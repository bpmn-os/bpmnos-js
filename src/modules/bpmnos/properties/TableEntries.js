import {
  is
} from 'bpmn-js/lib/util/ModelUtil';

import { TextFieldEntry, SelectEntry, ListEntry } from '@bpmn-io/properties-panel';

import { useService } from 'bpmn-js-properties-panel';

import IdEntry from './IdEntry.js';

import { Parameter, ParameterEntries } from './ParameterEntries.js';

import {
  createElement
} from '../utils/ElementUtil.js';

import { without } from 'min-dash';

export default function TableEntries(props) {

  const {
    idPrefix,
    element,
    table
  } = props;

  const entries = [ {
    id: idPrefix + '-id',
    component: IdEntry,
    idPrefix,
    item: table
  },{
    id: idPrefix + '-source',
    component: TableSource,
    idPrefix,
    table
  },{
    id: idPrefix + '-name',
    component: TableName,
    idPrefix,
    table
  },{
    id: idPrefix + '-header',
    component: TableHeader,
    idPrefix,
    table
  } ];

  return entries;
}

function TableSource(props) {
  const {
    idPrefix,
    element,
    table
  } = props;

  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const setValue = (value) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: table,
      properties: {
        source: value
      }
    });
  };

  const getValue = () => {
    return table.source;
  };

  const validate = (value) => {
    if ( !value || value.trim() == "" ) {
      return 'File name must not be empty.';
    }
  }

  return TextFieldEntry({
    element: table,
    id: idPrefix + '-source',
    label: translate('File name'),
    validate,
    getValue,
    setValue,
    debounce
  });
}

function TableName(props) {
  const {
    idPrefix,
    element,
    table
  } = props;

  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const setValue = (value) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: table,
      properties: {
        name: value
      }
    });
  };

  const getValue = () => {
    return table.name;
  };

  const validate = (value) => {
    if ( !value || value.trim() == "" ) {
      return 'Function name must not be empty.';
    }
  }

  return TextFieldEntry({
    element: table,
    id: idPrefix + '-name',
    label: translate('Lookup function name'),
    validate,
    getValue,
    setValue,
    debounce
  });
}

function TableHeader(props) {
  const {
    idPrefix,
    element,
    table
  } = props;

  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const setValue = (value) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: table,
      properties: {
        header: value
      }
    });
  };

  const getValue = () => {
    return table.header;
  };

  const validate = (value) => {
    if ( !value || value.trim() == "" ) {
      return 'Header must not be empty.';
    }
    const columns = value.split(";").map(name => name.trim());
    if ( columns.length < 2 ) {
      return 'Header must contain at least two column names separated by semicolon.';
    }
    if ( columns.some(name => name == "") ) {
      return 'Column names must not be empty.';
    }
  }

  return TextFieldEntry({
    element: table,
    id: idPrefix + '-header',
    label: translate('Table header'),
    validate,
    getValue,
    setValue,
    debounce
  });
}


