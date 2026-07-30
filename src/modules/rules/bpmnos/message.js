import { is } from 'bpmnlint-utils';

import { attributeName, getDefinitions, visibleAttributes } from './executionData.js';

/**
 * What a message says, and which events may exchange it.
 *
 * A message is exchanged between an event that throws it and one that catches it, and the engine decides
 * which pairs may do so when it reads the model: the two must agree on the name of the message and on the
 * header, and the message flows drawn in the collaboration must permit the pair. This module answers those
 * questions of a moddle tree, so that the rules below state faults rather than repeat the reading.
 *
 * The header is a set of keys, each holding values of one type. Three keys are always present, holding the
 * message name and the instance identifiers of the sending and the receiving token, and are strings. Every
 * further key is stated by a parameter, whose value names a declared attribute, in which case the key holds
 * values of the type that attribute is declared with, or is a quoted string, in which case it holds a
 * string. A parameter without a value states no type, its key holding no value, which every value held
 * under that key matches.
 */

/// The keys every header carries.
export const FIXED_KEYS = [ 'name', 'sender', 'recipient' ];

// a quoted string holds no quote of its own, quotes not being escaped
const QUOTED = /^"[^"]*"$/;

/**
 * The message definitions a node carries, in document order.
 *
 * A send or receive task holds them in a `bpmnos:messages` container, because a multi-instance task may
 * define one message per instance; every other event holds a `bpmnos:message` outright.
 */
export function messagesOf(node) {
  const extensionElements = node.extensionElements;

  if (!extensionElements) {
    return [];
  }

  return (extensionElements.values || []).flatMap(function(element) {
    if (is(element, 'bpmnos:Messages')) {
      return element.get('message') || [];
    }

    if (is(element, 'bpmnos:Message')) {
      return [ element ];
    }

    return [];
  });
}

export function isThrowing(node) {
  return is(node, 'bpmn:SendTask') || (is(node, 'bpmn:ThrowEvent') && hasMessageEventDefinition(node));
}

export function isCatching(node) {
  return is(node, 'bpmn:ReceiveTask') || (is(node, 'bpmn:CatchEvent') && hasMessageEventDefinition(node));
}

function hasMessageEventDefinition(node) {
  return (node.eventDefinitions || []).some(definition => is(definition, 'bpmn:MessageEventDefinition'));
}

/**
 * The types of the attributes visible at a node, by name.
 */
export function typesByName(node) {
  return new Map(visibleAttributes(node).map(attribute => [ attributeName(attribute), attribute.type ]));
}

/**
 * What a header parameter states: `unset` where it states no value, `literal` where it states a quoted
 * string, `attribute` where it names an attribute visible at the node, and `illegal` for anything else.
 * The first three carry the type of the values held under the key, which is stated for all but the first.
 */
export function shapeOf(parameter, types) {
  const value = (parameter.get('value') || '').trim();

  if (!value) {
    return { kind: 'unset' };
  }

  if (QUOTED.test(value)) {
    return { kind: 'literal', type: 'string' };
  }

  if (types.has(value)) {
    return { kind: 'attribute', type: types.get(value) };
  }

  return { kind: 'illegal', value };
}

/**
 * The header of a message: its keys in the order the engine builds them, the three fixed ones followed by
 * the rest by name, each with the type of the values held under it where the model states one.
 */
export function headerOf(node, message) {
  const types = typesByName(node),
        stated = new Map();

  (message.get('parameter') || []).forEach(function(parameter) {
    if (!stated.has(parameter.get('name'))) {
      stated.set(parameter.get('name'), parameter);
    }
  });

  const keys = [
    ...FIXED_KEYS,
    ...[ ...stated.keys() ].filter(key => !FIXED_KEYS.includes(key)).sort()
  ];

  return keys.map(function(key) {
    if (FIXED_KEYS.includes(key)) {
      return { key, type: 'string' };
    }

    return { key, type: shapeOf(stated.get(key), types).type };
  });
}

/**
 * Whether two message definitions may be exchanged: the same message name, the same keys, and the same
 * type under a key wherever both state one. A key stating no type is matched by any value held under it,
 * and agrees with a key of any type.
 */
export function agrees(message, header, otherMessage, otherHeader) {
  if (message.get('name') !== otherMessage.get('name')) {
    return false;
  }

  if (header.length !== otherHeader.length) {
    return false;
  }

  return header.every(function(entry, index) {
    const other = otherHeader[index];

    return entry.key === other.key && (!entry.type || !other.type || entry.type === other.type);
  });
}

/**
 * Whether the message flows of the model permit a message thrown by one event to be caught by another.
 *
 * A flow drawn for an event restricts what it exchanges with; where an event has none of its own, the
 * flows of the nearest enclosing scope that has any restrict it instead, event sub-processes being passed
 * over; and where no flow is drawn at all, nothing is restricted.
 */
export function permits(throwing, catching, flows) {
  const outgoing = relevantFlows(throwing, flows, 'sourceRef'),
        incoming = relevantFlows(catching, flows, 'targetRef');

  const mayBeCaught = !outgoing.length || outgoing.some(flow => reaches(flow.get('targetRef'), catching)),
        mayBeThrown = !incoming.length || incoming.some(flow => reaches(flow.get('sourceRef'), throwing));

  return mayBeCaught && mayBeThrown;
}

/**
 * The message flows of the model, which a collaboration holds.
 */
export function messageFlowsOf(definitions) {
  return (definitions.get('rootElements') || [])
    .filter(rootElement => is(rootElement, 'bpmn:Collaboration'))
    .flatMap(collaboration => collaboration.get('messageFlows') || []);
}

function relevantFlows(node, flows, side) {
  const own = flows.filter(flow => flow.get(side) === node);

  if (own.length) {
    return own;
  }

  for (let scope = enclosingScope(node); scope; scope = enclosingScope(scope)) {
    const participant = participantOf(scope),
          found = flows.filter(flow => flow.get(side) === scope || (participant && flow.get(side) === participant));

    if (found.length) {
      return found;
    }
  }

  return [];
}

/**
 * The scope a node sits in, passing over event sub-processes, whose message flows are those of the scope
 * containing them.
 */
function enclosingScope(node) {
  let scope = node.$parent;

  while (scope && is(scope, 'bpmn:SubProcess') && scope.get('triggeredByEvent')) {
    scope = scope.$parent;
  }

  return scope && (is(scope, 'bpmn:SubProcess') || is(scope, 'bpmn:Process')) ? scope : null;
}

function participantOf(scope) {
  const definitions = getDefinitions(scope);

  if (!definitions) {
    return null;
  }

  return (definitions.get('rootElements') || [])
    .filter(rootElement => is(rootElement, 'bpmn:Collaboration'))
    .flatMap(collaboration => collaboration.get('participants') || [])
    .find(participant => participant.get('processRef') === scope) || null;
}

/**
 * Whether an endpoint of a message flow is the given event or holds it, an endpoint being an event, a
 * sub-process, or a participant standing for the process it refers to.
 */
function reaches(endpoint, event) {
  if (!endpoint) {
    return false;
  }

  const container = is(endpoint, 'bpmn:Participant') ? endpoint.get('processRef') : endpoint;

  if (container === event) {
    return true;
  }

  for (let parent = event.$parent; parent; parent = parent.$parent) {
    if (parent === container) {
      return true;
    }
  }

  return false;
}
