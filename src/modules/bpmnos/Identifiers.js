import {
  collectIdentifiers,
  getHolders,
  isTaken,
  nextIdentifier,
  spacesOf
} from './collectIdentifiers.js';

/**
 * The identifier registry as a diagram-js service: a thin adapter over `collectIdentifiers`.
 *
 * All of the reading lives in that module, which is model-level and knows nothing of the canvas. This class
 * adds only what a modeller needs on top of it — keeping the collection current as the model is edited, and
 * announcing that it changed. A consumer without a modeller calls `collectIdentifiers(definitions)` and its
 * query functions directly instead of going through here.
 *
 * It answers two questions, both bounded by the process that contains the element asked about: whether an
 * identifier is already taken, and what the next free identifier for a prefix is. Generating an identifier
 * from the registry is what makes a duplicate impossible rather than improbable, and the same registry is
 * what a field validating a typed identifier consults.
 */
export default class Identifiers {
  constructor(eventBus, bpmnjs) {
    this._bpmnjs = bpmnjs;
    this._eventBus = eventBus;

    this._registry = collectIdentifiers();

    const self = this;

    eventBus.on([ 'import.done', 'elements.changed' ], function() {
      self.rebuild();
    });

    eventBus.on('diagram.clear', function() {
      self._registry = collectIdentifiers();
    });
  }

  /**
   * Whether an identifier is taken in the process the element belongs to.
   *
   * @param {djs.model.Base|ModdleElement|String} element  the element the content belongs to
   * @param {String} identifier
   * @param {ModdleElement} [except]  the content being edited, which does not clash with itself
   */
  isTaken(element, identifier, except) {
    return isTaken(this._registry, idOf(element), identifier, except);
  }

  /**
   * The next identifier free in the process the element belongs to, formed from the prefix.
   *
   * @param {djs.model.Base|ModdleElement|String} element
   * @param {String} prefix  e.g. `Attribute_`
   */
  nextId(element, prefix) {
    return nextIdentifier(this._registry, idOf(element), prefix);
  }

  /**
   * The content holding an identifier in the process the element belongs to, each entry naming its
   * identifier, its type, the element declaring it and the moddle element carrying it.
   */
  getHolders(element, identifier) {
    return getHolders(this._registry, idOf(element), identifier);
  }

  /**
   * The ids of the processes whose namespace the element's content belongs to: the one containing it, or
   * every one of them for content of the collaboration, which is seen from all of them.
   */
  getProcesses(element) {
    return spacesOf(this._registry, idOf(element));
  }

  rebuild() {
    this._registry = collectIdentifiers(this._bpmnjs.getDefinitions());

    this._eventBus.fire('identifiers.changed');
  }
}

Identifiers.$inject = [ 'eventBus', 'bpmnjs' ];

// a diagram element, a business object and an id are all accepted, as elsewhere in this package
function idOf(element) {
  return typeof element === 'string' ? element : element && element.id;
}
