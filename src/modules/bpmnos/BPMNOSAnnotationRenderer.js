import inherits from 'inherits';

import {
  append as svgAppend,
  create as svgCreate,
  attr as svgAttr
} from 'tiny-svg';

import BpmnRenderer from 'bpmn-js/lib/draw/BpmnRenderer';

import { isAnnotation } from './utils/AnnotationUtil';
import { layout, PADDING_X } from './utils/AnnotationLayout';

const STYLES = {
  title: { fontSize: 12, fontWeight: 'bold' },
  label: { fontSize: 9, fill: '#777' },
  item: { fontSize: 11 },
  type: { fontSize: 11, fontStyle: 'italic', fill: '#8a8a8a' },
  toggle: { fontSize: 10, fill: '#555' }
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

    separators.forEach(function(y) {
      const separator = svgCreate('path');

      svgAttr(separator, {
        d: `M0,${y}L${shape.width},${y}`,
        stroke: 'black',
        strokeWidth: 1
      });

      svgAppend(parentNode, separator);
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

        draw(row.text || '', STYLES.item, left + width + TYPE_GAP);
      } else if (row.kind === 'title') {

        // the header is centred, which the left-aligned no-wrap box cannot do by itself
        const { width } = textRenderer.getDimensions(row.text || '', { style: STYLES.title });

        draw(row.text || '', STYLES.title, Math.max(PADDING_X, (shape.width - width) / 2));
      } else {
        draw(row.text || '', STYLES[row.kind], left);
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
