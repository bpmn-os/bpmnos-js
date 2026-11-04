import { is, isAny } from 'bpmnlint-utils';

import { requiresCheck } from '../engine/helper.js';

/**
 * A rule reporting compensation that BPMN-OS does not allow, which the engine refuses when it reads a model
 * (`Model::createActivity`, `Model::createEvent`).
 *
 * A compensation activity is performed without any decision and must conclude, since a failing scope waits
 * for its compensations, so it is neither a send, receive or decision task nor an ad-hoc subprocess, the
 * latter having no start event at which its entry restrictions are checked. An activity with a loop or
 * multi-instance marker is not compensated at all: the BPMN specification compensates such an activity once
 * by its compensation activity but also once for every instance, and gives every instance a compensation
 * event subprocess of its own, so that neither a compensate boundary event on it nor a compensation event
 * subprocess within it is accepted. A compensation event subprocess compensates a completed subprocess
 * whatever the status it completed with, so it declares no restrictions.
 */
export default function() {

  function check(node, reporter) {
    if (!requiresCheck(node)) {
      return;
    }

    if (is(node, 'bpmn:Activity') && node.isForCompensation) {
      if (isAny(node, [ 'bpmn:SendTask', 'bpmn:ReceiveTask' ]) || (is(node, 'bpmn:Task') && node.get('type') === 'Decision')) {
        reporter.report(node.id, 'Compensation activity that is a send, receive or decision task',
          { subtype: 'typedCompensationActivity' });
      }
      if (is(node, 'bpmn:AdHocSubProcess')) {
        reporter.report(node.id, 'Compensation activity that is an ad-hoc subprocess',
          { subtype: 'adHocCompensationActivity' });
      }
    }

    if (is(node, 'bpmn:BoundaryEvent') && isCompensate(node) && node.attachedToRef && node.attachedToRef.loopCharacteristics) {
      reporter.report(node.id, 'Compensate boundary event attached to an activity with a loop or multi-instance marker',
        { subtype: 'compensatedLoop' });
    }

    if (isCompensationEventSubProcess(node)) {
      if (is(node.$parent, 'bpmn:Activity') && node.$parent.loopCharacteristics) {
        reporter.report(node.id, 'Compensation event subprocess within a subprocess with a loop or multi-instance marker',
          { subtype: 'compensationEventSubProcessInLoop' });
      }
      if (restrictionsOf(node).length) {
        reporter.report(node.id, 'Compensation event subprocess with restrictions',
          { subtype: 'restrictedCompensationEventSubProcess' });
      }
    }
  }

  return {
    check
  };
}

function isCompensate(event) {
  return (event.eventDefinitions || []).some(definition => is(definition, 'bpmn:CompensateEventDefinition'));
}

function isCompensationEventSubProcess(node) {
  return is(node, 'bpmn:SubProcess') && node.triggeredByEvent &&
    (node.flowElements || []).some(element => is(element, 'bpmn:StartEvent') && isCompensate(element));
}

/**
 * The restrictions an element declares in its status.
 */
function restrictionsOf(node) {
  const extensionElements = (node.extensionElements && node.extensionElements.values) || [],
        status = extensionElements.find(element => is(element, 'bpmnos:Status'));

  if (!status) {
    return [];
  }

  return (status.get('restrictions') || []).flatMap(restrictions => restrictions.get('restriction') || []);
}
