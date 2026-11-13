/**
 * The sequential performer of an ad-hoc subprocess, read from the moddle tree alone, so that the modeller and
 * the lint rules ask the same way and the module is loadable under Node.
 *
 * A node declares a sequential performer by a `bpmn:Performer` named "Sequential" among its resources. The
 * performer of an ad-hoc subprocess is the nearest such node, searched from the ad-hoc subprocess itself up
 * through the enclosing activities to the process, as the engine searches it when it reads a model
 * (`SequentialAdHocSubProcess`). The search ends before an enclosing ad-hoc subprocess, since a child of that
 * ad-hoc subprocess holds its performer while it is executed, so that the activities of a nested ad-hoc
 * subprocess could never obtain the same performer.
 */

/**
 * @param {ModdleElement} businessObject
 *
 * @return {boolean} whether the element declares a sequential performer itself
 */
export function declaresSequentialPerformer(businessObject) {
  return (businessObject.get('resources') || []).some(resource =>
    resource.$instanceOf('bpmn:Performer') && resource.get('name') === 'Sequential'
  );
}

/**
 * @param {ModdleElement} adHocSubProcess
 *
 * @return {ModdleElement|undefined} the activity or process whose performer the ad-hoc subprocess is
 * associated to, or nothing if no node before the next enclosing ad-hoc subprocess declares one
 */
export function getSequentialPerformer(adHocSubProcess) {
  let node = adHocSubProcess;

  while ( node ) {
    if ( ( node.$instanceOf('bpmn:Activity') || node.$instanceOf('bpmn:Process') ) && declaresSequentialPerformer(node) ) {
      return node;
    }
    if ( node.$instanceOf('bpmn:Process') ) {
      return;
    }
    node = node.$parent;
    if ( node && node.$instanceOf('bpmn:AdHocSubProcess') ) {
      return;
    }
  }
}
