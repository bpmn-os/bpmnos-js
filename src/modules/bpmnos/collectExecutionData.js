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
      collect(registry, rootElement, [], [], globals, []);
    }
  });

  // a participant is the pool of a process, and sees exactly what its process sees
  rootElements
    .filter(rootElement => is(rootElement, 'bpmn:Collaboration'))
    .forEach(collaboration => {
      record(registry, collaboration, [], [], globals, [], []);

      (collaboration.get('participants') || []).forEach(participant => {
        const processRef = participant.get('processRef'),
              visible = processRef && registry.byElement.get(processRef.id);

        record(registry, participant, visible ? visible.status : [], visible ? visible.data : [], globals,
          [], visible ? visible.ownRestrictions : []);
      });
    });

  return registry;
}

// walk a scope, handing its declarations down to everything it contains
function collect(registry, scope, inheritedStatus, inheritedData, globals, inheritedRestrictions) {
  const status = inheritedStatus.concat(attributesOf(getStatus(scope), 'status', scope)),
        data = inheritedData.concat(dataOf(scope));

  const own = restrictionsOf(scope);

  record(registry, scope, status, data, globals, inheritedRestrictions, own);

  // what the scope hands down: the full-scope restrictions it declares, on top of what it inherited itself
  // — unless it is a scope its content does not inherit through, which keeps only its own
  const handedDown = (breaksInheritance(scope) ? [] : inheritedRestrictions)
    .concat(own.filter(restriction => restriction.scope === 'full'));

  (scope.get('flowElements') || []).forEach(flowElement => {
    if (isScope(flowElement)) {
      collect(registry, flowElement, status, data, globals, handedDown);
    } else if (is(flowElement, 'bpmn:Activity')) {

      // an activity declares status of its own but contains no data objects
      record(registry, flowElement, status.concat(attributesOf(getStatus(flowElement), 'status', flowElement)),
        data, globals, handedDown, restrictionsOf(flowElement));
    } else {
      record(registry, flowElement, status, data, globals, handedDown, restrictionsOf(flowElement));
    }
  });

  (scope.get('artifacts') || []).forEach(artifact =>
    record(registry, artifact, status, data, globals, handedDown, []));
}

function record(registry, businessObject, status, data, globals, inheritedRestrictions, ownRestrictions) {
  registry.byElement.set(businessObject.id, {
    status,
    data,
    globals,

    // one list per checkpoint, inherited first as with attributes; a full-scope restriction is checked at
    // every one of them and therefore appears in all three
    entryRestrictions: checkedAt('entry', inheritedRestrictions, ownRestrictions),
    completionRestrictions: checkedAt('completion', inheritedRestrictions, ownRestrictions),
    exitRestrictions: checkedAt('exit', inheritedRestrictions, ownRestrictions),

    // what the element hands down, kept for the pool that stands for a process
    ownRestrictions,

    // kinds an element carries itself, read straight off it
    conditions: conditionsOf(businessObject),
    timer: timerOf(businessObject),
    loop: loopOf(businessObject),
    loopKind: loopKindOf(businessObject),
    choices: choicesOf(businessObject),
    operators: operatorsOf(businessObject),
    messages: messagesOf(businessObject),
    signal: signalOf(businessObject)
  });

  [ ...status, ...data, ...globals ].forEach(attribute => {
    registry.byId.set(attribute.id, attribute);

    const elements = registry.elementsById.get(attribute.id) || [];

    elements.push(businessObject.id);
    registry.elementsById.set(attribute.id, elements);
  });
}

/**
 * The restrictions checked at one of the three checkpoints: the element's own restrictions of that scope
 * and its own full-scope ones, preceded by the full-scope restrictions it inherits.
 *
 * That is what the engine checks (`ExtensionElements::feasibleEntry` and its two siblings, each ending in
 * `satisfiesInheritedRestrictions`): a descendant re-checks only its ancestors' full-scope restrictions,
 * never their entry, completion or exit ones.
 */
