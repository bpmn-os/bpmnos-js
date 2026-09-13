import { is } from 'bpmnlint-utils';

/**
 * A rule that reports a process instantiating itself by signal.
 *
 * A process whose start event is a signal start event is instantiated whenever a signal of that name is
 * thrown. A signal is broadcast without a sender and without a recipient, so the engine does not restrain
 * where it comes from, and a process throwing the signal its own start event declares therefore
 * instantiates itself. That is deliberate rather than an oversight: forbidding it would deviate from the
 * specification and would also forbid a bounded recursion, a re-throw guarded by a base case being
 * legitimate.
 *
 * An unguarded one, however, does not terminate. It is reported here because nothing else will: the engine
 * permits it, and a run only ends when it reaches its end time.
 *
 * A message cannot do this — a message flow connects two participants — and needs no rule of its own,
 * `message-candidate` reporting such a throw as exchanged with nobody.
 */
export default function() {

  function check(node, reporter) {
    if (!is(node, 'bpmn:Process')) {
      return;
    }

    const flowElements = node.flowElements || [];

    const triggering = flowElements
      .filter(element => is(element, 'bpmn:StartEvent') && hasSignalEventDefinition(element))
      .map(signalNameOf)
      .filter(name => name !== undefined);

    if (!triggering.length) {
      return;
    }

    // a throw event anywhere in the process, a sub-process being part of it
    throwingSignalEventsOf(node).forEach(function(throwing) {
      const name = signalNameOf(throwing);

      if (name !== undefined && triggering.includes(name)) {
        reporter.report(throwing.id,
          `Signal '${name}' instantiates the process throwing it`,
          { subtype: 'selfTrigger' });
      }
    });
  }

  return {
    check
  };

};

function hasSignalEventDefinition(node) {
  return (node.eventDefinitions || []).some(definition => is(definition, 'bpmn:SignalEventDefinition'));
}

function signalNameOf(node) {
  const extensionElements = (node.extensionElements && node.extensionElements.values) || [],
        signal = extensionElements.find(element => is(element, 'bpmnos:Signal'));

  return signal && signal.get('name');
}

/**
 * Every throwing signal event of a scope, a sub-process contributing its own as well.
 */
function throwingSignalEventsOf(scope) {
  const events = [];

  (scope.get('flowElements') || []).forEach(function(element) {
    if (hasSignalEventDefinition(element)
        && (is(element, 'bpmn:IntermediateThrowEvent') || is(element, 'bpmn:EndEvent'))) {
      events.push(element);
    }

    if (is(element, 'bpmn:SubProcess')) {
      events.push(...throwingSignalEventsOf(element));
    }
  });

  return events;
}
