import {
  is
} from 'bpmn-js/lib/util/ModelUtil';

import InputEntries from './InputEntries.js';

import {
  createElement
} from '../utils/ElementUtil.js';

import {
  getRelevantBusinessObject,
  getCustomItem,
  ensureCustomItem
} from '../utils/CustomItemUtil.js';

import { removeCustomItemCommands } from '../utils/RemovalUtil.js';

import {
  getDataElement,
  ensureDataStore
} from '../utils/DataReferenceUtil.js';


/**
 * Creates inputs entry and returns { items, add }
 *
 * An input, a lookup table, a matrix or an object read from a file, is held by the data store, beside the
 * globals and for the same reason: the name of an input is read from every expression of the model, as a
 * global is visible from every node, so both are properties of the store rather than of one occurrence of
 * referring to it. The store is not on the canvas, so the editor is offered on the reference to it and reads
 * and writes through that reference.
 *
 * A reference that refers to nothing holds no input, and the store is created when the first one is added.
 */
export function inputHandler({ element, injector }) {
  let businessObject = getRelevantBusinessObject(element);

  // do not offer for empty pools
  if (!businessObject) {
    return;
  }

  if ( !is(businessObject, 'bpmn:DataStoreReference') ) {
    return;
  }

  const bpmnFactory = injector.get('bpmnFactory'),
        commandStack = injector.get('commandStack'),
        identifiers = injector.get('identifiers');

  const dataElement = element;
  element = getDataElement(element);

  const inputs = ( element ? getCustomItem( element, 'bpmnos:Inputs' ) : undefined ) || {};

  const items = ( inputs.input || []).map((input, index) => {
    const id = element.id + '-input-' + index;

    // a lookup is called as a function, a matrix or an object is read by its name
    const name = input.get('name');

    return {
      id,
      label: name ? ( input.get('type') == 'lookup' ? name + "(...)" : name ) : input.get('id'),
      entries: InputEntries({
        idPrefix: id,
        element,
        input
      }),
      autoFocusEntry: id + '-name',
      remove: removeFactory({ commandStack, element, input, dataElement })
    };
  });
  return {
    items,
    add: addFactory({ bpmnFactory, commandStack, identifiers, dataElement })
  };
}

// ADD FACTORY //
function addFactory({ bpmnFactory, commandStack, identifiers, dataElement }) {
  return function(event) {
    event.stopPropagation();

    // the data store behind the reference, created now where the model holds none
    const element = ensureDataStore(bpmnFactory, commandStack, dataElement);

    const inputs = ensureCustomItem(bpmnFactory, commandStack, element, 'bpmnos:Inputs');

    // create 'bpmnos:Input', a lookup unless chosen otherwise
    const input = createElement('bpmnos:Input', { id: identifiers.nextId(element, 'Input_'), type: 'lookup' }, inputs, bpmnFactory);

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: inputs,
      properties: {
        input: [ ...inputs.get('input'), input ]
      }
    });

    redraw(commandStack, dataElement);
  };
}

// REMOVE FACTORY //
function removeFactory({ commandStack, element, input, dataElement }) {
  return function(event) {
    event.stopPropagation();

    redraw(commandStack, dataElement);

    commandStack.execute('properties-panel.multi-command-executor',
      removeCustomItemCommands(element, input));
  };
}

// the store is not on the canvas, so the reference to it is changed for appearance's sake, which is what
// makes the panel show what the store now holds
function redraw(commandStack, dataElement) {
  commandStack.execute('element.updateModdleProperties', {
    element: dataElement,
    moddleElement: dataElement.businessObject.id
  });
}

