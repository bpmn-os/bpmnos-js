import {
  collectExecutionData,
  getAttribute,
  getElements,
  spacesOf
} from './collectExecutionData.js';

// what an element carrying no execution data reports
const EMPTY = {
  status: [], data: [], globals: [],
  conditions: [], timer: [], loop: [], loopKind: '', choices: [], operators: [], messages: [], signal: [],
  entryRestrictions: [], completionRestrictions: [], exitRestrictions: [], ownRestrictions: [],
  guidance: []
};

/**
 * The execution data registry as a diagram-js service: a thin adapter over `collectExecutionData`.
 *
 * All of the reading lives in that module, which is model-level and knows nothing of the canvas. This class
 * adds only what a modeller needs on top of it — keeping the collection current as the model is edited, and
 * announcing that it changed. Any consumer without a modeler (`bpmnosdoc`, a lint rule, a headless tool)
 * calls `collectExecutionData(definitions)` directly instead of going through here.
 */
export default class ExecutionData {
  constructor(eventBus, bpmnjs) {
    this._bpmnjs = bpmnjs;
    this._eventBus = eventBus;

    this._registry = collectExecutionData();

    const self = this;

    eventBus.on([ 'import.done', 'elements.changed' ], function() {
      self.rebuild();
    });

    eventBus.on('diagram.clear', function() {
      self._registry = collectExecutionData();
    });
  }

  /**
   * The attributes visible at an element, each list in declaration order.
   *
   * @param {djs.model.Base|ModdleElement|String} element  element, business object or id
   * @return {{ status, data, globals, conditions, timer, messages, signal }} each an Array
   */
  get(element) {
    const id = typeof element === 'string' ? element : element.id;

    return this._registry.byElement.get(id) || EMPTY;
  }

  /**
   * All attributes visible at an element, status then data then globals.
   */
  getAll(element) {
    const { status, data, globals } = this.get(element);

    return [ ...status, ...data, ...globals ];
  }

  /**
   * The lookup tables the model declares, in document order. Model-level: a table's name is a callable in
   * expressions, not something a node declares or inherits.
   */
  getTables() {
    return this._registry.tables || [];
  }

  /**
   * The attribute of the given identifier, as the element sees it.
   *
   * An identifier is unique within a process and not beyond it, so the element is what says which process
   * is meant: a collaboration holds one `Instance` and one `Timestamp` per participant, and asking for one
   * without saying where would answer with whichever process was read last.
   *
   * @param {djs.model.Base|ModdleElement|String} element
   * @param {String} id
   */
  getAttribute(element, id) {
    return getAttribute(this._registry, idOf(element), id);
  }

  /**
   * The ids of the elements that see the attribute of the given identifier, within the process the element
   * belongs to — what a `DataUpdate` resolves against.
   */
  getElements(element, id) {
    return getElements(this._registry, idOf(element), id);
  }

  /**
   * The ids of the processes whose namespace the element's identifiers belong to: the one containing it, or
   * every one of them for an element belonging to none, the collaboration among them.
   */
  getProcesses(element) {
    return spacesOf(this._registry, idOf(element));
  }

  /**
   * Whether an element declares the attribute itself, rather than inheriting it.
   */
  isOwn(element, attribute) {
    return attribute.declaringElement === (typeof element === 'string' ? element : element.id);
  }

  rebuild() {
    this._registry = collectExecutionData(this._bpmnjs.getDefinitions());

    this._eventBus.fire('executionData.changed');
  }
}

ExecutionData.$inject = [ 'eventBus', 'bpmnjs' ];

// a diagram element, a business object and an id are all accepted, as elsewhere in this package
function idOf(element) {
  return typeof element === 'string' ? element : element && element.id;
}
