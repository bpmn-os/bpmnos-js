import { TextFieldEntry } from '@bpmn-io/properties-panel';

import { useService } from 'bpmn-js-properties-panel';

import ContentTypeEntry from './ContentTypeEntry.js';

import {
  ensureCustomItem
} from '../utils/CustomItemUtil.js';

import { removeCustomItemCommands } from '../utils/RemovalUtil.js';

/**
 * The name and the content type an error or escalation event states. Both are optional: an event stating no name
 * throws an unnamed error or escalation, or catches every one, so clearing the name removes the element stating it.
 *
 * @param {Object} props
 * @param {string} props.idPrefix
 * @param {ModdleElement} props.element
 * @param {ModdleElement} [props.item] the `bpmnos:Error` or `bpmnos:Escalation`
 * @param {string} props.itemType `bpmnos:Error` or `bpmnos:Escalation`
 */
export default function NamedContentEntries(props) {
  const {
    element,
    idPrefix,
    item,
    itemType
  } = props;

  const entries = [
   {
    id: idPrefix + '-name',
    component: ContentName,
    idPrefix,
    item,
    itemType
   }
  ];

  // a content type is stated only together with a name
  if ( item ) {
    entries.push({
      id: idPrefix + '-type',
      component: ContentTypeEntry,
      idPrefix,
      item,
      itemType
    });
  }

  return entries;
}

function ContentName(props) {
  let {
    idPrefix,
    element,
    item,
    itemType
  } = props;

  const bpmnFactory = useService('bpmnFactory');
  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const setValue = (value) => {
    if ( !value || value.trim() === '' ) {
      if ( item ) {
        commandStack.execute('properties-panel.multi-command-executor', removeCustomItemCommands(element, item));
      }
      return;
    }

    if ( !item ) {
      item = ensureCustomItem(bpmnFactory, commandStack, element, itemType);
    }

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: item,
      properties: {
        name: value
      }
    });
  };

  const getValue = () => {
    if ( item ) {
      return item.get('name');
    }
  };

  return TextFieldEntry({
    element: item,
    id: idPrefix + '-name',
    label: translate('Name'),
    description: translate('Empty to throw an unnamed one or to catch every one'),
    getValue,
    setValue,
    debounce
  });
}
