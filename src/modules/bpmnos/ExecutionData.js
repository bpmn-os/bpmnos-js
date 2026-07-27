import { collectExecutionData } from './collectExecutionData.js';

// what an element carrying no execution data reports
const EMPTY = {
  status: [], data: [], globals: [],
  conditions: [], timer: [], choices: [], operators: [], messages: [], signal: [],
  entryRestrictions: [], completionRestrictions: [], exitRestrictions: [], ownRestrictions: []
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
   * The attribute with the given id, ids being unique model-wide.
   */
  getAttribute(id) {
    return this._registry.byId.get(id);
  }

  /**
   * The ids of the elements that see the given attribute — what a DataUpdate resolves against.
   */
  getElements(attributeId) {
    return this._registry.elementsById.get(attributeId) || [];
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
