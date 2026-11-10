import { is } from 'bpmnlint-utils';

import { requiresCheck } from '../engine/helper.js';

/**
 * A rule reporting entry guidance on an activity that is not a child of an ad-hoc subprocess, which the engine
 * refuses when it reads a model (`Model::createActivity`).
 *
 * The engine performs every ad-hoc subprocess sequentially, and only the entry of a child of a sequential
 * ad-hoc subprocess is decided. Any other activity is entered as soon as its entry restrictions are satisfied,
 * so that an entry guidance would have no decision to guide.
 */
export default function() {

  function check(node, reporter) {
    if (!requiresCheck(node) || !is(node, 'bpmn:Activity')) {
      return;
    }

    if (is(node.$parent, 'bpmn:AdHocSubProcess')) {
      return;
    }

    if (guidanceOf(node).some(guidance => guidance.get('type') === 'entry')) {
      reporter.report(node.id, 'Entry guidance on an activity that is not a child of a sequential ad-hoc subprocess',
        { subtype: 'undecidedEntry' });
    }
  }

  return {
    check
  };
}

function guidanceOf(node) {
  return ((node.extensionElements && node.extensionElements.values) || [])
    .filter(element => is(element, 'bpmnos:Guidance'));
}
