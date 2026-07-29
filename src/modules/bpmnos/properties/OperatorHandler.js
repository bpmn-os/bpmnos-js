import {
  is
} from 'bpmn-js/lib/util/ModelUtil';

import OperatorEntries from './OperatorEntries';

import {
  createElement
} from '../utils/ElementUtil';

import {
  getRelevantBusinessObject,
  getCustomItem,
  ensureCustomItem
} from '../utils/CustomItemUtil';

import { removeCustomItemCommands } from '../utils/RemovalUtil';

// Creates operators entry and returns { items, add }
export function operatorHandler({ element, injector }) {
  let businessObject = getRelevantBusinessObject(element);

  // do not offer for empty pools
  if (!businessObject) {
    return;
  }

// TODO: operators are only allowed for tasks and event-subprocesses!
/*
  if ( !is(element, 'bpmn:Task') && !( is(element, 'bpmn:SubProcess') && !element.businessObject.triggeredByEvent ) ) {
    return;
  }
*/
  if ( !is(businessObject, 'bpmn:Process') && !is(businessObject, 'bpmn:Activity') ) {
    return;
  }

  const bpmnFactory = injector.get('bpmnFactory'),
        commandStack = injector.get('commandStack'),
        identifiers = injector.get('identifiers');

  const parent = getCustomItem( element, 'bpmnos:Status' ) || {};
  const operators = ( parent.get ? parent.get('operators') || [] : [] )[0] || {};


  const items = ( operators.operator || []).map((operator, index) => {
    const id = element.id + '-operator-' + index;

    return {
      id,
      label: operator.expression && operator.expression.length ? operator.expression : operator.get('id'),
      entries: OperatorEntries({
        idPrefix: id,
        element,
        operator
      }),
      autoFocusEntry: id + '-expression',
      remove: removeFactory({ commandStack, element, operator })
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

    const parent = ensureCustomItem(bpmnFactory, commandStack, element, 'bpmnos:Status'); 

    let operators = parent.operators ? parent.get('operators')[0] : undefined;
    if ( !operators ) {
      // create 'bpmnos:Operators'
      operators = createElement('bpmnos:Operators', {}, parent, bpmnFactory);
      commandStack.execute('element.updateModdleProperties', {
          element,
          moddleElement: parent,
          properties: {
            operators: [ ...parent.get('operators'), operators ]
          }
      });
    }

    // create 'bpmnos:Operator'
    let operator = createElement('bpmnos:Operator', { id: identifiers.nextId(element, 'Operator_') }, operators, bpmnFactory);

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: operators,
      properties: {
        operator: [ ...operators.get('operator'), operator ]
      }
    });
  };
}

// REMOVE FACTORY //
function removeFactory({ commandStack, element, operator }) {
  return function(event) {
    event.stopPropagation();

    commandStack.execute('properties-panel.multi-command-executor',
      removeCustomItemCommands(element, operator));
  };
}

