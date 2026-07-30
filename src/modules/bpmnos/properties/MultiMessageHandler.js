import {
  getBusinessObject,
  isAny
} from 'bpmn-js/lib/util/ModelUtil';

import MessageEntries from './MessageEntries.js';

import {
  createElement
} from '../utils/ElementUtil.js';

import {
  getCustomItem,
  ensureCustomItem
} from '../utils/CustomItemUtil.js';

import { removeCustomItemCommands } from '../utils/RemovalUtil.js';

// Creates messages entry and returns { items, add }
export function multiMessageHandler({ element, injector }) {
  let businessObject = getBusinessObject(element);

  if (!isAny(element, ['bpmn:ReceiveTask', 'bpmn:SendTask'] ) ) {
    return;
  }

  const bpmnFactory = injector.get('bpmnFactory'),
        commandStack = injector.get('commandStack');

  const messages = getCustomItem( element, 'bpmnos:Messages' ) || {};

  const items = ( messages.message || []).map((message, index) => {
    const id = element.id + '-message-' + index;

    return {
      id,
      label: message.get('name'),
      entries: MessageEntries({
        idPrefix: id,
        element,
        message
      }),
      autoFocusEntry: id + '-name',
      remove: removeFactory({ commandStack, element, message })
    };
  });

  return {
    items,
    add: addFactory({ bpmnFactory, commandStack, element })
  };
}

// ADD FACTORY //

function addFactory({ bpmnFactory, commandStack, element }) {
  return function(event) {
    event.stopPropagation();

    let messages = ensureCustomItem(bpmnFactory, commandStack, element, 'bpmnos:Messages'); 

    // create 'bpmnos:Message'
//    let message = createElement('bpmnos:Message', { id: nextId('Message_') }, messages, bpmnFactory);
    let message = createElement('bpmnos:Message', { }, messages, bpmnFactory);

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: messages,
      properties: {
        message: [ ...messages.get('message'), message ]
      }
    });
  };
}

// REMOVE FACTORY //
function removeFactory({ commandStack, element, message }) {
  return function(event) {
    event.stopPropagation();

    commandStack.execute('properties-panel.multi-command-executor',
      removeCustomItemCommands(element, message));
  };
}

