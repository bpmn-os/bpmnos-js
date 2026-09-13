import { is } from 'bpmnlint-utils';

/**
 * A rule that reports operators declared for an ad-hoc sub-process.
 *
 * The operators of an element with a scope are applied to the token at the start event of that scope, the
 * scope being instantiated there. An ad-hoc sub-process has no start event — BPMN forbids one, its
 * activities being enabled as the sub-process starts — so there is no token to apply them to and they are
 * never applied.
 *
 * The engine does not refuse such a model: the declaration is inert rather than incoherent, and nothing
 * goes wrong at execution beyond the operators doing nothing. That is exactly what makes it worth
 * reporting, an operator that never runs being invisible otherwise.
 *
 * Operators of a `bpmnos:guidance` are a different thing, evaluated where guidance is sought rather than
 * applied to a token, and are not reported here.
 */
export default function() {

  function check(node, reporter) {
    if (!is(node, 'bpmn:AdHocSubProcess')) {
      return;
    }

    const operators = statusOperatorsOf(node);

    if (operators.length) {
      reporter.report(node.id,
        `Operators of an ad-hoc sub-process are never applied, it having no start event to apply them at`,
        { subtype: 'adHocSubProcess' });
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
