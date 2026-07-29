import DecisionTaskModule from './decision-task.js';
import PropertiesModule from './properties.js';
import PasteIdentifiers from './PasteIdentifiers.js';

// The full BPMNOS bpmn-js module: the decision-task decorator and activity menu, the properties panel, and
// the naming of pasted extension content. Import the sub-modules (bpmnos-js/decision-task,
// bpmnos-js/properties) to pick only part of it.
//
// The BPMNOS annotations (bpmnos-js/annotation) are deliberately NOT included: they add a context-pad entry
// to every element, which a host may not want.
export default {
  __depends__: [ DecisionTaskModule, PropertiesModule ],
  __init__: [ 'pasteIdentifiers' ],
  pasteIdentifiers: [ 'type', PasteIdentifiers ]
};
