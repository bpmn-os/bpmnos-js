import { is } from 'bpmnlint-utils';

/**
 * The execution data declared in a model, collected from the parsed model alone.
 *
 * Model-level only: it reads the moddle tree and knows nothing of the canvas — no diagram-js, no rendering,
 * and no bpmn-js either, whose `lib/` is CommonJS to Node and therefore only usable once bundled. Type tests
 * come from `bpmnlint-utils`, the model-level helper the lint rules already use, so the module runs anywhere
 * a `bpmn:Definitions` is at hand: the modeller (through the `executionData` service), `bpmnosdoc`, a lint
 * rule, a test, or any headless tool.
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
 * @param {ModdleElement} definitions  a `bpmn:Definitions`
 *
 * @return {{
 *   byElement: Map<String, { status: Array, data: Array, globals: Array }>,
 *   byId: Map<String, Object>,
 *   elementsById: Map<String, String[]>
 * }}
 */
export function collectExecutionData(definitions) {
  const registry = {
    byElement: new Map(),
    byId: new Map(),
    elementsById: new Map()
  };

  if (!definitions) {
    return registry;
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
      collect(registry, rootElement, [], [], globals);
    }
  });

  // a participant is the pool of a process, and sees exactly what its process sees
  rootElements
    .filter(rootElement => is(rootElement, 'bpmn:Collaboration'))
    .forEach(collaboration => {
      record(registry, collaboration, [], [], globals);

      (collaboration.get('participants') || []).forEach(participant => {
        const processRef = participant.get('processRef'),
              visible = processRef && registry.byElement.get(processRef.id);

        record(registry, participant, visible ? visible.status : [], visible ? visible.data : [], globals);
      });
    });

  return registry;
}

// walk a scope, handing its declarations down to everything it contains
function collect(registry, scope, inheritedStatus, inheritedData, globals) {
  const status = inheritedStatus.concat(attributesOf(getStatus(scope), 'status', scope)),
        data = inheritedData.concat(dataOf(scope));

  record(registry, scope, status, data, globals);

  (scope.get('flowElements') || []).forEach(flowElement => {
    if (isScope(flowElement)) {
      collect(registry, flowElement, status, data, globals);
    } else if (is(flowElement, 'bpmn:Activity')) {

      // an activity declares status of its own but contains no data objects
      record(registry, flowElement, status.concat(attributesOf(getStatus(flowElement), 'status', flowElement)),
        data, globals);
    } else {
      record(registry, flowElement, status, data, globals);
    }
  });

  (scope.get('artifacts') || []).forEach(artifact => record(registry, artifact, status, data, globals));
}

function record(registry, businessObject, status, data, globals) {
  registry.byElement.set(businessObject.id, { status, data, globals });

  [ ...status, ...data, ...globals ].forEach(attribute => {
    registry.byId.set(attribute.id, attribute);

    const elements = registry.elementsById.get(attribute.id) || [];

    elements.push(businessObject.id);
    registry.elementsById.set(attribute.id, elements);
  });
}

// the `bpmnos:` extension elements of a business object; ExtensionElementsUtil is not used here because its
// write helpers reach into bpmn-js, which would make this module bundler-only
function getExtensionElementsList(businessObject, type) {
  const extensionElements = businessObject && businessObject.get && businessObject.get('extensionElements');

  if (!extensionElements) {
    return [];
  }

  return (extensionElements.get('values') || []).filter(value => is(value, type));
}

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
