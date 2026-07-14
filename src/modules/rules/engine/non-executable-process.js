import { is } from 'bpmnlint-utils';


/**
 * Rule that reports processes for which isExecutable is not true.
 */
export default function() {

  function check(node, reporter) {
    if ( is(node, 'bpmn:Process') && !node.isExecutable ) {
      reporter.report(node.id, 'Executable flag is not set');
    }
  }

  return {
    check: check
  };
};
