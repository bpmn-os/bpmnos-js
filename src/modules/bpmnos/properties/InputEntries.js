import { TextFieldEntry, SelectEntry } from '@bpmn-io/properties-panel';

import { useService } from 'bpmn-js-properties-panel';

import IdEntry from './IdEntry.js';

/**
 * The entries of an input: its id, its name, its type, the file it is read from, and its schema.
 *
 * An input is a lookup table, called as a function of its name, a matrix or an object, read by its name. Its
 * schema is written in the engine's grammar and checked by the engine when it builds the model: for a lookup
 * the header, each column with its name and type (`From: string;To: string;Duration: decimal`), for a matrix
 * the schema of a two-dimensional array (`decimal[][]`), and for an object the schema of the object
 * (`{ cost: decimal }[]`).
 */
export default function InputEntries(props) {

  const {
    idPrefix,
    element,
    input
  } = props;

  const entries = [ {
    id: idPrefix + '-id',
    component: IdEntry,
    idPrefix,
    item: input
  },{
    id: idPrefix + '-name',
    component: InputName,
    idPrefix,
    input
  },{
    id: idPrefix + '-type',
    component: InputType,
    idPrefix,
    input
  },{
    id: idPrefix + '-source',
    component: InputSource,
    idPrefix,
    input
  },{
    id: idPrefix + '-schema',
    component: InputSchema,
    idPrefix,
    input
  } ];

  return entries;
}

function InputName(props) {
  const {
    idPrefix,
    element,
    input
  } = props;

  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const setValue = (value) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: input,
      properties: {
        name: value
      }
    });
  };

  const getValue = () => {
    return input.get('name');
  };

  const validate = (value) => {
    if ( !value || value.trim() == "" ) {
      return translate('Name must not be empty.');
    }
  };

  return TextFieldEntry({
    element: input,
    id: idPrefix + '-name',
    label: translate('Name'),
    validate,
    getValue,
    setValue,
    debounce
  });
}

function InputType(props) {
  const {
    idPrefix,
    element,
    input
  } = props;

  const commandStack = useService('commandStack');
  const translate = useService('translate');

  const setValue = (value) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: input,
      properties: {
        type: value
      }
    });
  };

  const getValue = () => {
    return input.get('type');
  };

  const getOptions = () => {
    return [
      { value: 'lookup', label: translate('Lookup table') },
      { value: 'matrix', label: translate('Matrix') },
      { value: 'object', label: translate('Object') }
    ];
  };

  return SelectEntry({
    element: input,
    id: idPrefix + '-type',
    label: translate('Type'),
    getValue,
    setValue,
    getOptions
  });
}

function InputSource(props) {
  const {
    idPrefix,
    element,
    input
  } = props;

  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const setValue = (value) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: input,
      properties: {
        source: value
      }
    });
  };

  const getValue = () => {
    return input.get('source');
  };

  const validate = (value) => {
    if ( !value || value.trim() == "" ) {
      return translate('File name must not be empty.');
    }
  };

  return TextFieldEntry({
    element: input,
    id: idPrefix + '-source',
    label: translate('File name'),
    validate,
    getValue,
    setValue,
    debounce
  });
}

/**
 * The schema of an input. Only its presence is checked here, and for a lookup that it names at least two
 * columns: what a schema says is read by the engine alone.
 */
function InputSchema(props) {
  const {
    idPrefix,
    element,
    input
  } = props;

  const commandStack = useService('commandStack');
  const translate = useService('translate');
  const debounce = useService('debounceInput');

  const setValue = (value) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: input,
      properties: {
        schema: value
      }
    });
  };

  const getValue = () => {
    return input.get('schema');
  };

  const validate = (value) => {
    if ( !value || value.trim() == "" ) {
      return translate('Schema must not be empty.');
    }
    if ( input.get('type') == 'lookup' ) {
      const columns = value.split(";").map(column => column.trim());
      if ( columns.length < 2 ) {
        return translate('The header of a lookup table must name at least two columns separated by semicolons.');
      }
      if ( columns.some(column => column == "") ) {
        return translate('Columns must not be empty.');
      }
    }
  };

  return TextFieldEntry({
    element: input,
    id: idPrefix + '-schema',
    label: translate('Schema'),
    validate,
    getValue,
    setValue,
    debounce
  });
}
