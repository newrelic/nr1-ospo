import React from 'react';
import gql from 'graphql-tag';
import {
  HeadingText,
  Stack,
  StackItem,
  Button,
  BlockText,
  Icon,
  TextField,
  Link,
  Select,
  SelectItem,
} from 'nr1';
import { Multiselect } from 'react-widgets';
import { IssueLabel } from './issueLabel';
import UserSettingsQuery from './storageUtil';

const GET_CUR_USER_INFO = gql`
  query($repoCursor: String) {
    viewer {
      login
      repositories(
        affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
        first: 100
        after: $repoCursor
      ) {
        nodes {
          nameWithOwner
        }
      }
    }
  }
`;

export default class SettingsUI extends React.Component {
  static splitRepositoryNames(searchTerm) {
    return Array.from(
      new Set(
        searchTerm
          .split(/(,\s*)|\s+/g)
          .map((n) => n && n.trim())
          .filter((n) => n && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(n))
      )
    );
  }

  static splitLogins(searchTerm) {
    return Array.from(
      new Set(
        searchTerm
          .split(/(,\s*)|\s+/g)
          .map((n) => n && n.trim())
          .filter((n) => n)
      )
    );
  }

  constructor(props) {
    super(props);
    this.state = {
      repoValue: [],
      labelValue: [],
      userValue: [],
      timeUnit: 1000 * 60,
      timeValue: '',
      token: '',
      patStatus: {},
      submitting: false,
    };
    this.handlePATToken = this.handlePATToken.bind(this);
    this.handlePATRemove = this.handlePATRemove.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.curFetchIndex = 0;
  }

  async componentDidMount() {
    const [prevToken, prevSettings] = await Promise.all([
      UserSettingsQuery.readToken(),
      UserSettingsQuery.readSettings(),
    ]);
    // add saved values back into settings
    // TODO: do not write the previous token back to the input form, as it may be unsafe
    if (prevSettings) {
      const { repos, labels, users, staleTime } = prevSettings;
      this.setState({
        repoValue: repos || [],
        labelValue: labels || [],
        userValue: users || [],
        timeValue: staleTime ? (staleTime / (60 * 1000)).toString() : '',
        patStatus: prevToken ? { valid: true } : {},
        token: prevToken || '',
      });
    }
    // re-test the PAT
    if (prevToken) await this.updateUserInfo(prevToken);
  }

  async updateUserInfo(token) {
    // indicate we are currently testing the token
    this.setState({
      patStatus: {
        testing: true,
      },
    });
    // test the token with a user information query
    const curNum = ++this.curFetchIndex;
    return this.props.client
      .query({
        query: GET_CUR_USER_INFO,
        fetchPolicy: 'network-only',
        context: {
          headers: {
            authorization: `Bearer ${token}`,
          },
        },
      })
      .then(({ data }) => {
        // prevent race conditions
        if (curNum === this.curFetchIndex) {
          this.setState({
            patStatus: {
              valid: true,
              userName: data?.viewer?.login,
              repoOptions: data?.viewer?.repositories?.nodes?.map?.(
                ({ nameWithOwner }) => nameWithOwner
              ),
            },
          });
        }
      })
      .catch((e) => {
        // prevent race condition
        if (curNum === this.curFetchIndex) {
          if (e?.networkError?.statusCode === 401)
            this.setState({
              patStatus: {
                valid: false,
                message: 'Token returned authorization error',
              },
            });
          else
            this.setState({
              patStatus: {
                valid: false,
                message: 'Unknown GitHub API error',
              },
            });
        }
      });
  }

  handlePATToken(event) {
    const token = event.target.value;
    this.setState({ token });
    // error if the token is invalid
    if (token.length < 20) {
      return this.setState({
        patStatus: {
          valid: false,
          message: 'Token is less than 20 characters in length',
        },
      });
    }
    // else update the user information using the token
    this.updateUserInfo(token);
  }

  async handlePATRemove() {
    this.setState({ token: '', patStatus: {} });
    await UserSettingsQuery.removeToken();
  }

  async handleSubmit() {
    // tell the user we are currently submitting
    this.setState({ submitting: true });
    // write the token to NerdVault
    // write the everything else to UserStorage
    await Promise.all([
      UserSettingsQuery.writeToken(this.state.token),
      UserSettingsQuery.writeSettings({
        repos: this.state.repoValue,
        users: this.state.userValue,
        labels: this.state.labelValue,
        staleTime: parseFloat(this.state.timeValue) * this.state.timeUnit,
      }),
    ]);
    // tell the user we're done
    this.setState({ submitting: false });
    // call the callback
    this.props.onSubmit();
  }

