import {
  getBusinessObject,
  isAny
} from 'bpmn-js/lib/util/ModelUtil';

import MessageEntries from './MessageEntries.js';

import { TextFieldEntry } from '@bpmn-io/properties-panel';

import { useService } from 'bpmn-js-properties-panel';

import {
  getCustomItem
} from '../utils/CustomItemUtil.js';

import {
  isMessageSupported
} from '../utils/EventDefinitionUtil.js';


/**
 * @returns {Array<Entry>} entries
 */
export function messageHandler({ element }) {

  if (!isMessageSupported(element) ) {
    return [];
  }

  const id = element.id + '-message';
  let message = getCustomItem( element, 'bpmnos:Message' );
  return MessageEntries({
        idPrefix: id,
        element,
        message
      });
}

