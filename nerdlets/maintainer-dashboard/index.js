/* eslint-disable prettier/prettier */
import React from 'react';
import { client } from './graphql/ApolloClientInstance';
import * as humanizeDuration from 'humanize-duration';
import BootstrapTable from 'react-bootstrap-table-next';
import filterFactory, {
  textFilter,
  selectFilter,
  dateFilter,
  Comparator,
  multiSelectFilter,
} from 'react-bootstrap-table2-filter';
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
import { getGithubData } from './githubData';
import { IssueLabel, KNOWN_LABEL_COLORS } from './issueLabel';
import SettingsUI from './settings';
import PullRequestLogo from './img/git-pull-request-16.svg';
import IssueLogo from './img/issue-opened-16.svg';
import NewRelicUsers from './data/userdata-sample.json';

const TOKEN = '<redacted>';

const STALE_TIME = 1000 * 60 * 60 * 24 * 14; // 2 weeks in ms

const RELICS = Object.values(NewRelicUsers)
  .filter(u => u.user_type === 'relic' || u.user_type === 'contractor')
  .map(u => u.login)
  .sort();

const REPOS = [
  'newrelic/go-agent',
  'newrelic/infrastructure-agent',
  'newrelic/newrelic-dotnet-agent',
  'newrelic/newrelic-python-agent',
  /* 'newrelic/newrelic-ruby-agent',
  'newrelic/node-newrelic',
  'newrelic/newrelic-java-agent',
  'newrelic/infrastructure-bundle',
  'newrelic/java-log-extensions',
  'newrelic/newrelic-logenricher-dotnet',
  'newrelic/newrelic-monolog-logenricher-php',
  'newrelic/newrelic-winston-logenricher-node',
  'newrelic/node-newrelic-aws-sdk',
  'newrelic/node-newrelic-koa',
  'newrelic/node-newrelic-mysql',
  'newrelic/node-newrelic-superagent',
  'newrelic/nri-apache',
  'newrelic/nri-cassandra',
  'newrelic/nri-consul',
  'newrelic/nri-couchbase',
  'newrelic/nri-discovery-kubernetes',
  'newrelic/nri-docker',
  'newrelic/nri-ecs',
  'newrelic/nri-elasticsearch',
  'newrelic/nri-f5',
  'newrelic/nri-flex',
  'newrelic/nri-haproxy',
  'newrelic/nri-jmx',
  'newrelic/nri-kafka',
  'newrelic/nri-kube-events',
  'newrelic/nri-kubernetes',
  'newrelic/nri-memcached',
  'newrelic/nri-mongodb',
  'newrelic/nri-mssql',
  'newrelic/nri-mysql',
  'newrelic/nri-nagios',
  'newrelic/nri-nginx',
  'newrelic/nri-oracledb',
  'newrelic/nri-postgresql',
  'newrelic/nri-prometheus',
  'newrelic/nri-rabbitmq',
  'newrelic/nri-redis',
  'newrelic/nri-snmp',
  'newrelic/nri-statsd',
  'newrelic/nri-varnish',
  'newrelic/nri-vsphere',
  'newrelic/nri-winservices',
  'newrelic/aws-log-ingestion',
  'newrelic/k8s-metadata-injection',
  'newrelic/k8s-webhook-cert-manager' */
];

class IssueTable extends React.PureComponent {
  constructor(props) {
    super(props);
  }

