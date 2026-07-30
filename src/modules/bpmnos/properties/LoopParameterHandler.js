import {
  getBusinessObject,
  is
} from 'bpmn-js/lib/util/ModelUtil';

import LoopParameterEntries from './LoopParameterEntries.js';

import {
  createElement
} from '../utils/ElementUtil.js';

import {
  getCustomItem,
  ensureCustomItem
} from '../utils/CustomItemUtil.js';

import { removeCustomItemCommands } from '../utils/RemovalUtil.js';

// Creates loop entry and returns { items, add }
export function loopParameterHandler({ element, injector }) {
  let businessObject = getBusinessObject(element);

  if ( !is(element, 'bpmn:Activity') || !businessObject.loopCharacteristics ) {
    return;
  }

  const bpmnFactory = injector.get('bpmnFactory'),
        commandStack = injector.get('commandStack');

  const loopCharacteristics = getCustomItem( element, 'bpmnos:LoopCharacteristics' ) || {};

  const items = ( loopCharacteristics.parameter || []).map((parameter, index) => {
    const id = element.id + '-parameter-' + index;

    return {
      id,
      label: parameter.get('name') + " ~ " + parameter.get('value') ,
      entries: LoopParameterEntries({
        idPrefix: id,
        element,
        parameter
      }),
      autoFocusEntry: id + '-name',
      remove: removeFactory({ commandStack, element, parameter })
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

    let loopCharacteristics = ensureCustomItem(bpmnFactory, commandStack, element, 'bpmnos:LoopCharacteristics'); 

    // create 'bpmnos:Parameter'
    let parameter = createElement('bpmnos:Parameter', { }, loopCharacteristics, bpmnFactory);

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: loopCharacteristics,
      properties: {
        parameter: [ ...loopCharacteristics.get('parameter'), parameter ]
      }
    });
  };
}

// REMOVE FACTORY //
function removeFactory({ commandStack, element, parameter }) {
  return function(event) {
    event.stopPropagation();

    commandStack.execute('properties-panel.multi-command-executor',
      removeCustomItemCommands(element, parameter));
  };
}

