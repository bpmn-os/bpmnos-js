import inherits from 'inherits';

import RuleProvider from 'diagram-js/lib/features/rules/RuleProvider';

import { isProtectedAssociation } from './utils/ExecutionDataUtil';

const HIGH_PRIORITY = 1500;

/**
 * Keeps an execution data box attached to its element: the association may not be deleted on its own, only
 * along with the box or the host. Deleting either of those still works, and takes the association with it.
 */
export default function ExecutionDataRules(eventBus) {
  RuleProvider.call(this, eventBus);
}

inherits(ExecutionDataRules, RuleProvider);

ExecutionDataRules.$inject = [ 'eventBus' ];

ExecutionDataRules.prototype.init = function() {
  this.addRule('elements.delete', HIGH_PRIORITY, function(context) {
    const elements = context.elements,
          deletable = elements.filter(element => !isProtectedAssociation(element, elements));

    // no opinion unless something is actually protected, so the standard rules keep deciding
    if (deletable.length === elements.length) {
      return;
    }

    return deletable;
  });
};
