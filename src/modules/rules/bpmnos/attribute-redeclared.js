import { attributeName, visibleAttributes } from './executionData.js';

/**
 * A rule that checks that a node does not declare an attribute twice, whether against what it inherits or
 * against its own other declarations.
 *
 * Both halves come from the execution data registry, which reports every attribute visible at the node
 * together with the element declaring it — so "own" and "inherited" are read off one account rather than
 * re-derived here, which is what made an earlier version unreliable: it walked `$parent` over
 * `bpmnos:status` alone and saw neither data nor globals.
 *
 * The comparison covers a node's own declarations as well as the inherited ones, because the engine refuses
 * both alike: `AttributeRegistry::add` throws on a duplicate name among the attributes visible at a node,
 * wherever they are declared, so a model with two attributes of one name on one element fails to load. A
 * fault reported while the model is edited is better than one discovered when it is run.
 *
 * Two distinct faults, reported separately so that either may later be graded on its own. An **id** reused
 * is wrong under any reading, being the key every lookup is built on; it is unique within the process that
 * declares it, which is the boundary the registry itself observes, and never across a model, since every
 * process declares its own `Instance` and `Timestamp`. A **name** reused shadows the other attribute for
 * every expression in this scope, and is an error only for as long as the engine refuses it.
 */
export default function() {

  function check(node, reporter) {
    const visible = visibleAttributes(node),
          own = visible.filter(attribute => attribute.declaringElement === node.id);

    if (!own.length) {
      return;
    }

    const inherited = visible.filter(attribute => attribute.declaringElement !== node.id);

    own.forEach(function(attribute, index) {

      // compared against what this node declared before it, so the second of a pair is reported and not both
      const declaredBefore = own.slice(0, index);

      const idHere = declaredBefore.find(other => other.id === attribute.id),
            idAbove = inherited.find(other => other.id === attribute.id),
            nameHere = declaredBefore.find(other => attributeName(other) === attributeName(attribute)),
            nameAbove = inherited.find(other => attributeName(other) === attributeName(attribute));

      if (idHere) {
        reporter.report(node.id,
          `Attribute with id '${attribute.id}' is declared twice on this element`);
      } else if (idAbove) {
        reporter.report(node.id,
          `Attribute with id '${attribute.id}' is redeclared, it is inherited from '${idAbove.declaringElement}'`);
      } else if (nameHere) {
        reporter.report(node.id,
          `Attribute '${attributeName(attribute)}' is declared twice on this element`);
      } else if (nameAbove) {
        reporter.report(node.id,
          `Attribute '${attributeName(attribute)}' shadows the attribute inherited from '${nameAbove.declaringElement}'`);
      }
    });
  }

  return {
    check
  };

};
