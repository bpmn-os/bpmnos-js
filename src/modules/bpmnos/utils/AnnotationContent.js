import { is, getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';

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
export function getAnnotationContent(host, executionData, collapsedGroup = () => false) {
  const {
    status, data, globals, conditions, timer, loop, loopKind, choices, operators, messages, signal,
    entryRestrictions, completionRestrictions, exitRestrictions, guidance
  } = executionData.get(host);

  // what counts as declared here: the element, and for a pool the process it refers to
  const businessObject = getBusinessObject(host),
        processRef = businessObject.get && businessObject.get('processRef');

  // A sequence flow is not entered, completed or exited: the engine evaluates its gatekeeper and moves the
  // token on (`Token.cpp:1124-1138`, `advanceToDeparted`), so the checkpoints of the scope around it are
  // checked at its nodes, never here.
  const isFlow = is(businessObject, 'bpmn:SequenceFlow');

  const ownIds = [ host.id, processRef && processRef.id ].filter(Boolean);

  // Inherited and own are kept apart, each behind a chevron of its own: what the element inherits starts
  // folded away, what it declares itself starts in view. `ownKey` is what marks a compartment as making
  // that split at all — the kinds an element simply carries have no such halves and get no chevrons.
  const compartment = (label, key, attributes) => {
    const inherited = attributes.filter(attribute => !ownIds.includes(attribute.declaringElement)),
          own = attributes.filter(attribute => ownIds.includes(attribute.declaringElement));

    return {
      label,
      key,
      ownKey: key + ':own',
      group: 'declared',
      inherited: inherited.flatMap(attribute => item(attribute, ownIds)),
      own: own.flatMap(attribute => item(attribute, ownIds)),

      // an attribute takes a second row where it contributes to the objective, so a chevron counts the
      // attributes it hides rather than the rows
      inheritedCount: inherited.length,
      ownCount: own.length
    };
  };

  // kinds the element carries itself: nothing to fold, so they have no inherited half
  const own = (label, items) => ({ label, key: label.toLowerCase(), group: 'sequence', inherited: [], own: items });

  // how often the node runs, which frames everything below rather than happening at a point within it
  const loopBand = {
    label: loopKind === 'multiInstance' ? 'Multi-instance' : 'Loop',
    key: 'loop',
    group: 'loop',
    inherited: [],
    own: loop.map(parameter => ({ type: parameter.name || '', text: parameter.value || '' }))
  };

  // restrictions fold like attributes do: what the node inherits behind a chevron, what it declares in view
  const checkpoint = (label, key, restrictions) => ({
    label,
    key,
    ownKey: key + ':own',
    group: 'sequence',
    inherited: restrictions
      .filter(restriction => !ownIds.includes(restriction.declaringElement))
      .map(restriction => restrictionItem(restriction)),
    own: restrictions
      .filter(restriction => ownIds.includes(restriction.declaringElement))
      .map(restriction => restrictionItem(restriction))
  });

  // Three registers, told apart by a double rule where one gives way to the next: what a token here carries
  // — a set, in declaration order — then how often the node runs, then what happens at it, read top to
  // bottom as the token's passage through it. The loop parameters are a band of their own because they
  // frame the whole passage rather than happening at a point in it: a multi-instance cardinality is read
  // before the instance tokens exist (`Token::advanceToReady`), a standard loop's condition and maximum
  // after the exit restrictions have passed (`Token::advanceToExiting`), and the label says which it is.
  const compartments = [
    compartment('Status', 'statusInherited', status),
    compartment('Data', 'dataInherited', data),
    compartment('Globals', 'globals', globals),
    loopBand,
    own(isFlow ? 'Gatekeeper' : 'Conditions',
      conditions.map(condition => ({ type: '', text: condition.expression || condition.id }))),
    own('Timer', timer.map(parameter => ({ type: parameter.name || '', text: parameter.value || '' }))),
    ...(isFlow ? [] : [ checkpoint('Entry restrictions', 'entryRestrictions', entryRestrictions) ]),
    ...exchangeAndOperators(host, choices, operators, messages, signal, collapsedGroup),
    ...(isFlow ? [] : [
      checkpoint('Completion restrictions', 'completionRestrictions', completionRestrictions),
      checkpoint('Exit restrictions', 'exitRestrictions', exitRestrictions)
    ]),
    ...guidanceCompartments(guidance)
  ];

  return {
    title: titleOf(host),
    compartments: compartments.filter(compartment => compartment.inherited.length || compartment.own.length)
  };
}

/**
 * Operators and the message, in the order the engine applies them.
 *
 * A choice is always made before the operators that use it. A regular or send task applies its operators
 * when the token becomes busy, before the message goes out
 * (`Token::advanceToBusy`, which excludes receive and decision tasks). A receive task — like a decision task
 * and the typed start event of an event sub-process — applies them on completion, after the message has
 * arrived (`Token::advanceToCompleted`). The box is read chronologically, so the two compartments swap
 * accordingly.
 */
function exchangeAndOperators(host, choices, operators, messages, signal, collapsedGroup) {
  const own = (label, items) => ({ label, key: label.toLowerCase(), group: 'sequence', inherited: [], own: items });

  // a choice is made before the operators that use what was chosen
  const applied = [
    own('Choices', choices.map(choice => ({ type: '', text: choice.condition || choice.id }))),
    own('Operators', operators.map(operator => ({ type: '', text: operator.expression || operator.id })))
  ];

  const exchanges = [
    own('Message', messages.flatMap(definition => exchange(definition, collapsedGroup))),
    own('Signal', signal.flatMap(definition => exchange(definition, collapsedGroup)))
  ];

  return appliedOnCompletion(host)
    ? [ ...exchanges, ...applied ]
    : [ ...applied, ...exchanges ];
}

/**
 * Whether the node applies its operators on completion rather than on becoming busy.
 */
function appliedOnCompletion(host) {
  const businessObject = getBusinessObject(host);

  if (businessObject.$instanceOf('bpmn:ReceiveTask')) {
    return true;
  }

  // a decision task is a plain task carrying bpmnos:type="Decision"
  if (businessObject.get && businessObject.get('type') === 'Decision') {
    return true;
  }

  // a catching event receives before anything of its own runs
  return businessObject.$instanceOf('bpmn:CatchEvent');
}

/**
 * A message or signal: its name, then the **header** the engine matches senders and recipients on and the
 * **content** it carries, each mapping a key to a value or an attribute.
 *
 * Both groups are always shown, with their count, so an empty header is visible as `header (0)` rather than
 * leaving the reader to wonder whether it exists. Both fold, and neither is indented — the entries beneath
 * them are.
 */
function exchange(definition, collapsedGroup) {
  const name = definition.name || '';

  const group = (label, entries, keys) => {
    const key = `message:${name}:${label}`,
          collapsed = collapsedGroup(key);

    const toggle = {
      kind: 'toggle',
      key,
      type: '',
      text: `${collapsed || !entries.length ? '▸' : '▾'} ${label} (${entries.length})`
    };

    if (collapsed || !entries.length) {
      return [ toggle ];
    }

    return [ toggle, ...entries.map(entry => ({
      type: entry[keys[0]] || '',
      text: entry[keys[1]] || '',
      indent: 1
    })) ];
  };

  return [
    { type: 'Name', text: name },
    ...group('header', definition.parameters || [], [ 'name', 'value' ]),
    ...group('content', definition.contents || [], [ 'key', 'attribute' ])
  ];
}

// what each guidance type advises, named as a reader would say it
const GUIDANCE_LABELS = {
  entry: 'Entry guidance',
  message: 'Message guidance',
  choice: 'Choice guidance',
  exit: 'Exit guidance'
};

/**
 * Guidance: one compartment per type, each folded as a whole, in a band of their own after everything the
 * token does.
 *
 * It belongs to neither register: it does not constrain execution and does not happen at a point in the
 * token's passage — it advises whoever decides, by adding attributes to a candidate, applying operators to
 * it, discarding what its restrictions rule out and scoring the rest (`Guidance::apply`,
 * `restrictionsSatisfied`, `getObjective`). Within a compartment the three kinds it may hold are labelled,
 * each shown only when the guidance carries it.
 */
function guidanceCompartments(guidance) {
  return guidance.map(definition => ({
    label: GUIDANCE_LABELS[definition.type] || definition.type || 'Guidance',
    key: `guidance:${definition.type}`,
    group: 'guidance',
    foldsWhole: true,
    count: null,
    inherited: [],
    own: [
      ...group('Attributes', definition.attributes, attribute => [
        { type: attribute.type || '', text: (attribute.name || attribute.id || '').trim() },
        ...objectiveTerm(attribute)
      ]),
      ...group('Operators', definition.operators, operator => [
        { type: '', text: operator.expression || operator.id }
      ]),
      ...group('Restrictions', definition.restrictions, restriction => [
        { type: '', text: restriction.expression || restriction.id }
      ])
    ]
  }));
}

// a labelled run of entries, or nothing when the guidance holds none of that kind
function group(label, entries, item) {
  if (!entries.length) {
    return [];
  }

  return [ { kind: 'label', text: label }, ...entries.flatMap(item) ];
}

/**
 * A restriction is shown as written, with nothing said about its scope: the compartment it sits in is when
 * it is checked, and a full-scope one sits in all three.
 */
function restrictionItem(restriction) {
  return {
    type: '',
    text: restriction.expression || restriction.id
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
 *
 * An attribute contributing to the objective is followed by its term.
 */
function item(attribute, ownIds) {
  const raw = (attribute.name || attribute.id).trim(),
        separator = raw.indexOf(':=');

  const initialized = separator !== -1 && ownIds.includes(attribute.declaringElement),
        name = separator === -1 ? raw : raw.slice(0, separator).trim();

  return [
    {
      type: attribute.type || '',
      text: initialized ? raw : name
    },
    ...objectiveTerm(attribute, name)
  ];
}

/**
 * The objective term an attribute contributes: `→ minimize 1 * distance`.
 *
 * Shown wherever the attribute is listed, as its type is, because the objective belongs to the attribute
 * rather than to the node reading it — unlike the initialization, which happens at the declaring element
 * and is shown only there. It is what lets a global's objective be seen at all: globals are declared on the
 * collaboration and inherited everywhere.
 *
 * `objective="none"`, or none at all, contributes nothing (`Attribute.cpp:48-63`) and is not shown. A weight
 * is required whenever there is an objective; when a model omits it, the term is shown without one rather
 * than inventing a factor.
 */
function objectiveTerm(attribute, name) {
  const objective = attribute.objective;

  if (!objective || objective === 'none') {
    return [];
  }

  const factor = attribute.weight === undefined || attribute.weight === null || attribute.weight === ''
    ? ''
    : `${attribute.weight} * `;

  return [ {
    type: '',
    text: `→ ${objective} ${factor}${name || attribute.name || attribute.id}`,
    indent: 1
  } ];
}
