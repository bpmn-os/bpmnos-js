import { is } from 'bpmnlint-utils';

import { requiresCheck } from './helper.js';

/**
 * A rule reporting a process with more than one start event, which the engine does not run.
 *
 * The specification permits several and merely discourages them; the engine refuses them. The token at a
 * process creates the state machine for its contents from the one start node it finds, and throws
 * "process '…' has multiple start nodes" where there is more than one.
 *
 * It matters more than a count would suggest. A process has exactly one start event and that start event
 * decides how the process is instantiated: a blank one as the instance data declares, a message or signal
 * one whenever the trigger is thrown. Two would be two answers to that question.
 */
export default function() {

  function check(node, reporter) {
    if (!is(node, 'bpmn:Process') || !requiresCheck(node)) {
      return;
    }

    const startEvents = (node.flowElements || []).filter(element => is(element, 'bpmn:StartEvent'));

    if (startEvents.length > 1) {
      startEvents.forEach(function(startEvent) {
        reporter.report(startEvent.id, 'Multiple start events not supported by execution engine');
      });
    }
  }

  return {
    check
  };

};
