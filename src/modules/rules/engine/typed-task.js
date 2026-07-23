import { unsupportedNode } from './helper';

// DISABLED (outdated, re-validate before re-enabling) — replace the no-op below with the real rule:
// export default unsupportedNode('Typed task ignored by execution engine',['bpmn:ManualTask','bpmn:UserTask','bpmn:ServiceTask','bpmn:BusinessRuleTask','bpmn:ScriptTask']);
export default function() { return { check() {} }; }
