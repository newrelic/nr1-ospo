import { UserSecretsMutation, UserSecretsQuery } from '@newrelic/nr1-community';
import { UserStorageMutation, UserStorageQuery } from 'nr1';

const GH_TOKEN_KEY = 'githubToken';
const SETTINGS_KEY = 'nr1OspoSettings';

export async function writeToken(token) {
  return UserSecretsMutation.mutate({
    actionType: UserSecretsMutation.ACTION_TYPE.WRITE_SECRET,
    name: GH_TOKEN_KEY,
    value: token
  });
}

export async function readToken() {
  const { data } = await UserSecretsQuery.query({
    name: GH_TOKEN_KEY
  });
  return data?.value;
}

export async function removeToken() {
  return UserSecretsMutation.mutate({
    actionType: UserSecretsMutation.ACTION_TYPE.DELETE_SECRET,
    name: GH_TOKEN_KEY
  });
}

export async function writeSettings({ repos, labels, users, staleTime }) {
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

export async function readSettings() {
  const { data } = await UserStorageQuery.query({
    collection: SETTINGS_KEY,
    documentId: SETTINGS_KEY
  });
  return data;
}
