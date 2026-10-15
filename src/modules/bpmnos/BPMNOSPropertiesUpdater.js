import {
  is,
  isAny
} from 'bpmn-js/lib/util/ModelUtil';

import { without } from 'min-dash';

import { getCustomItem } from './utils/CustomItemUtil.js';

export default function BPMNOSPropertiesUpdater(eventBus,commandStack) {

  eventBus.on('element.changed', function(event) {
    const element = event.element;

    if ( is(element,'bpmn:Event') ) {
      const eventDefinitions = element.businessObject.eventDefinitions || [];
      // an event that no longer has the event definition an extension belongs to loses its extension content
      for ( const [ eventDefinitionType, type ] of [
        [ 'bpmn:MessageEventDefinition', 'bpmnos:Message' ],
        [ 'bpmn:TimerEventDefinition', 'bpmnos:Timer' ],
        [ 'bpmn:SignalEventDefinition', 'bpmnos:Signal' ],
        [ 'bpmn:ErrorEventDefinition', 'bpmnos:Error' ],
        [ 'bpmn:EscalationEventDefinition', 'bpmnos:Escalation' ]
      ] ) {
        if ( !eventDefinitions.find(definition => definition.$type == eventDefinitionType) ) {
          removeExtensionElements(element,type,commandStack);
        }
      }
    }

    // Type-specific BPMNOS data is copied when an activity's type changes. Drop it when the element no
    // longer matches the type, so it never lingers (decisions on a user task, messages on a plain task).
    if ( is(element,'bpmn:Activity') ) {
      const businessObject = element.businessObject;

      // decisions belong to a decision task (a plain bpmn:Task with type="Decision") and live under
      // bpmnos:Status
      if ( !( element.type === 'bpmn:Task' && businessObject.get('type') === 'Decision' ) ) {
        if ( businessObject.get('type') === 'Decision' ) {
          commandStack.execute('element.updateModdleProperties', {
            element,
            moddleElement: businessObject,
            properties: { type: undefined }
          });
        }
        const status = getCustomItem(element,'bpmnos:Status');
        if ( status && ( status.get('decisions') || [] ).length ) {
          commandStack.execute('element.updateModdleProperties', {
            element,
            moddleElement: status,
            properties: { decisions: undefined }
          });
        }
      }

      // a bpmnos:Message extension belongs to a send or receive task
      if ( !isAny(element,[ 'bpmn:SendTask', 'bpmn:ReceiveTask' ]) ) {
        removeCustomItem(element,'bpmnos:Message',commandStack);
      }

      // operators belong to a task, a scope having none, what is to happen when it starts being stated by the
      // operators of its start event
      if ( !is(element,'bpmn:Task') ) {
        const status = getCustomItem(element,'bpmnos:Status');
        if ( status && ( status.get('operators') || [] ).length ) {
          commandStack.execute('element.updateModdleProperties', {
            element,
            moddleElement: status,
            properties: { operators: undefined }
          });
        }
      }
    }
  });

}

BPMNOSPropertiesUpdater.$inject = [ 'eventBus', 'commandStack' ];

// helpers

function removeExtensionElements(element,type,commandStack) {
  const extensionElements = element.businessObject.get('extensionElements');
  if ( extensionElements && extensionElements.values.find(value => value.$type == type) ) {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: element.businessObject,
      properties: { extensionElements: undefined }
    });
  }
}

// remove a single top-level custom extension of the given type, keeping any others
function removeCustomItem(element,type,commandStack) {
  const businessObject = element.businessObject;
  const extensionElements = businessObject.get('extensionElements');
  if ( !extensionElements ) {
    return;
  }
  const item = ( extensionElements.get('values') || [] ).find(value => value.$type == type);
  if ( !item ) {
    return;
  }
  const kept = without(extensionElements.get('values'), item);
  if ( kept.length ) {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: extensionElements,
      properties: { values: kept }
    });
  } else {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: businessObject,
      properties: { extensionElements: undefined }
    });
  }
}
