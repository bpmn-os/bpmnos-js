import inherits from 'inherits';

import {
  append as svgAppend,
  create as svgCreate,
  attr as svgAttr
} from 'tiny-svg';

import BpmnRenderer from 'bpmn-js/lib/draw/BpmnRenderer';

import { isAnnotation } from './utils/AnnotationUtil';
import { layout, DOUBLE_GAP, PADDING_X } from './utils/AnnotationLayout';

/**
 * The disclosure caret of `bpmn-js-side-panel`, so a fold on the canvas is the same sign as a fold in the
 * panel. The path is that component's own, a rounded corner turned by 45 degrees, and it points right while
 * the group is folded and down while it is open, as the panel turns it by 90 degrees when it opens.
 */
const CARET = 'M10,12 L3,12 C2.44771525,12 2,11.5522847 2,11 C2,10.4477153 2.44771525,10 3,10 ' +
  'L8,10 L8,5 C8,4.44771525 8.44771525,4 9,4 C9.55228475,4 10,4.44771525 10,5 L10,12 Z';

const CARET_SIZE = 11,
      CARET_GAP = 3;

const STYLES = {
  title: { fontSize: 12, fontWeight: 'bold' },

  // the kind a compartment holds — status, data, globals — set small and in capitals, so it names what
  // follows without competing with it
  label: { fontSize: 10, fill: '#555' },

  // what a node declares: the name in black, the type beside it in dark italics
  item: { fontSize: 11 },
  type: { fontSize: 11, fontStyle: 'italic', fill: '#555' },

  // the folds, which are apparatus rather than content, and are therefore the lightest thing in the box
  toggle: { fontSize: 10, fill: '#8a8a8a' },

  // an identifier standing in for a name the model does not carry
  fallback: { fontSize: 11, fill: '#cc0000' }
};

// between the type and the name it qualifies
const TYPE_GAP = 4;

// how far a nested item — a message content, a signal content — sits in from its parent line
const INDENT = 10;

// wide enough that the text renderer never breaks a line; the box clips instead
const NO_WRAP_WIDTH = 10000;

/**
 * Draws the execution data box: a header naming the element, then one compartment per kind of declaration,
 * separated by full-width rules. Everything shown is derived from the host at draw time.
 */
