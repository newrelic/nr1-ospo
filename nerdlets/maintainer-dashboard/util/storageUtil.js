import { UserSecretsMutation, UserSecretsQuery } from '@newrelic/nr1-community';
import {
  UserStorageMutation,
  UserStorageQuery,
  AccountStorageQuery,
} from 'nr1';
import React from 'react';
import PropTypes from 'prop-types';
import { id } from '../../../nr1.json';

// TODO: clear previous values on version change
/** Increment this value to force-clear all user settings on publish */
const DASHBOARD_MAJOR_VERSION = 1;
const GH_TOKEN_KEY = `${id}-githubToken-v${DASHBOARD_MAJOR_VERSION}`;
const SETTINGS_KEY = `${id}-ospoSettings-v${DASHBOARD_MAJOR_VERSION}`;
const EMPLOYEE_METADATA_ACCOUNT_ID = ***REMOVED***;
const EMPLOYEE_METADATA_COLLECTION = `${id}-employeeMetadata-v${DASHBOARD_MAJOR_VERSION}`;
const EMPLOYEE_METADATA_DOCUMENT = EMPLOYEE_METADATA_COLLECTION;

/**
 * Component used to read and write the NerdStorage values relevant to this
 * dashboard. Similar to the existing NerdStorage components, this component
 * works both declaratively (as a component) and imperatively (static
 * functions).
 */
export default class SettingsQuery extends React.Component {
  /** Remove the PAT from NerdVault. */
  static async removeToken() {
    return UserSecretsMutation.mutate({
      actionType: UserSecretsMutation.ACTION_TYPE.DELETE_SECRET,
      name: GH_TOKEN_KEY,
    });
  }

  /**
   * Read the PAT from NerdVault.
   *
   * @returns {Promise<?string>} The PAT, or falsey if the token does not exist.
   */
  static async readToken() {
    const { data } = await UserSecretsQuery.query({
      name: GH_TOKEN_KEY,
    });
    return data?.value;
  }

  /** Save the PAT to NerdVault */
  static async writeToken(token) {
    return UserSecretsMutation.mutate({
      actionType: UserSecretsMutation.ACTION_TYPE.WRITE_SECRET,
      name: GH_TOKEN_KEY,
      value: token,
    });
  }

  /**
   * Write user settings to NerdStorage.
   *
   * @param {string[]} settings.repos A list of repositories including the owner
   *     to scan.
   *     (`owner/repo`).
   * @param {string[]} settings.labels A list of Issue/PR labels to denylist.
   * @param {string[]} settings.users A list of GitHub logins to include in the
   *     employee list.
   * @param {number} settings.staleTime A millisecond time duration used during
   *     stale categorization.
   */
  static async writeSettings({ repos, labels, users, staleTime }) {
    return UserStorageMutation.mutate({
      actionType: UserStorageMutation.ACTION_TYPE.WRITE_DOCUMENT,
      collection: SETTINGS_KEY,
      documentId: SETTINGS_KEY,
      document: {
        repos,
        labels,
        users,
        staleTime,
      },
    });
  }

  /**
   * Read user settings from NerdStorage
   *
   * @returns {?{
   *   repos: string[];
   *   labels: string[];
   *   users: string[];
   *   staleTime: number;
   * }}
   *     An object containing the stored user settings.
   */
  static async readSettings() {
    const { data } = await UserStorageQuery.query({
      collection: SETTINGS_KEY,
      documentId: SETTINGS_KEY,
    });
    return data;
  }

  /**
   * Read employee metadata from account-based nerdstorage. At the moment this
   * returns an array of usernames associated with the current company.
   *
   * @returns {Promise<string[]>} An array of usernames, or an empty array of
   *     none were found.
   */
  static async readEmployeeData() {
    const { data } = await AccountStorageQuery.query({
      accountId: EMPLOYEE_METADATA_ACCOUNT_ID,
      collection: EMPLOYEE_METADATA_COLLECTION,
      documentId: EMPLOYEE_METADATA_DOCUMENT,
    });
    return data?.users;
  }

  static propTypes = {
    /** ({ loading, token, settings, users }) => JSX */
    children: PropTypes.func.isRequired,
  };

  constructor(props = {}) {
    super(props);
    this.state = {
      loading: true,
    };
  }

  async componentDidMount() {
    const [token, settings, users] = await Promise.all([
      SettingsQuery.readToken(),
      SettingsQuery.readSettings(),
      SettingsQuery.readEmployeeData(),
    ]);
    this.setState({
      loading: false,
      token,
      settings,
      users,
    });
  }

  render() {
    return this.props.children(this.state);
  }
}