function checkedAt(scope, inheritedRestrictions, ownRestrictions) {
  const own = ownRestrictions.filter(restriction =>
    restriction.scope === scope || restriction.scope === 'full');

  if (!inheritedRestrictions.length && !own.length) {
    return [];
  }

  return [ ...inheritedRestrictions, ...own ];
}

/**
 * The restrictions an element declares: `bpmnos:status/restrictions/restriction`, each an id, an expression
 * and a scope.
 *
 * The scope defaults to full and falls back to it for anything unrecognised, as the engine does
 * (`Restriction.cpp:9-24`). Note that the XSD lists entry, exit and full only while the parser also accepts
 * completion, so a model may carry a scope its schema does not.
 */
function restrictionsOf(businessObject) {
  const status = getStatus(businessObject);

  if (!status) {
    return [];
  }

  return (status.get('restrictions') || [])
    .flatMap(restrictions => restrictions.get('restriction') || [])
    .map(restriction => {
      const scope = restriction.get('scope');

      return {
        id: restriction.get('id'),
        expression: restriction.get('expression'),
        scope: [ 'entry', 'completion', 'exit' ].includes(scope) ? scope : 'full',
        declaringElement: businessObject.id,
        moddleElement: restriction
      };
    });
}

/**
 * Whether a scope's content inherits restrictions from above it.
 *
 * It does not through an event sub-process started by an error or a compensate event, nor through an
 * activity performed for compensation (`ExtensionElements.cpp:378-392`): such a scope is entered on a path
 * of its own, where the conditions its surroundings impose no longer hold. Its own full-scope restrictions
 * are still handed down.
 */
function breaksInheritance(businessObject) {
  if (businessObject.get('isForCompensation')) {
    return true;
  }

  if (!businessObject.get('triggeredByEvent')) {
    return false;
  }

  const startEvent = (businessObject.get('flowElements') || []).find(flowElement =>
    is(flowElement, 'bpmn:StartEvent'));

  return Boolean(startEvent) && (startEvent.get('eventDefinitions') || []).some(definition =>
    is(definition, 'bpmn:ErrorEventDefinition') || is(definition, 'bpmn:CompensateEventDefinition'));
}

/**
 * The choices of an element: `bpmnos:status/decisions`, each an id and a condition.
 *
 * Not a kind with operators. An operator assigns a value; a choice states what a decision maker may pick —
 * the engine parses the condition into bounds, an enumeration and an optional discretizer, and takes the
 * attribute being chosen from the condition itself (`Choice.cpp:60-70`), as in
 * `1 <= index <= count(destinations)`. The condition is reported as written.
 */
function choicesOf(businessObject) {
  const status = getStatus(businessObject);

  if (!status) {
    return [];
  }

  return (status.get('decisions') || [])
    .flatMap(decisions => decisions.get('decision') || [])
    .map(decision => ({
      id: decision.get('id'),
      condition: decision.get('condition'),
      declaringElement: businessObject.id,
      moddleElement: decision
    }));
}

/**
 * The operators of an element: `bpmnos:status/operators`, each assigning to a status or data attribute.
 *
 * Not inherited — an ancestor's operators run for the ancestor's token, not for this node's.
 */
function operatorsOf(businessObject) {
  const status = getStatus(businessObject);

  if (!status) {
    return [];
  }

  return (status.get('operators') || [])
    .flatMap(operators => operators.get('operator') || [])
    .map(operator => ({
      id: operator.get('id'),
      expression: operator.get('expression'),
      declaringElement: businessObject.id,
      moddleElement: operator
    }));
}

/**
 * The conditions of an element: `bpmnos:restrictions` **directly under** `extensionElements`, as opposed to
 * the restrictions inside `bpmnos:status`.
 *
 * The engine reads the same XML in two roles: as `Conditions` on a conditional start, boundary or catch
 * event, deciding whether the event triggers, and as `Gatekeeper` on a sequence flow, deciding whether the
 * flow may be taken. Which of the two it is follows from the element carrying them.
 */
function conditionsOf(businessObject) {
  const restrictions = getExtensionElementsList(businessObject, 'bpmnos:Restrictions')[0];

  if (!restrictions) {
    return [];
  }

  return (restrictions.get('restriction') || []).map(restriction => ({
    id: restriction.get('id'),
    expression: restriction.get('expression'),
    declaringElement: businessObject.id,
    moddleElement: restriction
  }));
}

