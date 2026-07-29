# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

Working. A Vite demo app (`npm run dev`) wires a modern bpmn-js modeller with the BPMNOS extension, a
Properties tab, and an Issues tab. The BPMNOS modules were extracted from the (archived) modeller and are
exposed via a package `exports` API. The essential rules and the Issues tab are consumed from
bpmn-workbench; the BPMNOS-specific lint rules are added on top. All source is ESM and bundler-agnostic
(no webpack `require.context`, no Vite-only `import.meta.glob`), so the package is publishable under any
bundler.

Added since: the **execution data registry** (what a node declares and inherits), the **annotation box**
that renders it on the canvas, **bpmnosdoc**, which generates model documentation from it, and the
**identifier registry** (which identifiers a process has taken), with the first tests.

## Commands

```sh
npm install
npm run dev       # Vite dev server (HMR)
npm run build     # production build → dist/
npm run preview   # serve the production build
npm test          # node --test test/*.test.mjs
```

Tests run without a browser and without a modeller: what this package collects from a model is a function
of the moddle tree, so `test/helper.mjs` parses a fixture with `bpmn-moddle` and the BPMNOS moddle
extension registered — omit the extension and a collector reports an empty model rather than failing.
Fixtures in `test/fixtures` are copies of the BPMNOSInstances corpus, so the suite depends on nothing
outside the repo.

Runtime smoke test: drive the page with puppeteer-core (a devDependency) and **fail on `pageerror` or a
console error**, then assert `document.querySelectorAll('.djs-element').length > 0`. Do **not** grep the
dumped DOM for `djs-container`: that div is created before the diagram is imported, so the check passes
while the app is broken — it did, after a bad import sweep left `is` undefined and the canvas empty. The
app exposes `window.modeler`, so a probe can `importXML` a fixture, drive services (`copyPaste`,
`bpmnosAnnotation`) and read `saveXML` back, which is how the paste, container and panel behaviour were
verified.

Two CLI tools, both driving this app headlessly (they start their own Vite, so no server need be
running):

```sh
node bpmnos2svg.mjs [-o <dir>] [-s <url>] <model.bpmn>  # one model → SVG per plane, BPMNOS decorations
node bpmnosdoc.mjs  [-o <dir>] <model.bpmn>...          # markdown per model: diagrams, docs, attributes
```

`bpmnosdoc` is also the closest thing to a test: run it over `~/Code/bpmnos/BPMNOSInstances.jl/src/*/*.bpmn`
and read the output — that corpus (nested scopes, event sub-processes, data objects, collaborations) is
what caught every registry defect so far. Its output directory `doc/` is gitignored.

## What this project is

`bpmnos-js` provides **reusable [bpmn-js](https://github.com/bpmn-io/bpmn-js) modules for BPMN-OS** (BPMN
for optimization and simulation), for any bpmn-js host. Exposed via the package `exports` map:

- **`.`** — the full BPMNOS DI module: the decision-task decorator + activity replace menu, the
  properties panel, and the naming of pasted extension content (`PasteIdentifiers`, service
  `pasteIdentifiers`; was `ReplaceIds`/`replaceIds`).
- **`./moddle`** (`bpmnos.json`) — the `bpmnos:` moddle extension (decisions, attributes, restrictions,
  operators, messages, guidance, lookup tables, etc.).
- **`./decision-task`** — the decision-task renderer + `ActivityPopupMenu` (the type-change funnel and the
  decision task).
- **`./properties`** — a `@bpmn-io/properties-panel` provider (`BPMNOSPropertiesProvider` + updater),
  surfaced **as a tab in a `bpmn-js-side-panel`**.
- **`./execution-data`** — the registry (`executionData`): what a node declares and inherits. Depends on
  nothing else of BPMNOS and touches no canvas API.
- **`./annotation`** — the annotation box (`bpmnosAnnotation` + renderer, context pad, rules, behaviour),
  which renders the registry on the canvas. Brings `./execution-data` with it.

Neither is part of `.`: the annotation adds a context-pad entry to every element, which a host may not
want.

It also ships a **demo modeller** (`src/app.js`) wiring these with the Issues panel and Properties tab,
and two `bin` tools (`bpmnos2svg`, `bpmnosdoc`). Simulation is out of scope here — it belongs to
bpmn-workbench / a future workbench.

## Sibling projects (in `~/Code` and `~/Code/bpmnos`)

Match their conventions. The demo apps (this, bpmn-workbench, bpmn-js-animation) are all on **Vite**.

- **`~/Code/bpmnos/modeller`** — **archived; this project superseded it.** Was the source of the extracted
  BPMNOS modules and lint rules.
