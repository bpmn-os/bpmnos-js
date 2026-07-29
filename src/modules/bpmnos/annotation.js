import ExecutionDataModule from './execution-data.js';

import BPMNOSAnnotation from './BPMNOSAnnotation.js';
import BPMNOSAnnotationBehavior from './BPMNOSAnnotationBehavior.js';
import BPMNOSAnnotationContextPad from './BPMNOSAnnotationContextPad.js';
import BPMNOSAnnotationRenderer from './BPMNOSAnnotationRenderer.js';
import BPMNOSAnnotationRules from './BPMNOSAnnotationRules.js';

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
