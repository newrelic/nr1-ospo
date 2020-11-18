import React from 'react';
import PropTypes from 'prop-types';
import * as humanizeDuration from 'humanize-duration';
import {
  Spinner,
  Stack,
  StackItem,
  Table,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TableRowCell,
  Tabs,
  TabsItem,
  BillboardChart,
  Icon,
  Link,
  Tooltip,
} from 'nr1';
import { findDashboardItems } from '../graphql/githubData';
import IssueTable from './issueTable';

// TODO: figure out how to fix the tab labels from duplicating the key

/**
 * Given a set of repositories, uses githubData.findDashboardItems to query
 * GitHub for new/stale Issues/PRs and renders the result in a easily
 * digestible dashboard view.
 */
export default class DashboardData extends React.Component {
  static propTypes = {
    /**
     * Apollo GraphQL client used to retrieve data from GitHub. Must be
     * authenticated using a PAT.
     */
    client: PropTypes.object.isRequired,
    /** The list of repositories to scan, in `owner/repo` format. */
    scanRepos: PropTypes.arrayOf(PropTypes.string).isRequired,
    /**
     * A list of employees in the current company. This list is used by
     * findDashboardItems to determine the "newness" or "staleness" of an
     * Issue/PR.
     */
    companyUsers: PropTypes.arrayOf(PropTypes.string).isRequired,
    /** A list of GitHub Issue/PR labels to ignore items from. */
    ignoreLabels: PropTypes.arrayOf(PropTypes.string).isRequired,
    /**
     * A duration in milliseconds for an Issue/PR to wait before it is
     * considered stale
     */
    staleTime: PropTypes.number.isRequired,
    /** Pass through styles */
    style: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.state = {
      /**
       * A number indicating the total count of new items found, or null if data
       * is still being retrieved.
       */
      newSearchCount: null,
      /**
       * An array of "new" items retrieved from GitHub, or null if the data is
       * still being retrieved.
       */
      newSearchItems: null,
      /**
       * A number indicating the total count of stale items found, or null if
       * data is still being retrieved.
       */
      staleSearchCount: null,
      /**
       * An array of "stale" items retrieved from GitHub, or null if the data is
       * still being retrieved.
       */
      staleSearchItems: null,
    };
  }

  async componentDidMount() {
    // send to UI
    this.setState(
      await findDashboardItems(this.props.client, {
        scanRepos: this.props.scanRepos,
        companyUsers: this.props.companyUsers,
        ignoreLabels: this.props.ignoreLabels,
        staleTime: this.props.staleTime,
      })
    );
  }

  /**
   * Function translating `state.newSearchCount` and `state.staleSearchCount`
   * into a structure the billboard chart component understands.
   */
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
        style={this.props.style}
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
            {/* NOTE: label is meant to only accept a string, and giving it an object causes the key prop
              to be `[Object object]`. This was the only way I could get a tooltip to work though, so
              it'll have to do.*/}
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
