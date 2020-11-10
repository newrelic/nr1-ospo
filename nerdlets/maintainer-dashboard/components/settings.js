import React from 'react';
import PropTypes from 'prop-types';
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
import { Multiselect, DropdownList } from 'react-widgets';
import { getUserInfo } from '../graphql/githubData';
import IssueLabel, { KNOWN_LABEL_COLORS } from './issueLabel';
import SettingsQuery from '../util/storageUtil';

/** An array of { name, color } for every GitHub issue label in the default set */
const ALL_LABELS = Array.from(
  KNOWN_LABEL_COLORS.entries()
).map(([name, color]) => ({ name, color }));

/**
 * Split user supplied repository name list (including the organization) into an
 * array of the supplied names. This function supports whitespace and comma
 * separated lists, and will automatically deduplicate and remove invalid
 * entries.
 *
 * @param {string} repoList The user input string containing a list of
 *     repositories
 * @returns {string[]} The list of validated repository names parsed from the
 *     input.
 */
function splitRepositoryNames(repoList) {
  return Array.from(
    new Set(
      repoList
        .split(/(,\s*)|\s+/g)
        .map((n) => n && n.trim())
        .filter((n) => n && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(n))
    )
  );
}

/**
 * Split user supplied GitHub login list into an array of the supplied logins.
 * This function supports whitespace and comma separated lists, and will
 * automatically deduplicate and trim values.
 *
 * @param {string} loginList The user input string containing a list of GitHub
 *     logins.
 * @returns {string[]} The list of logins parsed from the input.
 */
function splitLogins(loginList) {
  return Array.from(
    new Set(
      loginList
        .split(/(,\s*)|\s+/g)
        .map((n) => n && n.trim())
        .filter((n) => n)
    )
  );
}

/**
 * An uncontrolled component for adjustment of the dashboard settings. This
 * component takes user input regarding dashboard configuration and writes it
 * to persistent storage using the UserSettingsQuery.writeSettings and
 * UserSettingsQuery.writeToken. This data can then be fetched in the dashboard
 * itself using the UserSettingsQuery component or read functions.
 *
 * Inputs behave normally with the exception of the PAT field, which is checked
 * with githubData.getUserInfo. Information from this query is also used to
 * supply suggestions to other input fields.
 */
export default class SettingsUI extends React.Component {
  static propTypes = {
    /** Apollo GraphQL client used to verify the PAT input. */
    client: PropTypes.object.isRequired,
    /**
     * Function called after the component has finished submitting the settings
     * to persistent storage. Takes no inputs and returns nothing.
     */
    onSubmit: PropTypes.func.isRequired,
    /** Optional CSS to apply to this component */
    style: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.state = {
      /**
       * A list of currently selected repositories, used by the repository
       * multiselect
       */
      repoValue: [],
      /**
       * A list of currently selected issue/pr labels, used by the label
       * multiselect
       */
      labelValue: [],
      /**
       * A list of currently selected user logins, used by the user override
       * multiselect.
       */
      userValue: [],
      /**
       * The millisecond value of the currently selected time unit (start at
       * weeks)
       */
      timeUnit: 1000 * 60,
      /** Value of the time text input box */
      timeValue: '20160',
      /** Value of the PAT input box */
      token: '',
      /**
       * Object indicating the status of the PAT validation and information
       * retrieval flow.
       *
       * @property {?boolean} valid If this value is true, `state.token` is
       *     verified to be a valid PAT.
       * @property {?boolean} testing If this value is true, `state.token` is in
       *     the process of being verified.
       * @property {?string} message If `valid` is false, this property will
       *     contain an error message from verification.
       * @property {?string} userName If `valid` is true, this property will
       *     contain the GitHub login associated with `state.token`.
       * @property {?string[]} repoOptions If `valid` is true, this property
       *     will contain a list of repository names that `state.token` has
       *     write access to.
       */
      patStatus: {},
      /**
       * Whether or not the values inputted are in the process of being written
       * to persistent storage
       */
      submitting: false,
    };
    this.handlePATToken = this.handlePATToken.bind(this);
    this.handlePATRemove = this.handlePATRemove.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    /** "semaphore" to prevent race conditions when fetching data asynchronously */
    this.curFetchIndex = 0;
  }

  async componentDidMount() {
    const [prevToken, prevSettings] = await Promise.all([
      SettingsQuery.readToken(),
      SettingsQuery.readSettings(),
    ]);
    // add saved values back into settings
    // TODO: do not write the previous token back to the input form, as it may be unsafe
    if (prevSettings) {
      const { repos, labels, users, staleTime } = prevSettings;
      this.setState({
        repoValue: repos || [],
        labelValue: labels || [],
        userValue: users || [],
        timeValue: staleTime ? (staleTime / (60 * 1000)).toString() : '20160',
        patStatus: prevToken ? { valid: true } : {},
        token: prevToken || '',
      });
    }
    // re-test the PAT
    if (prevToken) await this.updateUserInfo(prevToken);
  }

  /** Check the PAT and fetch information about the user */
  async updateUserInfo(token) {
    // indicate we are currently testing the token
    this.setState({
      patStatus: {
        testing: true,
      },
    });
    // test the token with a user information query
    const curNum = ++this.curFetchIndex;
    try {
      const data = await getUserInfo(this.props.client, token);
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
    } catch (e) {
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
    }
  }

  /** Handler for the PAT input event */
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

  /** Handler for the PAT remove button */
  async handlePATRemove() {
    this.setState({ token: '', patStatus: {} });
    await SettingsQuery.removeToken();
  }

  /** Handler for the submit button */
  async handleSubmit() {
    // tell the user we are currently submitting
    this.setState({ submitting: true });
    // write the token to NerdVault
    // write the everything else to UserStorage
    await Promise.all([
      SettingsQuery.writeToken(this.state.token),
      SettingsQuery.writeSettings({
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

  /** Used to generate an error message for the submit button */
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
              GitHub's GraphQL API. This token does not need to have any special
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
              only be accessible to you. This token can be removed or revoked at
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
                  repoValue: splitRepositoryNames(name)
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
                  const split = splitRepositoryNames(searchTerm);
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
                    data={ALL_LABELS}
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
                        userValue: splitLogins(name)
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
