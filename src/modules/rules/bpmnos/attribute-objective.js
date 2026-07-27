import { attributeName, declaredAttributes } from './executionData.js';

// what the engine accepts; anything else is an illegal objective (`Attribute.cpp:48-63`). Note that the
// XSD lists minimize and maximize only, while the parser also accepts none, which the corpus uses on
// Timestamp to say outright that an attribute contributes nothing.
const OBJECTIVES = [ 'minimize', 'maximize', 'none' ];

/**
 * A rule that checks the objective an attribute contributes to.
 *
 * The engine reads the two together (`Attribute.cpp:48-63`): a weight is the factor of the term, an
 * objective its sign. It throws when either is given without the other — "required objective weight
 * missing" for an objective without a weight, "illegal objective" for a weight whose objective is missing or
 * unrecognised — so a model carrying one of these does not run at all.
 *
 * Every attribute a node declares is checked, including those of a guidance, which are scored the same way
 * (`Guidance::getObjective`).
 */
export default function() {

  function check(node, reporter) {
    declaredAttributes(node).forEach(function(attribute) {
      const objective = attribute.objective,
            weight = attribute.weight,
            name = attributeName(attribute) || attribute.id;

      const hasWeight = weight !== undefined && weight !== null && String(weight).trim() !== '';

      if (objective && !OBJECTIVES.includes(objective)) {
        reporter.report(node.id, `Attribute '${name}' has an unknown objective '${objective}'`,
          { subtype: 'unknownObjective' });

        return;
      }

      if (objective && objective !== 'none' && !hasWeight) {
        reporter.report(node.id, `Attribute '${name}' has an objective but no weight`,
          { subtype: 'objectiveWithoutWeight' });
      }

      if (hasWeight && (!objective || objective === 'none')) {
        reporter.report(node.id, `Attribute '${name}' has a weight but no objective`,
          { subtype: 'weightWithoutObjective' });
      }
    });
  }

  return {
    check
  };

};