  getFormError() {
    if (!this.state.patStatus.valid) return 'Please enter a valid PAT';
    if (this.state.repoValue.length === 0)
      return 'Please select at least one repository';
    else if (!this.state.timeValue || isNaN(parseFloat(this.state.timeValue)))
      return 'Please enter a valid stale time';
    return null;
  }

  render() {
    return (
      <form style={this.props.style || {}}>
        <Stack
          fullWidth
          horizontalType={Stack.HORIZONTAL_TYPE.FILL}
          directionType={Stack.DIRECTION_TYPE.VERTICAL}
          gapType={Stack.GAP_TYPE.LARGE}
        >
          <StackItem>
            <HeadingText type={HeadingText.TYPE.HEADING_1}>
              Dashboard Configuration
            </HeadingText>
          </StackItem>
          <StackItem>
            <HeadingText type={HeadingText.TYPE.HEADING_3}>
              Personal Access Token
            </HeadingText>
          </StackItem>
          <StackItem>
            <BlockText type={BlockText.TYPE.NORMAL}>
              Supply a personal access token to allow this dashboard to access
              GitHub's GraphQL API. The token does not need to have any special
              permissions. See the{' '}
              <Link to="https://docs.github.com/en/free-pro-team@latest/github/authenticating-to-github/creating-a-personal-access-token">
                GitHub documentation
              </Link>{' '}
              for more information on creating and using personal access tokens.
            </BlockText>
          </StackItem>
          <StackItem>
            <BlockText type={BlockText.TYPE.NORMAL}>
              Your personal access token will stored in NerdStorage vault, and
              only be accessible to you. The token can be removed or revoked at
              any time.
            </BlockText>
          </StackItem>
          <StackItem>
            <Stack
              fullWidth
              directionType={Stack.DIRECTION_TYPE.HORIZONTAL}
              verticalType={Stack.VERTICAL_TYPE.CENTER}
            >
              <StackItem grow>
                <TextField
                  type={TextField.TYPE.PASSWORD}
                  placeholder="e.g. 58ac3310..."
                  style={{ width: '100%' }}
                  value={this.state.token}
                  onChange={this.handlePATToken}
                  invalid={
                    this.state.patStatus.valid === false &&
                    this.state.patStatus.message
                  }
                  disabled={this.state.patStatus.valid === true}
                  loading={this.state.patStatus.testing === true}
                />
              </StackItem>
              <StackItem>
                <Button
                  type={Button.TYPE.DESTRUCTIVE}
                  iconType={Icon.TYPE.INTERFACE__OPERATIONS__TRASH}
                  onClick={this.handlePATRemove}
                >
                  Remove Token
                </Button>
              </StackItem>
            </Stack>
            {this.state.patStatus.valid ? (
              <BlockText type={BlockText.TYPE.NORMAL}>
                <i>Authenticated as {this.state.patStatus.userName}</i>
              </BlockText>
            ) : null}
          </StackItem>
          <StackItem>
            <HeadingText type={HeadingText.TYPE.HEADING_3}>
              Repositories
            </HeadingText>
          </StackItem>
          <StackItem>
            <BlockText type={BlockText.TYPE.NORMAL}>
              Select which repositories you would like this tool to scan. To add
              options not on the list, enter comma or space separated repository
              names in the box and press enter.
            </BlockText>
          </StackItem>
          <StackItem>
            <Multiselect
              onCreate={(name) =>
                this.setState(({ repoValue }) => ({
                  repoValue: SettingsUI.splitRepositoryNames(name)
                    .filter((n) => !repoValue.includes(n))
                    .concat(repoValue),
                }))
              }
              onChange={(value) => this.setState({ repoValue: value })}
              value={this.state.repoValue}
              data={this.state.patStatus.repoOptions}
              placeholder="Enter a repository name (e.g. newrelic/nr1-ospo)"
              filter="contains"
              messages={{
                emptyFilter:
                  'Did not match any suggested repositories to that name.',
                emptyList:
                  'Enter a personal access token to see suggested repositories, or start typing to add your own.',
                createOption({ searchTerm }) {
                  const split = SettingsUI.splitRepositoryNames(searchTerm);
                  if (!split.length)
                    return 'Invalid repository name (make sure to include the organization)';
                  if (split.length === 1) return `Add repository ${split[0]}`;
                  return `Add repositories ${split.join(', ')}`;
                },
              }}
            />
          </StackItem>
          <StackItem>
            <details>
              <summary>
                <BlockText
                  style={{ display: 'inline-block' }}
                  spacingType={[
                    HeadingText.SPACING_TYPE.OMIT,
                    HeadingText.SPACING_TYPE.OMIT,
                    HeadingText.SPACING_TYPE.SMALL,
                    HeadingText.SPACING_TYPE.SMALL,
                  ]}
                >
                  Advanced Configuration
                </BlockText>
              </summary>
              <Stack
                fullWidth
                horizontalType={Stack.HORIZONTAL_TYPE.FILL}
                directionType={Stack.DIRECTION_TYPE.VERTICAL}
                gapType={Stack.GAP_TYPE.LARGE}
              >
                <StackItem>
                  <HeadingText type={HeadingText.TYPE.HEADING_4}>
                    Denylist Labels
                  </HeadingText>
                </StackItem>
                <StackItem>
                  <BlockText type={BlockText.TYPE.NORMAL}>
                    Optionally select labels this tool should denylist. Issues
                    or PRs with the selected labels will not be shown.
                  </BlockText>
                </StackItem>
                <StackItem>
                  <Multiselect
                    onCreate={({ name }) =>
                      this.setState(({ labelValue }) => ({
                        labelValue: labelValue.concat([name]),
                      }))
                    }
                    onChange={(value) =>
                      this.setState({
                        labelValue: value.map((v) =>
                          typeof v !== 'string' ? v.name : v
                        ),
                      })
                    }
                    value={this.state.labelValue}
                    placeholder="Select labels to filter"
                    data={this.props.labelOptions}
                    textField="name"
                    itemComponent={({ item }) => (
                      <IssueLabel name={item.name} color={item.color} />
                    )}
                    filter="contains"
                  />
                </StackItem>
                <StackItem>
                  <HeadingText type={HeadingText.TYPE.HEADING_4}>
                    Employee GitHub Usernames
                  </HeadingText>
                </StackItem>
                <StackItem>
                  <BlockText type={BlockText.TYPE.NORMAL}>
                    This dashboard pulls a list of current employee GitHub
                    handles from shared account storage, using it to determine
                    if an Issue or PR has received a response from inside the
                    company. You can specify additional GitHub usernames this
                    dashboard should treat as employees here.
                  </BlockText>
                </StackItem>
                <StackItem>
                  <Multiselect
                    onCreate={(name) =>
                      this.setState(({ userValue }) => ({
                        userValue: SettingsUI.splitLogins(name)
                          .filter((n) => !userValue.includes(n))
                          .concat(userValue),
                      }))
                    }
                    onChange={(value) => this.setState({ userValue: value })}
                    value={this.state.userValue}
                    data={[]}
                    placeholder="Enter additional GitHub usernames"
                  />
                </StackItem>
                <StackItem>
                  <HeadingText type={HeadingText.TYPE.HEADING_4}>
                    Stale Duration Threshold
                  </HeadingText>
                </StackItem>
                <StackItem>
                  <BlockText type={BlockText.TYPE.NORMAL}>
                    Optionally adjust the duration of time an Issue and PR
                    should go without activity before it is considered stale.
                    The suggested time is around 2 weeks.
                  </BlockText>
                </StackItem>
                <StackItem>
                  <Stack
                    fullWidth
                    directionType={Stack.DIRECTION_TYPE.HORIZONTAL}
                    verticalType={Stack.VERTICAL_TYPE.BOTTOM}
                  >
                    <StackItem grow>
                      <TextField
                        placeholder="Enter a number"
                        style={{ width: '100%' }}
                        onChange={({ target }) =>
                          this.setState({
                            timeValue: target.value,
                          })
                        }
                        invalid={
                          this.state.timeValue !== '' &&
                          isNaN(parseFloat(this.state.timeValue))
                            ? 'Value is not a number'
                            : false
                        }
                        value={this.state.timeValue}
                      />
                    </StackItem>
                    <StackItem grow>
                      <Select
                        onChange={(evt, value) =>
                          this.setState({ timeUnit: value })
                        }
                        value={this.state.timeUnit}
                      >
                        <SelectItem value={1000 * 60}>Minutes</SelectItem>
                        <SelectItem value={1000 * 60 * 60}>Hours</SelectItem>
                        <SelectItem value={1000 * 60 * 60 * 24}>
                          Days
                        </SelectItem>
                        <SelectItem value={1000 * 60 * 60 * 24 * 7}>
                          Weeks
                        </SelectItem>
                      </Select>
                    </StackItem>
                  </Stack>
                </StackItem>
              </Stack>
            </details>
          </StackItem>
          <StackItem>
            <Button
              type={Button.TYPE.PRIMARY}
              onClick={this.handleSubmit}
              disabled={this.getFormError() !== null}
              loading={this.state.submitting}
            >
              Submit
            </Button>
            <BlockText type={BlockText.TYPE.NORMAL}>
              <i>{this.getFormError()}</i>
            </BlockText>
          </StackItem>
        </Stack>
      </form>
    );
  }
}
