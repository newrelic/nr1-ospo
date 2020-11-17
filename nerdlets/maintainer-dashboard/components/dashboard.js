import React from 'react';
import {
  Card,
  CardBody,
  Spinner,
  Stack,
  StackItem,
  Button,
  Icon,
  Modal,
  Link,
  BlockText,
  HeadingText,
  Select,
  SelectItem,
} from 'nr1';
import SettingsUI from './settings';
import DashboardData from './dashboardData';
import SettingsQuery from '../util/storageUtil';
import { client } from '../graphql/ApolloClientInstance';

/**
 * The root component of the maintainer dashboard (excluding the wrapper). This
 * component glues together the UserSettingsQuery, SettingsUI, and
 * DashboardData components into a unified structure.
 *
 * If you've arrived here curious about how this dashboard categorizes
 * Issues/PRs, I recommend you check out ./graphql/githubData.js.
 */
export default class MaintainerDashboard extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      /** Boolean used to control the settings modal */
      settingsHidden: true,
      /**
       * Place to cache the previous settings while new settings are being
       * refetched
       */
      currentSettings: null,
      /** The current PAT */
      currentToken: null,
      /** GraphQL client generated from the PAT */
      gqlClient: null,
      /** The current list of employee usernames */
      currentUsers: null,
      /** Indicates that the settings are currently being retrieved */
      loading: false,
    };
  }

  async componentDidMount() {
    await this.updateAll();
  }

  /** Update which profile is selected, writing it to nerdstorage */
  async updateSettingsIndex(index) {
    try {
      this.setState(({ currentSettings }) => ({
        currentSettings: { ...currentSettings, currentProfileIndex: index },
      }));
      SettingsQuery.writeSettings({ currentProfileIndex: index });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`Recieved error ${e} when updating the profile index.`);
    }
  }

  /** Update all dashboard-related data facets */
  async updateAll() {
    this.setState({ loading: true });
    try {
      const [currentToken, currentUsers, currentSettings] = await Promise.all([
        SettingsQuery.readToken(),
        SettingsQuery.readEmployeeData(),
        SettingsQuery.readSettings(),
      ]);
      this.setState({
        currentSettings,
        currentUsers,
        currentToken,
        gqlClient: client(currentToken),
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`Recieved error ${e} when fetching all data.`);
    }
    this.setState({ loading: false });
  }

  getDashboardBody() {
    // loading! display a spinner
    if (this.state.loading && !this.state.currentSettings)
      return <Spinner fillContainer style={{ height: '100%' }} />;
    // display a fatal error if the employee data could not be found
    if (!this.state.currentUsers)
      return (
        <div style={{ maxWidth: '60em' }}>
          <HeadingText spacingType={[HeadingText.SPACING_TYPE.MEDIUM]}>
            Error
          </HeadingText>
          <BlockText
            spacingType={[HeadingText.SPACING_TYPE.MEDIUM]}
            type={BlockText.TYPE.NORMAL}
          >
            Could not find employee metadata in NerdStorage. Employee metadata
            must be added to NerdStorage manually using the New Relic CLI during
            the setup process. Try refreshing the page, and if the error
            persists check out the{' '}
            <Link to="https://github.com/newrelic/nr1-ospo">
              project README
            </Link>
            for more information, or reach out to the team that deployed this
            NerdPack.
          </BlockText>
        </div>
      );
    // display only the settings editing UI if no settings or token is present
    if (!this.state.currentToken || !this.state.currentSettings)
      return (
        <SettingsUI
          onSubmit={() => this.updateAll()}
          client={this.state.gqlClient}
          currentToken={this.state.currentToken}
          currentSettings={this.state.currentSettings}
          style={{ maxWidth: '60em' }}
        />
      );
    // get the current profile
    const currentProfile = this.state.currentSettings.profileList[
      this.state.currentSettings.currentProfileIndex
    ];
    // display the dashboard in it's full hacky glory
    return (
      <>
        {this.state.loading ? (
          <Spinner fillContainer /> // TODO: fix this spinner to make it fill the container
        ) : (
          <DashboardData
            key={this.state.currentSettings.currentProfileIndex}
            client={this.state.gqlClient}
            companyUsers={this.state.currentUsers.concat(currentProfile.users)}
            scanRepos={currentProfile.repos}
            ignoreLabels={currentProfile.labels}
            staleTime={
              currentProfile.staleTimeValue * currentProfile.staleTimeUnit
            }
            style={{ marginTop: '32px' }}
          />
        )}
        <Modal
          hidden={this.state.settingsHidden}
          onClose={() => this.setState({ settingsHidden: true })}
          onHideEnd={() => this.updateAll()}
        >
          <SettingsUI
            onSubmit={() =>
              this.setState(() => ({
                settingsHidden: true,
              }))
            }
            client={this.state.gqlClient}
            currentToken={this.state.currentToken}
            currentSettings={this.state.currentSettings}
          />
        </Modal>
        <Select
          value={this.state.currentSettings.currentProfileIndex}
          onChange={(evt, value) => this.updateSettingsIndex(value)}
          className="ospo-profile"
          style={{
            position: 'absolute',
            left: '24px',
            top: '8px',
          }}
        >
          {this.state.currentSettings.profileList.map(({ profileName }, i) => (
            <SelectItem key={i} value={i}>
              {profileName}
            </SelectItem>
          ))}
        </Select>
        <Stack
          style={{
            position: 'absolute',
            right: '24px',
            top: '8px',
          }}
          directionType={Stack.DIRECTION_TYPE.HORIZONTAL}
        >
          <StackItem>
            <Button
              iconType={Icon.TYPE.PROFILES__EVENTS__COMMENT__A_EDIT}
              type={Button.TYPE.PLAIN}
              to="https://github.com/newrelic/nr1-ospo/issues/new/choose"
            >
              Submit an Issue
            </Button>
          </StackItem>
          <StackItem>
            <Button
              iconType={Icon.TYPE.INTERFACE__OPERATIONS__CONFIGURE}
              type={Button.TYPE.NORMAL}
              onClick={() => this.setState({ settingsHidden: false })}
            >
              Configure
            </Button>
          </StackItem>
        </Stack>
      </>
    );
  }

  render() {
    return (
      <Card style={{ height: '100%' }}>
        <CardBody style={{ height: '100%' }}>
          {this.getDashboardBody()}
        </CardBody>
      </Card>
    );
  }
}
