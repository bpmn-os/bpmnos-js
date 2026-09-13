import { FIXED_KEYS, isCatching, isThrowing, messagesOf, shapeOf, triggeringMessages, typesByName } from './message.js';
import { getDefinitions } from './executionData.js';

/**
 * A rule that checks what the parameters of a message header state.
 *
 * The engine needs the type of every header entry when it reads the model, because it reports a header by
 * that type and because two events may exchange a message only where they hold values of the same type
 * under the same key. A parameter therefore states the name of a declared attribute or a quoted string,
 * and nothing else: an unquoted string is a name that no attribute carries, and an expression states a
 * value whose type follows from a run rather than from the model. A parameter without a value is not a
 * fault; its key holds no value, and every value held under that key matches it.
 *
 * The keys `name`, `sender` and `recipient` hold a message name and instance identifiers, so a parameter
 * stating one of them states a string.
 */
export default function() {

  function check(node, reporter) {
    if (!isThrowing(node) && !isCatching(node)) {
      return;
    }

    const types = typesByName(node);

    messagesOf(node).forEach(function(message) {
      const where = `of message '${message.get('name')}'`;

      (message.get('parameter') || []).forEach(function(parameter) {
        const key = parameter.get('name'),
              shape = shapeOf(parameter, types);

        if (shape.kind === 'illegal') {
          reporter.report(node.id,
            `Header parameter '${key}' ${where} states '${shape.value}', which is neither an attribute nor a quoted string`,
            { subtype: 'illegalValue' });

          return;
        }

        if (FIXED_KEYS.includes(key) && shape.kind !== 'unset' && shape.type !== 'string') {
          reporter.report(node.id,
            `Header parameter '${key}' ${where} must state a string`,
            { subtype: 'identifierNotString' });
        }
      });

      reportTriggeringHeader(node, message, reporter);
    });
  }

  return {
    check
  };

};

/**
 * A message instantiating a process is matched by its name alone, the instance not existing before it
 * arrives, so a header entry is never read and states something the execution does not honour.
 *
 * The two sides are refused for the same reason but not in the same terms. The start event may state no
 * parameter at all, none of them being read. An element throwing such a message may not state a key beyond
 * the three every header carries — a key the start event cannot match, since it states none, would prevent
 * the two from ever being paired while the name alone still instantiated the process — and may not name a
 * recipient, there being no instance to name until the message creates one.
 */
function reportTriggeringHeader(node, message, reporter) {
  const definitions = getDefinitions(node);

  if (!definitions) {
    return;
  }

  const name = message.get('name'),
        startEvent = triggeringMessages(definitions).get(name),
        parameters = message.get('parameter') || [];

  if (!startEvent) {
    return;
  }

  if (startEvent === node) {
    if (parameters.length) {
      reporter.report(node.id,
        `Message start event of process '${node.$parent.id}' must state no header parameter, message '${name}' being matched by its name alone`,
        { subtype: 'triggerHeader' });
    }

    return;
  }

  if (!isThrowing(node)) {
    return;
  }

  if (parameters.some(parameter => !FIXED_KEYS.includes(parameter.get('name')))) {
    reporter.report(node.id,
      `Message '${name}' instantiates process '${startEvent.$parent.id}' and must state no header parameter beyond ${FIXED_KEYS.join(', ')}`,
      { subtype: 'triggerHeader' });
  }

  if (parameters.some(parameter => parameter.get('name') === 'recipient')) {
    reporter.report(node.id,
      `Message '${name}' instantiates process '${startEvent.$parent.id}' and must state no recipient, the instance not existing until it arrives`,
      { subtype: 'triggerRecipient' });
  }
}
