import DecisionEntries from './DecisionEntries.js';

import {
  createElement
} from '../utils/ElementUtil.js';

import {
  getRelevantBusinessObject,
  getCustomItem,
  ensureCustomItem
} from '../utils/CustomItemUtil.js';

import { removeCustomItemCommands } from '../utils/RemovalUtil.js';


// Creates decisions entry and returns { items, add }
export function decisionHandler({ element, injector }) {
  let businessObject = getRelevantBusinessObject(element);

  // do not offer for empty pools
  if (!businessObject) {
    return;
  }

  // only a plain bpmn:Task (not a typed subtype such as a user task) carrying type="Decision"
  if ( businessObject.$type !== 'bpmn:Task' || businessObject.type != "Decision" ) {
    return;
  }

  const bpmnFactory = injector.get('bpmnFactory'),
        commandStack = injector.get('commandStack'),
        identifiers = injector.get('identifiers');

  const parent = getCustomItem( element, 'bpmnos:Status' ) || {};
  const decisions = ( parent.get ? parent.get('decisions') || [] : [] )[0] || {};

  const items = ( decisions.decision || []).map((decision, index) => {
    const id = element.id + '-decision-' + index;

    return {
      id,
      label: decision.get('condition') || decision.get('id'),
      entries: DecisionEntries({
        idPrefix: id,
        element,
        decision
      }),
      autoFocusEntry: id + '-condition',
      remove: removeFactory({ commandStack, element, decision })
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

    let decisions = parent.decisions ? parent.get('decisions')[0] : undefined;
    if ( !decisions ) {
      // create 'bpmnos:Decisions'
      decisions = createElement('bpmnos:Decisions', {}, parent, bpmnFactory);
      commandStack.execute('element.updateModdleProperties', {
          element,
          moddleElement: parent,
          properties: {
            decisions: [ ...parent.get('decisions'), decisions ]
          }
      });
    }

    // create 'bpmnos:Decision'
    let decision = createElement('bpmnos:Decision', { id: identifiers.nextId(element, 'Decision_') }, decisions, bpmnFactory);

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: decisions,
      properties: {
        decision: [ ...decisions.get('decision'), decision ]
      }
    });
  };
}

// REMOVE FACTORY //
function removeFactory({ commandStack, element, decision }) {
  return function(event) {
    event.stopPropagation();

    commandStack.execute('properties-panel.multi-command-executor',
      removeCustomItemCommands(element, decision));
  };
}

