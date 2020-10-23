import { UserSecretsMutation, UserSecretsQuery } from '@newrelic/nr1-community';
import { UserStorageMutation, UserStorageQuery } from 'nr1';
import React from 'react';
import PropTypes from 'prop-types';

const GH_TOKEN_KEY = 'githubToken';
const SETTINGS_KEY = 'nr1OspoSettings';

// at the moment a re-render must be forced by changing a key prop anytime the user storage is changed
// I'm not sure how to fix this but it'll work for now
export default class UserSettingsQuery extends React.Component {
  static async removeToken() {
    return UserSecretsMutation.mutate({
      actionType: UserSecretsMutation.ACTION_TYPE.DELETE_SECRET,
      name: GH_TOKEN_KEY
    });
  }

  static async readToken() {
    const { data } = await UserSecretsQuery.query({
      name: GH_TOKEN_KEY
    });
    return data?.value;
  }

  static async writeToken(token) {
    return UserSecretsMutation.mutate({
      actionType: UserSecretsMutation.ACTION_TYPE.WRITE_SECRET,
      name: GH_TOKEN_KEY,
      value: token
    });
  }

  static async writeSettings({ repos, labels, users, staleTime }) {
    return UserStorageMutation.mutate({
      actionType: UserStorageMutation.ACTION_TYPE.WRITE_DOCUMENT,
      collection: SETTINGS_KEY,
      documentId: SETTINGS_KEY,
      document: {
        repos,
        labels,
        users,
        staleTime
      }
    });
  }

  static async readSettings() {
    const { data } = await UserStorageQuery.query({
      collection: SETTINGS_KEY,
      documentId: SETTINGS_KEY
    });
    return data;
  }

  static propTypes = {
    children: PropTypes.func
  };

  constructor(props = {}) {
    super(props);
    this.state = {
      loading: true
    };
  }

  async componentDidMount() {
    const [token, settings] = await Promise.all([
      UserSettingsQuery.readToken(),
      UserSettingsQuery.readSettings()
    ]);
    this.setState({
      loading: false,
      token,
      settings
    });
  }

  render() {
    return this.props.children(this.state);
  }
}
