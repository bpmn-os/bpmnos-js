import { is } from 'bpmnlint-utils';

import { requiresCheck } from './helper.js';

/**
 * A rule reporting an event carrying more than one event definition.
 *
 * The engine refuses such a model as it reads it. `bpmn++` decides what an event is from its one event
 * definition, and throws "Multiple event definitions are not yet supported" where an event carries several,
 * for a boundary event, a catching event and a throwing event alike.
 *
 * The multiple-definition event of the specification, which is triggered by whichever of its definitions
 * occurs first, has no counterpart here. A model needing that states one event per definition and joins
 * them at an event-based gateway.
 */
export default function() {

  function check(node, reporter) {
    if ( !requiresCheck(node) || !is(node, 'bpmn:Event') ) {
      return;
    }

    if ( (node.eventDefinitions || []).length > 1 ) {
      reporter.report(node.id, 'Multiple event definitions not supported by execution engine', [ 'eventDefinitions' ]);
    }
  }

  return {
    check
  };

};
