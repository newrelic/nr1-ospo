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
import { Button, Icon } from 'nr1';
import IssueLabel from './issueLabel';

/**
 * Implementation of a Issue/PR list using react-bootstrap-table2. Includes
 * filtering, sorting, and autolinking to the respective GitHub page.
 */
export default class IssueTable extends React.PureComponent {
  static propTypes = {
    /**
     * A list of Issues and PRs. The structure of each object is defined in
     * ISSUE_FRAGMENT and PR_FRAGMENT in githubData.js. Ensure that the
     * __typename key is included in each object so the table can differentiate
     * between Issue and PR objects.
     */
    items: PropTypes.arrayOf(PropTypes.object).isRequired,
  };

  render() {
    // function to replace the default sort caret icons with NR ones
    const sortCaret = (order) => {
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

    // enumerate all labels present in the items array
    // do this by adding every label from every item into a Map,
    // thereby leaving a list of unique labels.
    const allLabels = Array.from(
      new Map(
        this.props.items.flatMap((i) => i.labels.nodes.map((l) => [l.name, l]))
      ).values()
    );

    // configuration for react-boostrap-table2 columns
    const columns = [
      {
        dataField: '__typename',
        text: 'Type',
        sort: true,
        sortCaret,
        formatter: (cell) => (
          <img
            className={cell === 'Issue' ? 'ospo-issue-logo' : 'ospo-pr-logo'}
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
        sortValue: (cell) => Date.now() - new Date(cell).getTime(),
        sortCaret,
        type: 'date',
        filter: dateFilter({}),
        formatter: (cell) =>
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
        filterValue: (cell) => cell.map(({ name }) => name),
        formatter: (cell) =>
          cell.map(({ name, color }) => (
            <IssueLabel key={name} name={name} color={color} />
          )),
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
          /* see styles.scss */
          headerClasses="ospo-tableheader"
          filter={filterFactory()}
        />
      </>
    );
  }
}
