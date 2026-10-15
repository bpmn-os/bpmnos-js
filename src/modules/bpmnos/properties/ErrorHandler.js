import NamedContentEntries from './NamedContentEntries.js';

import {
  getCustomItem
} from '../utils/CustomItemUtil.js';

import {
  isErrorSupported
} from '../utils/EventDefinitionUtil.js';

/**
 * @returns {Array<Entry>} entries
 */
export function errorHandler({ element }) {

  if ( !isErrorSupported(element) ) {
    return [];
  }

  return NamedContentEntries({
    idPrefix: element.id + '-error',
    element,
    item: getCustomItem( element, 'bpmnos:Error' ),
    itemType: 'bpmnos:Error'
  });
}
