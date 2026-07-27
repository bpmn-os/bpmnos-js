import ExecutionData from './ExecutionData';
import ExecutionDataBehavior from './ExecutionDataBehavior';
import ExecutionDataContextPad from './ExecutionDataContextPad';
import ExecutionDataRenderer from './ExecutionDataRenderer';

// Execution data boxes: a bpmn:TextAnnotation marked with bpmnos:executionData, attached to the element it
// describes by a bpmn:Association, its content rendered from the element's BPMNOS extensions.
export default {
  __init__: [ 'executionDataBehavior', 'executionDataContextPad', 'executionDataRenderer' ],
  executionData: [ 'type', ExecutionData ],
  executionDataBehavior: [ 'type', ExecutionDataBehavior ],
  executionDataContextPad: [ 'type', ExecutionDataContextPad ],
  executionDataRenderer: [ 'type', ExecutionDataRenderer ]
};
