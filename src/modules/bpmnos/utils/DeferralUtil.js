import { getSequentialPerformer } from './PerformerUtil.js';

/**
 * The deferral of a decision point, read from the moddle tree alone, so that the properties panel and a test
 * ask the same way and the module is loadable under Node.
 *
 * The deferral of the delivery of messages to a catch event stands in its message guidance, and the deferral
 * of the choice of a decision task in its choice guidance. The entries of the sequential activities of a
 * performer are deferred together, so that their deferral stands not in an entry guidance but in the extension
 * elements of the `bpmn:Performer` named "Sequential" of the node declaring the performer, and is shared by
 * every sequential activity of that performer.
 */

/**
 * @param {ModdleElement} businessObject  the activity or catch event carrying the guidance
 * @param {ModdleElement} guidance        a `bpmnos:Guidance` of it
 *
 * @return {ModdleElement|undefined} the element holding the deferral of the decision point the guidance
 * belongs to: the guidance itself for a message or a choice guidance, the performer for an entry guidance,
 * and nothing for an entry guidance of an activity whose ad-hoc subprocess has no sequential performer
 */
export function getDeferralHolder(businessObject, guidance) {
  if ( guidance.get('type') !== 'entry' ) {
    return guidance;
  }

  const node = businessObject.$parent && businessObject.$parent.$instanceOf('bpmn:AdHocSubProcess') ?
    getSequentialPerformer(businessObject.$parent) : undefined;

  if ( !node ) {
    return;
  }

  return node.get('resources').find(resource =>
    resource.$instanceOf('bpmn:Performer') && resource.get('name') === 'Sequential'
  );
}

/**
 * @param {ModdleElement} holder  a `bpmnos:Guidance` or a `bpmn:Performer`
 *
 * @return {ModdleElement|undefined} the `bpmnos:Deferral` the holder states, if any
 */
export function getDeferral(holder) {
  if ( holder.$instanceOf('bpmnos:Guidance') ) {
    return holder.get('deferral')[0];
  }

  const extensionElements = holder.get('extensionElements');

  return extensionElements && extensionElements.get('values').find(value => value.$instanceOf('bpmnos:Deferral'));
}
