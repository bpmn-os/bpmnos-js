import {
  is
} from 'bpmn-js/lib/util/ModelUtil';

import { TextFieldEntry, SelectEntry } from '@bpmn-io/properties-panel';

import { useCallback } from '@bpmn-io/properties-panel/preact/hooks';

import { useService } from 'bpmn-js-properties-panel';

import IdEntry from './IdEntry.js';

import {
  createElement
} from '../utils/ElementUtil.js';

import { without } from 'min-dash';

import { isScalarType, isObjectiveType } from '../utils/TypeUtil.js';

export default function AttributeEntries(props) {

  const {
    idPrefix,
    element,
    attribute
  } = props;

  const entries = [ {
    id: idPrefix + '-id',
    component: IdEntry,
    idPrefix,
    item: attribute
  },{
    id: idPrefix + '-type',
    component: AttributeType,
    idPrefix,
    attribute
  },{
    id: idPrefix + '-schema',
    component: AttributeSchema,
    idPrefix,
    attribute
  },{
    id: idPrefix + '-name',
    component: AttributeName,
    idPrefix,
    attribute
  },{
    id: idPrefix + '-objective',
    component: AttributeObjective,
    idPrefix,
    attribute
  },{
    id: idPrefix + '-weight',
    component: AttributeWeight,
    idPrefix,
    attribute
  } ];

  return entries;
}

function AttributeName(props) {
  const {
    idPrefix,
    element,
    attribute
  } = props;

  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const setValue = (value) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: attribute,
      properties: {
        name: value
      }
    });
  };

  const getValue = () => {
    return attribute.name;
  };

  const validate = (value) => {
    if ( !value || value.trim() == "" ) {
      return 'Name must not be empty.';
    }
  }

  return TextFieldEntry({
    element: attribute,
    id: idPrefix + '-name',
    label: translate('Name (and initial value)'),
    validate,
    getValue,
    setValue,
    debounce
  });
}

/**
 * The attributes for which Custom is chosen while their type is still a scalar one.
 *
 * Choosing Custom for a scalar attribute leaves its type as it is, so that the schema entry starts from the
 * scalar type last selected, e.g. `decimal`, to be extended to `decimal[]`. A type that is a scalar one is
 * otherwise shown as that scalar type, so the choice is remembered here until the schema is changed or a
 * scalar type is chosen again. It is a state of the editor, not of the model, and is not saved.
 */
const customChosen = new WeakSet();

/**
 * Returns true if the attribute is shown with a custom type.
 */
function isCustom(attribute) {
  return customChosen.has(attribute) || !isScalarType(attribute.get('type'));
}

/**
 * The type of an attribute: one of the scalar types, or custom, the schema of an array or of a value with
 * fields, which the schema entry holds.
 *
 * A type that is not a scalar one cannot contribute to the objective, so choosing it clears the objective and
 * the weight, as choosing a string does.
 */
function AttributeType(props) {
  const {
    idPrefix,
    element,
    attribute
  } = props;

  const commandStack = useService('commandStack');
  const eventBus = useService('eventBus');
  const translate = useService('translate');

  const setValue = (value) => {
    if ( value == 'custom' ) {
      if ( !isCustom(attribute) ) {
        // the type is kept, for the schema entry to start from it, and the entries are shown anew
        customChosen.add(attribute);
        eventBus.fire('elements.changed', { elements: [ element ] });
      }
      return;
    }

    customChosen.delete(attribute);

    const properties = { type: value };

    if ( !isObjectiveType(value) ) {
      properties.objective = null;
      properties.weight = null;
    }

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: attribute,
      properties
    });
  };

  const getValue = () => {
    return isCustom(attribute) ? 'custom' : attribute.get('type');
  };

  const getOptions = (element) => {
    return [
      { value: 'integer', label: translate('Integer') },
      { value: 'decimal', label: translate('Decimal') },
      { value: 'boolean', label: translate('Boolean') },
      { value: 'string', label: translate('String') },
      { value: 'custom', label: translate('Custom') }
    ];
  };

  return SelectEntry({
    element: attribute,
    id: idPrefix + '-type',
    label: translate('Type'),
    getValue,
    setValue,
    getOptions
  });
}

