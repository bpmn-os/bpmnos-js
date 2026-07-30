import inherits from 'inherits';

import RuleProvider from 'diagram-js/lib/features/rules/RuleProvider';

import { isProtectedAssociation, isAnnotationAssociation } from './utils/AnnotationUtil.js';

const HIGH_PRIORITY = 1500;

/**
 * Keeps an execution data box attached to the element it describes:
 *
 * - the association may not be deleted on its own, only along with the box or the host;
 * - neither of its ends may be dragged elsewhere, since the association *is* the attachment — moving an end
 *   would leave the box describing an element it no longer points at.
 */
export default function BPMNOSAnnotationRules(eventBus) {
  RuleProvider.call(this, eventBus);
}

inherits(BPMNOSAnnotationRules, RuleProvider);

BPMNOSAnnotationRules.$inject = [ 'eventBus' ];

BPMNOSAnnotationRules.prototype.init = function() {
  this.addRule('elements.delete', HIGH_PRIORITY, function(context) {
    const elements = context.elements,
          deletable = elements.filter(element => !isProtectedAssociation(element, elements));

    // no opinion unless something is actually protected, so the standard rules keep deciding
    if (deletable.length === elements.length) {
      return;
    }

    return deletable;
  });

  this.addRule('connection.reconnect', HIGH_PRIORITY, function(context) {
    if (isAnnotationAssociation(context.connection)) {
      return false;
    }
  });
};
