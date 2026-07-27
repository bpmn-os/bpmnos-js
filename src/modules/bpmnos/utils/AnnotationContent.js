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
export function getAnnotationContent(host, executionData) {
  const { status, data, globals, conditions, timer } = executionData.get(host);

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
    own('Timer', timer.map(parameter => ({ type: parameter.name || '', text: parameter.value || '' })))
  ];

  return {
    title: titleOf(host),
    compartments: compartments.filter(compartment => compartment.inherited.length || compartment.own.length)
  };
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
