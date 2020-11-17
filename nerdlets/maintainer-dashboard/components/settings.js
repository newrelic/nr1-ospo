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
} from 'nr1';
import { DropdownList } from 'react-widgets';
import { getUserInfo } from '../graphql/githubData';
import SettingsQuery from '../util/storageUtil';
import ProfileEditor from './profileEditor';

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
    currentToken: PropTypes.string,
    currentSettings: PropTypes.object,
    /** Optional CSS to apply to this component */
    style: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.state = {
      /** List of all profiles available */
      allProfiles: this.props.currentSettings?.profileList?.length
        ? this.props.currentSettings.profileList
        : [SettingsQuery.DEFAULT_PROFILE],
      /** The current profile being edited */
      currentProfileIndex: this.props.currentSettings?.currentProfileIndex || 0,
      /** Value of the PAT input box */
      token: this.props.currentToken || '',
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
    // re-test the PAT
    if (this.state.token) await this.updateUserInfo(this.state.token);
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
      // TODO: fix
      SettingsQuery.writeSettings({
        currentProfileIndex: this.state.currentProfileIndex,
        profileList: this.state.allProfiles,
      }),
    ]);
    // tell the user we're done
    this.setState({ submitting: false });
    // call the callback
    this.props.onSubmit();
  }

  /** Find a list of duplicate names in allProfiles */
  getDuplicateProfileNames() {
    const { dupes } = this.state.allProfiles.reduce(
      (p, { profileName }) => {
        if (p.set.has(profileName)) p.dupes.add(profileName);
        else p.set.add(profileName);
        return p;
      },
      { set: new Set(), dupes: new Set() }
    );
    return Array.from(dupes);
  }

  /** Used to generate an error message for the submit button */
  getFormError() {
    if (!this.state.patStatus.valid) return 'Please enter a valid PAT';
    if (this.state.allProfiles.some(({ profileName }) => !profileName))
      return `Please provide a profile name for all of your profiles`;
    const dupes = this.getDuplicateProfileNames();
    if (dupes.length)
      return `Please rename profiles with duplicate name(s) ${dupes
        .map((d) => `"${d}"`)
        .join(', ')}`;
    // check for empty list of selected repositories
    const needRepo = this.state.allProfiles.find(
      ({ repos }) => repos.length === 0
    );
    if (needRepo)
      return `Please select at least one repository for profile "${needRepo.profileName}"`;
    // check for valid stale time
    const needStale = this.state.allProfiles.find(
      ({ staleTimeValue }) => !staleTimeValue
    );
    if (needStale)
      return `Please enter a valid stale time for profile "${needStale.profileName}"`;
    // TODO: check for dupe profiles
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
              Your personal access token will stored in{' '}
              <Link to="https://developer.newrelic.com/explore-docs/nerdstoragevault">
                NerdStorageVault
              </Link>
              , and will only be accessible to you. This token can be removed or
              revoked at any time.
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
              Profiles
            </HeadingText>
          </StackItem>
          <StackItem>
            <BlockText type={BlockText.TYPE.NORMAL}>
              Use the dropdown below to select a profile to edit. To create a
              new profile, type the profile name in the search bar and press
              enter. The configuration for the currently selected profile is
              shown in the grey box below.
            </BlockText>
          </StackItem>
          <StackItem>
            <DropdownList
              data={this.state.allProfiles.map(({ profileName }, index) => ({
                profileName,
                index,
              }))}
              value={this.state.currentProfileIndex}
              valueField="index"
              textField="profileName"
              itemComponent={({ item: { profileName, index } }) => (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  {profileName}
                  {this.state.allProfiles.length > 1 && (
                    <Button
                      sizeType={Button.SIZE_TYPE.SMALL}
                      type={Button.TYPE.PLAIN_NEUTRAL}
                      iconType={Icon.TYPE.INTERFACE__OPERATIONS__TRASH}
                      onClick={(evt) => {
                        evt.stopPropagation();
                        this.setState(
                          ({ allProfiles, currentProfileIndex }) => {
                            // splice out the profile (not in place)
                            const newProfileList = allProfiles
                              .slice(0, index)
                              .concat(allProfiles.slice(index + 1));
                            return {
                              allProfiles: newProfileList,
                              currentProfileIndex: Math.min(
                                Math.max(newProfileList.length - 1, 0),
                                currentProfileIndex
                              ),
                            };
                          }
                        );
                      }}
                    />
                  )}
                </div>
              )}
              selectIcon={
                <Icon
                  type={Icon.TYPE.INTERFACE__CARET__CARET_BOTTOM__WEIGHT_BOLD}
                />
              }
              onChange={({ index }) =>
                this.setState({
                  currentProfileIndex: index,
                })
              }
              filter
              allowCreate="onFilter"
              onCreate={(newName) =>
                this.setState(({ allProfiles }) => ({
                  allProfiles: allProfiles.concat({
                    ...SettingsQuery.DEFAULT_PROFILE,
                    profileName: newName,
                  }),
                  currentProfileIndex: allProfiles.length,
                }))
              }
              messages={{
                createOption: ({ searchTerm }) =>
                  `Create profile "${searchTerm}"`,
              }}
              containerClassName="ospo-dropdown"
            />
          </StackItem>
          <StackItem>
            <ProfileEditor
              profile={this.state.allProfiles[this.state.currentProfileIndex]}
              onChange={(profileChanged) =>
                // replace the array with a new array with the changes made to the currently selected profile
                this.setState(({ allProfiles, currentProfileIndex }) => ({
                  allProfiles: allProfiles.map((p, i) =>
                    i !== currentProfileIndex ? p : { ...p, ...profileChanged }
                  ),
                }))
              }
              repoOptions={this.state.patStatus.repoOptions}
            />
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
