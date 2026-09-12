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

  // Send and receive tasks exchange a message like message throw and catch events do, but carry a
  // message event definition nowhere, so they are admitted by their type.
  if ( !isMessageSupported(element) && !isAny(element, [ 'bpmn:SendTask', 'bpmn:ReceiveTask' ]) ) {
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

