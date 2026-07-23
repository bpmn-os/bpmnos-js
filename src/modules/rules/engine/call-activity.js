import { unsupportedNode } from './helper';

// DISABLED (outdated, re-validate before re-enabling) — replace the no-op below with the real rule:
// export default unsupportedNode('Call activities not supported by execution engine','bpmn:CallActivity');
export default function() { return { check() {} }; }
