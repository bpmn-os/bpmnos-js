import { is } from 'bpmnlint-utils';

/**
 * A rule reporting a process that is not marked executable.
 *
 * The engine refuses such a model outright: `Model::createProcess` throws "process '…' must be executable"
 * as it reads it, so a single process without the flag stops the whole model from being loaded, not merely
 * that process from being run.
 *
 * The flag is absent by default, which is why this is worth reporting rather than assuming: a process drawn
 * in a modeller and never marked carries `isExecutable` as undefined and is refused.
 */
export default function() {

  function check(node, reporter) {
    if ( is(node, 'bpmn:Process') && !node.isExecutable ) {
      reporter.report(node.id, 'Process is not executable');
    }
  }

  return {
    check: check
  };
};
