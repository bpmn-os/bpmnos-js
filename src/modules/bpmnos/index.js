import DecisionTaskModule from './decision-task';
import PropertiesModule from './properties';
import ReplaceIds from './ReplaceIds';

// The full BPMNOS bpmn-js module: the decision-task decorator and activity menu, the properties panel, and
// the extension-element id replacer. Import the sub-modules (bpmnos-js/decision-task, bpmnos-js/properties)
// to pick only part of it.
//
// The execution data boxes (bpmnos-js/execution-data) are deliberately NOT included: they add a context-pad
// entry to every element, which a host may not want.
export default {
  __depends__: [ DecisionTaskModule, PropertiesModule ],
  __init__: [ 'replaceIds' ],
  replaceIds: [ 'type', ReplaceIds ]
};
