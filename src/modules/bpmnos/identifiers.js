import Identifiers from './Identifiers.js';

// The identifier registry: which identifiers the extension content of a process has taken, and what the next
// free one is. Depends on nothing else of BPMNOS and touches no canvas API.
export default {
  __init__: [ 'identifiers' ],
  identifiers: [ 'type', Identifiers ]
};
