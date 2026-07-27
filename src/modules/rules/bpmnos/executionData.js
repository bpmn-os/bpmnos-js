import { is } from 'bpmnlint-utils';

import { collectExecutionData } from '../../bpmnos/collectExecutionData.js';

/**
 * Execution data for lint rules.
 *
 * The rules answer "what is visible at this node" with the same module the modeller and bpmnosdoc use, so
 * there is one account of declaration and inheritance rather than a second walk that drifts from it.
 *
 * Note what is deliberately absent: nothing here reads an expression. Restrictions, operators, conditions
 * and parameter values are LIMEX expressions, compiled by the engine against its attribute registry — a
 * grammar with calls, aggregators binding their own variables (`min{ d in departures | d >= timestamp }`),
 * collections and keywords, which a regular expression here could only approximate and would fall behind on
 * the next LIMEX change. Checking those belongs where the engine itself can be asked, i.e. bpmnos-workbench
 * and its engine WASM build.
 *
 * The collection is rebuilt per call rather than cached: a lint run happens after the model changed, and
 * caching on the definitions object — which stays the same across edits — would serve a stale answer.
 * Models are tens of elements, so the walk is cheap.
 */
export function visibleAttributes(node) {
  const definitions = getDefinitions(node);

  if (!definitions) {
    return [];
  }

  const { byElement } = collectExecutionData(definitions),
        visible = byElement.get(node.id);

  if (!visible) {
    return [];
  }

  return [ ...visible.status, ...visible.data, ...visible.globals ];
}

export function getDefinitions(node) {
  let businessObject = node;

  while (businessObject && !is(businessObject, 'bpmn:Definitions')) {
    businessObject = businessObject.$parent;
  }

  return businessObject;
}

/**
 * The bare name of an attribute: the model keeps name and initial value in one string, `name := expression`,
 * as the properties panel edits them.
 */
export function attributeName(attribute) {
  const raw = (attribute.name || attribute.id || '').trim(),
        separator = raw.indexOf(':=');

  return separator === -1 ? raw : raw.slice(0, separator).trim();
}

/**
 * The names an element may refer to, as a Set of bare names.
 */
export function visibleNames(node) {
  return new Set(visibleAttributes(node).map(attributeName));
}

/**
 * Everything an element declares itself: the status, data and global attributes whose declaring element it
 * is, plus the attributes of any guidance it carries — which belong to that guidance and to nothing else.
 */
export function declaredAttributes(node) {
  const definitions = getDefinitions(node);

  if (!definitions) {
    return [];
  }

  const entry = collectExecutionData(definitions).byElement.get(node.id);

  if (!entry) {
    return [];
  }

  const own = [ ...entry.status, ...entry.data, ...entry.globals ]
    .filter(attribute => attribute.declaringElement === node.id);

  return [ ...own, ...entry.guidance.flatMap(guidance => guidance.attributes) ];
}
