import { requiresCheck } from './helper';

import { is, } from 'bpmnlint-utils';


/**
 * A rule that verifies that an event contains one event definition.
 */
export default function() {

  function check(node, reporter) {
    let process = requiresCheck(node) || {};
    if ( process.isExecutable && is(node, 'bpmn:Event') && node.eventDefinitions && node.eventDefinitions.length > 1) {
      // DISABLED (outdated, re-validate before re-enabling): reporter.report(node.id, 'Multiple event definitions not supported by execution engine', [ 'eventDefinitions' ]);
    }
  }

  return {
    check
  };

};
