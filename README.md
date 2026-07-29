# bpmnos-js

Reusable [bpmn-js](https://github.com/bpmn-io/bpmn-js) modules for BPMN-OS (BPMN for optimization and
simulation), with a demo modeller.

The demo is available online at [bpmn-os.github.io/bpmnos-js](https://bpmn-os.github.io/bpmnos-js/).

## Modules

The BPMNOS extension is a set of reusable modules, each importable on its own. The package's own entry
point, `bpmnos-js`, brings the decision task and the properties panel together.

- **`bpmnos-js/moddle`**: the `bpmnos:` moddle extension describing decisions, attributes, restrictions,
  operators, messages, guidance, and lookup tables.
- **`bpmnos-js/decision-task`**: draws the decision-task glyph and provides the activity replace menu
  (the context-pad wrench). The menu adds the decision task and keeps type changes consistent: a task,
  a typed task (user task, decision task, ...), and a sub-process convert only through an untyped task,
  so a sub-process never becomes a typed task directly. Flipping an activity's `triggeredByEvent`
  (flow activity to event sub-process and back) is locked by default and unlocked via
  `activityPopupMenu: { unlockedTriggeredByEvent: true }`.
- **`bpmnos-js/properties`**: a properties-panel provider for the BPMNOS attributes, shown as a tab in
  the side panel.
- **`bpmnos-js/execution-data`**: the execution data registry, a diagram-js module providing the
  `executionData` service, which reports the status, data and global attributes each element declares and
  inherits, outermost first and the element's own last, which is the order a token carries them in.
- **`bpmnos-js/collect-execution-data`**: the function that registry is built from,
  `collectExecutionData(definitions)`, which reads a parsed `bpmn:Definitions` and returns the same
  registry. It touches no canvas and depends on no part of bpmn-js, so it serves a headless consumer, a
  test or a lint rule as well as the modeller does.
- **`bpmnos-js/identifiers`**: the identifier registry, a diagram-js module providing the `identifiers`
  service, which answers whether an identifier is taken and yields the next one that is free.
- **`bpmnos-js/collect-identifiers`**: the function that registry is built from,
  `collectIdentifiers(definitions)`, together with the pure queries over it, and model-level in the same
  sense as the collector above.

## Identifiers

Every piece of extension content that carries an identifier, an attribute, a restriction, an operator, a
choice, a message, a signal and a lookup table alike, shares one namespace with all the others, and that
namespace is bounded by the process rather than by the model. Within one process no two pieces of content
may hold the same identifier, since the identifier is the key every lookup is built on; two processes are
independent of each other. Content declared on the collaboration, the globals and the tables it holds, is
seen from every process and therefore belongs to the namespace of each, and must be free in all of them.

The boundary is the process because BPMN-OS itself requires it. The engine identifies two attributes by
their identifier rather than by their name, `Instance` and `Timestamp`, and every process declares its own
pair, so a collaboration carries one of each per participant. A rule demanding uniqueness across the model
would make such a model unmodellable.

The `identifiers` service holds that namespace for the model being edited, rebuilding as the model is
imported and edited and announcing `identifiers.changed` when it has. It answers `isTaken(element,
identifier)`, where the element is the one the content belongs to and decides which namespace is consulted,
and `nextId(element, prefix)`, which appends the smallest counting number that is free. A pool is answered
for as the process it stands for, and an element belonging to no process, the collaboration among them, is
answered for in every namespace at once. The same questions are put to a model outside a modeller through
`collectIdentifiers(definitions)` and the pure functions `isTaken`, `nextIdentifier`, `getHolders` and
`spacesOf` over the registry it returns.

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
npm test          # node --test test/*.test.mjs
```

The tests run under Node's own test runner, without a browser and without a modeller. What this package
collects from a model, the execution data and the identifiers alike, is a function of the moddle tree
alone, so a test parses a fixture with `bpmn-moddle` through the helper in `test/helper.mjs`, which
registers the BPMNOS moddle extension. Without that registration the extension elements parse as anonymous
content and a collector reports an empty model rather than failing, which is worth knowing wherever a model
is parsed outside the modeller. The fixtures in `test/fixtures` are copies of the BPMN-OS benchmark
instances, kept here so that the tests depend on nothing outside this repository.

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