export default function BPMNOSAnnotationRenderer(
    config, eventBus, styles,
    pathMap, canvas, textRenderer, executionData) {

  BpmnRenderer.call(
    this,
    config, eventBus, styles,
    pathMap, canvas, textRenderer,
    1400
  );

  this.canRender = function(element) {
    return isAnnotation(element);
  };

  this.drawShape = function(parentNode, shape) {
    const box = svgCreate('rect');

    svgAttr(box, {
      x: 0,
      y: 0,
      width: shape.width,
      height: shape.height,
      fill: 'white',
      fillOpacity: 0.95,
      stroke: 'black',
      strokeWidth: 1
    });

    svgAppend(parentNode, box);

    const { rows, separators } = layout(shape, executionData);

    const rule = function(y) {
      const separator = svgCreate('path');

      svgAttr(separator, {
        d: `M0,${y}L${shape.width},${y}`,
        stroke: 'black',
        strokeWidth: 1
      });

      svgAppend(parentNode, separator);
    };

    separators.forEach(function(separator) {
      rule(separator.y);

      if (separator.double) {
        rule(separator.y + DOUBLE_GAP);
      }
    });

    // Nothing wraps: a row is one line, cut off at the box edge. The width is the user's — annotations
    // resize east and west — so an expression too long for the box is a matter of widening it.
    const clipId = 'bpmnos-annotation-clip-' + shape.id,
          clipPath = svgCreate('clipPath'),
          clipRect = svgCreate('rect');

    svgAttr(clipPath, { id: clipId });
    svgAttr(clipRect, { x: 0, y: 0, width: shape.width, height: shape.height });
    svgAppend(clipPath, clipRect);
    svgAppend(parentNode, clipPath);

    rows.forEach(function(row) {
      const group = svgCreate('g');

      svgAttr(group, { transform: `translate(0, ${row.y})`, 'clip-path': `url(#${clipId})` });

      const draw = function(text, style, left) {
        svgAppend(group, textRenderer.createText(text, {

          // a box far wider than the shape, so the text renderer never breaks the line
          box: { width: NO_WRAP_WIDTH, height: row.height },
          align: 'left-middle',
          padding: { left, right: 0, top: 0, bottom: 0 },
          style
        }));
      };

      const left = PADDING_X + (row.indent || 0) * INDENT;

      // an item is drawn as two runs, so the type can be set apart from the name it qualifies
      if (row.kind === 'item' && row.type) {
        draw(row.type, STYLES.type, left);

        const { width } = textRenderer.getDimensions(row.type, { style: STYLES.type });

        draw(row.text || '', row.fallback ? STYLES.fallback : STYLES.item, left + width + TYPE_GAP);
      } else if (row.kind === 'toggle') {
        const caret = svgCreate('path'),
              scale = CARET_SIZE / 16;

        // a fold standing for a compartment is set as that compartment's label, the rest as apparatus
        const style = row.emphasis ? STYLES.label : STYLES.toggle;

        // The caret is placed by its rightmost point rather than by its box or its tip. Pointing right that
        // point is the tip itself, at (11.66, 8) of the 16-unit box; turned down it is the end of the right
        // arm, at (13.24, 6), the tip having swung to the bottom. Anchoring the tip in both positions would
        // hang the open mark four pixels low, and anchoring the box would misplace both.
        //
        // Sideways it keeps its ink centred in the space reserved for it, that ink being 8 by 8 about
        // (6, 8) and about (8, 6) once turned.
        const anchor = row.collapsed ? 8 : 6,
              ink = row.collapsed ? { x: 6, y: 8 } : { x: 8, y: 6 };

        // the row's text is centred as a line, descenders and all, so its letters read a little above the
        // middle of the row; the tip follows them rather than the geometry
        const middle = row.height / 2 - style.fontSize * 0.07;

        svgAttr(caret, {
          d: CARET,
          fill: style.fill,
          'fill-rule': 'evenodd',
          transform:
            `translate(${left + CARET_SIZE / 2 - scale * ink.x}, ${middle - scale * anchor}) ` +
            `scale(${scale}) rotate(${row.collapsed ? 0 : 90} 8 8) rotate(-45 6 8)`
        });

        svgAppend(group, caret);

        draw(row.emphasis ? (row.text || '').toUpperCase() : (row.text || ''), style,
          left + CARET_SIZE + CARET_GAP);
      } else if (row.kind === 'title') {

        // the header is centred, which the left-aligned no-wrap box cannot do by itself
        const { width } = textRenderer.getDimensions(row.text || '', { style: STYLES.title });

        draw(row.text || '', STYLES.title, Math.max(PADDING_X, (shape.width - width) / 2));
      } else {
        // a compartment label is set in capitals; one subdued to a list within a list is not
        const label = row.kind === 'label' && !row.subdued;

        const text = label ? (row.text || '').toUpperCase() : (row.text || '');

        const style = row.fallback
          ? STYLES.fallback
          : (row.subdued ? STYLES.toggle : STYLES[row.kind]);

        draw(text, style, left);

        // a row whose closing part alone stands in for a missing name, the objective term above all
        if (row.fallbackText) {
          const { width } = textRenderer.getDimensions(text, { style });

          // the same gap that sets a type apart from the name it qualifies, since a trailing space in the
          // text is not measured and the two runs would otherwise touch
          draw(row.fallbackText, STYLES.fallback, left + width + TYPE_GAP);
        }
      }

      svgAppend(parentNode, group);
    });

    return box;
  };
}

inherits(BPMNOSAnnotationRenderer, BpmnRenderer);

BPMNOSAnnotationRenderer.$inject = [
  'config.bpmnRenderer',
  'eventBus',
  'styles',
  'pathMap',
  'canvas',
  'textRenderer',
  'executionData'
];
