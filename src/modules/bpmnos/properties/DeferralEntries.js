import {
  CollapsibleEntry,
  ListEntry,
  TextFieldEntry
} from '@bpmn-io/properties-panel';

import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';

import { useService } from 'bpmn-js-properties-panel';

import { createElement } from '../utils/ElementUtil.js';

import { removeCustomItemCommands } from '../utils/RemovalUtil.js';

import { getDeferral, getDeferralHolder } from '../utils/DeferralUtil.js';

/**
 * The entry of the deferral of the decision point a guidance belongs to, a group holding its condition and its
 * observed attributes, each a parameter named `observable` whose value names a data or global attribute.
 *
 * The deferral is created with its first content and removed with its last, so that a guidance or a performer
 * stating no deferral is left as it was. For an entry guidance the deferral is that of the performer, which
 * every sequential activity of the performer shows and edits alike.
 */
export default function DeferralEntries(props) {
  const {
    idPrefix,
    element,
    guidance
  } = props;

  const holder = getDeferralHolder(getBusinessObject(element), guidance);

  if ( !holder ) {
    return [];
  }

  return [
    {
      id: idPrefix + '-deferral',
      component: Deferral,
      idPrefix,
      holder
    }
  ];
}

function Deferral(props) {
  const {
    idPrefix,
    element,
    holder
  } = props;

  const translate = useService('translate');

  return (
    <CollapsibleEntry
      id={ idPrefix + '-deferral' }
      element={ element }
      entries={ [
        {
          id: idPrefix + '-deferral-condition',
          component: DeferralCondition,
          idPrefix,
          holder
        },
        {
          id: idPrefix + '-deferral-observables',
          component: DeferralObservables,
          idPrefix,
          holder
        }
      ] }
      label={ translate('Deferral') }
      open={ !!getDeferral(holder) } />
  );
}

function DeferralCondition(props) {
  const {
    idPrefix,
    element,
    holder
  } = props;

  const bpmnFactory = useService('bpmnFactory');
  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const getValue = () => {
    const deferral = getDeferral(holder);

    return deferral && deferral.get('condition');
  };

  const setValue = (value) => {
    const deferral = getDeferral(holder);

    if ( !deferral ) {
      if ( value ) {
        const created = createElement('bpmnos:Deferral', { condition: value }, undefined, bpmnFactory);
        commandStack.execute('properties-panel.multi-command-executor',
          insertDeferralCommands(element, holder, created, bpmnFactory));
      }
      return;
    }

    if ( !value && !deferral.get('parameter').length ) {
      commandStack.execute('properties-panel.multi-command-executor',
        removeCustomItemCommands(element, deferral));
      return;
    }

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: deferral,
      properties: {
        condition: value
      }
    });
  };

  // a deferral with observed attributes states a condition, the engine refusing one without
  const validate = (value) => {
    const deferral = getDeferral(holder);

    if ( ( !value || value.trim() == "" ) && deferral && deferral.get('parameter').length ) {
      return translate('Condition must not be empty.');
    }
  };

  return TextFieldEntry({
    element,
    id: idPrefix + '-deferral-condition',
    label: translate('Condition'),
    description: holder.$instanceOf('bpmn:Performer') ?
      translate('Shared by every sequential activity of the performer') : undefined,
    validate,
    getValue,
    setValue,
    debounce
  });
}

function DeferralObservables(props) {
  const {
    idPrefix,
    element,
    holder
  } = props;

  const bpmnFactory = useService('bpmnFactory');
  const commandStack = useService('commandStack');
  const translate = useService('translate');

  const deferral = getDeferral(holder);
  const parameters = deferral ? deferral.get('parameter') : [];

  function addFactory() {
    if ( !deferral ) {
      const created = createElement('bpmnos:Deferral', {}, undefined, bpmnFactory);
      created.get('parameter').push(createElement('bpmnos:Parameter', { name: 'observable' }, created, bpmnFactory));
      commandStack.execute('properties-panel.multi-command-executor',
        insertDeferralCommands(element, holder, created, bpmnFactory));
      return;
    }

    const parameter = createElement('bpmnos:Parameter', { name: 'observable' }, deferral, bpmnFactory);
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: deferral,
      properties: {
        parameter: [ ...deferral.get('parameter'), parameter ]
      }
    });
  }

  function removeFactory(parameter) {
    commandStack.execute('properties-panel.multi-command-executor',
      removeCustomItemCommands(element, parameter));
  }

  return <ListEntry
    element={ element }
    id={ idPrefix + '-deferral-observables' }
    label={ translate('Observed attributes') }
    items={ parameters }
    component={ Observable }
    onAdd={ addFactory }
    onRemove={ removeFactory } />;
}

function Observable(props) {
  const {
    element,
    id,
    item: parameter
  } = props;

  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const setValue = (value) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: parameter,
      properties: {
        value
      }
    });
  };

  const getValue = () => {
    return parameter.get('value');
  };

  const validate = (value) => {
    if ( !value || value.trim() == "" ) {
      return translate('Attribute must not be empty.');
    }
  };

  return TextFieldEntry({
    element: parameter,
    id: id + '-value',
    label: translate('Attribute'),
    validate,
    getValue,
    setValue,
    debounce
  });
}

// the commands inserting a deferral into its holder, creating the extension elements of a performer stating
// none, as one step of the undo history
function insertDeferralCommands(element, holder, deferral, bpmnFactory) {
  if ( holder.$instanceOf('bpmnos:Guidance') ) {
    deferral.$parent = holder;
    return [ updateModdleProperties(element, holder, { deferral: [ ...holder.get('deferral'), deferral ] }) ];
  }

  let extensionElements = holder.get('extensionElements');

  if ( !extensionElements ) {
    extensionElements = createElement('bpmn:ExtensionElements', { values: [ deferral ] }, holder, bpmnFactory);
    deferral.$parent = extensionElements;
    return [ updateModdleProperties(element, holder, { extensionElements }) ];
  }

  deferral.$parent = extensionElements;
  return [ updateModdleProperties(element, extensionElements, { values: [ ...extensionElements.get('values'), deferral ] }) ];
}

function updateModdleProperties(element, moddleElement, properties) {
  return {
    cmd: 'element.updateModdleProperties',
    context: { element, moddleElement, properties }
  };
}
