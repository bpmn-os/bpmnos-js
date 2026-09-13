import { unsupportedEventDefinition } from './helper.js';

/**
 * A rule reporting terminate events, which the engine does not run.
 *
 * `bpmn++` builds a terminate throw event, so such a model parses, but the engine names it nowhere. A token
 * reaching one departs as it would from an untyped end event, so the other tokens of the process keep
 * running and nothing is terminated. A process meant to stop when one of its branches finishes needs the
 * branches to be joined instead.
 */
export default unsupportedEventDefinition('Terminate events not supported by execution engine', 'bpmn:TerminateEventDefinition');
