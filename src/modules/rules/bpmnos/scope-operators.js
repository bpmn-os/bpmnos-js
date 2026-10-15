import { is, isAny } from 'bpmnlint-utils';

/**
 * A rule that reports operators declared for a scope or a gateway.
 *
 * A task and every event have operators of their own. A scope, a process or a sub-process of any kind, has none:
 * what is to happen when it starts is stated by the operators of its start event, and the engine refuses a model
 * declaring operators for a scope. A gateway has no operators either; the engine does not refuse them, but never
 * applies them, an operator that never runs being invisible otherwise.
 *
 * Operators of a `bpmnos:guidance` are a different thing, evaluated where guidance is sought rather than
 * applied to a token, and are not reported here.
 */
export default function() {

  function check(node, reporter) {
    if (!isAny(node, [ 'bpmn:Process', 'bpmn:SubProcess', 'bpmn:Gateway' ])) {
      return;
    }

    if (!statusOperatorsOf(node).length) {
      return;
    }

    if (is(node, 'bpmn:Gateway')) {
      reporter.report(node.id,
        `Operators of a gateway are never applied`,
        { subtype: 'gateway' });
    }
    else {
      reporter.report(node.id,
        `A scope has no operators; what is to happen when it starts is stated by the operators of its start event`,
        { subtype: 'scope' });
    }
  }

  return {
    check
  };

};

/**
 * The operators an element declares in its status, which are the ones applied to a token. Those of a
 * guidance are reached through the guidance and are deliberately not collected.
 */
function statusOperatorsOf(node) {
  const extensionElements = (node.extensionElements && node.extensionElements.values) || [],
        status = extensionElements.find(element => is(element, 'bpmnos:Status'));

  if (!status) {
    return [];
  }

  return (status.get('operators') || []).flatMap(operators => operators.get('operator') || []);
}
