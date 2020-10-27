import React from 'react';
import {
  Card,
  CardHeader,
  CardBody,
  HeadingText,
  Spinner,
  Grid,
  GridItem,
  Stack,
  StackItem,
  Spacing,
  Table,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TableRowCell,
  Button,
  Tabs,
  TabsItem,
  BillboardChart,
  BlockText,
  Icon,
  Modal,
  TextField,
  Link,
  Select,
  SelectItem,
  UserStorageMutation,
} from 'nr1';
import { KNOWN_LABEL_COLORS } from './issueLabel';
import SettingsUI from './settings';
import Dashboard from './dashboard';
import UserSettingsQuery from './storageUtil';
import { client } from './graphql/ApolloClientInstance';
import NewRelicUsers from './data/userdata-sample.json';

const RELICS = Object.values(NewRelicUsers)
  .filter((u) => u.user_type === 'relic' || u.user_type === 'contractor')
  .map((u) => u.login)
  .sort();

export default class MaintainerDashboard extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      queryKey: 0,
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
                    labelOptions={Array.from(
                      KNOWN_LABEL_COLORS.entries()
                    ).map(([name, color]) => ({ name, color }))}
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
                  <Dashboard
                    client={gqlClient}
                    companyUsers={RELICS.concat(settings.users)}
                    scanRepos={settings.repos}
                    ignoreLabels={settings.labels}
                    ignoreUsers={settings.users}
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
                      labelOptions={Array.from(
                        KNOWN_LABEL_COLORS.entries()
                      ).map(([name, color]) => ({ name, color }))}
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
