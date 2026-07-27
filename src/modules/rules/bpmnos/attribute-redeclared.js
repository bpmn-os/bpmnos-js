import { attributeName, visibleAttributes } from './executionData.js';

/**
 * A rule that checks that a node does not redeclare what it already inherits.
 *
 * Both halves come from the execution data registry, which reports every attribute visible at the node
 * together with the element declaring it — so "own" and "inherited" are read off one account rather than
 * re-derived here, which is what made the previous version unreliable: it walked `$parent` over
 * `bpmnos:status` alone and saw neither data nor globals.
 *
 * Two distinct faults: an **id** reused, which is illegal outright, since ids are unique model-wide and the
 * engine looks attributes up by them; and a **name** reused, which shadows the inherited attribute for every
 * expression in this scope.
 */
export default function() {

  function check(node, reporter) {
    const visible = visibleAttributes(node),
          own = visible.filter(attribute => attribute.declaringElement === node.id);

    if (!own.length) {
      return;
    }

    const inherited = visible.filter(attribute => attribute.declaringElement !== node.id);

    own.forEach(function(attribute) {
      const sameId = inherited.find(other => other.id === attribute.id),
            sameName = inherited.find(other => attributeName(other) === attributeName(attribute));

      if (sameId) {
        reporter.report(node.id,
          `Attribute with id '${attribute.id}' is redeclared, it is inherited from '${sameId.declaringElement}'`);
      } else if (sameName) {
        reporter.report(node.id,
          `Attribute '${attributeName(attribute)}' shadows the attribute inherited from '${sameName.declaringElement}'`);
      }
    });
  }

  return {
    check
  };

};
