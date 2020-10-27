import gql from 'graphql-tag';

// TODO: split query into search + virtualized table to improve caching
/**
 * Fragment indicating the values and structure of all issue objects fetched
 * using the github queries below.
 */
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

/**
 * Fragment indicating the values and structure of all PR objects fetched using
 * the github queries below.
 */
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

/**
 * Query to perform a GitHub search and fetch all "Issues" (Issues and PRs) that
 * match a given query. We can use this graphQL query and GitHub's powerful
 * search syntax to only fetch items which were created by users who are not
 * employees. Use makeNewSearch to construct a search query paramter that finds
 * PRs and Issues that are open and not created/commented by an employee.
 *
 * @param {string} query The GitHub search query to search with.
 */
export const SEARCH_NEW_ITEMS_QUERY = gql`
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

export const SEARCH_STALE_ITEMS_QUERY = gql`
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

export function makeNewSearch(users, repos, ignoreLabels) {
  return `${repos.map((r) => `repo:${r}`).join(' ')} ${users
    .map((u) => `-author:${u} -commenter:${u}`)
    .join(' ')} ${ignoreLabels.map((l) => `-label:${l}`).join(' ')} is:open`;
}

export function makeDefStaleSearch(users, repos, ignoreLabels, date) {
  return `${repos.map((r) => `repo:${r}`).join(' ')} ${users
    .map((u) => `-author:${u} commenter:${u}`)
    .join(' ')} ${ignoreLabels
    .map((l) => `-label:${l}`)
    .join(' ')} is:open updated:<=${date.toISOString()}`;
}

export function makeMaybeStaleSearch(users, repos, ignoreLabels, date) {
  return `${repos.map((r) => `repo:${r}`).join(' ')} ${users
    .map((u) => `-author:${u} commenter:${u}`)
    .join(' ')} ${ignoreLabels
    .map((l) => `-label:${l}`)
    .join(
      ' '
    )} is:open updated:>${date.toISOString()} created:<=${date.toISOString()}`;
}
