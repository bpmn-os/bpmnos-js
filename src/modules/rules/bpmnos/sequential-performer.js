import { is } from 'bpmnlint-utils';

import { requiresCheck } from '../engine/helper.js';

import { getSequentialPerformer } from '../../bpmnos/utils/PerformerUtil.js';

/**
 * A rule reporting an ad-hoc subprocess the engine refuses to perform sequentially when it reads a model
 * (`SequentialAdHocSubProcess`): one whose ordering is not `Sequential`, an unset ordering meaning `Parallel`
 * by the default of BPMN, and one without a sequential performer.
 *
 * The performer is searched as the engine searches it: at the ad-hoc subprocess itself, then at the enclosing
 * activities and the process, ending before an enclosing ad-hoc subprocess.
 */
export default function() {

  function check(node, reporter) {
    if (!requiresCheck(node) || !is(node, 'bpmn:AdHocSubProcess')) {
      return;
    }

    if (node.get('ordering') !== 'Sequential') {
      reporter.report(node.id, 'Ad-hoc subprocess not ordered sequentially', { subtype: 'parallelOrdering' });
    }

    if (!getSequentialPerformer(node)) {
      reporter.report(node.id, 'Ad-hoc subprocess without a sequential performer', { subtype: 'missingPerformer' });
    }
  }

  return {
    check
  };
}
