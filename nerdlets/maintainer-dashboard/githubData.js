import gql from 'graphql-tag';

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
    labels(first: 100, orderBy: { field: NAME, direction: ASC }) {
      nodes {
        name
        color
      }
    }
    number
    url
    createdAt
  }
`;

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
    labels(first: 100, orderBy: { field: NAME, direction: ASC }) {
      nodes {
        name
        color
      }
    }
    number
    url
    createdAt
  }
`;

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
  ${ISSUE_FRAGMENT}
`;

const SEARCH_STALE_ITEMS_QUERY = gql`
  query SearchResults(
    $queryDefStale: String!
    $queryMaybeStale: String!
    $timeSince: DateTime!
  ) {
    definitelyStale: search(query: $queryDefStale, type: ISSUE, first: 100) {
      issueCount
      nodes {
        __typename
        ...GetIssueInfo
        ...GetPRInfo
      }
    }
    maybeStale: search(query: $queryMaybeStale, type: ISSUE, first: 100) {
      issueCount
      nodes {
        __typename
        ...GetIssueInfo
        ...GetPRInfo
        ... on Issue {
          timelineItems(since: $timeSince, last: 100) {
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
          timelineItems(since: $timeSince, last: 100) {
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
  ${ISSUE_FRAGMENT}
`;

function makeNewSearch(users, repos) {
  return `${repos.map(r => `repo:${r}`).join(' ')} ${users
    .map(u => `-author:${u} -commenter:${u}`)
    .join(' ')} is:open`;
}

function makeDefStaleSearch(users, repos, date) {
  return `${repos.map(r => `repo:${r}`).join(' ')} ${users
    .map(u => `-author:${u} commenter:${u}`)
    .join(' ')} is:open updated:<=${date.toISOString()}`;
}

function makeMaybeStaleSearch(users, repos, date) {
  return `${repos.map(r => `repo:${r}`).join(' ')} ${users
    .map(u => `-author:${u} commenter:${u}`)
    .join(
      ' '
    )} is:open updated:>${date.toISOString()} created:<=${date.toISOString()}`;
}

export async function getGithubData(client, options) {
  const { repos, users, staleTime } = options;
  const staleDate = new Date(Date.now() - staleTime);
  // fetch all the data
  const [newRes, staleRes] = await Promise.all([
    client.query({
      query: SEARCH_NEW_ITEMS_QUERY,
      variables: { query: makeNewSearch(users, repos) },
    }),
    client.query({
      query: SEARCH_STALE_ITEMS_QUERY,
      variables: {
        queryDefStale: makeDefStaleSearch(users, repos, staleDate),
        queryMaybeStale: makeMaybeStaleSearch(users, repos, staleDate),
        timeSince: staleDate.toISOString(),
      },
    }),
  ]);
  // filter the stale data to only the actually stale items
  const nrSet = new Set(users);
  // if every comment by a relic is stale, then the issue is stale
  // TODO: filter timeline events for interactions
  const filteredMaybeItems = staleRes.data.maybeStale.nodes.filter(n =>
    n.timelineItems.nodes.every(c =>
      c?.author && nrSet.has(c.author.login)
        ? new Date(c.updatedAt) <= staleDate
        : true
    )
  );
  return {
    newSearchCount: Math.max(
      newRes.data.search.issueCount,
      newRes.data.search.nodes.length
    ),
    newSearchItems: newRes.data.search.nodes,
    staleSearchCount:
      Math.max(
        staleRes.data.definitelyStale.issueCount,
        staleRes.data.definitelyStale.nodes.length
      ) + filteredMaybeItems.length,
    staleSearchItems: staleRes.data.definitelyStale.nodes.concat(
      filteredMaybeItems
    ),
  };
}