/**
 * The timer of an event: the parameters of `bpmnos:timer`, e.g. `trigger = latest_visit`. The engine expects
 * exactly one (`Timer`), but the list is kept as found rather than assumed.
 */
function timerOf(businessObject) {
  const timer = getExtensionElementsList(businessObject, 'bpmnos:Timer')[0];

  if (!timer) {
    return [];
  }

  return (timer.get('parameter') || []).map(parameter => ({
    name: parameter.get('name'),
    value: parameter.get('value'),
    declaringElement: businessObject.id,
    moddleElement: parameter
  }));
}

/**
 * The loop parameters of an activity: `bpmnos:loopCharacteristics/parameter`, named `cardinality`, `index`,
 * `condition` or `maximum` (`ExtensionElements.cpp:241-256`). Reported as declared, in document order —
 * a name the engine does not know is a modelling error worth seeing.
 */
function loopOf(businessObject) {
  const loopCharacteristics = getExtensionElementsList(businessObject, 'bpmnos:LoopCharacteristics')[0];

  if (!loopCharacteristics) {
    return [];
  }

  return (loopCharacteristics.get('parameter') || []).map(parameter => ({
    name: parameter.get('name'),
    value: parameter.get('value'),
    declaringElement: businessObject.id,
    moddleElement: parameter
  }));
}

/**
 * Which kind of loop the activity carries, which decides when the parameters are read: a multi-instance
 * activity evaluates its cardinality as the activity is entered
 * (`StateMachine::createMultiInstanceActivityTokens`), while a standard loop evaluates its condition and
 * maximum in `Token::advanceToExiting`, after the exit restrictions have been checked.
 *
 * It comes from the BPMN loop characteristics, not from the BPMNOS parameters: without them the engine does
 * not loop at all.
 */
function loopKindOf(businessObject) {
  const loopCharacteristics = businessObject.get && businessObject.get('loopCharacteristics');

  if (!loopCharacteristics) {
    return '';
  }

  return is(loopCharacteristics, 'bpmn:MultiInstanceLoopCharacteristics') ? 'multiInstance' : 'standard';
}

/**
 * The messages an element defines, each with a name, its header parameters and its contents.
 *
 * Two spellings, both in use: a message **event** carries `bpmnos:message` directly under
 * `extensionElements`, while a send or receive **task** wraps it in `bpmnos:messages`, which is what allows
 * several. Both are read here.
 *
 * A `content` maps a status or data attribute to a key in the message, in one direction or the other
 * depending on whether the node sends or receives; a `parameter` is the message header the engine matches
 * senders and recipients on.
 */
function messagesOf(businessObject) {
  const wrapped = getExtensionElementsList(businessObject, 'bpmnos:Messages')
    .flatMap(messages => messages.get('message') || []);

  const direct = getExtensionElementsList(businessObject, 'bpmnos:Message');

  return [ ...direct, ...wrapped ].map(message => ({
    name: message.get('name'),
    parameters: parametersOf(message),
    contents: contentsOf(message),
    declaringElement: businessObject.id,
    moddleElement: message
  }));
}

/**
 * The signal an element throws or catches: `bpmnos:signal`, a name and its contents.
 */
function signalOf(businessObject) {
  const signal = getExtensionElementsList(businessObject, 'bpmnos:Signal')[0];

  if (!signal) {
    return [];
  }

  return [ {
    name: signal.get('name'),
    contents: contentsOf(signal),
    declaringElement: businessObject.id,
    moddleElement: signal
  } ];
}

function parametersOf(holder) {
  return (holder.get('parameter') || []).map(parameter => ({
    name: parameter.get('name'),
    value: parameter.get('value'),
    moddleElement: parameter
  }));
}

function contentsOf(holder) {
  return (holder.get('content') || []).map(content => ({
    key: content.get('key'),
    attribute: content.get('attribute'),
    moddleElement: content
  }));
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
