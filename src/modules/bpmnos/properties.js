import BPMNOSPropertiesProvider from './BPMNOSPropertiesProvider';
import BPMNOSPropertiesUpdater from './BPMNOSPropertiesUpdater';

// The properties-panel provider for the BPMNOS attributes plus its updater.
export default {
  __init__: [ 'bpmnosPropertiesProvider', 'bpmnosPropertiesUpdater' ],
  bpmnosPropertiesProvider: [ 'type', BPMNOSPropertiesProvider ],
  bpmnosPropertiesUpdater: [ 'type', BPMNOSPropertiesUpdater ]
};
