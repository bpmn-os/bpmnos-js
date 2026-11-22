import { SelectEntry } from '@bpmn-io/properties-panel';

import {
  is,
  isAny
} from 'bpmn-js/lib/util/ModelUtil';

import {
  getRelevantBusinessObject,
} from '../utils/CustomItemUtil.js';

import {
  isMessageSupported
} from '../utils/EventDefinitionUtil.js';

import { useService } from 'bpmn-js-properties-panel';

import AttributesList from './GuidingAttributesList.js';
import RestrictionsList from './GuidingRestrictionsList.js';
import OperatorsList from './GuidingOperatorsList.js';
import DeferralEntries from './DeferralEntries.js';

/**
 * The types of guidance an element may carry, one for each decision made at it: the entry of a child of an
 * ad-hoc subprocess, which the engine performs sequentially, any other activity being entered without a
 * decision; the choice at a decision task; and the delivery of a message to a receive task or a catching
 * message event.
 */
export function getGuidanceTypes(element) {
  const businessObject = getRelevantBusinessObject(element);

  if ( is(element, 'bpmn:CatchEvent') ) {
    return isMessageSupported(element) ? [ { label: 'Message delivery', value: 'message' } ] : [];
  }

  const guidanceTypes = [];
  if ( is(businessObject.$parent, 'bpmn:AdHocSubProcess') ) {
    guidanceTypes.push({ label: 'Entry decision', value: 'entry' });
  }
  if ( is(element, 'bpmn:Task') && businessObject.type == "Decision" ) {
    guidanceTypes.push({ label: 'Choice', value: 'choice' });
  }
  else if ( is(element, 'bpmn:ReceiveTask') ) {
    guidanceTypes.push({ label: 'Message delivery', value: 'message' });
  }
  return guidanceTypes;
}

export default function GuidanceEntries(props) {
  const {
    idPrefix,
    element,
    guidance
  } = props;

  const entries = [ 
    {
      id: idPrefix + '-type',
      component: GuidanceType,
      idPrefix,
      guidance
    },
    ...DeferralEntries({
      idPrefix,
      element,
      guidance
    }),
    {
      id: idPrefix + '-attributes',
      component: AttributesList,
      idPrefix,
      guidance
    },
    {
      id: idPrefix + '-restrictions',
      component: RestrictionsList,
      idPrefix,
      guidance
    },
    {
      id: idPrefix + '-operators',
      component: OperatorsList,
      idPrefix,
      guidance
    }
  ];

  return entries;
}

function GuidanceType(props) {
  const {
    idPrefix,
    element,
    guidance
  } = props;

  const guidanceTypes = getGuidanceTypes(element);

  const commandStack = useService('commandStack');
  const bpmnFactory = useService('bpmnFactory');
  const translate = useService('translate');

  const setValue = (value) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: guidance,
      properties: {
        type: value
      }
    });
  };

  const getValue = () => {
    if ( guidance ) {
      let value = guidance.get('type');
      if ( !value && guidanceTypes.length ) {
        value = guidanceTypes[0].value;
        commandStack.execute('element.updateModdleProperties', {
          element,
          moddleElement: guidance,
          properties: {
            type: value
          }
        });

      }
      return value;
    }
  };

  const getOptions = (element) => {
    return guidanceTypes;
  };

  return SelectEntry({
    element: guidance,
    id: idPrefix + '-type',
    label: translate('Type'),
    getValue,
    setValue,
    getOptions
  });
}

