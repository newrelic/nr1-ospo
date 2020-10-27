import React from 'react';
import PropTypes from 'prop-types';
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
  Spinner,
  Stack,
  StackItem,
  Table,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TableRowCell,
  Button,
  Tabs,
  TabsItem,
  BillboardChart,
  Icon,
  Link,
  Tooltip,
} from 'nr1';
import { getGithubData } from './githubData';
import { IssueTable } from './issueTable';

export default class Dashboard extends React.Component {
  static propTypes = {
    client: PropTypes.object,
    scanRepos: PropTypes.arrayOf(PropTypes.string),
    companyUsers: PropTypes.arrayOf(PropTypes.string),
    ignoreUsers: PropTypes.arrayOf(PropTypes.string),
    ignoreLabels: PropTypes.arrayOf(PropTypes.string),
    staleTime: PropTypes.number,
  };

  constructor(props) {
    super(props);
    this.state = {
      newSearchCount: null,
      newSearchItems: null,
      staleSearchCount: null,
      staleSearchItems: null,
    };
  }

  async componentDidMount() {
    // send to UI
    this.setState(
      await getGithubData(this.props.client, {
        scanRepos: this.props.scanRepos,
        companyUsers: this.props.companyUsers.concat(this.props.ignoreUsers),
        ignoreLabels: this.props.ignoreLabels,
        staleTime: this.props.staleTime,
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
            <TabsItem
              label={
                <span>
                  New Items{' '}
                  <Tooltip text="Issues or PRs which have not received a response from an employee.">
                    <Icon type={Icon.TYPE.INTERFACE__INFO__HELP} />
                  </Tooltip>
                </span>
              }
              value="new"
            >
              <IssueTable items={this.state.newSearchItems} />
            </TabsItem>
            <TabsItem
              label={
                <span>
                  Stale Items{' '}
                  <Tooltip
                    text={`Issues or PRs which have received a response from an employee, but have not received an employee follow up for longer than ${humanizeDuration(
                      this.props.staleTime
                    )}.`}
                  >
                    <Icon type={Icon.TYPE.INTERFACE__INFO__HELP} />
                  </Tooltip>
                </span>
              }
              value="stale"
            >
              <IssueTable items={this.state.staleSearchItems} />
            </TabsItem>
          </Tabs>
        </StackItem>
      </Stack>
    );
  }
}
