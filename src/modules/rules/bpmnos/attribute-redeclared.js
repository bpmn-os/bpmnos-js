import { getAttributes } from '../../bpmnos/utils/StatusUtil';
import { getStatus } from '../../bpmnos/utils/StatusUtil';

import { is } from 'bpmnlint-utils';



/**
 * A rule that checks that no attribute is redeclared.
 */
export default function() {

  function check(node, reporter) {
    if ( node.$parent ) {
      const attributes = getAttributes(node);
      const parentStatus = getStatus(node.$parent);
      for (var i=0; i < attributes.length; i++) {
        if (parentStatus.filter(attribute => attribute.id == attributes[i].id).length > 0) {
          // DISABLED (outdated, re-validate before re-enabling): reporter.report(node.id, "Attribute with id '" + attributes[i].id + "' is redeclared");
        }
        if (parentStatus.filter(attribute => attribute.name == attributes[i].name).length > 0) {
          // DISABLED (outdated, re-validate before re-enabling): reporter.report(node.id, "Attribute with name '" + attributes[i].name + "' is shadowed");
        }
      }
    }
  }

  return {
    check
  };

};



