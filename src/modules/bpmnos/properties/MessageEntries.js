import { ListEntry, TextFieldEntry } from '@bpmn-io/properties-panel';

import { useService } from 'bpmn-js-properties-panel';

import ContentTypeEntry from './ContentTypeEntry.js';
import { Parameter, ParameterEntries } from './ParameterEntries.js';

import {
  createElement
} from '../utils/ElementUtil.js';

import {
  getCustomItem,
  ensureCustomItem
} from '../utils/CustomItemUtil.js';

import { without } from 'min-dash';

export default function MessageEntries(props) {
  const {
    element,
    idPrefix,
    message
  } = props;

  const entries = [
   {
    id: idPrefix + '-name',
    component: MessageName,
    idPrefix,
    message
   },
   {
    id: idPrefix + '-type',
    component: ContentTypeEntry,
    idPrefix,
    item: message,
    itemType: 'bpmnos:Message'
   },
   {
    id: idPrefix + '-parameters',
    component: MessageParameters,
    idPrefix,
    message
   }
  ];

  return entries;
}

function MessageName(props) {
  let {
    idPrefix,
    element,
    message
  } = props;

  const bpmnFactory = useService('bpmnFactory');
  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const setValue = (value) => {

    if ( !message ) {
      // ensure 'bpmnos:Message'
      message = ensureCustomItem(bpmnFactory, commandStack, element, 'bpmnos:Message'); 
    }

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: message,
      properties: {
        name: value
      }
    });
  };

  const getValue = () => {
    if ( message ) {
      return message.name;
    }
  };

  const validate = (value) => {
    if ( !value || value.trim() == "" ) {
      return 'Name must not be empty.';
    }
  }

  return TextFieldEntry({
    element: message,
    id: idPrefix + '-name',
    label: translate('Name'),
    validate,
    getValue,
    setValue,
    debounce
  });
}

function MessageParameters(props) {
  let {
    id,
    element,
    message
  } = props;

  const bpmnFactory = useService('bpmnFactory');
  const commandStack = useService('commandStack');
  const translate = useService('translate');

  let parameter = (message || {}).parameter;

  function addParameter() {
    let commands = [];

    if ( !message ) {
      message = ensureCustomItem(bpmnFactory, commandStack, element, 'bpmnos:Message'); 
    }

    // create parameter
    const parameter = createElement('bpmnos:Parameter', {}, message, bpmnFactory);

    commands.push({
      cmd:'element.updateModdleProperties', 
      context: {
        element,
        moddleElement: message,
        properties: {
          parameter: [ ...message.get('parameter'), parameter ]
        }
      }
    });

    // commit all updates
    commandStack.execute('properties-panel.multi-command-executor', commands);

  }

  function removeParameter(parameter) {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: message,
      properties: {
        parameter: without(message.get('parameter'), parameter)
      }
    });
  }

  function compareName(parameter, anotherParameter) {
    const [ name = '', anotherName = '' ] = [ parameter.name, anotherParameter.name ];

    return name === anotherName ? 0 : name > anotherName ? 1 : -1;
  }

  return <ListEntry
    id={ id }
    element={ element }
    label={ translate('Parameters') }
    items={ parameter }
    component={ Parameter }
    onAdd={ addParameter }
    onRemove={ removeParameter }
    compareFn={ compareName }
    autoFocusEntry
  />;
}
