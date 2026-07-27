import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';

/**
 * The content of an element's annotation box, as plain data:
 *
 *   {
 *     title: String,                                     // header compartment, naming the element
 *     compartments: [ { label: String, items: [ String ] } ]
 *   }
 *
 * Everything comes from the execution data registry, so the box shows exactly what a token at the node
 * carries: status, data and globals, each in declaration order, inherited entries first and the node's own
 * last. Empty compartments are dropped.
 *
 * AnnotationLayout turns this into rows and a height, and the renderer draws one compartment per entry — so
 * this is the only file to change when the box is to show more, such as operators and restrictions once the
 * registry holds them.
 */
export function getAnnotationContent(host, executionData, collapsedGroup = () => false) {
  const { status, data, globals, conditions, timer, messages, signal } = executionData.get(host);

  // what counts as declared here: the element, and for a pool the process it refers to
  const businessObject = getBusinessObject(host),
        processRef = businessObject.get && businessObject.get('processRef');

  const ownIds = [ host.id, processRef && processRef.id ].filter(Boolean);

  // inherited and own are kept apart: what the element inherits can be folded away, what it declares
  // itself is always in view
  const compartment = (label, key, attributes) => ({
    label,
    key,
    inherited: attributes
      .filter(attribute => !ownIds.includes(attribute.declaringElement))
      .map(attribute => item(attribute, ownIds)),
    own: attributes
      .filter(attribute => ownIds.includes(attribute.declaringElement))
      .map(attribute => item(attribute, ownIds))
  });

  // kinds the element carries itself: nothing to fold, so they have no inherited half
  const own = (label, items) => ({ label, key: label.toLowerCase(), inherited: [], own: items });

  // the order is the token's passage through the node: what exists, then what makes the node happen at all
  const compartments = [
    compartment('Status', 'statusInherited', status),
    compartment('Data', 'dataInherited', data),
    compartment('Globals', 'globals', globals),
    own('Conditions', conditions.map(condition => ({ type: '', text: condition.expression || condition.id }))),
    own('Timer', timer.map(parameter => ({ type: parameter.name || '', text: parameter.value || '' }))),
    own('Message', messages.flatMap(definition => exchange(definition, collapsedGroup))),
    own('Signal', signal.flatMap(definition => exchange(definition, collapsedGroup)))
  ];

  return {
    title: titleOf(host),
    compartments: compartments.filter(compartment => compartment.inherited.length || compartment.own.length)
  };
}

/**
 * A message or signal: its name, then the **header** the engine matches senders and recipients on and the
 * **content** it carries, each mapping a key to a value or an attribute.
 *
 * Both groups are always shown, with their count, so an empty header is visible as `header (0)` rather than
 * leaving the reader to wonder whether it exists. Both fold, and neither is indented — the entries beneath
 * them are.
 */
function exchange(definition, collapsedGroup) {
  const name = definition.name || '';

  const group = (label, entries, keys) => {
    const key = `message:${name}:${label}`,
          collapsed = collapsedGroup(key);

    const toggle = {
      kind: 'toggle',
      key,
      type: '',
      text: `${collapsed || !entries.length ? '▸' : '▾'} ${label} (${entries.length})`
    };

    if (collapsed || !entries.length) {
      return [ toggle ];
    }

    return [ toggle, ...entries.map(entry => ({
      type: entry[keys[0]] || '',
      text: entry[keys[1]] || '',
      indent: 1
    })) ];
  };

  return [
    { type: 'Name', text: name },
    ...group('header', definition.parameters || [], [ 'name', 'value' ]),
    ...group('content', definition.contents || [], [ 'key', 'attribute' ])
  ];
}

// a pool is titled by the process it refers to — a participant id is never shown
function titleOf(host) {
  const businessObject = getBusinessObject(host),
        processRef = businessObject.get && businessObject.get('processRef');

  return processRef ? processRef.id : host.id;
}

/**
 * An item is `{ type, text }`, drawn as the type followed by the name — and by the initialization when the
 * attribute is declared here, since an inherited attribute is not reinitialized and its initial value
 * belongs to the element declaring it.
 *
 * The model keeps name and initialization in one string, as the properties panel edits them ("Name (and
 * initial value)").
 */
function item(attribute, ownIds) {
  const raw = (attribute.name || attribute.id).trim(),
        separator = raw.indexOf(':=');

  const initialized = separator !== -1 && ownIds.includes(attribute.declaringElement);

  return {
    type: attribute.type || '',
    text: initialized ? raw : (separator === -1 ? raw : raw.slice(0, separator).trim())
  };
}
