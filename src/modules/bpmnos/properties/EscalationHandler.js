import NamedContentEntries from './NamedContentEntries.js';

import {
  getCustomItem
} from '../utils/CustomItemUtil.js';

import {
  isEscalationSupported
} from '../utils/EventDefinitionUtil.js';

/**
 * @returns {Array<Entry>} entries
 */
export function escalationHandler({ element }) {

  if ( !isEscalationSupported(element) ) {
    return [];
  }

  return NamedContentEntries({
    idPrefix: element.id + '-escalation',
    element,
    item: getCustomItem( element, 'bpmnos:Escalation' ),
    itemType: 'bpmnos:Escalation'
  });
}
