/* eslint-disable prettier/prettier */
import React from 'react';
import { Query, ApolloProvider } from 'react-apollo';
import ErrorMessage from './graphql/ErrorMessage';
import { client } from './graphql/ApolloClientInstance';
import gql from 'graphql-tag';
import * as humanizeDuration from 'humanize-duration';
import BootstrapTable from 'react-bootstrap-table-next';
import filterFactory, { textFilter, selectFilter, dateFilter, Comparator, multiSelectFilter } from 'react-bootstrap-table2-filter';
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
  Icon
} from 'nr1';
import PullRequestLogo from './img/git-pull-request-16.svg';
import IssueLogo from './img/issue-opened-16.svg';
import NewRelicUsers from './data/userdata-sample.json';

const RELICS = Object.values(NewRelicUsers)
  .filter(u => u.user_type === 'relic' || u.user_type === 'contractor')
  .map(u => u.login);

const STALE_TIME = 1000 * 60 * 60 * 24 * 14; // 2 weeks in ms

const KNOWN_LABEL_COLORS = new Map([
  ['bug', 'd73a4a'],
  ['documentation', '0075ca'],
  ['duplicate', 'cfd3d7'],
  ['enhancement', 'a2eeef'],
  ['good first issue', '7057ff'],
  ['help wanted', '008672'],
  ['invalid', 'e4e669'],
  ['question', 'd876e3'],
  ['wontfix', 'ffffff'],
  ['dependencies', '0366d6'],
  ['repolinter', 'fbca04']
])

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
]
const TOKEN = '<redacted>';

// TODO: split query into search + virtualized table to improve caching
const ISSUE_FRAGMENT = gql`
fragment GetIssueInfo on Issue {
  id
  title
  author {
    login
    url
  }
  repository {
    name
    url
  }
  labels(first: 100 orderBy: {field: NAME, direction: ASC}) {
    nodes {
      name
      color
    }
  }
  number
  url
  createdAt
}`;

const PR_FRAGMENT = gql`
fragment GetPRInfo on PullRequest {
  id
  title
  author {
    login
    url
  }
  repository {
    name
    url
  }
  labels(first: 100 orderBy: {field: NAME, direction: ASC}) {
    nodes {
      name
      color
    }
  }
  number
  url
  createdAt
}`;

const SEARCH_NEW_ITEMS_QUERY = gql`
query SearchResults($query: String!) {
  search(query: $query, type: ISSUE, first: 100) {
    nodes {
      __typename
      ...GetIssueInfo
      ...GetPRInfo
    }
    issueCount
  }
  rateLimit {
    limit
    cost
    remaining
    resetAt
  }
}
${PR_FRAGMENT}
${ISSUE_FRAGMENT}`;

const SEARCH_STALE_ITEMS_QUERY = gql`
query SearchResults($queryDefStale: String! $queryMaybeStale: String! $timeSince: DateTime!) {
  definitelyStale: search(query: $queryDefStale type: ISSUE first: 100) {
    issueCount
    nodes {
      __typename
      ...GetIssueInfo
      ...GetPRInfo
    }
  }
  maybeStale: search(query: $queryMaybeStale type: ISSUE first: 100) {
    issueCount
    nodes {
      __typename
      ...GetIssueInfo
      ...GetPRInfo
      ... on Issue {
        timelineItems(since: $timeSince last:100) {
          nodes {
            ... on Comment {
              id
              author {
                login
              }
              updatedAt
            }
          }
        }
      }
      ... on PullRequest {
        timelineItems(since: $timeSince last:100) {
          nodes {
            ... on Comment {
              id
              author {
                login
              }
              updatedAt
            }
          }
        }
      }
    }
  }
  rateLimit {
    limit
    cost
    remaining
    resetAt
  }
}
${PR_FRAGMENT}
${ISSUE_FRAGMENT}`;

// stolen from https://stackoverflow.com/questions/3942878/how-to-decide-font-color-in-white-or-black-depending-on-background-color
function pickTextColorBasedOnBgColor(bgColor, lightColor, darkColor) {
  const color = (bgColor.charAt(0) === '#') ? bgColor.substring(1, 7) : bgColor;
  const r = parseInt(color.substring(0, 2), 16); // hexToR
  const g = parseInt(color.substring(2, 4), 16); // hexToG
  const b = parseInt(color.substring(4, 6), 16); // hexToB
  return (((r * 0.299) + (g * 0.587) + (b * 0.114)) > 186) ?
    darkColor : lightColor;
}

