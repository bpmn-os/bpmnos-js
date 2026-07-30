import {
  is
} from 'bpmn-js/lib/util/ModelUtil';

import GuidanceEntries from './GuidanceEntries.js';

import {
  getRelevantBusinessObject,
  getCustomItems,
  createCustomItem
} from '../utils/CustomItemUtil.js';

import { removeCustomItemCommands } from '../utils/RemovalUtil.js';

import {
  isMessageSupported
} from '../utils/EventDefinitionUtil.js';


// Creates guidance entry and returns { items, add }
export function guidanceHandler({ element, injector }) {
  let businessObject = getRelevantBusinessObject(element);

  // do not offer for empty pools
  if (!businessObject) {
    return;
  }

  if ( !is(businessObject, 'bpmn:Activity') && !is(element, 'bpmn:CatchEvent') ) {
    return;
  }
  if ( is(businessObject, 'bpmn:SubProcess') && businessObject.triggeredByEvent ) {
    return;
  }
  if ( is(businessObject, 'bpmn:Activity') && businessObject.isForCompensation ) {
    return;
  }
  if ( is(businessObject, 'bpmn:CatchEvent') && !isMessageSupported(element) ) {
    return;
  }

  const bpmnFactory = injector.get('bpmnFactory'),
        commandStack = injector.get('commandStack');

  const guidances = getCustomItems( element, 'bpmnos:Guidance' );

  const items = guidances.map((guidance, index) => {
    const id = element.id + '-guidance-' + index;

    return {
      id,
      label: guidance.get('type') || '',
      entries: GuidanceEntries({
        idPrefix: id,
        element,
        guidance
      }),
//      autoFocusEntry: id + '-type',
      remove: removeFactory({ commandStack, element, guidance })
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

    const guidance = createCustomItem(bpmnFactory, commandStack, element, 'bpmnos:Guidance'); 
  };
}

// REMOVE FACTORY //
function removeFactory({ commandStack, element, guidance }) {
  return function(event) {
    event.stopPropagation();

    commandStack.execute('properties-panel.multi-command-executor',
      removeCustomItemCommands(element, guidance));
  };
}

