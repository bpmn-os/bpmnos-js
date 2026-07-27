import { is, getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';

import { getExtensionElementsList } from './utils/ExtensionElementsUtil';

/**
 * The execution data declared in a model, ready to be looked up per node.
 *
 * Three kinds of attribute, each its own ordered namespace:
 *
 * - **status** — `bpmnos:Status` on a process or any activity;
 * - **data** — declared by scopes only, through the data objects they contain;
 * - **global** — on the collaboration, and therefore seen by every node.
 *
 * All of them are inherited by every descendant, in declaration order, outermost first and a node's own
 * declarations last — the order a token carries them in (see the engine logs of BPMNOSInstances.jl). An
 * inherited attribute is not redeclared: every entry names the element that declares it, so a node's own
 * entries are those whose `declaringElement` is the node itself.
 *
 * Attribute ids are unique model-wide, which is what makes `getAttribute` and `getElements` possible —
 * the latter answering "which nodes are affected by a DataUpdate for this attribute id".
 *
 * The registry knows nothing of annotations, rendering or the canvas.
 */
export default class ExecutionData {
  constructor(eventBus, elementRegistry) {
    this._elementRegistry = elementRegistry;
    this._eventBus = eventBus;

    this._clear();

    const self = this;

    eventBus.on([ 'import.done', 'elements.changed' ], function() {
      self.rebuild();
    });

    eventBus.on('diagram.clear', function() {
      self._clear();
    });
  }

  /**
   * The attributes visible at an element, each list in declaration order.
   *
   * @param {djs.model.Base|String} element  element or element id
   * @return {{ status: Array, data: Array, globals: Array }}
   */
  get(element) {
    const id = typeof element === 'string' ? element : element.id;

    return this._byElement.get(id) || { status: [], data: [], globals: [] };
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
    return this._byId.get(id);
  }

  /**
   * The ids of the elements that see the given attribute — what a DataUpdate resolves against.
   */
  getElements(attributeId) {
    return this._elementsById.get(attributeId) || [];
  }

  /**
   * Whether an element declares the attribute itself, rather than inheriting it.
   */
  isOwn(element, attribute) {
    return attribute.declaringElement === (typeof element === 'string' ? element : element.id);
  }

  rebuild() {
    this._clear();

    const definitions = this._getDefinitions();

    if (!definitions) {
      return;
    }

    const rootElements = definitions.get('rootElements') || [];

    // globals are declared on the collaboration and seen everywhere
    const globals = rootElements
      .filter(rootElement => is(rootElement, 'bpmn:Collaboration'))
      .reduce((all, collaboration) => all.concat(
        attributesOf(collaboration, 'global', collaboration)
      ), []);

    rootElements.forEach(rootElement => {
      if (is(rootElement, 'bpmn:Process')) {
        this._collect(rootElement, [], [], globals);
      }
    });

    // a participant is the pool of a process, and sees exactly what its process sees
    rootElements
      .filter(rootElement => is(rootElement, 'bpmn:Collaboration'))
      .forEach(collaboration => {
        this._record(collaboration, [], [], globals);

        (collaboration.get('participants') || []).forEach(participant => {
          const processRef = participant.get('processRef');

          if (processRef) {
            const visible = this._byElement.get(processRef.id);

            this._record(participant, visible ? visible.status : [], visible ? visible.data : [], globals);
          }
        });
      });

    this._eventBus.fire('executionData.changed');
  }

  // walk a scope, handing its declarations down to everything it contains
  _collect(scope, inheritedStatus, inheritedData, globals) {
    const status = inheritedStatus.concat(attributesOf(getStatus(scope), 'status', scope)),
          data = inheritedData.concat(dataOf(scope));

    this._record(scope, status, data, globals);

    (scope.get('flowElements') || []).forEach(flowElement => {
      if (isScope(flowElement)) {
        this._collect(flowElement, status, data, globals);
      } else if (is(flowElement, 'bpmn:Activity')) {

        // an activity declares status of its own but contains no data objects
        this._record(flowElement, status.concat(attributesOf(getStatus(flowElement), 'status', flowElement)),
          data, globals);
      } else {
        this._record(flowElement, status, data, globals);
      }
    });

    (scope.get('artifacts') || []).forEach(artifact => this._record(artifact, status, data, globals));
  }

  _record(businessObject, status, data, globals) {
    this._byElement.set(businessObject.id, { status, data, globals });

    [ ...status, ...data, ...globals ].forEach(attribute => {
      this._byId.set(attribute.id, attribute);

      const elements = this._elementsById.get(attribute.id) || [];

      elements.push(businessObject.id);
      this._elementsById.set(attribute.id, elements);
    });
  }

  _clear() {
    this._byElement = new Map();
    this._byId = new Map();
    this._elementsById = new Map();
  }

  /**
   * The definitions, reached by walking up from any element that has a business object.
   *
   * Not from the first element in the registry: after a re-import that is a root without a business
   * object, and the walk would end there — leaving the whole registry empty until the page was reloaded.
   */
  _getDefinitions() {
    for (const element of this._elementRegistry.getAll()) {
      let businessObject = getBusinessObject(element);

      while (businessObject && !is(businessObject, 'bpmn:Definitions')) {
        businessObject = businessObject.$parent;
      }

      if (businessObject) {
        return businessObject;
      }
    }
  }
}

ExecutionData.$inject = [ 'eventBus', 'elementRegistry' ];

// scopes declare data through the data objects they contain; activities do not
function isScope(businessObject) {
  return is(businessObject, 'bpmn:SubProcess') || is(businessObject, 'bpmn:AdHocSubProcess');
}

function getStatus(businessObject) {
  return getExtensionElementsList(businessObject, 'bpmnos:Status')[0];
}

/**
 * The attributes of a `bpmnos:Status`, or of anything carrying `bpmnos:Attributes` directly (a data object,
 * a collaboration), in declaration order.
 */
function attributesOf(holder, scope, declaringElement) {
  if (!holder) {
    return [];
  }

  const attributes = is(holder, 'bpmnos:Status')
    ? (holder.get('attributes') || [])[0]
    : getExtensionElementsList(holder, 'bpmnos:Attributes')[0];

  if (!attributes) {
    return [];
  }

  return (attributes.get('attribute') || []).map(attribute => ({
    id: attribute.get('id'),
    name: attribute.get('name'),
    type: attribute.get('type'),
    objective: attribute.get('objective'),
    weight: attribute.get('weight'),
    scope,
    declaringElement: declaringElement.id,
    moddleElement: attribute
  }));
}

/**
 * The data attributes a scope declares, through the data objects it contains, in document order.
 *
 * Read from the `bpmn:DataObject`s, never from the `bpmn:DataObjectReference`s — per BPMN a reference does
 * not own data, it refers to it, and a model may hold an object no reference points at (the TSP model
 * declares `instance` on exactly such an object). The declaring element is the **scope** that owns the data
 * object, since that is the scope the attribute belongs to and is inherited from.
 */
function dataOf(scope) {
  return (scope.get('flowElements') || [])
    .filter(flowElement => is(flowElement, 'bpmn:DataObject'))
    .reduce((all, dataObject) => all.concat(attributesOf(dataObject, 'data', scope)), []);
}
