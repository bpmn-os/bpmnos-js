import { is, isAny } from 'bpmnlint-utils';

import { attributeName, declaredAttributes, visibleAttributes } from './executionData.js';

/**
 * A rule that checks the attributes the engine reserves.
 *
 * Two identifiers mean something to the engine wherever they appear. A status attribute with the id
 * `Timestamp` holds the time a token stands at, and a data attribute with the id `Instance` holds the
 * instance identifier. The engine reads each by position, the first status attribute and the first data
 * attribute, and moves them there as it reads the model — so a process declaring no `Timestamp` does not
 * fail but has whatever it declared first read as its timestamp. They are matched by identifier and not by
 * name, as the engine matches them; the name is for display and for expressions to refer to.
 *
 * What may write them is narrower still. An operator may never assign the instance identifier, and may
 * advance the timestamp only where the element it belongs to takes time: not an event, which is
 * instantaneous, and not a send, receive or decision task, each of which completes upon an event of its own.
 * The engine refuses all of those as it reads the model, so those reports are early warnings of a refusal.
 */
export default function() {

  const TIMESTAMP = 'Timestamp',
        INSTANCE = 'Instance';

  // `name := expr` and the compound assignments; anything else states no target
  const ASSIGNMENT = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?::=|\+=|-=|\*=|\/=)/;

  function check(node, reporter) {
    if (is(node, 'bpmn:Process') && node.isExecutable) {
      const declared = declaredAttributes(node);

      if (!declared.some(attribute => attribute.scope === 'status' && attribute.id === TIMESTAMP)) {
        reporter.report(node.id,
          `Process declares no status attribute with the id '${TIMESTAMP}', so the first it declares is read as the timestamp`,
          { subtype: 'timestampMissing' });
      }

      if (!declared.some(attribute => attribute.scope === 'data' && attribute.id === INSTANCE)) {
        reporter.report(node.id,
          `Process declares no data attribute with the id '${INSTANCE}', so the first it declares is read as the instance identifier`,
          { subtype: 'instanceMissing' });
      }
    }

    const reserved = reservedNames(node);

    operatorsOf(node).forEach(function(operator) {
      const target = assignedName(operator);

      if (target === undefined) {
        return;
      }

      if (reserved.get(target) === INSTANCE) {
        reporter.report(node.id,
          `Operator '${operator.get('id')}' assigns the instance identifier, which the engine refuses`,
          { subtype: 'instanceAssigned' });
      }
      else if (reserved.get(target) === TIMESTAMP && !mayAdvanceTime(node)) {
        reporter.report(node.id,
          `Operator '${operator.get('id')}' advances the timestamp, which the engine refuses here`,
          { subtype: 'timestampAdvanced' });
      }
    });
  }

  return {
    check
  };

  /**
   * The names, at this element, of the attributes reserved under those identifiers. An element names them
   * as it likes, so what an operator refers to is resolved through the attributes visible here.
   */
  function reservedNames(node) {
    return new Map(
      visibleAttributes(node)
        .filter(attribute => attribute.id === TIMESTAMP || attribute.id === INSTANCE)
        .map(attribute => [ attributeName(attribute), attribute.id ])
    );
  }

  function assignedName(operator) {
    const match = ASSIGNMENT.exec(operator.get('expression') || '');

    return match ? match[1] : undefined;
  }

  /**
   * Whether an operator of this element may advance the timestamp. A regular task takes time, which is how
   * its duration is modelled. An event does not, being instantaneous, a scope has no operators, and a send,
   * receive or decision task does not, each completing upon an event of its own.
   */
  function mayAdvanceTime(node) {
    if (isAny(node, [ 'bpmn:Process', 'bpmn:SubProcess' ])) {
      return false;
    }

    if (isAny(node, [ 'bpmn:SendTask', 'bpmn:ReceiveTask' ]) || isDecisionTask(node)) {
      return false;
    }

    return is(node, 'bpmn:Task');
  }

  function isDecisionTask(node) {
    return is(node, 'bpmn:Task') && node.get('type') === 'Decision';
  }
};

function extensionElementsOf(node) {
  return (node.extensionElements && node.extensionElements.values) || [];
}

function operatorsOf(node) {
  const status = extensionElementsOf(node).find(element => is(element, 'bpmnos:Status'));

  if (!status) {
    return [];
  }

  return (status.get('operators') || []).flatMap(operators => operators.get('operator') || []);
}
