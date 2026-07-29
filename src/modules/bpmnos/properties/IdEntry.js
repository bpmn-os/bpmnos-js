import { TextFieldEntry } from '@bpmn-io/properties-panel';

import { useCallback } from '@bpmn-io/properties-panel/preact/hooks';

import { useService } from 'bpmn-js-properties-panel';

/**
 * The identifier of a piece of extension content, refusing one the process has already taken.
 *
 * One entry serves every kind of content that carries an identifier, an attribute, a restriction, an
 * operator, a choice and a lookup table alike, because the rule they answer to is one rule: within a process
 * no two pieces of extension content may share an identifier, whatever their kind, since the identifier is
 * the key every lookup is built on. The check is put to the `identifiers` service, which holds that
 * namespace for the model being edited and is bounded by the process, so an identifier legitimately repeated
 * in another participant's process is not refused here.
 *
 * The content being edited is passed to the check and excluded by it, so that content does not report its
 * own identifier as a duplicate of itself.
 *
 * Refusing what is already taken is what keeps a model consistent while it is being written; the lint rule
 * that reports a duplicate remains for the models this modeller never produced, one imported, one generated,
 * one edited by hand.
 *
 * @param {Object} props
 * @param {String} props.idPrefix
 * @param {djs.model.Base} props.element  the element the content belongs to
 * @param {ModdleElement} props.item      the content whose identifier is edited
 */
export default function IdEntry(props) {
  const {
    idPrefix,
    element,
    item
  } = props;

  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const identifiers = useService('identifiers');

  const setValue = (value, error) => {

    // the panel reports the fault and writes regardless, so what is refused must be refused here, as the
    // element's own id entry does: a rejected identifier never reaches the model
    if (error) {
      return;
    }

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: item,
      properties: {
        id: value
      }
    });
  };

  const getValue = () => {
    return item.get('id');
  };

  /**
   * The check must keep its identity between renderings.
   *
   * The panel validates in two places, once for what is typed and once, in an effect, for what the model
   * holds, and that effect runs again whenever the value or the check itself changes. A check written afresh
   * on every rendering therefore re-runs against the model, which still holds the identifier the refused one
   * was to replace and is by definition valid, and the message disappears as soon as it is shown. Held
   * steady, the effect runs only when the model's value really changes, so the message stays until the
   * typed identifier is one the model can take.
   */
  const validate = useCallback((value) => {
    if ( !value || value.trim() == "" ) {
      return translate('Id must not be empty.');
    }

    if ( identifiers.isTaken(element, value, item) ) {
      return translate('Id is already used within the process.');
    }
  }, [ element, item, identifiers, translate ]);

  return TextFieldEntry({
    element: item,
    id: idPrefix + '-id',
    label: translate('Id'),
    validate,
    getValue,
    setValue,
    debounce
  });
}
