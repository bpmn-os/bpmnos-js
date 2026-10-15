import { Group, ListGroup } from '@bpmn-io/properties-panel';

import {
  ProcessProps,
  IdProps,
  NameProps,
  DocumentationProps
} from './properties/bpmn/index.js';


import { ExecutableProps } from './properties/ExecutableProps.js';
import { SequentialPerformerProps } from './properties/SequentialPerformerProps.js';
import { AdHocOrderingProps } from './properties/AdHocOrderingProps.js';
import { loopParameterHandler } from './properties/LoopParameterHandler.js';
import { attributeHandler } from './properties/AttributeHandler.js';
import { decisionHandler } from './properties/DecisionHandler.js';
import { restrictionHandler } from './properties/RestrictionHandler.js';
import { conditionHandler } from './properties/ConditionHandler.js';
import { operatorHandler } from './properties/OperatorHandler.js';
import { messageHandler } from './properties/MessageHandler.js';
import { signalHandler } from './properties/SignalHandler.js';
import { errorHandler } from './properties/ErrorHandler.js';
import { escalationHandler } from './properties/EscalationHandler.js';
import { timerHandler } from './properties/TimerHandler.js';
import { guidanceHandler } from './properties/GuidanceHandler.js';
import { inputHandler } from './properties/InputHandler.js';

const LOW_PRIORITY = 500;

const EXECUTION_GROUPS = [
{ label: 'Loop parameters', id: 'loop', component: ListGroup, handler: loopParameterHandler},
// the attribute handler names its own group, Status, Data or Globals, for what the element declares
{ label: 'Attributes', id: 'attributes', component: ListGroup, handler: attributeHandler},
{ label: 'Decisions', id: 'decisions', component: ListGroup, handler: decisionHandler},
{ label: 'Restrictions', id: 'restrictions', component: ListGroup, handler: restrictionHandler},
{ label: 'Conditions', id: 'conditions', component: ListGroup, handler: conditionHandler},
{ label: 'Operators', id: 'operators', component: ListGroup, handler: operatorHandler},
{ label: 'Message', id: 'message', handler: messageHandler},
{ label: 'Signal', id: 'signal', handler: signalHandler},
{ label: 'Error', id: 'error', handler: errorHandler},
{ label: 'Escalation', id: 'escalation', handler: escalationHandler},
{ label: 'Timer', id: 'attribute', component: Group, handler: timerHandler},
{ label: 'Guidance', id: 'guidance', component: ListGroup, handler: guidanceHandler},
{ label: 'Inputs', id: 'inputs', component: ListGroup, handler: inputHandler}
];

export default class BPMNOSPropertiesProvider {

  constructor(propertiesPanel, injector) {
    propertiesPanel.registerProvider(LOW_PRIORITY, this);

    this._injector = injector;
  }

  getGroups(element) {
    return (groups) => {
      groups.push(GeneralGroup(element));

      EXECUTION_GROUPS.forEach( group => addGroup( group, groups, element, this._injector ) );

      return groups;
    };
  }
}

BPMNOSPropertiesProvider.$inject = [ 'propertiesPanel', 'injector' ];

function addGroup({ label, id, handler, component }, groups, element, injector) {
//console.log(component);
  let group = {}
  if ( component == ListGroup ) {
    group = {
      label,
      id,
      component,
      ...handler({ element, injector })
    };
    if ( group.items ) {
      groups.push(group);
    }
  }
  else {
    const group = {
      label,
      id,
      component: Group,
      entries: [
        ...handler({ element, injector })
      ]
    };
    if (group.entries.length) {
      groups.push(group);
    }
  }
}

// from BpmnPropertiesProvider.js

function GeneralGroup(element) {

  const entries = [
    ...NameProps({ element }),
    ...IdProps({ element }),
    ...ProcessProps({ element }),
    ...ExecutableProps({ element }),
    ...SequentialPerformerProps({ element }),
    ...AdHocOrderingProps({ element }),
    ...DocumentationProps({ element })
  ];

  return {
    id: 'general',
    label: 'General',
    entries,
    component: Group
  };

}
