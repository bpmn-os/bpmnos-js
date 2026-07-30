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

import RestrictionEntries from './RestrictionEntries.js';


export default function RestrictionsList(props) {
  const {
    element,
    idPrefix,
    guidance
  } = props;

  const id = `${ idPrefix }-restrictions`;

  const bpmnFactory = useService('bpmnFactory');
  const commandStack = useService('commandStack');
  const identifiers = useService('identifiers');
  const translate = useService('translate');

  const businessObject = getBusinessObject(element);

  let parent = guidance.get('restrictions') || [];
  const restrictions = parent.length && parent[0].restriction || [];

  function addFactory() {
    let restrictionList = guidance.restrictions ? guidance.get('restrictions')[0] : undefined;
    if ( !restrictionList ) {
      // create 'bpmnos:Restrictions'
      restrictionList = createElement('bpmnos:Restrictions', {}, guidance, bpmnFactory);
      commandStack.execute('element.updateModdleProperties', {
          element,
          moddleElement: guidance,
          properties: {
            restrictions: [ ...guidance.get('restrictions'), restrictionList ]
          }
      });
    }

    // create 'bpmnos:Restriction'
    const restriction = createElement('bpmnos:Restriction', { id: identifiers.nextId(element, 'Restriction_') }, restrictionList, bpmnFactory);

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: restrictionList,
      properties: {
        restriction: [ ...restrictionList.get('restriction'), restriction ]
      }
    });
  }

  function removeFactory(restriction) {
    commandStack.execute('properties-panel.multi-command-executor',
      removeCustomItemCommands(element, restriction));
  }

  return <ListEntry
    element={ element }
    id={ id }
    label={ translate('Restrictions') }
    items={ restrictions }
    component={ Restriction }
    onAdd={ addFactory }
    onRemove={ removeFactory } />;
}

function Restriction(props) {
  const {
    element,
    id,
    index,
    item,
    open
  } = props;

  const restriction = item;
  const translate = useService('translate');
  return (
    <CollapsibleEntry
      id={ id }
      element={ element }
      entries={ RestrictionEntries({
        idPrefix: id,
        element,
        restriction
      }) }
      label={ restriction.expression || restriction.get('id') }
      open={ open }
    />
  );
}