function makeNewSearch(users, repos) {
  return `${repos.map(r => `repo:${r}`).join(' ')} ${users.map(u => `-author:${u} -commenter:${u}`).join(' ')} is:open`
}

function makeDefStaleSearch(users, repos, date) {
  return `${repos.map(r => `repo:${r}`).join(' ')} ${users.map(u => `-author:${u} commenter:${u}`).join(' ')} is:open updated:<=${date.toISOString()}`
}

function makeMaybeStaleSearch(users, repos, date) {
  return `${repos.map(r => `repo:${r}`).join(' ')} ${users.map(u => `-author:${u} commenter:${u}`).join(' ')} is:open updated:>${date.toISOString()} created:<=${date.toISOString()}`
}

class IssueTable extends React.PureComponent {
  constructor(props) {
    super(props);
  }

  render() {
    const sortCaret = order => {
      let type;
      if (order === 'asc') type = Icon.TYPE.INTERFACE__ARROW__ARROW_TOP
      else if (order === 'desc') type = Icon.TYPE.INTERFACE__ARROW__ARROW_BOTTOM
      else type = Icon.TYPE.INTERFACE__ARROW__ARROW_VERTICAL
      return <Button sizeType={Button.SIZE_TYPE.SMALL} type={Button.TYPE.PLAIN} iconType={type} style={{ float: 'right' }} />
    }

    const allLabels = Array.from(new Map(this.props.items.flatMap(i => i.labels.nodes.map(l => [l.name, l]))).values())

    const columns = [
      {
        dataField: '__typename',
        text: 'Type',
        sort: true,
        sortCaret,
        formatter: cell => <img src={cell === "Issue" ? IssueLogo : PullRequestLogo} style={{ marginRight: '40px' }} />,
        filter: selectFilter({
          options: {
            Issue: 'Issue',
            PullRequest: 'Pull Request'
          },
        })
      },
      {
        dataField: 'url',
        text: 'Link',
        formatter: (cell, row) => 
          <Button
            type={Button.TYPE.NORMAL}
            iconType={Button.ICON_TYPE.INTERFACE__OPERATIONS__EXTERNAL_LINK}
            onClick={() => window.open(cell, '_blank')}>
              #{row.number}
          </Button>
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
        formatter: cell => humanizeDuration(Date.now() - new Date(cell).getTime(), { largest: 1 })
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
          options: allLabels.reduce((a, {name}) => { a[name] = name; return a; }, {}),
          withoutEmptyOption: true,
        }),
        filterValue: cell => cell.map(({name}) => name),
        formatter: cell =>
          cell.map(({name, color}) => {
            const bgColor = KNOWN_LABEL_COLORS.has(name) ? KNOWN_LABEL_COLORS.get(name) : color;
            return (
                <span
                  key={name} 
                  style={{
                    padding: '0 7px',
                    border: '1px solid transparent',
                    borderRadius: '2em',
                    marginRight: '6px',
                    backgroundColor: `#${bgColor}`,
                    boxSizing: 'border-box',
                    display: 'inline-block',
                  }}>
                  <BlockText
                    type={BlockText.TYPE.PARAGRAPH}
                    tagType={BlockText.TYPE.P}
                    style={{
                      fontSize: '12px',
                      fontWeight: '500',
                      lineHeight: '18px',
                      color: pickTextColorBasedOnBgColor(bgColor, '#ffffff', '#000000'),
                      display: 'inline-block',
                      boxSizing: 'border-box',
                    }}>
                    {name}
                  </BlockText>
                </span>         
            )
          })
      },
      {
        dataField: 'title',
        text: 'Title',
        filter: textFilter()
      },
    ]

    return (
      <>
      <BootstrapTable 
        keyField='id' 
        data={ this.props.items }
        columns={ columns } 
        defaultSorted={[{ dataField: 'createdAt', order: 'asc' }]}
        rowStyle={{ whiteSpace: 'nowrap' }}
        headerClasses='ospo-tableheader'
        filter={ filterFactory() } />
      </>
    )
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
    };
    this.client = client(TOKEN);
  }

  async componentDidMount() {
    const staleTime = new Date(Date.now() - STALE_TIME);
    // fetch all the data
    const [newRes, staleRes] = await Promise.all([
      this.client.query({
        query: SEARCH_NEW_ITEMS_QUERY,
        variables: { query: makeNewSearch(RELICS, REPOS) }
      }),
      this.client.query({
        query: SEARCH_STALE_ITEMS_QUERY,
        variables: { queryDefStale: makeDefStaleSearch(RELICS, REPOS, staleTime), queryMaybeStale: makeMaybeStaleSearch(RELICS, REPOS, staleTime), timeSince: staleTime.toISOString() }
      })
    ])
    // filter the stale data to only the actually stale items
    const nrSet = new Set(RELICS)
    // if every comment by a relic is stale, then the issue is stale
    // TODO: filter timeline events for interactions
    const filteredMaybeItems = staleRes.data.maybeStale.nodes.filter(n =>
      n.timelineItems.nodes.every(c => (c?.author && nrSet.has(c.author.login)) ? new Date(c.updatedAt) <= staleTime : true))
    // send to UI
    this.setState({ 
      newSearchCount: Math.max(newRes.data.search.issueCount, newRes.data.search.nodes.length), 
      newSearchItems: newRes.data.search.nodes, 
      staleSearchCount: Math.max(staleRes.data.definitelyStale.issueCount, staleRes.data.definitelyStale.nodes.length) + filteredMaybeItems.length, 
      staleSearchItems: staleRes.data.definitelyStale.nodes.concat(filteredMaybeItems)
    })
  }

  _getNumbers() {
    return [
      {
        metadata: {
          id: 'new-item',
          name: 'New Items',
          viz: 'main',
          units_data: {
            y: 'COUNT'
          }
        },
        data: [
          { y: this.state.newSearchCount }
        ]
      },
      {
        metadata: {
          id: 'stale-items',
          name: 'Stale Items',
          viz: 'main',
          units_data: {
            y: 'COUNT'
          }
        },
        data: [
          { y: this.state.staleSearchCount }
        ]
      },
    ]
  }

  render() {
    return ( 
      <div>
        {
          !this.state.newSearchItems || !this.state.staleSearchItems
          ? <Spinner fillContainer style={{ height: '100vh' }} />
          : (
            <Card>
              <CardBody>
                <Stack
                  fullWidth
                  horizontalType={Stack.HORIZONTAL_TYPE.FILL}
                  directionType={Stack.DIRECTION_TYPE.VERTICAL}>
                  <StackItem>
                    <Grid>
                      <GridItem columnSpan={3}>
                        <Table compact style={{height: '200px'}} items={[{ first: true, repo: null }].concat(REPOS.map(repo => { return { repo }}))}>
                          <TableHeader>
                            <TableHeaderCell value={() => 'delete'} width='80px'/>
                            <TableHeaderCell value={({ item }) => item.repo}>
                              Repositories
                            </TableHeaderCell>
                          </TableHeader>
                          {({ item }) => item.first
                           ? (
                            <TableRow>
                              <TableRowCell />
                              <TableRowCell>
                                <Button
                                  type={Button.TYPE.PLAIN}
                                  iconType={Button.ICON_TYPE.INTERFACE__SIGN__PLUS}
                                  onClick={() => {}}>
                                  Add another repository
                                </Button>
                              </TableRowCell>
                            </TableRow>
                           ) : (
                            <TableRow>
                              <TableRowCell>
                              <Button
                                  type={Button.TYPE.PLAIN}
                                  iconType={Button.ICON_TYPE.INTERFACE__OPERATIONS__TRASH}
                                  onClick={() => {}} />
                              </TableRowCell>
                              <TableRowCell>
                                {item.repo}
                              </TableRowCell>
                            </TableRow>
                          )}
                        </Table>
                      </GridItem>
                      <GridItem columnSpan={9}>
                        <BillboardChart data={this._getNumbers()} fullWidth />
                      </GridItem>
                    </Grid>
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
          )
        }
      </div>
    );
  }
}
