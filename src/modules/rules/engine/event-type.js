import { is, isAny } from 'bpmnlint-utils';

import { requiresCheck } from './helper.js';

/**
 * A rule reporting a start event of a process the engine cannot start it with.
 *
 * A process is instantiated in one of two ways. A blank start event is instantiated as the instance data
 * declares, at the time the data states. A message or signal start event is instantiated whenever the
 * message or signal triggering it is thrown, with a generated identifier and the content of the trigger in
 * its status.
 *
 * There is no third way. A timer or conditional start event of a process the engine refuses when it reads
 * the model; an error or escalation start event it accepts and then abandons the run at, there being no
 * enclosing scope to have raised either.
 *
 * A typed start event of a plain sub-process and a blank start event of an event sub-process are equally
 * unsupported and are reported by the BPMN rules that say the same of the specification.
 */
export default function () {

  function check(node, reporter) {
    if (!requiresCheck(node) || !is(node, 'bpmn:StartEvent') || !is(node.$parent, 'bpmn:Process')) {
      return;
    }

    const eventDefinitions = node.eventDefinitions || [];

    if (!eventDefinitions.length) {
      return;
    }

    if (!isAny(eventDefinitions[0], [ 'bpmn:MessageEventDefinition', 'bpmn:SignalEventDefinition' ])) {
      reporter.report(node.id, 'Start event type not supported by execution engine');
    }
  }

  return {
    check
  };
}
