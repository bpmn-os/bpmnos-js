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

import OperatorEntries from './OperatorEntries.js';


export default function OperatorsList(props) {
  const {
    element,
    idPrefix,
    guidance
  } = props;

  const id = `${ idPrefix }-operators`;

  const bpmnFactory = useService('bpmnFactory');
  const commandStack = useService('commandStack');
  const identifiers = useService('identifiers');
  const translate = useService('translate');

  const businessObject = getBusinessObject(element);

  let parent = guidance.get('operators') || [];
  const operators = parent.length && parent[0].operator || [];

  function addFactory() {
    let operatorList = guidance.operators ? guidance.get('operators')[0] : undefined;
    if ( !operatorList ) {
      // create 'bpmnos:Operators'
      operatorList = createElement('bpmnos:Operators', {}, guidance, bpmnFactory);
      commandStack.execute('element.updateModdleProperties', {
          element,
          moddleElement: guidance,
          properties: {
            operators: [ ...guidance.get('operators'), operatorList ]
          }
      });
    }

    // create 'bpmnos:Operator'
    const operator = createElement('bpmnos:Operator', { id: identifiers.nextId(element, 'Operator_') , type: 'decimal' }, operatorList, bpmnFactory);

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: operatorList,
      properties: {
        operator: [ ...operatorList.get('operator'), operator ]
      }
    });
  }

  function removeFactory(operator) {
    commandStack.execute('properties-panel.multi-command-executor',
      removeCustomItemCommands(element, operator));
  }

  return <ListEntry
    element={ element }
    id={ id }
    label={ translate('Operators') }
    items={ operators }
    component={ Operator }
    onAdd={ addFactory }
    onRemove={ removeFactory } />;
}

function Operator(props) {
  const {
    element,
    id,
    index,
    item,
    open
  } = props;

  const operator = item;
  const translate = useService('translate');

  return (
    <CollapsibleEntry
      id={ id }
      element={ element }
      entries={ OperatorEntries({
        idPrefix: id,
        element,
        operator
      }) }
      label={ operator.expression || operator.get('id') }
      open={ open }
    />
  );
}
