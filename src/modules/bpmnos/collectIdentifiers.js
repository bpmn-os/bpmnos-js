import { is } from 'bpmnlint-utils';

import Ids from 'ids';

/**
 * The identifiers of the extension content a model declares, bounded by the process that declares it.
 *
 * Model-level only, in the manner of `collectExecutionData`: it reads the moddle tree and knows nothing of
 * the canvas, so it serves the modeller through the `identifiers` service, a test, a lint rule, or any
 * headless tool holding a `bpmn:Definitions`.
 *
 * **The boundary is the process, not the model.** The engine identifies two attributes by their identifier
 * rather than by their name, `Instance` and `Timestamp`, and every process declares its own pair, so a
 * collaboration carries one of each per participant and model-wide uniqueness is not a property of BPMN-OS
 * models. Within one process, however, no two pieces of extension content may share an identifier, whatever
 * their kind: an attribute, a restriction, an operator, a choice, a message, a signal and a lookup table are
 * one namespace, because the identifier is the key every lookup is built on. Two processes are independent
 * of each other.
 *
 * Content declared on the collaboration, the globals and any table it holds, is visible from every process
 * and therefore belongs to the namespace of each, and must clash with nothing in any of them. It is recorded
 * in every process space rather than in one of its own, which is what makes a single lookup answer for it.
 *
 * Every piece of extension content carrying an identifier is collected, found by walking the `bpmnos:`
 * subtree of each element rather than by enumerating the types that carry one, so a type added to the moddle
 * extension is covered without this module being changed.
 *
 * @param {ModdleElement} definitions  a `bpmn:Definitions`
 *
 * @return {{
 *   processes: String[],
 *   byProcess: Map<String, Map<String, Array<Object>>>,
 *   processOf: Map<String, String>
 * }}
 */
export function collectIdentifiers(definitions) {
  const registry = {
    processes: [],
    byProcess: new Map(),
    processOf: new Map()
  };

  if (!definitions) {
    return registry;
  }

  const rootElements = definitions.get('rootElements') || [];

  rootElements
    .filter(rootElement => is(rootElement, 'bpmn:Process'))
    .forEach(process => {
      registry.processes.push(process.id);
      registry.byProcess.set(process.id, new Map());

      walk(registry, process, process.id);
    });

  rootElements
    .filter(rootElement => is(rootElement, 'bpmn:Collaboration'))
    .forEach(collaboration => {

      // a participant is the pool of a process and belongs to that process's namespace
      (collaboration.get('participants') || []).forEach(participant => {
        const processRef = participant.get('processRef');

        if (processRef && registry.byProcess.has(processRef.id)) {
          registry.processOf.set(participant.id, processRef.id);
        }
      });

      // what the collaboration itself declares is seen from every process, so it is taken in every space
      registry.processes.forEach(processId => record(registry, collaboration, processId));
    });

  return registry;
}

/**
 * The process namespaces the content of an element belongs to.
 *
 * One for an element a process contains, and every one of them for an element that no process does, which is
 * the collaboration and anything the walk did not reach: content visible everywhere must be free everywhere,
 * and an element that cannot be placed is treated as such rather than as belonging nowhere.
 */
export function spacesOf(registry, elementId) {
  const processId = registry.processOf.get(elementId);

  return processId ? [ processId ] : registry.processes;
}

/**
 * The content holding an identifier in the namespaces an element's own content belongs to, each entry naming
 * its identifier, its type, the element declaring it and the moddle element carrying it.
 *
 * An identifier is held more than once only in a model that is already wrong, or by content of the
 * collaboration, which is recorded in every space and is therefore reported once per process.
 */
export function getHolders(registry, elementId, identifier) {
  return spacesOf(registry, elementId).flatMap(processId =>
    (registry.byProcess.get(processId) || new Map()).get(identifier) || []);
}

/**
 * Whether an identifier is already taken in the namespaces an element's own content belongs to.
 *
 * The content being edited is excluded when it is given, so that content does not report its own identifier
 * as a duplicate of itself.
 *
 * @param {Object} registry
 * @param {String} elementId       the element the content belongs to
 * @param {String} identifier
 * @param {ModdleElement} [except] the content being edited
 */
