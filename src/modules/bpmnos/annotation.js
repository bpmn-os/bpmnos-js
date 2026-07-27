import ExecutionDataModule from './execution-data';

import BPMNOSAnnotation from './BPMNOSAnnotation';
import BPMNOSAnnotationBehavior from './BPMNOSAnnotationBehavior';
import BPMNOSAnnotationContextPad from './BPMNOSAnnotationContextPad';
import BPMNOSAnnotationRenderer from './BPMNOSAnnotationRenderer';
import BPMNOSAnnotationRules from './BPMNOSAnnotationRules';

// Execution data boxes: a bpmn:TextAnnotation marked with bpmnos:annotation, attached to the element it
// describes by a bpmn:Association, its content rendered from the element's BPMNOS extensions.
export default {

  // the box renders what the registry reports, so it brings the registry along
  __depends__: [ ExecutionDataModule ],
  __init__: [
    'bpmnosAnnotationBehavior',
    'bpmnosAnnotationContextPad',
    'bpmnosAnnotationRenderer',
    'bpmnosAnnotationRules'
  ],
  bpmnosAnnotation: [ 'type', BPMNOSAnnotation ],
  bpmnosAnnotationBehavior: [ 'type', BPMNOSAnnotationBehavior ],
  bpmnosAnnotationContextPad: [ 'type', BPMNOSAnnotationContextPad ],
  bpmnosAnnotationRenderer: [ 'type', BPMNOSAnnotationRenderer ],
  bpmnosAnnotationRules: [ 'type', BPMNOSAnnotationRules ]
};
