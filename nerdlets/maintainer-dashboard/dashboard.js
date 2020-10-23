import React from 'react';
import PropTypes from 'prop-types';
import { client } from './graphql/ApolloClientInstance';
import * as humanizeDuration from 'humanize-duration';
import BootstrapTable from 'react-bootstrap-table-next';
import filterFactory, {
  textFilter,
  selectFilter,
  dateFilter,
  Comparator,
  multiSelectFilter
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
  UserStorageMutation
} from 'nr1';
import { getGithubData } from './githubData';
import { IssueLabel } from './issueLabel';
import PullRequestLogo from './img/git-pull-request-16.svg';
import IssueLogo from './img/issue-opened-16.svg';

class IssueTable extends React.PureComponent {
  static propTypes = {
    items: PropTypes.arrayOf(PropTypes.object)
  };

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
            PullRequest: 'Pull Request'
          }
        })
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
        )
      },
      {
        dataField: 'repository.name',
        text: 'Repository',
        sort: true,
        sortCaret,
        filter: textFilter()
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
            largest: 1
          })
      },
      {
        dataField: 'author.login',
        text: 'User',
        sort: true,
        sortCaret,
        filter: textFilter()
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
          withoutEmptyOption: true
        }),
        filterValue: cell => cell.map(({ name }) => name),
        formatter: cell =>
          cell.map(({ name, color }) => (
            <IssueLabel key={name} name={name} color={color} />
          ))
      },
      {
        dataField: 'title',
        text: 'Title',
        filter: textFilter()
      }
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

export default class Dashboard extends React.Component {
  static propTypes = {
    client: PropTypes.object,
    scanRepos: PropTypes.arrayOf(PropTypes.string),
    companyUsers: PropTypes.arrayOf(PropTypes.string),
    ignoreUsers: PropTypes.arrayOf(PropTypes.string),
    ignoreLabels: PropTypes.arrayOf(PropTypes.string),
    staleTime: PropTypes.number
  };

  constructor(props) {
    super(props);
    this.state = {
      newSearchCount: null,
      newSearchItems: null,
      staleSearchCount: null,
      staleSearchItems: null
    };
  }

  async componentDidMount() {
    // send to UI
    this.setState(
      await getGithubData(this.props.client, {
        scanRepos: this.props.scanRepos,
        companyUsers: this.props.companyUsers.concat(this.props.ignoreUsers), // TODO: ignore users by adding them to the company users?
        ignoreLabels: this.props.ignoreLabels,
        staleTime: this.props.staleTime
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
            y: 'COUNT'
          }
        },
        data: [{ y: this.state.newSearchCount }]
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
        data: [{ y: this.state.staleSearchCount }]
      }
    ];
  }

  render() {
    return !this.state.newSearchItems || !this.state.staleSearchItems ? (
      <Spinner fillContainer style={{ height: '100%' }} />
    ) : (
      <Stack
        fullWidth
        horizontalType={Stack.HORIZONTAL_TYPE.FILL}
        directionType={Stack.DIRECTION_TYPE.VERTICAL}
      >
        <StackItem shrink>
          <Stack fullWidth gapType={Stack.GAP_TYPE.EXTRA_LARGE}>
            <StackItem>
              <Table
                compact
                items={this.props.scanRepos}
                style={{ width: '25em', height: '20em' }}
              >
                <TableHeader>
                  <TableHeaderCell value={({ item }) => item}>
                    Repository
                  </TableHeaderCell>
                </TableHeader>
                {({ item }) => (
                  <TableRow>
                    <TableRowCell>
                      <Link to={`https://github.com/${item}`}>{item}</Link>
                    </TableRowCell>
                  </TableRow>
                )}
              </Table>
            </StackItem>
            <StackItem grow>
              <BillboardChart data={this._getNumbers()} fullWidth />
            </StackItem>
          </Stack>
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
    );
  }
}