  render() {
    const sortCaret = order => {
      let type;
      if (order === 'asc') type = Icon.TYPE.INTERFACE__ARROW__ARROW_TOP;
      else if (order === 'desc')
        type = Icon.TYPE.INTERFACE__ARROW__ARROW_BOTTOM;
      else type = Icon.TYPE.INTERFACE__ARROW__ARROW_VERTICAL;
      return (
        <Button
          sizeType={Button.SIZE_TYPE.SMALL}
          type={Button.TYPE.PLAIN}
          iconType={type}
          style={{ float: 'right' }}
        />
      );
    };

    const allLabels = Array.from(
      new Map(
        this.props.items.flatMap(i => i.labels.nodes.map(l => [l.name, l]))
      ).values()
    );

    const columns = [
      {
        dataField: '__typename',
        text: 'Type',
        sort: true,
        sortCaret,
        formatter: cell => (
          <img
            src={cell === 'Issue' ? IssueLogo : PullRequestLogo}
            style={{ marginRight: '40px' }}
          />
        ),
        filter: selectFilter({
          options: {
            Issue: 'Issue',
            PullRequest: 'Pull Request',
          },
        }),
      },
      {
        dataField: 'url',
        text: 'Link',
        formatter: (cell, row) => (
          <Button
            type={Button.TYPE.NORMAL}
            iconType={Button.ICON_TYPE.INTERFACE__OPERATIONS__EXTERNAL_LINK}
            onClick={() => window.open(cell, '_blank')}
          >
            #{row.number}
          </Button>
        ),
      },
      {
        dataField: 'repository.name',
        text: 'Repository',
        sort: true,
        sortCaret,
        filter: textFilter(),
      },
      {
        dataField: 'createdAt',
        text: 'Open',
        sort: true,
        sortValue: cell => Date.now() - new Date(cell).getTime(),
        sortCaret,
        type: 'date',
        filter: dateFilter({}),
        formatter: cell =>
          humanizeDuration(Date.now() - new Date(cell).getTime(), {
            largest: 1,
          }),
      },
      {
        dataField: 'author.login',
        text: 'User',
        sort: true,
        sortCaret,
        filter: textFilter(),
      },
      {
        dataField: 'labels.nodes',
        text: 'Labels',
        filter: multiSelectFilter({
          comparator: Comparator.LIKE,
          options: allLabels.reduce((a, { name }) => {
            a[name] = name;
            return a;
          }, {}),
          withoutEmptyOption: true,
        }),
        filterValue: cell => cell.map(({ name }) => name),
        formatter: cell =>
          cell.map(({ name, color }) => <IssueLabel key={name} name={name} color={color} />),
      },
      {
        dataField: 'title',
        text: 'Title',
        filter: textFilter(),
      },
    ];

    return (
      <>
        <BootstrapTable
          keyField="id"
          data={this.props.items}
          columns={columns}
          defaultSorted={[{ dataField: 'createdAt', order: 'asc' }]}
          rowStyle={{ whiteSpace: 'nowrap' }}
          headerClasses="ospo-tableheader"
          filter={filterFactory()}
        />
      </>
    );
  }
}

export default class MaintainerDashboard extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      newSearchCount: null,
      newSearchItems: null,
      staleSearchCount: null,
      staleSearchItems: null,
      settingsHidden: true,
    };
    this.client = client(TOKEN);
  }

  async componentDidMount() {
    // send to UI
    this.setState(
      await getGithubData(this.client, {
        repos: REPOS,
        users: RELICS,
        staleTime: STALE_TIME,
      })
    );
  }

  _getNumbers() {
    return [
      {
        metadata: {
          id: 'new-item',
          name: 'New Items',
          viz: 'main',
          units_data: {
            y: 'COUNT',
          },
        },
        data: [{ y: this.state.newSearchCount }],
      },
      {
        metadata: {
          id: 'stale-items',
          name: 'Stale Items',
          viz: 'main',
          units_data: {
            y: 'COUNT',
          },
        },
        data: [{ y: this.state.staleSearchCount }],
      },
    ];
  }

  render() {
    return (
      <div>
        <Modal hidden={this.state.settingsHidden} onClose={() => this.setState({ settingsHidden: true })}>
          <SettingsUI
            client={this.client}
            labelOptions={Array.from(KNOWN_LABEL_COLORS.entries()).map(([name, color]) => ({name, color}))} 
            onSubmit={() => this.setState({ settingsHidden: true })} />
        </Modal>
        {!this.state.newSearchItems || !this.state.staleSearchItems ? (
          <Spinner fillContainer style={{ height: '100vh' }} />
        ) : (
          <>
            <Card>
              <CardBody>
                <Stack
                  fullWidth
                  horizontalType={Stack.HORIZONTAL_TYPE.FILL}
                  directionType={Stack.DIRECTION_TYPE.VERTICAL}
                >
                  <StackItem>
                    <BillboardChart data={this._getNumbers()} fullWidth />
                  </StackItem>
                  <StackItem>
                    <Tabs default="new">
                      <TabsItem label="New Items" value="new">
                        <IssueTable items={this.state.newSearchItems} />
                      </TabsItem>
                      <TabsItem label="Stale Items" value="stale">
                        <IssueTable items={this.state.staleSearchItems} />
                      </TabsItem>
                    </Tabs>
                  </StackItem>
                </Stack>
              </CardBody>
            </Card>
            <Stack
              style={{
                position: 'absolute',
                right: '24px',
                top: '8px' 
              }}
              directionType={Stack.DIRECTION_TYPE.HORIZONTAL}>
              <StackItem>
                <Button 
                  iconType={Icon.TYPE.PROFILES__EVENTS__COMMENT__A_EDIT}
                  type={Button.TYPE.PLAIN}
                  to="https://github.com/newrelic/nr1-ospo/issues/new/choose">
                  Submit an Issue
                </Button>
              </StackItem>
              <StackItem>
                <Button 
                  iconType={Icon.TYPE.INTERFACE__OPERATIONS__CONFIGURE}
                  type={Button.TYPE.NORMAL}
                  onClick={() => this.setState({ settingsHidden: false })}>
                  Configure
                </Button>
              </StackItem>
            </Stack>  
          </>
        )}
      </div>
    );
  }
}
