import { unsupportedNode } from './helper.js';

/**
 * A rule reporting tasks whose type the engine ignores.
 *
 * `UserTask`, `ManualTask`, `ScriptTask` and `BusinessRuleTask` all derive from `Task` in `bpmn++`, and a
 * service task is not distinguished at all and becomes a plain task. The engine tests for `BPMN::Task` and
 * so runs every one of them as an ordinary task: the operators are applied and the timestamp advances by
 * whatever they compute.
 *
 * Nothing fails, which is why this is a warning rather than an error. What is lost is only what the type
 * was meant to say — no script is run, no user is asked, no rule is evaluated — so the model reads as
 * though something happens that does not. Work the engine is to perform is stated in operators.
 */
export default unsupportedNode('Typed task ignored by execution engine',['bpmn:ManualTask','bpmn:UserTask','bpmn:ServiceTask','bpmn:BusinessRuleTask','bpmn:ScriptTask']);
