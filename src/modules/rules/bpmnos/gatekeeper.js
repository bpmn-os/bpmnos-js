import { is, isAny } from 'bpmnlint-utils';

/**
 * A rule that checks where a gatekeeper belongs: the `bpmnos:restrictions` a sequence flow carries, which
 * decide whether the flow may be taken.
 *
 * A gatekeeper decides a branch, so it belongs on the non-default outgoing flows of a **diverging exclusive
 * or inclusive gateway**: the exclusive one takes the first flow whose conditions hold, the inclusive one
 * every such flow, and either falls back to its default flow when none does. Everywhere else a flow is
 * taken without being asked — a node with a single outgoing flow departs along it, and a parallel or
 * event-based gateway copies the token to all of its outgoing flows.
 *
 * Hence two faults, and the engine is unforgiving about the first: at a diverging exclusive gateway a
 * non-default flow without a gatekeeper throws "no gatekeeper provided for sequence flow"
 * (`Token::advanceToDeparting`), so the model dies there; a gatekeeper anywhere else is never read, and the
 * flow is taken whatever it says.
 *
 * That the engine does not yet *run* a diverging inclusive gateway — `StateMachine::handleDivergingGateway`
 * throws "not yet supported" — is a separate matter, and the business of `engine/inclusive-gateway`.
 */
export default function() {

  function check(node, reporter) {
    if (!is(node, 'bpmn:SequenceFlow')) {
      return;
    }

    const source = node.sourceRef;

    if (!source) {
      return;
    }

    const diverging = isAny(source, [ 'bpmn:ExclusiveGateway', 'bpmn:InclusiveGateway' ])
      && (source.outgoing || []).length > 1;

    const consulted = diverging && source.get('default') !== node;

    const restrictions = (node.extensionElements && node.extensionElements.values || [])
      .filter(element => is(element, 'bpmnos:Restrictions'))
      .flatMap(element => element.get('restriction') || []);

    if (consulted && !restrictions.length) {
      const gateway = is(source, 'bpmn:InclusiveGateway') ? 'an inclusive' : 'an exclusive';

      reporter.report(node.id, `Outgoing flow of ${gateway} gateway without a gatekeeper`,
        { subtype: 'missing' });
    }

    if (!consulted && restrictions.length) {
      reporter.report(node.id, `Gatekeeper on a flow that is ${reason(source, diverging)}`,
        { subtype: 'unused' });
    }
  }

  return {
    check
  };

};

function reason(source, diverging) {
  if (diverging) {
    return 'the default flow of its gateway';
  }

  if ((source.outgoing || []).length < 2) {
    return 'the only outgoing flow of its source';
  }

  return 'not diverging from an exclusive or inclusive gateway';
}
