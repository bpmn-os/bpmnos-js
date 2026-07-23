# bpmnos-js

Reusable [bpmn-js](https://github.com/bpmn-io/bpmn-js) modules for BPMN-OS (BPMN for optimization and
simulation), with a demo modeller.

The demo is available online at [bpmn-os.github.io/bpmnos-js](https://bpmn-os.github.io/bpmnos-js/).

## Modules

The BPMNOS extension is three reusable modules, importable individually or together (`bpmnos-js`
bundles all three):

- **`bpmnos-js/moddle`**: the `bpmnos:` moddle extension describing decisions, attributes, restrictions,
  operators, messages, guidance, allocations, and lookup tables.
- **`bpmnos-js/decision-task`**: draws the decision-task glyph and provides the activity replace menu
  (the context-pad wrench). The menu adds the decision task and keeps type changes consistent: a task,
  a typed task (user task, decision task, ...), and a sub-process convert only through an untyped task,
  so a sub-process never becomes a typed task directly. Flipping an activity's `triggeredByEvent`
  (flow activity to event sub-process and back) is locked by default and unlocked via
  `activityPopupMenu: { unlockedTriggeredByEvent: true }`.
- **`bpmnos-js/properties`**: a properties-panel provider for the BPMNOS attributes, shown as a tab in
  the side panel.

## Demo modeller

The demo wires the three modules into a bpmn-js modeller with the property panel and an Issues tab. The
Issues tab and the essential model-checking rules come from
[bpmn-workbench](https://github.com/bpmn-os/bpmn-workbench), and the side panel from
[bpmn-js-side-panel](https://github.com/bpmn-os/bpmn-js-side-panel). The BPMNOS rule set reuses the
essential rules and adds engine and execution rules, applied more strictly for execution.

Simulation is out of scope here. It is reserved for a future bpmnos-workbench.

## Development

```sh
npm install
npm run dev       # Vite dev server (hot reload)
npm run build     # production build to dist/
npm run preview   # serve the production build
```

## Rendering diagrams to SVG (`bpmnos2svg`)

`bpmnos2svg` is a command-line tool (shipped as this package's `bin`) that renders a `.bpmn` file to
SVG headlessly including BPMNOS-specific decision task decorator. It emits
one SVG per plane (each collapsed sub-process gets its own file) and adds `data-element-id` tooltips.

It works by launching headless Chrome, loading the bpmnos-js app, and calling `modeler.importXML` /
`modeler.saveSVG` in the page (the app exposes the modeller as `window.modeler`).

### Prerequisites

- Google Chrome — auto-detected via `chrome-launcher` (`sudo apt install google-chrome-stable`).

### Install

`bpmnos2svg` lives in this repo and depends on it, so put it on your `PATH` with `npm link`:

```sh
npm install
npm link          # adds `bpmnos2svg` to your PATH
```

No `sudo` is needed as long as npm's global prefix is user-writable. If it isn't, point npm at a
user-owned prefix once and make sure its `bin` is on your `PATH`:

```sh
npm config set prefix ~/.local     # then ensure ~/.local/bin is on PATH
```

### Usage

```sh
# Auto-start: spins up the bpmnos-js dev server, renders, then shuts it down.
bpmnos2svg <file.bpmn> [-o <outputDir>]

# Against an already-running server (start it once with `npm run dev`).
# Reuse one server for a whole batch — much faster than auto-starting per file.
bpmnos2svg -s <serverURL> <file.bpmn> [-o <outputDir>]
```

## License

MIT. See [LICENSE](LICENSE).
