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
  const { status, data, globals } = executionData.get(host);

  const compartments = [
    { label: 'Status', items: status.map(item) },
    { label: 'Data', items: data.map(item) },
    { label: 'Globals', items: globals.map(item) }
  ];

  return {
    title: titleOf(host),
    compartments: compartments.filter(compartment => compartment.items.length)
  };
}

// a pool is titled by the process it refers to — a participant id is never shown
function titleOf(host) {
  const businessObject = getBusinessObject(host),
        processRef = businessObject.get && businessObject.get('processRef');

  return processRef ? processRef.id : host.id;
}

/**
 * `name : type`. The model keeps name and initialization in one string, `name := expression`, as the
 * properties panel edits them ("Name (and initial value)"); the box shows the name alone.
 */
function item(attribute) {
  const raw = attribute.name || attribute.id,
        separator = raw.indexOf(':=');

  const name = separator === -1 ? raw.trim() : raw.slice(0, separator).trim();

  return attribute.type ? `${name} : ${attribute.type}` : name;
}
