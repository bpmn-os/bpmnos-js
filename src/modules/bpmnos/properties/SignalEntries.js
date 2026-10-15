import { TextFieldEntry } from '@bpmn-io/properties-panel';

import { useService } from 'bpmn-js-properties-panel';

import ContentTypeEntry from './ContentTypeEntry.js';

import {
  ensureCustomItem
} from '../utils/CustomItemUtil.js';

export default function SignalEntries(props) {
  const {
    element,
    idPrefix,
    signal
  } = props;

  const entries = [
   {
    id: idPrefix + '-name',
    component: SignalName,
    idPrefix,
    signal
   },
   {
    id: idPrefix + '-type',
    component: ContentTypeEntry,
    idPrefix,
    item: signal,
    itemType: 'bpmnos:Signal'
   }
  ];

  return entries;
}

function SignalName(props) {
  let {
    idPrefix,
    element,
    signal
  } = props;

  const bpmnFactory = useService('bpmnFactory');
  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const setValue = (value) => {

    if ( !signal ) {
      // ensure 'bpmnos:Signal'
      signal = ensureCustomItem(bpmnFactory, commandStack, element, 'bpmnos:Signal'); 
    }

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: signal,
      properties: {
        name: value
      }
    });
  };

  const getValue = () => {
    if ( signal ) {
      return signal.name;
    }
  };

  const validate = (value) => {
    if ( !value || value.trim() == "" ) {
      return 'Name must not be empty.';
    }
  }

  return TextFieldEntry({
    element: signal,
    id: idPrefix + '-name',
    label: translate('Name'),
    validate,
    getValue,
    setValue,
    debounce
  });
}
