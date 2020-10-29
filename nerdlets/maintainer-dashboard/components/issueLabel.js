import React from 'react';
import PropTypes from 'prop-types';
import { BlockText } from 'nr1';

/**
 * Default GitHub label colors, pulled by creating a repository. Used to correct
 * for some slightly different color shades caused by a GitHub color transition
 * awhile ago.
 */
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
  ['repolinter', 'fbca04'],
]);

/**
 * Function to automatically select light or dark text based off of the
 * background color the text will sit on. Heavily inspired by
 * https://stackoverflow.com/questions/3942878/how-to-decide-font-color-in-whit
 * -or-black-depending-on-background-color/41491220#41491220
 *
 * @param {string} bgColor The background color text will sit on, in 6 character
 *     hex format.
 * @param {any} lightColor The light option to use for text color.
 * @param {any} darkColor The dark option to use for text color.
 * @returns {any} Either lightColor or darkColor depending on bgColor's shade.
 */
function pickTextColorBasedOnBgColor(bgColor, lightColor, darkColor) {
  const color = bgColor.charAt(0) === '#' ? bgColor.substring(1, 7) : bgColor;
  const r = parseInt(color.substring(0, 2), 16); // hexToR
  const g = parseInt(color.substring(2, 4), 16); // hexToG
  const b = parseInt(color.substring(4, 6), 16); // hexToB
  return r * 0.299 + g * 0.587 + b * 0.114 > 186 ? darkColor : lightColor;
}

/**
 * A component to imitate a GitHub Issue/PR label with NR styling. Inspired by
 * primer/css and some inspect elementing.
 *
 * This component will automatically adjust label colors for known default
 * labels (in `KNOWN_LABEL_COLORS`) to prevent slightly different label colors
 * with the same name from creating visual confusion.
 */
export default class IssueLabel extends React.PureComponent {
  static propTypes = {
    /** The label name (ex. "bug") */
    name: PropTypes.string.isRequired,
    /** The label color in hex format */
    color: PropTypes.string.isRequired,
  };

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
          display: 'inline-block',
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
            boxSizing: 'border-box',
          }}
        >
          {this.props.name}
        </BlockText>
      </span>
    );
  }
}