export function isTaken(registry, elementId, identifier, except) {
  return getHolders(registry, elementId, identifier)
    .some(holder => !except || holder.moddleElement !== except);
}

/**
 * An identifier free in every namespace the element's content belongs to, formed from the prefix.
 *
 * The identifier is generated at random rather than counted up, since the order in which content happened to
 * be created carries no meaning and a number would invite one to be read into it. Uniqueness comes from the
 * registry each candidate is checked against rather than from the improbability of a collision, which is the
 * whole of the difference to generating one blindly.
 *
 * Two candidates are never equal even before the registry has been rebuilt, because the generator is one
 * instance for the lifetime of the module and `Ids` does not repeat a value it has issued. Content created
 * in a single command, a paste among them, is therefore safe without the registry being rebuilt between one
 * identifier and the next.
 *
 * @param {Object} registry
 * @param {String} elementId
 * @param {String} prefix       e.g. `Attribute_`
 * @param {Function} [generate] the candidate generator, replaced only by a test
 */
export function nextIdentifier(registry, elementId, prefix, generate = randomIdentifier) {
  for (;;) {
    const identifier = generate(prefix);

    if (!isTaken(registry, elementId, identifier)) {
      return identifier;
    }
  }
}

const ids = new Ids([ 32, 32, 1 ]);

function randomIdentifier(prefix) {
  return ids.nextPrefixed(prefix);
}

/**
 * Record what an element declares, then descend into everything it contains: the flow elements at any depth,
 * so that a sub-process's content lands in the namespace of the process containing it rather than in one of
 * its own, and the artifacts, which carry annotations.
 */
function walk(registry, businessObject, processId) {
  registry.processOf.set(businessObject.id, processId);

  record(registry, businessObject, processId);

  (businessObject.get('flowElements') || []).forEach(flowElement =>
    walk(registry, flowElement, processId));

  (businessObject.get('artifacts') || []).forEach(artifact =>
    walk(registry, artifact, processId));
}

// the identifiers an element declares, taken from the `bpmnos:` content beneath its extension elements
function record(registry, businessObject, processId) {
  const extensionElements = businessObject.get && businessObject.get('extensionElements');

  if (!extensionElements) {
    return;
  }

  const taken = registry.byProcess.get(processId);

  identifiedContent(extensionElements).forEach(moddleElement => {
    const id = moddleElement.id,
          holders = taken.get(id) || [];

    holders.push({ id, type: moddleElement.$type, declaringElement: businessObject.id, moddleElement });
    taken.set(id, holders);
  });
}

/**
 * The `bpmnos:` content carrying an identifier within a piece of extension content, itself included.
 *
 * Exported because naming pasted content asks the same question of the same tree.
 *
 * The descent is over the containment properties moddle writes onto an element, skipping the `$`-prefixed
 * ones, which are moddle's own and among which `$parent` points back up. Only `bpmnos:` content is reported,
 * since an identifier of the BPMN namespace belongs to the model's own namespace and is bpmn-js's to keep
 * unique. Elements already met are not descended into again, since an extension of another namespace may
 * hold a resolved reference and so a cycle; the BPMNOS extension declares none.
 */
export function identifiedContent(moddleElement, seen = new Set()) {
  if (!moddleElement || typeof moddleElement !== 'object' || seen.has(moddleElement)) {
    return [];
  }

  seen.add(moddleElement);

  const found = [];

  if ((moddleElement.$type || '').startsWith('bpmnos:') && moddleElement.id) {
    found.push(moddleElement);
  }

  Object.keys(moddleElement)
    .filter(key => !key.startsWith('$'))
    .forEach(key => {
      const value = moddleElement[key];

      if (Array.isArray(value)) {
        value.forEach(entry => found.push(...identifiedContent(entry, seen)));
      } else if (value && typeof value === 'object' && value.$type) {
        found.push(...identifiedContent(value, seen));
      }
    });

  return found;
}
