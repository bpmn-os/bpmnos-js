import { unsupportedNode } from './helper.js';

/**
 * A rule reporting call activities, which the engine does not run.
 *
 * `bpmn++` builds a `CallActivity`, which derives from `Activity` rather than from `SubProcess`, and the
 * engine names it nowhere: it has neither the contents of a sub-process to run nor the completion of a task
 * to wait for. A token reaching one therefore has nothing to do and no state machine to create.
 *
 * Calling a process is not the same as embedding one, and BPMN-OS offers no substitute; a model that needs
 * the called process executed embeds it as a sub-process.
 */
export default unsupportedNode('Call activities not supported by execution engine','bpmn:CallActivity');
