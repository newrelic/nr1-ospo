/* eslint-disable prettier/prettier */
import React from 'react';
import { Query, ApolloProvider } from 'react-apollo';
import ErrorMessage from './graphql/ErrorMessage';
import { client } from './graphql/ApolloClientInstance';
import gql from 'graphql-tag';
import {
  Card,
  CardHeader,
  CardBody,
  HeadingText,
  Spinner,
  Table,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TableRowCell
} from 'nr1';

const REPOS = [
  'newrelic/newrelic-ruby-agent',
  'newrelic/repolinter-action',
  'kubernetes/kubernetes'
];
const TOKEN = '';

const ISSUE_FRAGMENT = gql`
fragment GetIssueInfo on Issue {
  title
  author {
    login
    url
  }
  repository {
    name
    url
  }
  number
  url
  createdAt
  comments(first: 1) {
    nodes {
      ... on IssueComment {
        author {
          login
        }
        bodyText
      }
    }
  }
}`;

const PR_FRAGMENT = gql`
fragment GetPRInfo on PullRequest {
  title
  author {
    login
    url
  }
  repository {
    name
    url
  }
  number
  url
  createdAt
  comments(first: 1) {
    nodes {
      ... on IssueComment {
        author {
          login
        }
        bodyText
      }
    }
  }
}`;

const SEARCH_ITEM_QUERY = gql`
query CountPRSearchResults($query: String!) {
  search(query: $query, type: ISSUE, first: 100) {
    nodes {
      ...GetIssueInfo
      ...GetPRInfo
    }
    issueCount
    pageInfo {
      endCursor
      hasNextPage
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

class ItemInfo extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = { data: props.data, totalCount: props.totalCount, title: props.title };
  }

  render() {
    return (
      <Card>
        <CardHeader title={this.state.title} />
        <CardBody>
          <HeadingText type={HeadingText.TYPE.HEADING_1}>
            {this.state.totalCount}
          </HeadingText>
          <Table items={this.state.data}>
            <TableHeader>
              <TableHeaderCell value={({ item }) => item.title} width="30%">
                Title
              </TableHeaderCell>
              <TableHeaderCell
                value={({ item }) => item.repository.name}
                width="20%"
              >
                Repo
              </TableHeaderCell>
              <TableHeaderCell
                value={({ item }) => item.author && item.author.login}
                width="10%"
              >
                Created By
              </TableHeaderCell>
              <TableHeaderCell value={({ item }) => item.createdAt} width="20%">
                Created At
              </TableHeaderCell>
              <TableHeaderCell value={({ item }) => item.comments.nodes[0]?.bodyText?.split('\n')?.pop() } width="20%">
                Last Comment
              </TableHeaderCell>
            </TableHeader>
            {({ item }) => (
              <TableRow>
                <TableRowCell onClick={() => window.open(item.url, '_blank')}>
                  {item.title}
                </TableRowCell>
                <TableRowCell
                  onClick={() => window.open(item.repository.url, '_blank')}
                >
                  {item.repository.name}
                </TableRowCell>
                <TableRowCell
                  onClick={() => window.open(item.author.url, '_blank')}
                >
                  {item.author && item.author.login}
                </TableRowCell>
                <TableRowCell>{item.createdAt}</TableRowCell>
                <TableRowCell>{item.comments.nodes[0]?.bodyText?.split('\n')?.pop()}</TableRowCell>
              </TableRow>
            )}
          </Table>
        </CardBody>
      </Card>
    );
  }
}

export default class MaintainerDashboard extends React.Component {
  constructor(props) {
    super(props);
    this.state = { issueCount: null, prCount: null, issueList: null, prList: null };
    this.client = client(TOKEN);
  }

  async componentDidMount() {
    const issueList = async () => {
      const arr = await Promise.all(REPOS.map(async r => this.client.query({
        query: SEARCH_ITEM_QUERY, 
        variables: { query: `repo:${r} is:issue is:open no:assignee no:project` }
      })));
      this.setState({ 
        issueCount: arr.reduce((a, c) => a + c.data.search.issueCount, 0),
        issueList: arr.reduce((a, c) => a.concat(c.data.search.nodes), []),
      })
    };
    const prList = async () => {
      const arr = await Promise.all(REPOS.map(async r => this.client.query({
        query: SEARCH_ITEM_QUERY, 
        variables: { query: `repo:${r} is:pr is:open no:assignee no:project` }
      })));
      this.setState({ 
        prCount: arr.reduce((a, c) => a + c.data.search.issueCount, 0),
        prList: arr.reduce((a, c) => a.concat(c.data.search.nodes), [])
      })
    };
    await Promise.all([issueList(), prList()]);
  }

  render() {
    return (
      <div>
        {this.state.prList !== null ?
          <ItemInfo
            title="Pull Requests Need Attention"
            data={this.state.prList}
            totalCount={this.state.prCount}
          />
          : <Spinner />
         }
        {this.state.issueList !== null ?
          <ItemInfo
            title="Issues Need Attention"
            data={this.state.issueList}
            totalCount={this.state.issueCount}
          />
          : <Spinner />
        }
      </div>
    );
  }
}
