import React from 'react';
import MaintainerDashboard from './components/dashboard';

/** Wrapper for the root component */
export default class Root extends React.PureComponent {
  render() {
    return <MaintainerDashboard />;
  }
}
