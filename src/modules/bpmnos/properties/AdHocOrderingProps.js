import {
  is,
  getBusinessObject
} from 'bpmn-js/lib/util/ModelUtil';

import { SelectEntry } from '@bpmn-io/properties-panel';

import { useService } from 'bpmn-js-properties-panel';

import {
  createElement
} from '../utils/ElementUtil.js';

import {
  getCustomItem,
  ensureCustomItem
} from '../utils/CustomItemUtil.js';

/**
 * @returns {Array<Entry>} entries
 */
export function AdHocOrderingProps(props) {
  const {
    element
  } = props;

  if ( !is(element, 'bpmn:AdHocSubProcess' ) ) {
    return [];
  }

  return [
    {
      id: 'ordering',
      component: AdHocOrdering
    }
  ];
}

function AdHocOrdering(props) {
  const {
    element
  } = props;

  const modeling = useService('modeling');
  const translate = useService('translate');

  const setValue = (value) => {
    modeling.updateProperties(element, {
      ordering: value
    });
  };

  const getValue = () => {
    return getBusinessObject(element).ordering || 'Parallel';
  };

  // a model read with the ordering `Parallel`, stated or unset, keeps it, so that the choice remains; the
  // engine refuses it, which the option and the description say
  const getOptions = (element) => {
    return [
      { value: 'Sequential', label: translate('Sequential') },
      { value: 'Parallel', label: translate('Parallel (refused by the engine)') }
    ];
  };

  return SelectEntry({
    id: 'ordering',
    label: translate('Ordering'),
    description: getValue() === 'Sequential' ? undefined :
      translate('The engine performs an ad-hoc subprocess only sequentially.'),
    getValue,
    setValue,
    getOptions
  });
}

