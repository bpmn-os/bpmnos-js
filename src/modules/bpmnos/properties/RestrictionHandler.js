import {
  is,
  isAny
} from 'bpmn-js/lib/util/ModelUtil';

import RestrictionEntries from './RestrictionEntries';

import {
  createElement
} from '../utils/ElementUtil';

import {
  getRelevantBusinessObject,
  getCustomItem,
  ensureCustomItem
} from '../utils/CustomItemUtil';

import { removeCustomItemCommands } from '../utils/RemovalUtil';

// Creates restrictions entry and returns { items, add }
export function restrictionHandler({ element, injector }) {
  let businessObject = getRelevantBusinessObject(element);

  // do not offer for empty pools
  if (!businessObject) {
    return;
  }

  if ( !isAny(businessObject, [ 'bpmn:Process', 'bpmn:Activity' ]) ) {
    return;
  }

  const bpmnFactory = injector.get('bpmnFactory'),
        commandStack = injector.get('commandStack'),
        identifiers = injector.get('identifiers');
  let parent = getCustomItem( element, 'bpmnos:Status' ) || {};
  let restrictions = ( parent.get ? parent.get('restrictions') || [] : [] )[0] || {};

  const items = ( restrictions.restriction || []).map((restriction, index) => {
    const id = element.id + '-restriction-' + index;
    return {
      id,
      label: restriction.expression && restriction.expression.length ? restriction.expression : restriction.get('id'),
      entries: RestrictionEntries({
        idPrefix: id,
        element,
        restriction
      }),
      autoFocusEntry: id + '-expression',
      remove: removeFactory({ commandStack, element, restriction })
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
//console.log(element);
    const businessObject = element.businessObject;

    let parent = ensureCustomItem(bpmnFactory, commandStack, element, 'bpmnos:Status'); 
    let restrictions = parent.restrictions ? parent.get('restrictions')[0] : undefined;
    if ( !restrictions ) {
      // create 'bpmnos:Restrictions'
      restrictions = createElement('bpmnos:Restrictions', {}, parent, bpmnFactory);
      commandStack.execute('element.updateModdleProperties', {
          element,
          moddleElement: parent,
          properties: {
            restrictions: [ ...parent.get('restrictions'), restrictions ]
          }
      });
    }

    // create 'bpmnos:Restriction'
    const restriction = createElement('bpmnos:Restriction', { id: identifiers.nextId(element, 'Restriction_') }, restrictions, bpmnFactory);

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: restrictions,
      properties: {
        restriction: [ ...restrictions.get('restriction'), restriction ]
      }
    });

/*
    // create 'bpmnos:Parameter'
    const parameter = createElement('bpmnos:Parameter', { name: 'linear' }, restriction, bpmnFactory);

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: restriction,
      properties: {
        parameter: [ parameter ]
      }
    });
*/
  };
}

// REMOVE FACTORY //
function removeFactory({ commandStack, element, restriction }) {
  return function(event) {
    event.stopPropagation();

    commandStack.execute('properties-panel.multi-command-executor',
      removeCustomItemCommands(element, restriction));
  };
}

