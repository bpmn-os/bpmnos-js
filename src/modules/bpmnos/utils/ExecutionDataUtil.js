import { is, getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';

// An execution data box is a plain bpmn:TextAnnotation marked with bpmnos:executionData, attached to the
// element it describes by a bpmn:Association. The attribute's presence marks the annotation as ours; its
// value carries the display state, and anything unrecognised counts as visible.
export const VISIBLE = 'visible';
export const HIDDEN = 'hidden';

export function isExecutionData(element) {
  return is(element, 'bpmn:TextAnnotation') && !!getBusinessObject(element).get('executionData');
}

export function isHidden(element) {
  return isExecutionData(element) && getBusinessObject(element).get('executionData') === HIDDEN;
}

/**
 * The execution data box attached to an element, if it has one.
 */
export function getExecutionData(host) {
  return (host.outgoing || [])
    .map(connection => connection.target)
    .filter(isExecutionData)[0];
}

/**
 * The element an execution data box describes — known through the association alone.
 */
export function getHost(box) {
  return (box.incoming || []).map(connection => connection.source)[0];
}

/**
 * Elements that may carry execution data. Labels, the root, other annotations and connections may not.
 */
export function canHaveExecutionData(element) {
  if (element.labelTarget || isExecutionData(element)) {
    return false;
  }

  return is(element, 'bpmn:FlowNode')
    || is(element, 'bpmn:Participant')
    || is(element, 'bpmn:DataObjectReference')
    || is(element, 'bpmn:DataStoreReference');
}
