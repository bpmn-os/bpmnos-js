import { FIXED_KEYS, isCatching, isThrowing, messagesOf, shapeOf, typesByName } from './message.js';

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
    });
  }

  return {
    check
  };

};
