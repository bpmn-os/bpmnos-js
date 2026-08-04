# bpmnos-js

Reusable [bpmn-js](https://github.com/bpmn-io/bpmn-js) modules for BPMN-OS (BPMN for optimization and
simulation), with a demo modeller.

The demo is available online at [bpmn-os.github.io/bpmnos-js](https://bpmn-os.github.io/bpmnos-js/).

## Modules

The BPMNOS extension is a set of reusable modules, each importable on its own. The package's own entry
point, `bpmnos-js`, brings the decision task and the properties panel together.

- **`bpmnos-js/moddle`**: the `bpmnos:` moddle extension describing decisions, attributes, restrictions,
  operators, messages, guidance, and lookup tables.
- **`bpmnos-js/decision-task`**: displays the decision-task glyph and provides the activity replace menu
  (the context-pad wrench). The menu adds the decision task and keeps type changes consistent: a task,
  a typed task (user task, decision task, ...), and a sub-process convert only through an untyped task,
  so a sub-process never becomes a typed task directly. Flipping an activity's `triggeredByEvent`
  (flow activity to event sub-process and back) is locked by default and unlocked via
  `activityPopupMenu: { unlockedTriggeredByEvent: true }`.
- **`bpmnos-js/decision-task-symbol`**: the decision task drawn away from the canvas.
  `createDecisionTaskSymbol({ width, height, color })` returns one SVG element holding BPMN's task outline,
  the branching arrow in the upper left where BPMN places a typed task's marker, and, where a colour is
  given, a token on the middle of the upper boundary. The outline and the marker take `currentColor`, and
  the drawing is a single element, so it is sized and coloured by its container and needs nothing of a
  stylesheet. It is drawn on the square `bpmn-font` draws BPMN's own symbols on, so a decision task sits
  beside a participant or a manual task at one size and one line weight. The marker is exported on its own
  as `BRANCHING_ARROW` with `MARKER_STROKE_WIDTH`, and the renderer of `bpmnos-js/decision-task` draws the
  shape from those same constants, so the glyph on a diagram and the glyph in a list cannot drift apart.
- **`bpmnos-js/properties`**: a properties-panel provider for the BPMNOS attributes, shown as a tab in
  the side panel.
- **`bpmnos-js/execution-data`**: the execution data registry, a diagram-js module providing the
  `executionData` service, which reports the status, data and global attributes each element declares and
  inherits, outermost first and the element's own last, which is the order a token carries them in, and
  resolves an attribute from its identifier within the process asked about.
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
and `nextId(element, prefix)`, which generates an identifier at random and returns the first one the
process has not taken, so that uniqueness rests on the registry rather than on the improbability of a
collision and no order is implied that a counter would invite a reader to look for. A pool is answered for
as the process it stands for, and an element belonging to no process, the collaboration among them, is
answered for in every namespace at once. The same questions are put to a model outside a modeller through
`collectIdentifiers(definitions)` and the pure functions `isTaken`, `nextIdentifier`, `getHolders` and
`spacesOf` over the registry it returns.

Reading an attribute by its identifier obeys the same boundary. `executionData.getAttribute(element, id)`
returns the attribute of that identifier as the element sees it, and `executionData.getElements(element, id)`
the elements that see it, both answered within the process the element belongs to, or within every process
for an element belonging to none. Naming the element is what makes the answer well defined: in a
collaboration each participant declares an `Instance` and a `Timestamp` of its own, and a lookup that did
not say where would report whichever process happened to be read last.

Copying and pasting obeys the same rule. Content pasted into a process that already holds one of its
identifiers is given a new one, generated from the identifier it replaces, so that `Index` becomes `Index_`
and a suffix rather than something unrecognisable; content pasted into a process that holds none of them
keeps the identifiers it has, since the identifiers of one process say nothing about another and a task
copied from one pool to the next is more useful with its own names intact. This is settled when the content
is pasted rather than when it is copied, because one clipboard may be pasted into either process, and which
identifiers are free is not known until it is known where the content lands.

## Extension content and its containers

BPMN-OS content is held in containers. An attribute sits in a `bpmnos:Attributes`, which sits in a
`bpmnos:Status` when an activity or a process declares it, and every one of them sits in the element's
`bpmn:ExtensionElements`. The properties panel creates each container as it is needed, and removes each one
again when the content it held is gone, so that removing the last attribute of an element leaves that
element exactly as it was before the first one was added, with no empty `bpmnos:status` and no empty
`bpmn:extensionElements` left in the file.

A container is removed only when it becomes meaningless, which is when every list of it is empty and it
holds no value of its own. A `bpmnos:Guidance` with its type, a `bpmnos:Message` with its name and
identifier, and a `bpmnos:Signal` are content in their own right and therefore stay when their lists run
empty; whether they are wanted is the user's to say. The judgement is made from what the element holds
rather than from a list of types, so a type added to the moddle extension is treated correctly without
anything being changed.

The removal of a piece of content and of the containers it empties is one command, hence one step of the
undo history. A timer is removed when its trigger is cleared, since a timer that names no trigger states
nothing, and an empty trigger no longer creates one.

When an element's type changes, content that no longer applies is discarded. An event that ceases to be a
message event or a timer event loses its extension content altogether, because what a changed element needs
is a different set of content and there is no reliable way to tell which of the old is still meant. An
activity keeps its `bpmnos:Status`, whose attributes, restrictions and operators are valid whatever the
activity is, and loses only what belongs to the type it no longer has, its choices and its messages.

## Objectives and weights

An attribute may contribute to the objective a run optimises, by minimizing or by maximizing, and it does so
with a weight by which its value is multiplied. The two belong together. Giving an attribute an objective
gives it a weight of one where it carries none; changing between minimizing and maximizing leaves the weight
as it stands, since that choice says nothing about it; and taking the objective away takes the weight with
it. For as long as there is an objective the weight is required and must be a number, and a weight that is
neither is refused as it is typed and never reaches the model.

## The annotation box

The box attached to an element shows what that element declares and what it inherits, in the order a token
carries it. Each compartment is named in capitals, and what the element inherits and what it declares itself
fold separately, so a box can be read at the depth wanted and left there.

An attribute is shown as its type followed by its name, and where it contributes to the objective its term
follows beneath, as `➔ minimize 1 * distance`. A restriction, an operator and a choice are shown as the
expression they carry.

Red marks a fault in the model rather than a decoration. An attribute to which the model gives no name, and a
restriction, operator or choice that carries no expression, are shown by their identifier in red, because
that identifier is standing in for something that ought to be there: the engine resolves an attribute by its
name, and content without an expression says nothing at all.

A box holds no text of its own. What it shows is drawn from the model each time it is rendered, and the
annotation's text is never read, so a double click on a box does not open the label editor as it does on a
text annotation of the user's own.

The module exports one function beside itself, `annotationRole(element)`, answering what an element is to a
box: `box`, `association`, `host` for an element that may carry one, and `null` for anything else. It is
there for a host that permits some modelling of a box under conditions of its own — a workbench keeping the
box alive while a simulation runs, where the rest of the canvas is read-only — so that the host may say what
it permits of each kind without knowing how a box is put together.

```js
import AnnotationModule, { annotationRole } from 'bpmnos-js/annotation';
import 'bpmnos-js/bpmnos.css';
```

The stylesheet carries the icons the modules draw with, the decision task's and the box's, and a host imports
it as it imports bpmn-js's own.

## Demo modeller

The demo wires the three modules into a bpmn-js modeller with the property panel and an Issues tab. The
Issues tab and the essential model-checking rules come from
[bpmn-workbench](https://github.com/bpmn-os/bpmn-workbench), and the side panel from
[bpmn-js-side-panel](https://github.com/bpmn-os/bpmn-js-side-panel). The BPMNOS rule set reuses the
essential rules and adds engine and execution rules, applied more strictly for execution.

Two of them concern messages, and both state what the execution engine requires of a model it reads. The
parameters of a message header must state the name of a declared attribute or a quoted string, so that the
type of every header entry is known before a run begins; a parameter without a value is permitted and means
that the entry holds no value, which every value held under that name matches. And a message event must be
paired with an event that may exchange its message, which requires the same message name, the same header
keys holding values of the same type, and message flows permitting the two. Whether the values of a header
agree is decided while a model runs and is checked nowhere here, so a pair the rules accept may still
exchange nothing; what the rules report is an event that no run whatever could pair with.

Simulation is out of scope here. It is reserved for a future bpmnos-workbench.

## Loading the package outside a bundle

Every relative import names the file it resolves to and JSON is imported with the attribute Node requires, so
the modules of this package load in Node as they do in a bundler. That is what makes a rule testable, a
corpus checkable with `bpmnosdoc`, and the execution data registry usable by any tool holding a parsed
`bpmn:Definitions`.

The properties panel is the exception, and deliberately so: it is preact JSX written in `.js` files, which
Node cannot parse whatever its imports say. `bpmnos-js`, `bpmnos-js/properties` and `bpmnos-js/decision-task`
are therefore for a bundler; `./rules`, `./execution-data`, `./collect-execution-data`, `./identifiers`,
`./collect-identifiers`, `./annotation` and `./moddle` load anywhere.

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

## Documenting a model (`bpmnosdoc`)

`bpmnosdoc` is the second command-line tool this package ships, and it writes the documentation of a model:
one markdown file per model, holding the diagrams and, for every node, what the model says about it and what
that node declares and inherits. The diagrams are rendered by `bpmnos2svg`'s renderer, so a collapsed
sub-process gets a diagram of its own, and the execution data comes from the `executionData` registry, which
is the same implementation the modeller answers from. A model's own documentation elements are carried
through, so what the modeller writes about a process is what the reader of the documentation gets.

It is installed and prepared exactly as `bpmnos2svg` is, sharing its `npm link` and its headless Chrome.

```sh
bpmnosdoc <model.bpmn> [...] [-o <outDir>]
```

Each model named yields `<model>.md` beside one `.svg` per plane, in the output directory, which defaults to
the working directory. Several models may be given at once, and one browser serves them all.

Running it over the corpus of `BPMNOSInstances.jl` is how this package's registry is checked against real
models, and it is what has caught every registry fault so far.

## License

MIT. See [LICENSE](LICENSE).
