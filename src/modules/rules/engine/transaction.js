import { unsupportedNode } from './helper.js';

/**
 * A rule reporting transactions, whose transactional behaviour the engine does not implement.
 *
 * `bpmn++` builds a `Transaction`, which derives from `SubProcess`, so the engine runs it as an ordinary
 * sub-process: its contents execute and it completes. What does not happen is everything that makes it a
 * transaction. A cancel end event within it ends nothing and a cancel boundary event on it never fires, the
 * engine naming no cancel event anywhere, so the sub-process cannot be cancelled and its completed
 * activities are never compensated on cancellation.
 *
 * A model needing work undone declares compensation explicitly, which the engine does implement.
 */
export default unsupportedNode('Transactions not supported by execution engine','bpmn:Transaction');
