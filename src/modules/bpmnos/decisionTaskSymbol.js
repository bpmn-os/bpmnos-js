/**
 * The decision task as a symbol, and the marker the canvas draws it with.
 *
 * A decision task is a BPMN task carrying a marker, as a user task and a manual task are. The marker is
 * defined here once and used twice: `DecisionTaskDecorator` appends it to the shape a diagram draws, and
 * `createDecisionTaskSymbol` composes it with BPMN's task outline into a symbol small enough for a list or
 * a legend. A consumer that shows a decision task away from the canvas therefore shows the same glyph the
 * canvas shows, rather than a second drawing of it that can drift.
 *
 * The symbol is drawn on the two thousand and forty-eight unit square `bpmn-font` draws BPMN's own symbols
 * on, so that a decision task sits beside a participant, a sub-process or a manual task at one size and
 * with one line weight.
 */

const SVG = 'http://www.w3.org/2000/svg';

/**
 * The marker of a decision task: an arrow that branches, in the twenty-four unit space bpmn-js gives a task
 * marker. It is filled and stroked, the stroke being what gives the arrow its weight at the size a diagram
 * draws it, so a consumer drawing it must apply both.
 */
export const BRANCHING_ARROW =
  'm 12.3765 9.8338 c 0.4627 -1.0288 0.7177 -1.5952 2.2439 -1.5952 h 0.9873 v 2.2002 l 3.2183 -3.2198 l '
  + '-3.2183 -3.219 v 2.2001 h -0.9873 c -2.844 0 -3.6014 1.6833 -4.1028 2.7972 c -0.4247 0.9438 -0.6395 '
  + '1.4209 -1.7567 1.4835 h -3.5866 l 3.6643 0.0012 c 1.2193 0.0612 1.9879 0.4795 2.5146 1.0179 c 0.503 '
  + '-0.5141 0.7853 -1.1373 1.0233 -1.6661 z m 6.4493 5.9467 l -3.2183 -3.219 v 2.2001 h -0.9873 c -1.526 '
  + '0 -1.781 -0.5667 -2.2439 -1.5952 c -0.2378 -0.5286 -0.5203 -1.152 -1.0233 -1.6662 c -0.5267 -0.5383 '
  + '-1.2953 -0.9568 -2.5146 -1.0179 l -3.6643 -0.0014 v 2.0383 h 3.5866 c 1.1175 0.0625 1.3321 0.5397 '
  + '1.7567 1.4835 c 0.5011 1.1139 1.2586 2.7972 4.1028 2.7972 h 0.9873 v 2.2002 z';

/** The stroke width the marker is drawn with, in its own space. */
export const MARKER_STROKE_WIDTH = 0.5;

/**
 * BPMN's task: the rounded rectangle as an outline, filled rather than stroked, so that a symbol is one
 * shape at any size and needs nothing of a stylesheet.
 */
export const TASK_OUTLINE =
  'M441.139 273.613C266.445 273.613 124.314 415.744 124.314 590.438L124.314 1457.56C124.314 1632.26 '
  + '266.445 1774.39 441.139 1774.39L1606.86 1774.39C1781.56 1774.39 1923.69 1632.26 1923.69 '
  + '1457.56L1923.69 590.438C1923.69 415.744 1781.56 273.613 1606.86 273.613L441.139 273.613ZM441.139 '
  + '373.555L1606.86 373.555C1727.9 373.555 1823.74 469.402 1823.74 590.438L1823.74 1457.56C1823.74 '
  + '1578.6 1727.9 1674.44 1606.86 1674.44L441.139 1674.44C320.102 1674.44 224.256 1578.6 224.256 '
  + '1457.56L224.256 590.438C224.256 469.402 320.102 373.555 441.139 373.555Z';

/**
 * What carries the marker's own space into the symbol's square. BPMN places a typed task's marker in the
 * upper left of the shape, and this places it there: the arrow spans a little over two fifths of the
 * rectangle's interior across and a little under three fifths down, inset about a tenth from the upper and
 * left edges, which is where `bpmn-font` puts the marker of its own typed tasks.
 */
export const MARKER_TRANSFORM = 'translate(140,300) scale(50)';

/** The square the symbol is drawn on, hugging the rectangle and a token standing on its upper boundary. */
export const VIEW_BOX = '124 -127 1800 1902';

/**
 * The middle of the rectangle's upper boundary line, which is where a token standing at the node sits. It
 * is the middle of the line rather than its outer edge, the outline being a shape of some thickness, and a
 * token placed on the edge reading as sitting above the rectangle rather than on it.
 */
export const BOUNDARY_TOP = 323.61;

/** The horizontal middle of the square, which is where a token on the upper boundary is centred. */
export const BOUNDARY_CENTRE = 1024;

/**
 * The decision task drawn as one SVG element, optionally marked with a token on its upper boundary.
 *
 * The drawing is one element rather than an icon with something placed over it, so that the rectangle, the
 * marker and the token scale together and are positioned by nothing outside the element. The rectangle and
 * the marker take `currentColor`, so a consumer colours the symbol by colouring its container.
 *
 * @param {Object} [options]
 * @param {number} [options.width=28]   the width the symbol is drawn at
 * @param {number} [options.height=24]  the height it is drawn at
 * @param {string} [options.color]      the colour of a token on the upper boundary, or nothing for no token
 * @param {number} [options.tokenRadius=420]  the radius of that token, on the symbol's own square
 * @param {string} [options.className]  a class put on the element
 * @returns {SVGElement}
 */
export function createDecisionTaskSymbol(options = {}) {
  const svg = document.createElementNS(SVG, 'svg');

  svg.setAttribute('viewBox', VIEW_BOX);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('width', String(options.width != null ? options.width : 28));
  svg.setAttribute('height', String(options.height != null ? options.height : 24));
  svg.setAttribute('aria-hidden', 'true');

  if (options.className) {
    svg.setAttribute('class', options.className);
  }

  const outline = document.createElementNS(SVG, 'path');

  outline.setAttribute('d', TASK_OUTLINE);
  outline.setAttribute('fill', 'currentColor');
  svg.appendChild(outline);

  const marker = document.createElementNS(SVG, 'path');

  marker.setAttribute('d', BRANCHING_ARROW);
  marker.setAttribute('transform', MARKER_TRANSFORM);
  marker.setAttribute('fill', 'currentColor');
  marker.setAttribute('stroke', 'currentColor');
  marker.setAttribute('stroke-width', String(MARKER_STROKE_WIDTH));
  svg.appendChild(marker);

  if (options.color) {
    const token = document.createElementNS(SVG, 'circle');

    token.setAttribute('cx', String(BOUNDARY_CENTRE));
    token.setAttribute('cy', String(BOUNDARY_TOP));
    token.setAttribute('r', String(options.tokenRadius != null ? options.tokenRadius : 420));
    token.setAttribute('fill', options.color);
    token.setAttribute('stroke', 'rgba(0, 0, 0, 0.2)');
    token.setAttribute('stroke-width', '60');
    svg.appendChild(token);
  }

  return svg;
}
