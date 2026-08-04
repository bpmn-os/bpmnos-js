import inherits from 'inherits';

import {
  create as svgCreate,
  append as svgAppend,
  attr as svgAttr
} from 'tiny-svg';

import BpmnRenderer from 'bpmn-js/lib/draw/BpmnRenderer';

import {
  getBusinessObject,
  is
} from 'bpmn-js/lib/util/ModelUtil';

// The marker is stated once and drawn twice, here on the shape and by createDecisionTaskSymbol away from
// the canvas, so that a decision task shown in a list is the glyph the diagram shows rather than a second
// drawing of it.
import { BRANCHING_ARROW, MARKER_STROKE_WIDTH } from './decisionTaskSymbol.js';


export default function DecisionTaskDecorator(
    config, eventBus, styles,
    pathMap, canvas, textRenderer) {

  BpmnRenderer.call(
    this,
    config, eventBus, styles,
    pathMap, canvas, textRenderer,
    1400
  );

  this.canRender = function(element) {
    if ( element.type != 'bpmn:Task' ) {
      return;
    }

    return ( getBusinessObject(element).type == "Decision" );
  };

  this.drawShape = function(parentNode, shape) {

    var bpmnShape = this.drawBpmnShape(parentNode, shape);

    var branchingArrow = drawCustomShape('path', {
      d: BRANCHING_ARROW,
      stroke: 'black',
      strokeWidth: String(MARKER_STROKE_WIDTH),
      fill: 'black'
    });
    svgAppend(parentNode, branchingArrow);

    return bpmnShape;
  };
}

function drawCustomShape(type, attr) {
  var shape = svgCreate(type);
  svgAttr(shape,attr);
  return shape;
}

inherits(DecisionTaskDecorator, BpmnRenderer);

DecisionTaskDecorator.prototype.drawBpmnShape = BpmnRenderer.prototype.drawShape;


DecisionTaskDecorator.$inject = [
  'config.bpmnRenderer',
  'eventBus',
  'styles',
  'pathMap',
  'canvas',
  'textRenderer'
];
