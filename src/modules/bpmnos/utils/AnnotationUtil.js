import { is, getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';

// An execution data box is a plain bpmn:TextAnnotation marked with bpmnos:annotation, attached to the
// element it describes by a bpmn:Association. The attribute's presence marks the annotation as ours; its
// value carries the display state, and anything unrecognised counts as visible.
export const VISIBLE = 'visible';
export const HIDDEN = 'hidden';

export function isAnnotation(element) {
  return is(element, 'bpmn:TextAnnotation') && !!getBusinessObject(element).get('annotation');
}

export function isHidden(element) {
  return isAnnotation(element) && getBusinessObject(element).get('annotation') === HIDDEN;
}

/**
 * The execution data box attached to an element, if it has one.
 */
export function getAnnotation(host) {
  return (host.outgoing || [])
    .map(connection => connection.target)
    .filter(isAnnotation)[0];
}

/**
 * The element an execution data box describes — known through the association alone.
 */
export function getHost(box) {
  return (box.incoming || []).map(connection => connection.source)[0];
}

/**
 * The association attaching an execution data box to the element it describes.
 */
export function isAnnotationAssociation(element) {
  return !!element.waypoints && !!element.target && isAnnotation(element.target);
}

/**
 * Such an association may not be deleted on its own — that would leave a box describing nothing. It goes
 * only with the box or with the host, so deleting either of those is allowed to take it along.
 */
export function isProtectedAssociation(element, elements) {
  if (!isAnnotationAssociation(element)) {
    return false;
  }

  return elements.indexOf(element.target) === -1
    && elements.indexOf(getHost(element.target)) === -1;
}

/**
 * Elements that may carry execution data. Labels, the root, other annotations and connections may not.
 */
export function canHaveAnnotation(element) {
  if (element.labelTarget || isAnnotation(element)) {
    return false;
  }

  // data object and data store references carry no token, so there is nothing to show for them — the
  // attributes they hold appear as the data of the scope that owns them
  return is(element, 'bpmn:FlowNode')
    || is(element, 'bpmn:Participant');
}
