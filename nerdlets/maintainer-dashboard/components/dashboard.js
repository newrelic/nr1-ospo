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
} from 'nr1';
import SettingsUI from './settings';
import DashboardData from './dashboardData';
import UserSettingsQuery from '../util/storageUtil';
import { client } from '../graphql/ApolloClientInstance';
import NewRelicUsers from '../data/userdata-sample.json';

// TODO: remove
const RELICS = Object.values(NewRelicUsers)
  .filter((u) => u.user_type === 'relic' || u.user_type === 'contractor')
  .map((u) => u.login)
  .sort();

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
      /**
       * A state value used to force a refresh of the UserSettingsQuery
       * component when SettingsUI indicates an update was performed.
       */
      queryKey: 0,
      /** Boolean used to control the settings modal */
      settingsHidden: true,
    };
  }

  render() {
    return (
      <Card style={{ height: '100%' }}>
        <CardBody style={{ height: '100%' }}>
          <UserSettingsQuery key={this.state.queryKey}>
            {({ loading, token, settings }) => {
              if (loading)
                return <Spinner fillContainer style={{ height: '100%' }} />;
              // create apollo client and settings UI
              const gqlClient = client(token);
              // return settings selection front and center if we have no settings
              if (!token || !settings)
                return (
                  <SettingsUI
                    onSubmit={() =>
                      this.setState(({ queryKey }) => ({
                        settingsHidden: true,
                        queryKey: queryKey + 1,
                      }))
                    }
                    client={gqlClient}
                    style={{ maxWidth: '60em' }}
                  />
                );
              return (
                // else return the dashboard with a settings modal
                <>
                  <DashboardData
                    client={gqlClient}
                    companyUsers={RELICS.concat(settings.users)}
                    scanRepos={settings.repos}
                    ignoreLabels={settings.labels}
                    staleTime={settings.staleTime}
                  />
                  <Modal
                    hidden={this.state.settingsHidden}
                    onClose={() => this.setState({ settingsHidden: true })}
                    onHideEnd={() =>
                      this.setState(({ queryKey }) => ({
                        queryKey: queryKey + 1,
                      }))
                    }
                  >
                    <SettingsUI
                      onSubmit={() =>
                        this.setState(() => ({
                          settingsHidden: true,
                        }))
                      }
                      client={gqlClient}
                    />
                  </Modal>
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
            }}
          </UserSettingsQuery>
        </CardBody>
      </Card>
    );
  }
}
