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

function makeNewSearch(users, repos, ignoreLabels) {
  return `${repos.map(r => `repo:${r}`).join(' ')} ${users
    .map(u => `-author:${u} -commenter:${u}`)
    .join(' ')} ${ignoreLabels.map(l => `-label:${l}`).join(' ')} is:open`;
}

function makeDefStaleSearch(users, repos, ignoreLabels, date) {
  return `${repos.map(r => `repo:${r}`).join(' ')} ${users
    .map(u => `-author:${u} commenter:${u}`)
    .join(' ')} ${ignoreLabels
    .map(l => `-label:${l}`)
    .join(' ')} is:open updated:<=${date.toISOString()}`;
}

function makeMaybeStaleSearch(users, repos, ignoreLabels, date) {
  return `${repos.map(r => `repo:${r}`).join(' ')} ${users
    .map(u => `-author:${u} commenter:${u}`)
    .join(' ')} ${ignoreLabels
    .map(l => `-label:${l}`)
    .join(
      ' '
    )} is:open updated:>${date.toISOString()} created:<=${date.toISOString()}`;
}

/**
 * Run a GraphQL query to get information about new and stale items for a given set of repositories.
 *  TODO: better overview of new/stale items
 *
 * @param {*} client Apollo GraphQL client to use to query the GitHub GraphQL API. Must be preloaded with the proper credentials.
 * @param {string[]} options.scanRepos The repositories to scan, in "org/name" format.
 * @param {string[]} options.companyUsers Login names of GitHub accounts associated with employees. This value is used to determine which items have received a response from someone in the company.
 * @param {string[]} options.ignoreLabels Issue/PR labels to exclude. All issues/PRs with these labels will be ignored.
 * @param {number} options.staleTime Duration in milliseconds that a item should remain inactive for it to be considered stale.
 * @returns {object} TODO: more docs
 */
export async function getGithubData(client, options) {
  const { scanRepos, companyUsers, staleTime, ignoreLabels } = options;
  const staleDate = new Date(Date.now() - staleTime);
  // fetch all the data
  const [newRes, staleRes] = await Promise.all([
    client.query({
      query: SEARCH_NEW_ITEMS_QUERY,
      variables: { query: makeNewSearch(companyUsers, scanRepos, ignoreLabels) }
    }),
    client.query({
      query: SEARCH_STALE_ITEMS_QUERY,
      variables: {
        queryDefStale: makeDefStaleSearch(
          companyUsers,
          scanRepos,
          ignoreLabels,
          staleDate
        ),
        queryMaybeStale: makeMaybeStaleSearch(
          companyUsers,
          scanRepos,
          ignoreLabels,
          staleDate
        ),
        timeSince: staleDate.toISOString()
      }
    })
  ]);
  // filter the stale data to only the actually stale items
  const nrSet = new Set(companyUsers);
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
    )
  };
}
