import {
  is
} from 'bpmn-js/lib/util/ModelUtil';

import AttributeEntries from './AttributeEntries.js';

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
  isDataReference,
  getDataElement,
  ensureDataObject,
  ensureDataStore
} from '../utils/DataReferenceUtil.js';


/**
 * Creates attributes entry and returns { items, add }
 *
 * A process and an activity declare status attributes, held in the `bpmnos:Status` they carry. A data
 * object declares the data of the scope containing it and a data store declares the globals of the model,
 * and each holds its `bpmnos:Attributes` directly. Neither of the latter two is on the canvas, so the
 * editor is offered on the reference to it and reads and writes through that reference.
 *
 * A reference that refers to nothing declares nothing, and is therefore shown as declaring nothing rather
 * than refused. What it refers to is created when the first attribute is added, since only then is there
 * something that needs somewhere to live.
 */
export function attributeHandler({ element, injector }) {
  let businessObject = getRelevantBusinessObject(element);

  // do not offer for empty pools
  if (!businessObject) {
    return;
  }

  if ( !is(businessObject, 'bpmn:Process') && !is(businessObject, 'bpmn:Activity')
       && !isDataReference(businessObject) ) {
    return;
  }

  // the group is named for what the element declares rather than for the container the attributes sit in,
  // which is one word in the model and three different things to a reader
  let label = 'Status';

  let dataElement = undefined;
  if ( isDataReference(businessObject) ) {
    label = is(businessObject, 'bpmn:DataStoreReference') ? 'Globals' : 'Data';
    dataElement = element;
    element = getDataElement(element);
  }

  const bpmnFactory = injector.get('bpmnFactory'),
        commandStack = injector.get('commandStack'),
        identifiers = injector.get('identifiers');

  let attributes  = undefined;
  if ( dataElement ) {
    attributes = ( element ? getCustomItem( element, 'bpmnos:Attributes' ) : undefined ) || {};
  }
  else {
    const parent = getCustomItem( element, 'bpmnos:Status' ) || {};
    attributes = ( parent.get ? parent.get('attributes') || [] : [] )[0] || {};
  }
  
  const items = ( attributes.attribute || []).map((attribute, index) => {
    const id = element.id + '-attribute-' + index;

    return {
      id,
      label: attribute.get('name') ? attribute.get('name') + " : " + attribute.get('type') : attribute.get('id'),
      entries: AttributeEntries({
        idPrefix: id,
        element,
        attribute
      }),
      autoFocusEntry: id + '-name',
      remove: removeFactory({ commandStack, element, attribute, dataElement })
    };
  });
  return {
    label,
    items,
    add: addFactory({ bpmnFactory, commandStack, identifiers, element, dataElement })
  };
}

// ADD FACTORY //
function addFactory({ bpmnFactory, commandStack, identifiers, element, dataElement }) {
  return function(event) {
    event.stopPropagation();

    let attributes  = undefined;
    if ( dataElement ) {

      // the data object or data store behind the reference, created now where the model holds none
      element = is(dataElement, 'bpmn:DataStoreReference')
        ? ensureDataStore(bpmnFactory, commandStack, dataElement)
        : ensureDataObject(bpmnFactory, commandStack, dataElement);

      attributes = ensureCustomItem(bpmnFactory, commandStack, element, 'bpmnos:Attributes');
    }
    else {
      const parent = ensureCustomItem(bpmnFactory, commandStack, element, 'bpmnos:Status'); 
      attributes = parent.attributes ? parent.get('attributes')[0] : undefined;
      if ( !attributes ) {
        // create 'bpmnos:Attributes'
        attributes = createElement('bpmnos:Attributes', {}, parent, bpmnFactory);
        commandStack.execute('element.updateModdleProperties', {
          element,
          moddleElement: parent,
            properties: {
              attributes: [ ...parent.get('attributes'), attributes ]
            }
        });
      }
    }

    // create 'bpmnos:Attribute'
    const attribute = createElement('bpmnos:Attribute', { id: identifiers.nextId(element, 'Attribute_') , type: 'decimal' }, attributes, bpmnFactory);

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: attributes,
      properties: {
        attribute: [ ...attributes.get('attribute'), attribute ]
      }
    });

    if ( dataElement ) {
      // trigger update via fake change
      commandStack.execute('element.updateModdleProperties', {
        element: dataElement,
        moddleElement: dataElement.businessObject.id
      });
    }
  };
}

// REMOVE FACTORY //
function removeFactory({ commandStack, element, attribute, dataElement }) {
  return function(event) {
    event.stopPropagation();

    if ( dataElement ) {
      // trigger update via fake change
      commandStack.execute('element.updateModdleProperties', {
        element: dataElement,
        moddleElement: dataElement.businessObject.id
      });
    }

    commandStack.execute('properties-panel.multi-command-executor',
      removeCustomItemCommands(element, attribute));
  };
}

