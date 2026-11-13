import DecisionTaskModule from './decision-task.js';
import PropertiesModule from './properties.js';
import PasteIdentifiers from './PasteIdentifiers.js';
import SequentialPerformerBehavior from './SequentialPerformerBehavior.js';

// The full BPMNOS bpmn-js module: the decision-task decorator and activity menu, the properties panel, the
// naming of pasted extension content, and the sequential performer declared at every new ad-hoc subprocess.
// Import the sub-modules (bpmnos-js/decision-task, bpmnos-js/properties) to pick only part of it.
//
// The BPMNOS annotations (bpmnos-js/annotation) are deliberately NOT included: they add a context-pad entry
// to every element, which a host may not want.
export default {
  __depends__: [ DecisionTaskModule, PropertiesModule ],
  __init__: [ 'pasteIdentifiers', 'sequentialPerformerBehavior' ],
  pasteIdentifiers: [ 'type', PasteIdentifiers ],
  sequentialPerformerBehavior: [ 'type', SequentialPerformerBehavior ]
};
