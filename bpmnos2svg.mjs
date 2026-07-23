#!/usr/bin/env node

// Headless BPMN → SVG for this app's modeller, which is configured with the BPMNOS moddle extension
// and the decision-task decorator — so BPMNOS decorations render correctly. All the rendering logic
// (headless Chrome, one SVG per plane, collapsed sub-processes, tooltips) is reused from
// bpmn-workbench's shared core; this entry only points it at THIS app's dev server.

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from 'bpmn-workbench/bpmn2svg';

const appDir = dirname(fileURLToPath(import.meta.url));

runCli({ appDir, argv: process.argv.slice(2), toolName: 'bpmnos2svg' })
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });
