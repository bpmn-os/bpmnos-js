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
 * Groups of the box that can be collapsed, and whether they start collapsed: what the element inherits is
 * folded away, what it declares itself is not. Globals are inherited by every element, so the whole
 * compartment folds.
 *
 * The state is session-only, kept on the element rather than in the file — whether it should persist is
 * still open, and an element is rebuilt on import, so a reload starts from these defaults.
 */
const COLLAPSED_BY_DEFAULT = {
  statusInherited: true,
  dataInherited: true,
  globals: true,
  entryRestrictions: true,
  completionRestrictions: true,
  exitRestrictions: true
};

// every guidance compartment starts folded, whatever its type
const COLLAPSED_PREFIXES = [ 'guidance:' ];

export function isCollapsed(box, key) {
  const state = box.collapsedGroups || {};

  if (key in state) {
    return state[key];
  }

  return !!COLLAPSED_BY_DEFAULT[key] || COLLAPSED_PREFIXES.some(prefix => key.startsWith(prefix));
}

export function toggleCollapsed(box, key) {
  const state = box.collapsedGroups = box.collapsedGroups || {};

  state[key] = !isCollapsed(box, key);
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
  // attributes they hold appear as the data of the scope that owns them. A sequence flow does carry one,
  // and is where a gatekeeper lives.
  return is(element, 'bpmn:FlowNode')
    || is(element, 'bpmn:Participant')
    || is(element, 'bpmn:SequenceFlow');
}
