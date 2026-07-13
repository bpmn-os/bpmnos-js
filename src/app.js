import BpmnModeler from 'bpmn-js/lib/Modeler';

import { BpmnPropertiesPanelModule } from 'bpmn-js-properties-panel';

import SidePanelModule from 'bpmn-js-side-panel';

import CollapseEventSubProcessModule from 'bpmn-js-collapse-event-subprocess';

import LintModule from 'bpmn-js-bpmnlint';
import getRules from './modules/rules'; // reused essential + BPMNOS engine/execution lint rules (bundle carries descriptions)
import IssuesPanelModule from 'bpmn-workbench/issues'; // self-registering "Issues" side-panel tab (owned by bpmn-workbench)
import createToolbar from 'bpmn-workbench/toolbar'; // on-canvas file/view toolbar (open/save/export/zoom)

import BPMNOSModdleDescriptor from './modules/bpmnos/bpmnos.json';
import BPMNOSModule from './modules/bpmnos'; // moddle-backed properties panel, decision-task decorator + popup menu

import newDiagram from './newDiagram.bpmn';

var moddleExtensions = {
  bpmnos: BPMNOSModdleDescriptor
};

// The side panel auto-hosts the properties panel as its first "Properties" tab (we deliberately do not
// set the properties panel's own `parent`); IssuesPanelModule adds the "Issues" tab.
var modeler = new BpmnModeler({
  container: '#canvas',
  linting: {
    bpmnlint: getRules()
  },
  sidePanel: {
    parent: '#side-panel',
    header: '<img class="bpmnos-logo" src="BPMNOS.svg" alt="BPMNOS"/>'
  },
  additionalModules: [
    BpmnPropertiesPanelModule,
    BPMNOSModule,
    SidePanelModule,
    LintModule,
    IssuesPanelModule,
    CollapseEventSubProcessModule
  ],
  moddleExtensions
});

modeler.importXML(newDiagram);

// On-canvas file/view toolbar (open, save, export SVG, centre, zoom) — packaged by bpmn-workbench.
createToolbar(modeler);

// Optional deep-linking: ?src=<url> loads a diagram on startup.
var src = new URL(window.location.href).searchParams.get('src');
if (src) {
  var xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      modeler.importXML(xhttp.responseText);
    }
    else if (this.readyState == 4) {
      console.warn('Failed to load ' + src + ' (status ' + this.status + ')');
    }
  };
  xhttp.open('GET', src, true);
  xhttp.send();
}
