import { unsupportedEventDefinition } from './helper.js';

/**
 * A rule reporting link events, which the engine does not run.
 *
 * `bpmn++` builds a link source and a link target event, so such a model parses, but the engine names
 * neither. A link is a jump drawn as a pair of events rather than as a sequence flow, and with no handling
 * for it the token departs the source along its outgoing flows, if it has any, and never arrives at the
 * target. A model relying on a link to continue elsewhere therefore loses the token instead.
 */
export default unsupportedEventDefinition('Link events not supported by execution engine', 'bpmn:LinkEventDefinition');
