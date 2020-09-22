/* eslint-disable prettier/prettier */
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

const REPOS = [
  'newrelic/newrelic-ruby-agent',
  'newrelic/repolinter-action',
  // 'kubernetes/kubernetes'
];
const TOKEN = '<redacted>';

function normalizeRepoName(repoName) {
  return repoName
    .split('/')
    .pop()
    .replace(/-/g, '_');
}

function makeSearchQuery(repoName, suffix, fragmentName, type, pageToken = null) {
  return {
    key: `${normalizeRepoName(repoName)}${suffix}`,
    query: `${normalizeRepoName(
      repoName
    )}${suffix}: search(query: "repo:${repoName} is:${type} is:open no:assignee no:project" type: ISSUE first:100 ${
      pageToken ? `after:"${pageToken}"` : ''
    }) {
    ...${fragmentName}
    issueCount
    }`
  };
}

function makeStatusQuery(repos, pageTokens = null) {
  const prFragment = `fragment GetPullRequests on SearchResultItemConnection {
nodes {
  ... on PullRequest {
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
  }
}
pageInfo {
  endCursor
  hasNextPage
}
}`

const issueFragment = `fragment GetIssues on SearchResultItemConnection {
nodes {
  ... on Issue {
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
  }
}
pageInfo {
  endCursor
  hasNextPage
}
}`;

  const validRepos = repos.filter((_r, i) => !pageTokens || pageTokens[i])
  const issueQueries = validRepos
    .map((r, i) =>
    !pageTokens || (pageTokens[i] && pageTokens[i].issue) ?
      makeSearchQuery(
        r,
        '_issue',
        'GetIssues',
        'issue',
        pageTokens && pageTokens[i] && pageTokens[i].issue
      )
      : null
    );
  const prQueries = repos
    .filter((_r, i) => !pageTokens || (pageTokens[i] && pageTokens[i].pr))
    .map((r, i) =>
      !pageTokens || (pageTokens[i] && pageTokens[i].pr) ?
      makeSearchQuery(
        r,
        '_pr',
        'GetPullRequests',
        'pr',
        pageTokens && pageTokens[i] && pageTokens[i].pr
      )
      : null
    );
  const joinedQueries = issueQueries
    .concat(prQueries)
    .filter(q => q)
    .map(q => q.query)
    .join('\n');
  const meta = Object.fromEntries(repos.map((r, i) => [r, { issueName: issueQueries[i] && issueQueries[i].key, prName: prQueries[i] && prQueries[i].key }]))

  return {
    query: `${issueQueries.some(i => i) ? issueFragment : ''}
    ${prQueries.some(p => p) ? prFragment : ''}
    query {
      ${joinedQueries}
      rateLimit {
        limit
        cost
        remaining
        resetAt
      }
    }`,
    meta,
  };
}

class ItemInfo extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = { data: props.data, title: props.title };
  }

  render() {
    return (
      <Card>
        <CardHeader title={this.state.title} />
        <CardBody>
          <HeadingText type={HeadingText.TYPE.HEADING_1}>
            {this.state.data.length}
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
    this.state = { githubQuery: null };
  }

  async componentDidMount() {
    // extract page tokens and pagnate
    let curRepos = REPOS;
    let json = null;
    let curTokens = null;
    do {
      const pageQuery = makeStatusQuery(curRepos, curTokens);
      const pageRes = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        body: JSON.stringify({ query: pageQuery.query }),
        headers: {
          Authorization: `bearer ${TOKEN}`
        }
      });
      const pageJson = await pageRes.json();
      if (!pageJson || !pageJson.data)
        throw new Error(`Bad data: ${JSON.stringify(pageJson)} query: ${pageQuery.query}`);
      if (!json) json = pageJson
      else {
        // merge nodes for each search result
        for (const repo of curRepos) {
          const {issueName, prName} = pageQuery.meta[repo];
          if (issueName) json.data[issueName].nodes = json.data[issueName].nodes.concat(pageJson.data[issueName].nodes);
          if (prName) json.data[prName].nodes = json.data[prName].nodes.concat(pageJson.data[prName].nodes);
        }
      }
      // get the tokens for the next fetch
      const tokens = curRepos
        .map(r => pageQuery.meta[r])
        .map(({issueName, prName}) => {
          let issue = null;
          if (issueName && pageJson.data[issueName].pageInfo.hasNextPage)
            issue = pageJson.data[issueName].pageInfo.endCursor;
          let pr = null;
          if (prName && pageJson.data[prName].pageInfo.hasNextPage)
            pr = pageJson.data[prName].pageInfo.endCursor;
          if (issue || pr)
            return {
              issue,
              pr
            };
          else
            return null;
        })
      curRepos = curRepos.filter((_r, i) => tokens[i])
      curTokens = tokens.filter(t => t);
      // print rate limit
      console.log(JSON.stringify(pageJson.data.rateLimit));
    } while(curRepos.length > 0);
    this.setState({ githubQuery: json });
  }

  render() {
    return (
      <div>
        {this.state.githubQuery === null ? (
          <Spinner />
        ) : (
          <div>
            <ItemInfo
              title="Pull Requests Need Attention"
              data={Object.entries(this.state.githubQuery.data)
                .filter(([k, v]) => k.endsWith('_pr') && v.nodes.length > 0)
                .flatMap(([k, v]) => v.nodes)}
            />
            <ItemInfo
              title="Issues Need Attention"
              data={Object.entries(this.state.githubQuery.data)
                .filter(([k, v]) => k.endsWith('_issue') && v.nodes.length > 0)
                .flatMap(([k, v]) => v.nodes)}
            />
          </div>
        )}
      </div>
    );
  }
}
