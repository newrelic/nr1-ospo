import React from 'react';
import { BlockText } from 'nr1';

export const KNOWN_LABEL_COLORS = new Map([
  ['bug', 'd73a4a'],
  ['documentation', '0075ca'],
  ['duplicate', 'cfd3d7'],
  ['enhancement', 'a2eeef'],
  ['good first issue', '7057ff'],
  ['help wanted', '008672'],
  ['invalid', 'e4e669'],
  ['question', 'd876e3'],
  ['wontfix', 'ffffff'],
  ['dependencies', '0366d6'],
  ['repolinter', 'fbca04']
]);

// stolen from https://stackoverflow.com/questions/3942878/how-to-decide-font-color-in-white-or-black-depending-on-background-color
function pickTextColorBasedOnBgColor(bgColor, lightColor, darkColor) {
  const color = bgColor.charAt(0) === '#' ? bgColor.substring(1, 7) : bgColor;
  const r = parseInt(color.substring(0, 2), 16); // hexToR
  const g = parseInt(color.substring(2, 4), 16); // hexToG
  const b = parseInt(color.substring(4, 6), 16); // hexToB
  return r * 0.299 + g * 0.587 + b * 0.114 > 186 ? darkColor : lightColor;
}

export class IssueLabel extends React.PureComponent {
  constructor(props) {
    super(props);
  }

  render() {
    const bgColor = KNOWN_LABEL_COLORS.has(this.props.name)
      ? KNOWN_LABEL_COLORS.get(this.props.name)
      : this.props.color;
    return (
      <span
        key={this.props.name}
        style={{
          padding: '0 7px',
          border: '1px solid transparent',
          borderRadius: '2em',
          marginRight: '6px',
          backgroundColor: `#${bgColor}`,
          boxSizing: 'border-box',
          display: 'inline-block'
        }}
      >
        <BlockText
          type={BlockText.TYPE.PARAGRAPH}
          tagType={BlockText.TYPE.P}
          style={{
            fontSize: '12px',
            fontWeight: '500',
            lineHeight: '18px',
            color: pickTextColorBasedOnBgColor(bgColor, '#ffffff', '#000000'),
            display: 'inline-block',
            boxSizing: 'border-box'
          }}
        >
          {this.props.name}
        </BlockText>
      </span>
    );
  }
}
