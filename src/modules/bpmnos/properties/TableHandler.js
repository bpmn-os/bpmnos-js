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


// Creates tables entry and returns { items, add }
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

  let tables  = undefined;
  tables = getCustomItem( element, 'bpmnos:Tables' ) || {};
  
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
      remove: removeFactory({ commandStack, element, table })
    };
  });
  return {
    items,
    add: addFactory({ bpmnFactory, commandStack, identifiers, element })
  };
}

// ADD FACTORY //
function addFactory({ bpmnFactory, commandStack, identifiers, element }) {
  return function(event) {
    event.stopPropagation();

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
  };
}

// REMOVE FACTORY //
function removeFactory({ commandStack, element, table }) {
  return function(event) {
    event.stopPropagation();

    commandStack.execute('properties-panel.multi-command-executor',
      removeCustomItemCommands(element, table));
  };
}

