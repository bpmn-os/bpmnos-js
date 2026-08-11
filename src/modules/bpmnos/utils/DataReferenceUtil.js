import {
  getBusinessObject,
  is
} from 'bpmn-js/lib/util/ModelUtil.js';

import {
  createElement,
  getRoot
} from './ElementUtil.js';

/**
 * The two references BPMN pairs a data declaration with.
 *
 * A `bpmn:DataObjectReference` refers to the `bpmn:DataObject` declaring the data of a scope, and a
 * `bpmn:DataStoreReference` refers to the `bpmn:DataStore` declaring the globals of a model. In both cases
 * the reference refers and does not declare, so what a reference appears to carry is read from and written
 * to the element behind it.
 */
export function isDataReference(element) {
  return is(element, 'bpmn:DataObjectReference') || is(element, 'bpmn:DataStoreReference');
}

/**
 * The element a data reference refers to, or `undefined` where it refers to nothing.
 *
 * Both `dataObjectRef` and `dataStoreRef` are optional in the schema, so a model may hold a reference that
 * leads nowhere. Such a reference declares nothing, which is an answer and not a fault.
 */
export function getDataElement(element) {
  const businessObject = getBusinessObject(element);

  if (is(businessObject, 'bpmn:DataObjectReference')) {
    return businessObject.get('dataObjectRef');
  }

  if (is(businessObject, 'bpmn:DataStoreReference')) {
    return businessObject.get('dataStoreRef');
  }
}

/**
 * The data object a data object reference refers to, created and linked where the model holds none.
 *
 * A data object is a flow element, so it belongs to the scope holding the reference, which is where
 * bpmn-js's `BpmnUpdater` keeps it as the reference is moved and where it puts it when the reference is
 * created.
 *
 * @param {BpmnFactory} bpmnFactory
 * @param {CommandStack} commandStack
 * @param {djs.model.Base} reference  a `bpmn:DataObjectReference`
 */
export function ensureDataObject(bpmnFactory, commandStack, reference) {
  const businessObject = getBusinessObject(reference);

  return businessObject.get('dataObjectRef') || create(commandStack, reference, {
    dataElement: createElement('bpmn:DataObject', {}, businessObject.$parent, bpmnFactory),
    container: businessObject.$parent,
    containment: 'flowElements',
    refProperty: 'dataObjectRef'
  });
}

/**
 * The data store a data store reference refers to, created and linked where the model holds none.
 *
 * A data store is a root element, because a store outlives any one process instance, so it belongs to the
 * definitions and stays there however the reference is moved. This is where `bpmn-js-datastore` puts the
 * store it creates with a reference.
 *
 * @param {BpmnFactory} bpmnFactory
 * @param {CommandStack} commandStack
 * @param {djs.model.Base} reference  a `bpmn:DataStoreReference`
 */
export function ensureDataStore(bpmnFactory, commandStack, reference) {
  const businessObject = getBusinessObject(reference),
        definitions = getRoot(businessObject);

  return businessObject.get('dataStoreRef') || create(commandStack, reference, {
    dataElement: createElement('bpmn:DataStore', {}, definitions, bpmnFactory),
    container: definitions,
    containment: 'rootElements',
    refProperty: 'dataStoreRef'
  });
}

/**
 * Contain the created element and point the reference at it, as one step of the command stack.
 *
 * Creating is called for when something is to be written and never when something is read: a reference
 * that leads nowhere is read as declaring nothing, and only a declaration needs somewhere to live. What
 * pairs the two on the canvas is a behaviour of the modeller, bpmn-js's own `CreateDataObjectBehavior` and
 * `bpmn-js-datastore`, and neither can act on a model that was saved without the pair. Writing is
 * therefore where the halves are made whole, and a model opened and left alone is left as it was.
 */
function create(commandStack, reference, { dataElement, container, containment, refProperty }) {
  commandStack.execute('properties-panel.multi-command-executor', [ {
    cmd: 'element.updateModdleProperties',
    context: {
      element: reference,
      moddleElement: container,
      properties: {
        [ containment ]: [ ...container.get(containment), dataElement ]
      }
    }
  }, {
    cmd: 'element.updateModdleProperties',
    context: {
      element: reference,
      moddleElement: getBusinessObject(reference),
      properties: {
        [ refProperty ]: dataElement
      }
    }
  } ]);

  return dataElement;
}
