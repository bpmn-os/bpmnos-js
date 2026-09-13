import { unsupportedEventDefinition } from './helper.js';

/**
 * A rule reporting cancel events, which the engine does not run.
 *
 * `bpmn++` builds a cancel boundary event and a cancel throw event, so such a model parses, but the engine
 * names neither anywhere: no branch of `Token` or `StateMachine` mentions a cancel event. A cancel boundary
 * event therefore never fires, and a cancel end event departs as an untyped one would, leaving the
 * transaction it was meant to undo untouched.
 *
 * Transactions are unsupported for the same reason, and `engine/transaction` says so.
 */
export default unsupportedEventDefinition('Cancel events not supported by execution engine', 'bpmn:CancelEventDefinition');
