import {
  is
} from 'bpmn-js/lib/util/ModelUtil';

import TableEntries from './TableEntries.js';

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
 * Creates tables entry and returns { items, add }
 *
 * A lookup table is held by the data store, beside the globals and for the same reason: the name of a
 * table is callable from every expression of the model, as a global is visible from every node, so both
 * are properties of the store rather than of one occurrence of referring to it. The store is not on the
 * canvas, so the editor is offered on the reference to it and reads and writes through that reference.
 *
 * A reference that refers to nothing holds no table, and the store is created when the first one is added.
 */
export function tableHandler({ element, injector }) {
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

  let tables  = undefined;
  tables = ( element ? getCustomItem( element, 'bpmnos:Tables' ) : undefined ) || {};

  const items = ( tables.table || []).map((table, index) => {
    const id = element.id + '-table-' + index;

    return {
      id,
      label: table.get('name') ? table.get('name') + "(...)" : table.get('id'),
      entries: TableEntries({
        idPrefix: id,
        element,
        table
      }),
      autoFocusEntry: id + '-name',
      remove: removeFactory({ commandStack, element, table, dataElement })
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

    let tables  = ensureCustomItem(bpmnFactory, commandStack, element, 'bpmnos:Tables');

    // create 'bpmnos:Table'
    const table = createElement('bpmnos:Table', { id: identifiers.nextId(element, 'Table_') }, tables, bpmnFactory);

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: tables,
      properties: {
        table: [ ...tables.get('table'), table ]
      }
    });

    redraw(commandStack, dataElement);
  };
}

// REMOVE FACTORY //
function removeFactory({ commandStack, element, table, dataElement }) {
  return function(event) {
    event.stopPropagation();

    redraw(commandStack, dataElement);

    commandStack.execute('properties-panel.multi-command-executor',
      removeCustomItemCommands(element, table));
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

