import { is } from 'bpmnlint-utils';

import { KNOWN, READ_BY, loopKindOf, loopParametersOf, loopValue, messageCount } from './loop.js';

/**
 * A rule that checks the loop parameters of an activity: `bpmnos:loopCharacteristics/parameter`.
 *
 * Two of the cases below make the engine throw when the activity is reached; the rest it silently ignores,
 * which is no better — a parameter that is never read is a statement the model makes and the execution does
 * not honour, and nothing at run time will say so. Both are errors here.
 *
 * The checks are structural: which parameters are present, for which kind of loop, and whether they carry a
 * value. What a value says is not read — those are LIMEX expressions, compiled by the engine itself (see
 * `executionData.js`). The one name checked anywhere is `index`, which the engine requires to *be* an
 * attribute rather than an expression over one, and that is `attribute-undeclared`'s business.
 */
export default function() {

  function check(node, reporter) {
    if (!is(node, 'bpmn:Activity')) {
      return;
    }

    const parameters = loopParametersOf(node),
          kind = loopKindOf(node);

    if (!parameters.length) {
      return;
    }

    // the parameters are read only for an activity BPMN marks as looping
    if (!kind) {
      reporter.report(node.id,
        'Loop parameters on an activity that is neither a standard loop nor multi-instance',
        { subtype: 'noLoopCharacteristics' });

      return;
    }

    const names = parameters.map(parameter => parameter.get('name'));

    parameters.forEach(function(parameter, index) {
      const name = parameter.get('name');

      if (!KNOWN.includes(name)) {
        reporter.report(node.id, `Unknown loop parameter '${name}'`, { subtype: 'unknownParameter' });

        return;
      }

      if (!READ_BY[kind].includes(name)) {
        const activity = kind === 'standard' ? 'a standard loop' : 'a multi-instance activity';

        reporter.report(node.id, `Loop parameter '${name}' is not read by ${activity}`,
          { subtype: 'unusedParameter' });
      }

      if (names.indexOf(name) !== index) {
        reporter.report(node.id, `Loop parameter '${name}' given more than once`,
          { subtype: 'duplicateParameter' });
      }

      if (!(parameter.get('value') || '').trim()) {
        reporter.report(node.id, `Loop parameter '${name}' without a value`,
          { subtype: 'parameterWithoutValue' });
      }
    });

    // a multi-instance activity is sized by its cardinality, or by the number of messages it defines when
    // it has none; with neither, no instance is created and the engine fails (`StateMachine.cpp:433-444`)
    if (kind === 'multiInstance' && !loopValue(parameters, 'cardinality') && !messageCount(node)) {
      reporter.report(node.id, 'Multi-instance activity without a cardinality or a message',
        { subtype: 'noCardinality' });
    }

    // the maximum bounds the loop index, so the activity must name one to count in (`Token.cpp:442-446`)
    if (kind === 'standard' && loopValue(parameters, 'maximum') && !loopValue(parameters, 'index')) {
      reporter.report(node.id, 'Loop maximum without a loop index', { subtype: 'maximumWithoutIndex' });
    }
  }

  return {
    check
  };

};
