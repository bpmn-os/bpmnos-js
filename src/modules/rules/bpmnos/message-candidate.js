import { is } from 'bpmnlint-utils';

import { getDefinitions } from './executionData.js';
import { agrees, headerOf, isCatching, isThrowing, messageFlowsOf, messagesOf, permits } from './message.js';

/**
 * A rule that checks that a message event may exchange its message with someone.
 *
 * The engine pairs a throwing event with a catching one when it reads the model, and a message is delivered
 * to a recipient of such a pair only. The pairing asks for the same message name, the same keys of the
 * header holding values of the same type, and message flows permitting the two, all of which the model
 * states. What it does not ask is that the values agree, which a run decides and which no rule here can
 * know, so a pair passing this rule may still exchange nothing. The other direction is what is reported: an
 * event that pairs with nobody exchanges a message under no run whatever.
 *
 * The model is read once per event rather than once per lint run, as the execution data is, and for the
 * same reason: a lint run follows an edit, and what was collected before it is stale.
 */
export default function() {

  function check(node, reporter) {
    const throwing = isThrowing(node),
          catching = isCatching(node);

    if (!throwing && !catching) {
      return;
    }

    const definitions = getDefinitions(node);

    if (!definitions) {
      return;
    }

    const messages = messagesOf(node);

    if (!messages.length) {
      reporter.report(node.id, 'Message event without a message', { subtype: 'noMessage' });

      return;
    }

    const flows = messageFlowsOf(definitions),
          counterparts = flowNodesOf(definitions).filter(throwing ? isCatching : isThrowing);

    messages.forEach(function(message) {
      const header = headerOf(node, message);

      const paired = counterparts.some(counterpart =>
        messagesOf(counterpart).some(other =>
          agrees(message, header, other, headerOf(counterpart, other))
            && (throwing ? permits(node, counterpart, flows) : permits(counterpart, node, flows))));

      if (!paired) {
        reporter.report(node.id,
          `Message '${message.get('name')}' is exchanged with no ${throwing ? 'catching' : 'throwing'} event`,
          { subtype: throwing ? 'noRecipient' : 'noSender' });
      }
    });
  }

  return {
    check
  };

};

/**
 * Every flow node of the model, a sub-process contributing its own as well.
 */
function flowNodesOf(definitions) {
  const nodes = [];

  function visit(scope) {
    (scope.get('flowElements') || []).forEach(function(element) {
      nodes.push(element);

      if (is(element, 'bpmn:SubProcess')) {
        visit(element);
      }
    });
  }

  (definitions.get('rootElements') || [])
    .filter(rootElement => is(rootElement, 'bpmn:Process'))
    .forEach(visit);

  return nodes;
}
