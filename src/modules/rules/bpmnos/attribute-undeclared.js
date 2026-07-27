import { is } from 'bpmnlint-utils';

import { visibleNames } from './executionData.js';

/**
 * A rule that checks that the attributes a node names outright are declared and visible at it.
 *
 * "Visible" is what the execution data registry reports: the node's own status, data and global attributes
 * plus everything inherited from its ancestors, the same account the engine works from.
 *
 * Only places that name an attribute **directly** are checked — the contents of messages and signals, whose
 * `attribute` is a plain name mapped to a key. Restrictions, operators, conditions and parameter values hold
 * LIMEX expressions instead, and are not checked here: the engine compiles those against its attribute
 * registry and rejects unknown names itself, so validating them belongs where the engine can be asked
 * (bpmnos-workbench, with the engine WASM). Approximating that grammar with pattern matching produced false
 * positives — an aggregator's bound variable in `min{ d in departures | d >= timestamp }` is not an
 * attribute — which is why this rule was disabled before.
 */
export default function() {

  function check(node, reporter) {
    const extensionElements = node.extensionElements;

    if (!extensionElements) {
      return;
    }

    const names = visibleNames(node);

    const report = (used, where) => {
      if (used && !names.has(used)) {
        reporter.report(node.id, `Undeclared attribute '${used}' used in ${where}`);
      }
    };

    (extensionElements.values || []).forEach(function(element) {

      if (is(element, 'bpmnos:Messages')) {
        (element.get('message') || []).forEach(message =>
          (message.get('content') || []).forEach(content =>
            report(content.get('attribute'),
              `content '${content.get('key')}' of message '${message.get('name')}'`)));
      }

      if (is(element, 'bpmnos:Signal')) {
        (element.get('content') || []).forEach(content =>
          report(content.get('attribute'),
            `content '${content.get('key')}' of signal '${element.get('name')}'`));
      }
    });
  }

  return {
    check
  };

};
