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

import {
  isConditionSupported
} from '../utils/EventDefinitionUtil';

// Creates restrictions entry and returns { items, add }
export function conditionHandler({ element, injector }) {
  let businessObject = getRelevantBusinessObject(element);

  // do not offer for empty pools
  if (!businessObject) {
    return;
  }

  if ( !isAny(businessObject, ['bpmn:SequenceFlow', 'bpmn:Event']) ) {
    return;
  }
  if ( is(businessObject, 'bpmn:Event') && !isConditionSupported(element) ) {
    return;
  }

  const bpmnFactory = injector.get('bpmnFactory'),
        commandStack = injector.get('commandStack'),
        identifiers = injector.get('identifiers');
  let restrictions = getCustomItem( element, 'bpmnos:Restrictions' ) || {};

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

    let restrictions = ensureCustomItem( bpmnFactory, commandStack, element, 'bpmnos:Restrictions' );

    // create 'bpmnos:Restriction'
    const restriction = createElement('bpmnos:Restriction', { id: identifiers.nextId(element, 'Condition_') }, restrictions, bpmnFactory);

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: restrictions,
      properties: {
        restriction: [ ...restrictions.get('restriction'), restriction ]
      }
    });

    // create 'bpmnos:Parameter'
    const parameter = createElement('bpmnos:Parameter', { name: 'linear' }, restriction, bpmnFactory);

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: restriction,
      properties: {
        parameter: [ parameter ]
      }
    });
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

