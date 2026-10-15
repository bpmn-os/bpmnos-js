import { TextFieldEntry } from '@bpmn-io/properties-panel';

import { useService } from 'bpmn-js-properties-panel';

import {
  ensureCustomItem
} from '../utils/CustomItemUtil.js';

/**
 * The type of the content a message, signal, error or escalation carries, an object in the syntax of attribute
 * types, `{ order: string, duration: decimal }`; empty if it carries no content. The engine reads the type, so it
 * is not parsed here.
 *
 * @param {Object} props
 * @param {string} props.idPrefix
 * @param {ModdleElement} props.element
 * @param {ModdleElement} [props.item] the `bpmnos:Message`, `bpmnos:Signal`, `bpmnos:Error` or `bpmnos:Escalation`
 * @param {string} props.itemType the type of the item, created when a type is given to an element stating none
 */
export default function ContentTypeEntry(props) {
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
    if ( !item ) {
      item = ensureCustomItem(bpmnFactory, commandStack, element, itemType);
    }

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: item,
      properties: {
        type: value && value.trim() !== '' ? value : undefined
      }
    });
  };

  const getValue = () => {
    if ( item ) {
      return item.get('type');
    }
  };

  return TextFieldEntry({
    element: item,
    id: idPrefix + '-type',
    label: translate('Content type'),
    description: translate('An object, e.g. { order: string, duration: decimal }; empty if there is no content'),
    getValue,
    setValue,
    debounce
  });
}
