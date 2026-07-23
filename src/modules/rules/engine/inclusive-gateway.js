import { unsupportedNode } from './helper';

// DISABLED (outdated, re-validate before re-enabling) — replace the no-op below with the real rule:
// export default unsupportedNode('Inclusive gateways not supported by execution engine','bpmn:InclusiveGateway');
export default function() { return { check() {} }; }
