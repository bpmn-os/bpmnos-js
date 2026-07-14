import {
  is,
  isAny
} from 'bpmn-js/lib/util/ModelUtil';

import { without } from 'min-dash';

import { getCustomItem } from './utils/CustomItemUtil';

export default function BPMNOSPropertiesUpdater(eventBus,commandStack) {

  eventBus.on('element.changed', function(event) {
    const element = event.element;

    if ( is(element,'bpmn:Event') ) {
      const eventDefinitions = element.businessObject.eventDefinitions;
      if ( !eventDefinitions || !eventDefinitions.find(definition => definition.$type == 'bpmn:MessageEventDefinition') ) {
        removeExtensionElements(element,'bpmnos:Message',commandStack);
      }
      if ( !eventDefinitions || !eventDefinitions.find(definition => definition.$type == 'bpmn:TimerEventDefinition') ) {
        removeExtensionElements(element,'bpmnos:Parameter',commandStack);
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

      // a bpmnos:Messages extension belongs to a send or receive task
      if ( !isAny(element,[ 'bpmn:SendTask', 'bpmn:ReceiveTask' ]) ) {
        removeCustomItem(element,'bpmnos:Messages',commandStack);
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