/**
 * The schema of a custom type, e.g. `integer[5]` or `{ x: decimal, flags: boolean[3] }[]`, shown only for an
 * attribute with a custom type.
 *
 * The schema is written in the engine's grammar and checked by the engine when it builds the model; here it is
 * only required to be given. Changing it ends the choice of Custom remembered for a scalar type, the type now
 * saying for itself whether it is custom, and clears an objective and a weight a custom type cannot carry.
 */
function AttributeSchema(props) {
  const {
    idPrefix,
    element,
    attribute
  } = props;

  if ( !attribute || !isCustom(attribute) ) {
    return;
  }

  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const setValue = (value, error) => {
    if (error) {
      return;
    }

    const properties = { type: value };

    if ( !isObjectiveType(value) ) {
      properties.objective = null;
      properties.weight = null;
    }

    customChosen.delete(attribute);

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: attribute,
      properties
    });
  };

  const getValue = () => {
    return attribute.get('type');
  };

  const validate = useCallback((value) => {
    if ( value === undefined || value === null || String(value).trim() == '' ) {
      return translate('Schema must not be empty.');
    }
  }, [ translate ]);

  return TextFieldEntry({
    element: attribute,
    id: idPrefix + '-schema',
    label: translate('Schema'),
    validate,
    getValue,
    setValue,
    debounce
  });
}

function AttributeObjective(props) {
  const {
    idPrefix,
    element,
    attribute
  } = props;

  if ( !attribute || !isObjectiveType(attribute.get('type')) ) {
    return;
  }

  const commandStack = useService('commandStack');
  const translate = useService('translate');
//  const debounce = useService('debounceInput');

  const setValue = (value) => {

    // an option carrying no value of its own is handed back by its label, so `none` arrives as a word and
    // means what an empty selection means: the attribute contributes to no objective
    if ( value && value != 'none' ) {

      // an objective requires a weight, so one is given where the attribute carries none; a weight already
      // set is kept, since changing between minimize and maximize says nothing about it
      const weight = attribute.get('weight');

      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: attribute,
        properties: {
          objective: value,
          weight: weight === undefined || weight === null || weight === '' ? '1' : weight
        }
      });
    }
    else {
      commandStack.execute('element.updateModdleProperties', {
        element,
        moddleElement: attribute,
        properties: {
          objective: null,
          weight: null
        }
      });
    }
  };

  const getValue = () => {

    // a model may carry `objective="none"`, which the engine reads as no objective and which is shown as one
    return attribute.objective == 'none' ? '' : attribute.objective;
  };

  const getOptions = (element) => {
    return [
      { value: '', label: translate('none') },
      { value: 'minimize', label: translate('minimize') },
      { value: 'maximize', label: translate('maximize') }
    ];
  };

  return SelectEntry({
    element: attribute,
    id: idPrefix + '-objective',
    label: translate('Objective'),
    getValue,
    setValue,
    getOptions
  });
}

function AttributeWeight(props) {
  const {
    idPrefix,
    element,
    attribute
  } = props;

  if ( !attribute || !(attribute.get('objective') == 'maximize' || attribute.get('objective') == 'minimize')) {
    return;
  }
  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const setValue = (value, error) => {

    // what the check refuses never reaches the model, as with an identifier
    if (error) {
      return;
    }

    // the entry commits what it holds as it is removed, which happens exactly when the objective is cleared,
    // so a weight is written only while there is an objective to weigh
    const objective = attribute.get('objective');

    if ( !objective || objective == 'none' ) {
      return;
    }

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: attribute,
      properties: {
        weight: value
      }
    });
  };

  const getValue = () => {
    return attribute.weight;
  };

  /**
   * An attribute contributing to the objective is weighted, and the weight is a number.
   *
   * The engine multiplies the attribute's value by it (`Attribute.cpp`), so a missing or unreadable weight
   * has no meaning; the entry is shown only while there is an objective, so the check applies exactly where
   * a weight is required. It keeps its identity between renderings for the reason given in `IdEntry`: a
   * check written afresh each time would clear its own message against the value the model still holds.
   */
  const validate = useCallback((value) => {
    if ( value === undefined || value === null || String(value).trim() == "" ) {
      return translate('Weight must not be empty.');
    }

    if ( !isFinite(Number(value)) ) {
      return translate('Weight must be a number.');
    }
  }, [ translate ]);

  return TextFieldEntry({
    element: attribute,
    id: idPrefix + '-weight',
    label: translate('Weight'),
    validate,
    getValue,
    setValue,
    debounce
  });
}