- **`~/Code/bpmn-workbench`** — **owns the Issues panel and the essential rules; consume, do not
  re-implement.** Exports `bpmn-workbench/issues` (self-registering "Issues" tab), `bpmn-workbench/rules`
  (essential rules + `createRules`/`createContext`), and `bpmn-workbench/toolbar` (on-canvas toolbar).
- **`~/Code/bpmn-js-collapse-event-subprocess`** — event sub-process create (palette) + collapse/expand
  (popup). Consumed from **npm** (`^0.3.0`); default export = collapse, `./palette` = optional create.

## Architecture / key patterns

Everything is a **bpmn-js/diagram-js DI module**: `{ __init__: [...], serviceName: [ 'type', Ctor ] }`
added to `BpmnModeler`'s `additionalModules`. See `src/modules/bpmnos/index.js`. Optional deps use
`injector.get(name, false)` so a module no-ops when a host lacks a service.

**Build: Vite** (`vite.config.mjs`). The properties panel is authored in **preact JSX** inside `.js`
files, so a small pre-transform plugin runs `src/*.js` through esbuild's jsx loader with `jsxImportSource:
'@bpmn-io/properties-panel/preact'`, plus a `react → @bpmn-io/properties-panel/preact/compat` alias.
Vendor CSS and `./app.less` are imported from `app.js`; `.bpmn` is imported with `?raw`; the BPMNOS.svg
logo is imported (Vite resolves the URL). Deployed to GitHub Pages via `npm run build` (base `/bpmnos-js/`
in CI).

**Bundler-agnostic source.** All source is ESM — no `module.exports`, no webpack `require.context`, no
Vite-only `import.meta.glob`. Rule registries are built with explicit imports fed to `createContext`.
This is what keeps the modules publishable under any bundler; do not reintroduce a bundler-specific glob.

**Side panel + tabs.** The demo uses the `bpmn-js-side-panel` fork, which **auto-hosts a standard
`bpmn-js-properties-panel` provider as its first "Properties" tab** when the properties panel's own
`parent` is not set — so `BPMNOSPropertiesProvider` stays a normal properties-panel provider yet appears
in the side panel. The **Issues tab** comes from `bpmn-workbench/issues` (self-registering).

**Pasted identifiers** (`src/modules/bpmnos/PasteIdentifiers.js`). Runs at **paste**, not at copy, on
`copyPaste.pasteElement` at priority 500 (after bpmn-js's handler, which is what produces
`descriptor.businessObject`), with the target taken from `descriptor.parent` or the paste root captured at
`copyPaste.pasteElements`. Keeps an identifier free in the target process and replaces only one it holds,
generating the replacement from the prefix up to the last `_`. A `claimed` set spans the paste, since the
registry is not rebuilt between one descriptor and the next. Testable under `node --test`
(`test/paste.test.mjs`) because it imports no bpmn-js. The predecessor `ReplaceIds` was **broken**, not
merely blind: it intercepted `moddleCopy.canCopyProperty` and returned `{ ...values }`, a shallow array over
the *same* moddle objects, so a copy shared the original's content (`status === status`) and the rewrite
renamed the **original's** identifiers on Ctrl+C. Dropping the interception is what restores bpmn-js's own
deep copy (`ModdleCopy.copyProperty` recurses into model elements); bpmn-js leaves BPMNOS identifiers alone
only because `bpmnos:Attribute.id` is a plain `String` attribute rather than `isId`.

**Extension content containers** (`src/modules/bpmnos/utils/RemovalUtil.js`). `removeCustomItemCommands`
returns the commands that remove a piece of content **and every container it leaves empty**, walking up
`$parent` from the content to `bpmn:ExtensionElements` and stopping at the first container that still holds
something. A container goes when every list of it would be empty **and** it holds no value of its own —
derived from `$descriptor.properties` and the values set, not from a list of types, so `bpmnos:Status` and
`bpmnos:Attributes` go while a `bpmnos:Guidance` (type) or `bpmnos:Message` (name, id) stays. Note
`bpmn:ExtensionElements` itself declares `valueRef`/`extensionAttributeDefinition` per the BPMN spec, which
is why the test is *holds* a value rather than *can hold* one. Commands are returned, not executed, so a
caller appends them to its own and the whole removal is **one undo step**. Every remove factory in
`properties/` calls it; the old hand-written variants each got the pruning subtly differently and one
(`TableHandler`) wiped the element's entire `extensionElements`. Model-level (no bpmn-js import), hence
tested under `node --test` in `test/removal.test.mjs`.

**Type change** (`BPMNOSPropertiesUpdater.js`). An **event** that loses its message/timer event definition
loses *all* extension content (`removeExtensionElements`) — deliberate: a changed element needs a different
set and there is no reliable way to tell what is still meant. An **activity** keeps `bpmnos:Status`
(attributes/restrictions/operators are valid on any activity) and loses only type-specific content, its
choices and `bpmnos:Messages`.

**Execution data registry** (`src/modules/bpmnos/ExecutionData.js`). Built from the moddle tree, so
declaration order *is* document order. Per element it holds ordered `status`, `data` and `globals`, each
entry naming its `declaringElement` (so "own" is `declaringElement === element.id`), plus, **per process**,
`id → attribute` and `id → element ids` — the latter is what a `DataUpdate` resolves against at playback.
`byId`/`elementsById` are keyed by process first because an identifier is unique within a process only (each
participant declares `Instance`/`Timestamp`); model-wide maps returned whichever process was walked last and
merged both processes' elements. `processOf` places an element; the collaboration's globals are recorded in
every process's namespace. The service and the collector share one shape: `getAttribute(element, id)`,
`getElements(element, id)`, `getProcesses(element)` on `executionData`, and the pure `getAttribute`,
`getElements`, `spacesOf` over a registry from `collectExecutionData` — the same idiom the identifier
registry uses, so a headless consumer and the modeller ask the same way. Status comes from
`bpmnos:Status` on a process or activity, data from the `bpmn:DataObject`s a **scope** contains (never
from a `bpmn:DataObjectReference`, which per BPMN refers to data rather than owning it, and a model may
hold an object no reference points at), globals from the collaboration. All are inherited by every
descendant, outermost first and a node's own last — the order a token carries them in, verified against
engine logs in `~/Code/bpmnos/BPMNOSInstances.jl`. It rebuilds on `import.done` and `elements.changed` and
fires `executionData.changed`. **A participant id is never shown anywhere; a pool stands for its
process.**

**Annotation box** (`src/modules/bpmnos/BPMNOSAnnotation*.js`). A `bpmn:TextAnnotation` marked
`bpmnos:annotation="visible|hidden"`, attached to its element by a `bpmn:Association` — so dragging,
west/east resizing, position and size come from bpmn-js and persist as ordinary BPMN DI, and the box
appears in SVG exports. Content is derived when the box is rendered and never stored; `bpmn:text` is the user's alone,
neither written nor read by us. The marker's value carries visibility, applied through diagram-js's
`element.hidden`, which leaves geometry untouched so a hidden box returns exactly where it was. Height
follows content and grows *away* from the host (a box above keeps its bottom edge, one below its top edge,
one beside it its centre). Only the header drags; below it the mousedown is suppressed so it cannot
swallow the click that folds a group. Inherited entries fold behind a caret, collapsed by default,
session-only state on the element.

**Annotation box presentation.** Three greys and black: compartment labels (`STATUS`, `DATA`, guidance)
10px dark `#555`, **uppercased at render time** so the model keeps its own casing (bpmnosdoc included);
folds (`inherited (n)`, `owned (n)`) 10px light `#8a8a8a`; an attribute's type 11px dark italic, its name
11px black; a stand-in identifier `#cc0000`. Guidance flips the two: the compartment fold is `emphasis`
(drawn as a label), the `Attributes`/`Operators`/`Restrictions` within it are `subdued` (drawn as folds, not
uppercased). The disclosure mark is `bpmn-js-side-panel`'s **caret path**, not a character — font-independent
and it survives SVG export — rotated 90° when open. A row may carry `fallback` (the whole run is red) or
`fallbackText` (only that trailing run is, used by the objective term, offset by `TYPE_GAP` because a
trailing space is not measured). The objective arrow is U+2794 in the box and in `bpmnosdoc`.

