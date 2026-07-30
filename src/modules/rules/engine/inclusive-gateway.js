import { unsupportedNode } from './helper.js';

/**
 * A rule reporting inclusive gateways, which the engine does not run.
 *
 * Neither direction is implemented: a diverging one reaches `StateMachine::handleDivergingGateway`, which
 * handles parallel and event-based gateways and throws "diverging gateway type ... not yet supported" for
 * anything else, and a converging one reaches `attemptGatewayActivation`, which merges only a parallel
 * join and throws "converging gateway type ... not yet supported" otherwise. The engine has no mention of
 * an inclusive gateway anywhere.
 *
 * Where its gatekeepers belong is another matter, and `bpmnos/gatekeeper` says so: the branches of an
 * inclusive gateway are decided the same way, whether or not the engine can take them yet.
 */
export default unsupportedNode('Inclusive gateways not supported by execution engine', 'bpmn:InclusiveGateway');
