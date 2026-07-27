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
  item: { fontSize: 11 }
};

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

      svgAppend(group, textRenderer.createText(row.text || '', {
        box: { width: shape.width, height: row.height },
        align: row.kind === 'title' ? 'center-middle' : 'left-middle',
        padding: { left: PADDING_X, right: PADDING_X, top: 0, bottom: 0 },
        style: STYLES[row.kind]
      }));

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
