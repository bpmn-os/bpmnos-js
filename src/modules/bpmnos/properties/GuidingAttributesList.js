import { removeCustomItemCommands } from '../utils/RemovalUtil.js';

import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';

import {
  createElement
} from '../utils/ElementUtil.js';

import { 
  CollapsibleEntry,
  ListEntry 
} from '@bpmn-io/properties-panel';

import { useService } from 'bpmn-js-properties-panel';

import AttributeEntries from './AttributeEntries.js';


export default function AttributesList(props) {
  const {
    element,
    idPrefix,
    guidance
  } = props;

  const id = `${ idPrefix }-attributes`;

  const bpmnFactory = useService('bpmnFactory');
  const commandStack = useService('commandStack');
  const identifiers = useService('identifiers');
  const translate = useService('translate');

  const businessObject = getBusinessObject(element);

  let parent = guidance.get('attributes') || [];
  const attributes = parent.length && parent[0].attribute || [];

  function addFactory() {
    let attributeList = guidance.attributes ? guidance.get('attributes')[0] : undefined;
    if ( !attributeList ) {
      // create 'bpmnos:Attributes'
      attributeList = createElement('bpmnos:Attributes', {}, guidance, bpmnFactory);
      commandStack.execute('element.updateModdleProperties', {
          element,
          moddleElement: guidance,
          properties: {
            attributes: [ ...guidance.get('attributes'), attributeList ]
          }
      });
    }

    // create 'bpmnos:Attribute'
    const attribute = createElement('bpmnos:Attribute', { id: identifiers.nextId(element, 'Attribute_') , type: 'decimal' }, attributeList, bpmnFactory);

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: attributeList,
      properties: {
        attribute: [ ...attributeList.get('attribute'), attribute ]
      }
    });
  }

  function removeFactory(attribute) {
    commandStack.execute('properties-panel.multi-command-executor',
      removeCustomItemCommands(element, attribute));
  }

  return <ListEntry
    element={ element }
    id={ id }
    label={ translate('Attributes') }
    items={ attributes }
    component={ Attribute }
    onAdd={ addFactory }
    onRemove={ removeFactory } />;
}

function Attribute(props) {
  const {
    element,
    id,
    index,
    item,
    open
  } = props;

  const attribute = item;
  const translate = useService('translate');

  return (
    <CollapsibleEntry
      id={ id }
      element={ element }
      entries={ AttributeEntries({
        idPrefix: id,
        element,
        attribute
      }) }
      label={ attribute.get('name') ? attribute.get('name') + " : " + attribute.get('type') : attribute.get('id') }
      open={ open }
    />
  );
}
