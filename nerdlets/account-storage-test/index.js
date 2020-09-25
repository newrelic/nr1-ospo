/* eslint-disable prettier/prettier */
import React from 'react';
import {
  AccountStorageMutation,
  AccountStorageQuery,
  TextField,
  Button,
  Spinner,
  List,
  ListItem
} from 'nr1'

const ACCOUNT_ID = 2875235
const COLLECTION_ID = 'ospo-user-metadata'
const DOCUMENT_ID = 'ospo-user-metadata-document'

export default class AccountStorageTest extends React.Component {
  constructor(props) {
    super(props)
    this.state = { input: '' }
  }

  render() {
    return ( 
      <div>
        <TextField label="Store What?" placeholder="e.g. John Doe" onChange={e => this.setState({ input: e.target.value })} />
        <Button onClick={() => AccountStorageMutation.mutate({
          accountId: ACCOUNT_ID,
          actionType: AccountStorageMutation.ACTION_TYPE.WRITE_DOCUMENT,
          collection: COLLECTION_ID,
          documentId: DOCUMENT_ID,
          document: { input: this.state.input }
        })}>Do It</Button>
        <AccountStorageQuery accountId={ACCOUNT_ID} collection={COLLECTION_ID}>
          {({ loading, error, data }) => {
            if (loading) {
              return <Spinner />;
            }
            if (error) {
              return 'Error!';
            }
            return <pre>{JSON.stringify(data, null, 4)}</pre>;
          }}
        </AccountStorageQuery>
      </div>
    );
  }
}