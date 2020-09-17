import React from 'react';
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

const REPOS = ['newrelic/newrelic-ruby-agent', 'newrelic/repolinter-action'];
const TOKEN = '<redacted>';

function makeStatusQuery(repos) {
  const normalizeRepoNames = repos.map(r =>
    r
      .split('/')
      .pop()
      .replace(/-/g, '_')
  );
  return `
fragment GetPullRequests on SearchResultItemConnection {
  nodes {
    ... on PullRequest {
      title
    }
  }
  pageInfo {
    endCursor
    hasNextPage
  }
}

fragment GetIssues on SearchResultItemConnection {
  nodes {
    ... on Issue {
      title
    }
  }
  pageInfo {
    endCursor
    hasNextPage
  }
}

query {
  ${repos
    .map(
      (r, i) =>
        `${normalizeRepoNames[i]}_pr: search(query: "repo:${r} is:pr is:open no:assignee draft:false" type: ISSUE, first:100) {
        ...GetPullRequests
        issueCount
      }
      ${normalizeRepoNames[i]}_issue: search(query: "repo:${r} is:issue is:open no:assignee no:project" type: ISSUE, first:100) {
        ...GetIssues
        issueCount
      }`
    )
    .join('\n')}
}`;
}

export default class MaintainerDashboard extends React.Component {
  constructor(props) {
    super(props);
    this.state = { githubQuery: null };
  }

  async componentDidMount() {
    const query = makeStatusQuery(REPOS);
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      body: JSON.stringify({ query }),
      headers: {
        Authorization: `bearer ${TOKEN}`
      }
    });
    this.setState({ githubQuery: await res.json() });
  }

  render() {
    return (
      <div>
        <Card>
          <CardHeader title="Issues Need Attention" />
          <CardBody>
            {this.state.githubQuery === null ? (
              <Spinner />
            ) : (
              <div>
                <HeadingText type={HeadingText.TYPE.HEADING_1}>
                  {Object.entries(this.state.githubQuery.data)
                    .filter(([k, v]) => k.endsWith('_issue'))
                    .reduce((a, c) => a + c[1].issueCount, 0)}
                </HeadingText>
                <Table
                  items={Object.entries(this.state.githubQuery.data)
                    .filter(
                      ([k, v]) => k.endsWith('_issue') && v.nodes.length > 0
                    )
                    .flatMap(([k, v]) => v.nodes)
                    .map(v => {
                      return {
                        title: v.title
                      };
                    })}
                >
                  <TableHeader>
                    <TableHeaderCell
                      value={({ item }) => item.title}
                      width="100%"
                    >
                      Title
                    </TableHeaderCell>
                  </TableHeader>
                  {({ item }) => (
                    <TableRow>
                      <TableRowCell>{item.title}</TableRowCell>
                    </TableRow>
                  )}
                </Table>
              </div>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Pull Requests Need Attention" />
          <CardBody>
            {this.state.githubQuery === null ? (
              <Spinner />
            ) : (
              <div>
                <HeadingText type={HeadingText.TYPE.HEADING_1}>
                  {Object.entries(this.state.githubQuery.data)
                    .filter(([k, v]) => k.endsWith('_pr'))
                    .reduce((a, c) => a + c[1].issueCount, 0)}
                </HeadingText>
                <Table
                  items={Object.entries(this.state.githubQuery.data)
                    .filter(([k, v]) => k.endsWith('_pr') && v.nodes.length > 0)
                    .flatMap(([k, v]) => v.nodes)
                    .map(v => {
                      return {
                        title: v.title
                      };
                    })}
                >
                  <TableHeader>
                    <TableHeaderCell
                      value={({ item }) => item.title}
                      width="100%"
                    >
                      Title
                    </TableHeaderCell>
                  </TableHeader>
                  {({ item }) => (
                    <TableRow>
                      <TableRowCell>{item.title}</TableRowCell>
                    </TableRow>
                  )}
                </Table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    );
  }
}
