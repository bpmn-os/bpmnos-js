import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import '@bpmn-io/properties-panel/dist/assets/properties-panel.css';
import 'bpmn-js-bpmnlint/dist/assets/css/bpmn-js-bpmnlint.css';
import 'bpmn-js-side-panel/assets/side-panel.css';
import './modules/bpmnos/css/bpmnos.css';
import './app.less';

import bpmnosLogo from './BPMNOS.svg'; // resolved to the served asset URL by Vite

import BpmnModeler from 'bpmn-js/lib/Modeler';

import { BpmnPropertiesPanelModule } from 'bpmn-js-properties-panel';

import SidePanelModule from 'bpmn-js-side-panel';

import CollapseEventSubProcessModule from 'bpmn-js-collapse-event-subprocess'; // collapse/expand popup menu
import EventSubProcessPaletteModule from 'bpmn-js-collapse-event-subprocess/palette'; // palette entry to create event sub-processes

import LintModule from 'bpmn-js-bpmnlint';
import getRules from './modules/rules'; // reused essential + BPMNOS engine/execution lint rules (bundle carries descriptions)
import IssuesPanelModule from 'bpmn-workbench/issues'; // self-registering "Issues" side-panel tab (owned by bpmn-workbench)
import createToolbar from 'bpmn-workbench/toolbar'; // on-canvas file/view toolbar (open/save/export/zoom)

import BPMNOSModdleDescriptor from './modules/bpmnos/bpmnos.json';
import BPMNOSModule from './modules/bpmnos'; // moddle-backed properties panel, decision-task decorator + popup menu

import newDiagram from './newDiagram.bpmn?raw';

import ContextPadCompatModule from './context-pad-compat'; // shim bpmn-js's deprecated ContextPad#getPad call

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
    // logo + source link, shown in the side-panel header (above the tabs)
    header: '<div class="bpmnos-brand">'
      + '<img class="bpmnos-logo" src="' + bpmnosLogo + '" alt="BPMNOS"/>'
      + '<a class="bpmnos-gh" href="https://github.com/bpmn-os/bpmnos-js" target="_blank"'
      + ' rel="noopener" title="View source on GitHub" aria-label="GitHub repository">'
      + '<svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true"><path fill="currentColor"'
      + ' d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38'
      + ' 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01'
      + ' 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95'
      + ' 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0'
      + ' 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0'
      + ' 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013'
      + ' 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>'
      + '</a>'
      + '</div>'
  },
  additionalModules: [
    BpmnPropertiesPanelModule,
    BPMNOSModule,
    SidePanelModule,
    LintModule,
    IssuesPanelModule,
    CollapseEventSubProcessModule,
    EventSubProcessPaletteModule,
    ContextPadCompatModule
  ],
  moddleExtensions
});

// Expose the modeler globally so the headless bpmnos2svg CLI (bpmnos2svg.js) can drive it — it
// navigates a browser to this app and calls modeler.importXML / modeler.saveSVG in the page context.
window.modeler = modeler;

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