**Objective and weight** (`properties/AttributeEntries.js`). Two traps, both found by running it: the `none`
option carries no value, so the browser hands back its **label** — `setValue` must treat `'none'` as
clearing, and `getValue` maps a stored `objective="none"` to the empty selection. And `TextfieldEntry`
**commits its value as it unmounts**, which is exactly when clearing the objective removes the weight entry,
so the weight setter returns early unless an objective is present. A `validate` must be `useCallback`-stable
or the panel's effect re-validates the *model's* (still valid) value on the next render and wipes the message
— the same reason `IdEntry` memoises its check, and why a refused value shows an error at all.

**`bpmnos/attribute-redeclared`** compares a node's own declarations against the inherited ones **and
against each other**: the engine's `AttributeRegistry::add` throws on a duplicate name among the attributes
visible at a node wherever declared, so two on one element fail to load and are worth reporting while the
model is edited. Id and name stay two faults with two messages, so the name half can be re-graded if
shadowing is ever permitted. The second of a pair is reported, not both. Tested against
`test/fixtures/redeclared-attributes.bpmn`, written for the purpose since the corpus contains no violation.

**Linting** is bpmnlint via `bpmn-js-bpmnlint` (`linting: { bpmnlint: getRules() }`). `src/modules/rules`
composes the set: `rules.json` is the source of truth, mapping each rule **locator** to severity +
rationale — the reused bpmn-workbench essentials (`@bpmn-workbench/bpmn/*.js`, severities adapted) plus
the BPMNOS `engine/*` and `bpmnos/*` rules. `createRules(rules, sources)` (from `bpmn-workbench/rules`)
builds the bundle; `sources` maps `''` → the local rules (`createContext` over explicit imports) and
`'@bpmn-workbench'` → the essentials' exported `ruleContext`. The bundle carries `descriptions` (the
per-subtype `description`/`reference`/`url` in `rules.json`), which the Issues panel reads directly.
BPMNOS severities must be **>= bpmn-workbench's** (never looser).

