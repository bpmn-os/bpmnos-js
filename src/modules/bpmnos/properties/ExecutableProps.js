import {
  getRelevantBusinessObject
} from '../utils/CustomItemUtil.js';

import {
  is
} from 'bpmn-js/lib/util/ModelUtil';

import { CheckboxEntry, isCheckboxEntryEdited } from '@bpmn-io/properties-panel';

import { useService } from 'bpmn-js-properties-panel';

import {
  createElement
} from '../utils/ElementUtil.js';

import {
  ensureCustomItem
} from '../utils/CustomItemUtil.js';

/**
 * @typedef { import('@bpmn-io/properties-panel').EntryDefinition } Entry
 */

/**
 * @returns {Array<Entry>} entries
 */
export function ExecutableProps(props) {
  const {
    element
  } = props;

  if (!is(element, 'bpmn:Process') && !hasProcessRef(element)) {
    return [];
  }

  return [
    {
      id: 'isExecutable',
      component: Executable,
      isEdited: isCheckboxEntryEdited
    }
  ];
}

function Executable(props) {
  const {
    element
  } = props;

  const modeling = useService('modeling');
  const bpmnFactory = useService('bpmnFactory');
  const commandStack = useService('commandStack');
  const translate = useService('translate');

  let getValue, setValue;

  setValue = (value) => {
    if ( value ) {
      ensureDefaultAttributes(element,bpmnFactory,commandStack);
    }
    modeling.updateProperties(element, {
      isExecutable: value
    });
  };

  getValue = (element) => {
    return element.businessObject.isExecutable;
  };

  // handle properties on processRef level for participants
  if (is(element, 'bpmn:Participant')) {

    const process = element.businessObject.get('processRef');

    setValue = (value) => {
      if ( value ) {
        ensureDefaultAttributes(element,bpmnFactory,commandStack);
      }
      commandStack.execute(
        'element.updateModdleProperties',
        {
          element,
          moddleElement: process,
          properties: {
            isExecutable: value
          }
        }
      );
    };

    getValue = () => {
      return process.get('isExecutable');
    };

  }

  return CheckboxEntry({
    element,
    id: 'isExecutable',
    label: translate('Executable'),
    getValue,
    setValue
  });
}


// helper /////////////////////

function hasProcessRef(element) {
  return is(element, 'bpmn:Participant') && element.businessObject.get('processRef');
}

// whether the process already declares the instance, on whichever of its data objects it declares it
function hasInstanceAttribute(businessObject) {
  return (businessObject.get('flowElements') || [])
    .filter(flowElement => is(flowElement, 'bpmn:DataObject'))
    .some(dataObject => attributesOf(dataObject).some(attribute => attribute.get('id') == "Instance"));
}

/**
 * The attributes an executable process always declares, whichever of them it is still missing.
 *
 * A process declares `Timestamp` in its status and `Instance` on a data object of its own, once per
 * process, since each process is instantiated on its own and carries a time and an identity of its own. The
 * objective a run accumulates is held by the engine and declared by no attribute.
 */
/**
 * The `bpmnos:Attribute`s an element declares directly, whichever of its extension values holds them.
 *
 * The extension values are searched rather than the first of them taken, since an element may carry an
 * extension of another kind before the attributes, and a model is not to be read as declaring nothing
 * because of the order its extensions happen to stand in.
 */
function attributesOf(moddleElement) {
  const extensionElements = moddleElement.get('extensionElements'),
        values = extensionElements ? extensionElements.get('values') || [] : [];

  return values
    .filter(value => is(value, 'bpmnos:Attributes'))
    .flatMap(attributes => attributes.get('attribute') || []);
}

function ensureDefaultAttributes(element,bpmnFactory,commandStack) {
  const businessObject = getRelevantBusinessObject(element);

  if ( !hasInstanceAttribute(businessObject) ) {

    // the data object is built whole and contained in one command, so that undoing the tick that created it
    // takes it away again
    const dataObject = createElement('bpmn:DataObject', {}, businessObject, bpmnFactory);
    const extensionElements = createElement('bpmn:ExtensionElements', { values: [] }, dataObject, bpmnFactory);
    const attributes = createElement('bpmnos:Attributes', {}, extensionElements, bpmnFactory);
    const attribute = createElement('bpmnos:Attribute',
      { id: 'Instance' , name: 'instance', type: 'string' }, attributes, bpmnFactory);

    attributes.get('attribute').push(attribute);
    extensionElements.get('values').push(attributes);
    dataObject.extensionElements = extensionElements;

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: businessObject,
      properties: {
        flowElements: [ ...businessObject.get('flowElements'), dataObject ]
      }
    });
  }

  const status = ensureCustomItem(bpmnFactory, commandStack, element, 'bpmnos:Status'); 
  let attributes = status.get('attributes') ? status.attributes[0] : undefined;
  if ( !attributes ) {
    // create 'bpmnos:Attributes'
    attributes = createElement('bpmnos:Attributes', {}, status, bpmnFactory);
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: status,
      properties: {
        attributes: [ attributes ]
      }
    });
  }

  // matched by id, as the engine matches it and as `Instance` is matched above: the name of an attribute
  // carries its initial value too, so a process declaring `timestamp := 0` holds no attribute named
  // `timestamp` and would be given a second one
  let attributeList = attributes.get('attribute') || [];
  if ( !attributeList.find(attribute => attribute.id == "Timestamp") ) {
    const attribute = createElement('bpmnos:Attribute', { id: 'Timestamp' , name: 'timestamp', type: 'decimal' }, attributes, bpmnFactory);
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: attributes,
      properties: {
        attribute: [ ...attributes.get('attribute'), attribute ]
      }
    });
  }
}
