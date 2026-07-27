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
  type: { fontSize: 11, fontStyle: 'italic', fill: '#8a8a8a' }
};

// between the type and the name it qualifies
const TYPE_GAP = 4;

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

    rows.forEach(function(row) {
      const group = svgCreate('g');

      svgAttr(group, { transform: `translate(0, ${row.y})` });

      const draw = function(text, style, left) {
        svgAppend(group, textRenderer.createText(text, {
          box: { width: shape.width, height: row.height },
          align: row.kind === 'title' ? 'center-middle' : 'left-middle',
          padding: { left, right: PADDING_X, top: 0, bottom: 0 },
          style
        }));
      };

      // an item is drawn as two runs, so the type can be set apart from the name it qualifies
      if (row.kind === 'item' && row.type) {
        draw(row.type, STYLES.type, PADDING_X);

        const { width } = textRenderer.getDimensions(row.type, { style: STYLES.type });

        draw(row.text || '', STYLES.item, PADDING_X + width + TYPE_GAP);
      } else {
        draw(row.text || '', STYLES[row.kind], PADDING_X);
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
