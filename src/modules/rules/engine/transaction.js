import { unsupportedNode } from './helper';

// DISABLED (outdated, re-validate before re-enabling) — replace the no-op below with the real rule:
// export default unsupportedNode('Transactions not supported by execution engine','bpmn:Transaction');
export default function() { return { check() {} }; }
