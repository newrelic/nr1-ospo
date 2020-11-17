import React from 'react';
import PropTypes from 'prop-types';
import {
  HeadingText,
  Stack,
  StackItem,
  BlockText,
  TextField,
  Select,
  SelectItem,
} from 'nr1';
import { Multiselect } from 'react-widgets';
import IssueLabel, { KNOWN_LABEL_COLORS } from './issueLabel';

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
 * A simple form for editing a single profile configuration.
 *
 * This component is a controlled component, and does not attempt to maintain
 * it's own state. Modifications to the form are passed up using the onChange
 * function prop, and then must be propagated back down using the profile prop.
 */
export default class ProfileEditor extends React.PureComponent {
  static propTypes = {
    /**
     * Function which receives changes in the ProfileEditor form. Takes a single
     * input parameter of type profile. This function will be called anytimme
     * any value in this form is changed with only the value that changed: for
     * example, if a new repository is selected onChange({ repos }) will be
     * called.
     */
    onChange: PropTypes.func.isRequired,
    /**
     * An object representing the current profile which should be displayed in
     * the form.
     */
    profile: PropTypes.shape({
      repos: PropTypes.arrayOf(PropTypes.string).isRequired,
      labels: PropTypes.arrayOf(PropTypes.string).isRequired,
      users: PropTypes.arrayOf(PropTypes.string).isRequired,
      staleTimeValue: PropTypes.number.isRequired,
      staleTimeUnit: PropTypes.number.isRequired,
      profileName: PropTypes.string.isRequired,
    }),
    /** A list of repository selection suggestions, in 'owner/repo' format. */
    repoOptions: PropTypes.arrayOf(PropTypes.string),
  };

  render() {
    return (
      <Stack
        fullWidth
        horizontalType={Stack.HORIZONTAL_TYPE.FILL}
        directionType={Stack.DIRECTION_TYPE.VERTICAL}
        gapType={Stack.GAP_TYPE.LARGE}
      >
        <StackItem>
          <HeadingText type={HeadingText.TYPE.HEADING_4}>
            Profile Name
          </HeadingText>
        </StackItem>
        <StackItem>
          <TextField
            value={this.props.profile.profileName}
            invalid={!this.props.profile.profileName}
            onChange={(evt) =>
              this.props.onChange({ profileName: evt.target.value })
            }
            style={{ width: '100%' }}
          />
        </StackItem>
        <StackItem>
          <HeadingText type={HeadingText.TYPE.HEADING_4}>
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
              this.props.onChange({
                repos: splitRepositoryNames(name)
                  .filter((n) => !this.props.profile.repos.includes(n))
                  .concat(this.props.profile.repos),
              })
            }
            onChange={(value) => this.props.onChange({ repos: value })}
            value={this.props.profile.repos}
            data={this.props.repoOptions || []}
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
                  Optionally select labels this tool should denylist. Issues or
                  PRs with the selected labels will not be shown.
                </BlockText>
              </StackItem>
              <StackItem>
                <Multiselect
                  onCreate={({ name }) =>
                    name &&
                    this.props.onChange({
                      labels: !this.props.profile.labels.includes(name)
                        ? this.props.profile.labels.concat([name])
                        : this.props.profile.labels,
                    })
                  }
                  onChange={(value) =>
                    this.props.onChange({
                      labels: value.map((v) =>
                        typeof v !== 'string' ? v.name : v
                      ),
                    })
                  }
                  value={this.props.profile.labels}
                  placeholder="Select labels to filter"
                  data={ALL_LABELS.filter(
                    (l) =>
                      !this.props.profile.labels.includes(
                        typeof l !== 'string' ? l.name : l
                      )
                  )}
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
                  This dashboard pulls a list of current employee GitHub handles
                  from shared account storage, using it to determine if an Issue
                  or PR has received a response from inside the company. You can
                  specify additional GitHub usernames this dashboard should
                  treat as employees here.
                </BlockText>
              </StackItem>
              <StackItem>
                <Multiselect
                  onCreate={(name) =>
                    this.props.onChange({
                      users: splitLogins(name)
                        .filter((n) => !this.props.profile.users.includes(n))
                        .concat(this.props.profile.users),
                    })
                  }
                  onChange={(value) =>
                    this.props.onChange({
                      users: value,
                    })
                  }
                  value={this.props.profile.users}
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
                  Optionally adjust the duration of time an Issue and PR should
                  go without activity before it is considered stale. The
                  suggested time is around 2 weeks.
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
                      type="number"
                      onChange={({ target }) =>
                        this.props.onChange({
                          staleTimeValue: parseFloat(target.value),
                        })
                      }
                      value={
                        isNaN(this.props.profile.staleTimeValue)
                          ? ''
                          : this.props.profile.staleTimeValue.toString()
                      }
                    />
                  </StackItem>
                  <StackItem grow>
                    <Select
                      onChange={(evt, value) =>
                        this.props.onChange({ staleTimeUnit: value })
                      }
                      value={this.props.profile.staleTimeUnit}
                    >
                      <SelectItem value={1000 * 60}>Minutes</SelectItem>
                      <SelectItem value={1000 * 60 * 60}>Hours</SelectItem>
                      <SelectItem value={1000 * 60 * 60 * 24}>Days</SelectItem>
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
      </Stack>
    );
  }
}
