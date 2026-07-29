import BPMNOSPropertiesProvider from './BPMNOSPropertiesProvider.js';
import BPMNOSPropertiesUpdater from './BPMNOSPropertiesUpdater.js';

// The properties-panel provider for the BPMNOS attributes plus its updater.
export default {
  __init__: [ 'bpmnosPropertiesProvider', 'bpmnosPropertiesUpdater' ],
  bpmnosPropertiesProvider: [ 'type', BPMNOSPropertiesProvider ],
  bpmnosPropertiesUpdater: [ 'type', BPMNOSPropertiesUpdater ]
};
