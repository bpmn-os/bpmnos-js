import { is } from 'bpmnlint-utils';

import { requiresCheck } from '../engine/helper.js';

import { getSequentialPerformer } from '../../bpmnos/utils/PerformerUtil.js';

/**
 * A rule reporting an ad-hoc subprocess without a sequential performer, which the engine refuses when it reads
 * a model (`SequentialAdHocSubProcess`).
 *
 * The performer is searched as the engine searches it: at the ad-hoc subprocess itself, then at the enclosing
 * activities and the process, ending before an enclosing ad-hoc subprocess.
 */
export default function() {

  function check(node, reporter) {
    if (!requiresCheck(node) || !is(node, 'bpmn:AdHocSubProcess')) {
      return;
    }

    if (!getSequentialPerformer(node)) {
      reporter.report(node.id, 'Ad-hoc subprocess without a sequential performer', { subtype: 'missingPerformer' });
    }
  }

  return {
    check
  };
}