## Open

- **What the test suite does not cover.** 55 tests over the identifier registry, the execution data
  registry, the removal of empty containers, the naming of pasted content and `attribute-redeclared`. Still
  untested: the other lint rules, the moddle, the `exports` API, and everything that imports bpmn-js and so
  cannot load under Node — `AnnotationContent.js` above all, which decides what the box shows and when an
  entry is marked red. Making that module model-level, as `collectExecutionData` and `RemovalUtil` are,
  would bring it into reach; it needs only `is` and `getBusinessObject`, both of which have model-level
  equivalents. `bpmnosdoc` over the corpus remains the check for the rendering path, and its markdown would
  make usable golden files.
- **Collapsed state is session-only** — whether folding should persist in the file is deliberately
  undecided.
- **How to show `objective` and `weight` is unsettled.** The registry collects both and nothing renders
  them, so the very thing a model optimizes is invisible in box and documentation alike. A compartment of
  contributing attributes on the declaring node was proposed and *not* adopted: the open question is
  globals, which may carry an objective yet belong to no node — `getContributionsToObjective` walks a
  node's own status and data attributes only, so a global's contribution appears nowhere in that account.
  Decide where a global's objective is shown before choosing the shape for the rest.
- **The engine should reject bad loop input rather than ignore it** (a note for `~/Code/bpmnos/engine`, not
  work for this repo). `ExtensionElements.cpp:241-256` assigns the four parameters it knows —
  `cardinality`, `index`, `condition`, `maximum` — and silently drops everything else: an unknown name, a
  parameter belonging to the other kind of loop (`cardinality` on a standard loop, `condition`/`maximum` on
  a multi-instance one), a duplicate (last one wins), a parameter with no expression, and parameters on an
  activity carrying no BPMN loop characteristics at all, which are never read. All of these could throw
  where the file is read, as the constructor already does for an illegal restriction, operator or choice.
  Two further cases throw only when the activity is reached — a multi-instance activity with neither a
  cardinality nor a message (`StateMachine.cpp:433-444`) and a `maximum` without an `index`
  (`Token.cpp:442-446`) — and are decidable at load. `bpmnos/loop-parameters.js` flags all seven here, so
  the lint rule and such an engine check should be kept in step.
- The registry reports operators, restrictions, choices, conditions, timers, loop parameters, messages,
  signals, guidance and lookup tables beside the attributes; what `bpmnosdoc` emits for each of them is
  where it still grows.
- `~/Code/bpmndoc` (C++, Xerces + bpmn++) is superseded by `bpmnosdoc` and can go once the latter covers
  what it emitted.
- **`src/context-pad-compat.js` is a shim to delete on an upstream bump, not before.** It reimplements
  `ContextPad#getPad`, which diagram-js deprecated (`ContextPad.js` warns, cf. bpmn-io/diagram-js#888) but
  bpmn-js still calls — as of bpmn-js 18.21.0 / diagram-js 15.21.0 in
  `features/context-pad/ContextPadProvider.js` (positioning the replace menu) and
  `features/align-elements/AlignElementsContextPadProvider.js`. Without it those calls log a deprecation
  stack on every wrench click; once `getPad` is gone from diagram-js and bpmn-js has stopped calling it,
  they would break instead. **Check those two files after a bpmn-js bump: when neither calls `getPad`, drop
  the shim and its wiring in `src/app.js`.**
- `npm audit` reports toolchain vulnerabilities (Vite/esbuild transitive) — review before relying on it.
