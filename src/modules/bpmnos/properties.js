import IdentifiersModule from './identifiers.js';

import BPMNOSPropertiesProvider from './BPMNOSPropertiesProvider.js';
import BPMNOSPropertiesUpdater from './BPMNOSPropertiesUpdater.js';

// The properties-panel provider for the BPMNOS attributes plus its updater.
export default {

  // content is created with an identifier generated from the registry, and a typed one is checked against it
  __depends__: [ IdentifiersModule ],
  __init__: [ 'bpmnosPropertiesProvider', 'bpmnosPropertiesUpdater' ],
  bpmnosPropertiesProvider: [ 'type', BPMNOSPropertiesProvider ],
  bpmnosPropertiesUpdater: [ 'type', BPMNOSPropertiesUpdater ]
};
