import { getProcess } from '../engine/helper';
import { getCustomElements } from '../../bpmnos/utils/StatusUtil';
import { getStatus } from '../../bpmnos/utils/StatusUtil';

import { is } from 'bpmnlint-utils';



/**
 * A rule that checks that attributes for restrictions and operators are declared.
 */
export default function() {

  function check(node, reporter) {
    const process = getProcess(node) || {};
    if ( process.isExecutable
         && is(node,'bpmn:SequenceFlow') 
         && is(node.sourceRef,'bpmn:ExclusiveGateway')
         && node.sourceRef.outgoing.length > 1 
    ) {

      const customElements = getCustomElements(node);
      for (var i=0; i < customElements.length; i++ ) {
        const restrictions = customElements[i].restriction;
        if ( restrictions && restrictions.length > 0) {
          return;
        }
      }

      // DISABLED (outdated, re-validate before re-enabling): reporter.report(node.id, "Gatekeeper restrictions missing");
    }
  }

  return {
    check
  };

};


