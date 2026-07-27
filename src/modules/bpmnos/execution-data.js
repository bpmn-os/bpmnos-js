import ExecutionData from './ExecutionData';

// The execution data registry: which attributes a node declares and inherits, an attribute by id, and the
// nodes an attribute id is visible at. Depends on nothing else of BPMNOS and touches no canvas API.
export default {
  __init__: [ 'executionData' ],
  executionData: [ 'type', ExecutionData ]
};
