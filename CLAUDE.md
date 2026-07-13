# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

Scaffolded and building. A webpack + less demo app runs (`npm start`), wiring a modern bpmn-js modeller
with the BPMNOS extension, a Properties tab, and an Issues tab. The BPMNOS modules and all lint rules
have been **copied verbatim from the (to-be-archived) modeller** as a starting point; the "revise later"
passes below (dedupe vs bpmn-workbench, adapt severities, package `exports`) are not done yet.

## Commands

```sh
npm install
npm start        # bundle, then watch (webpack + lessc) and serve dist/ (sirv)
npm run bundle   # one-off build → dist/
npm test         # node --test test/*.test.mjs  (no tests yet)
```

Runtime smoke test (no browser test harness yet): `npx sirv dist --port 5055 &` then
`google-chrome --headless=new --dump-dom --virtual-time-budget=12000 http://localhost:5055/` and check the
DOM for `djs-container`, the `Properties`/`Issues` side-panel tabs, and `bjsl-issues` (lint output).

## What this project is

`bpmnos-js` provides **reusable [bpmn-js](https://github.com/bpmn-io/bpmn-js) modules for BPMN-OS**
(BPMN for optimization and simulation), to be included in any bpmn-js host. Three modules:

1. **BPMNOS moddle** — the `bpmnos:` moddle extension (`bpmnos.json`) describing decisions, attributes,
   restrictions, operators, messages, guidance, allocations, lookup tables, etc.
2. **Decision task decorator** — a custom renderer (`BpmnRenderer` subclass) that draws the decision-task
   glyph, plus its popup menu / context-pad wiring.
3. **Property panel** — a `@bpmn-io/properties-panel` provider (`BPMNOSPropertiesProvider` +
   updater) surfaced **as a tab in a `bpmn-js-side-panel`** (dependency
   `github:bpmn-os/bpmn-js-side-panel`).

It also ships a **demo modeller** wiring these together with an **Issues panel** and the **property
panel** tab. Simulation is explicitly **out of scope** here — it belongs to a future `bpmnos-workbench`.

## Sibling projects (in `~/Code` and `~/Code/bpmnos`)

Read these to port from / depend on. Match their conventions rather than inventing new ones.

- **`~/Code/bpmnos/modeller`** (`bpmnos-modeller`) — **being archived; this project supersedes it.** It is
  the **source of the BPMNOS code to extract**: `src/modules/bpmnos/` (moddle `bpmnos.json`,
  `DecisionTaskDecorator.js`, `DecisionTaskPopupMenu.js`, `BPMNOSPropertiesProvider.js`,
  `BPMNOSPropertiesUpdater.js`, `properties/*`, `utils/*`) and the BPMNOS-specific lint rules under
  `src/modules/linting/engine/` and `src/modules/linting/execution/`.
- **`~/Code/bpmn-workbench`** (`bpmn-workbench`) — **already owns the Issues panel and the essential
  rules; consume it, do not re-implement.** It exposes package exports `bpmn-workbench/issues` (a
  self-registering "Issues" side-panel tab) and `bpmn-workbench/rules` (the essential BPMN model-checking
  rules + the bpmnlint config composer). This is the reference for module structure and the newer,
  cleaner patterns (e.g. `flow-conditions`, `process-start-event`, `sub-process-start-event`,
  `no-duplicate-sequence-flows` replaced the modeller's older equivalents).

## Architecture / key patterns

Everything is a **bpmn-js/diagram-js DI module**: an object `{ __init__: [...], serviceName: [ 'type',
Ctor ] }` added to `BpmnModeler`'s `additionalModules`. See `src/modules/bpmnos/index.js`. Services
resolve each other lazily via the injector; optional deps use the non-strict form
`injector.get(name, false)` so a module no-ops when a host lacks a service.

**Side panel + tabs.** The demo (`src/app.js`) uses the `bpmn-js-side-panel` fork
(`github:bpmn-os/bpmn-js-side-panel`), which **auto-hosts a standard `bpmn-js-properties-panel` provider
as its first "Properties" tab** when you do *not* set the properties panel's own `parent`. So the BPMNOS
properties panel stays a normal properties-panel provider (`propertiesPanel.registerProvider`, in
`BPMNOSPropertiesProvider.js`) yet appears in the side panel — satisfying the "compatible with
bpmn-js-properties-panel AND works in a side-panel tab" goal with no custom code. The **Issues tab** is
consumed from `bpmn-workbench/issues` (`IssuesPanelModule`, self-registering) — bpmn-workbench owns it;
do not re-implement. The properties panel is authored in **preact JSX**, so webpack needs the babel JSX
transform + `react → @bpmn-io/properties-panel/preact/compat` alias (see `webpack.config.js`).

**Linting** is bpmnlint, wired through `bpmn-js-bpmnlint` (`linting: { bpmnlint: getLintConfig() }`).
Rules are grouped into named **plugins** (`essential`, `engine`, `execution`); a rule id is
`<plugin>/<rule>`. `createLintConfig({ rules, plugins })` builds a browser-resolvable bundle where
`rules` maps `<plugin>/<rule>` → severity (`error` | `warn` | `info`) and `plugins` supplies the
implementations. bpmn-workbench separates **severity + rationale into `rule-meta.json`** (keyed by rule
id, with per-subtype `description`/`reference`/`url`), then derives two maps: `severitiesOf(meta)` →
`createLintConfig`, and `descriptionsOf(meta)` → the Issues panel's `descriptions` config. Follow that
meta-driven approach.

## The porting work (core of this project)

- **Extract** the three BPMNOS modules from `modeller/src/modules/bpmnos/` into reusable,
  independently-importable modules here.
- **Consume** `bpmn-workbench/rules` (essential rules) and `bpmn-workbench/issues` (Issues tab) rather
  than copying them.
- **Add the BPMNOS-specific lint rules** the current modeller carries on top of the essential set — the
  `engine/` plugin (`non-executable-process`, `typed-task`, `event-type`,
  `multiple-event-definitions`, `call-activity`, `transaction`, `complex-gateway`, `inclusive-gateway`,
  … note several are commented out in the modeller's `linting/index.js`) and the `execution/` plugin
  (`default-attributes`, `attribute-redeclared`, `attribute-undeclared`, `gatekeeper-restrictions`,
  `allocation`). Compose them as additional plugins/tiers alongside the essential rules.
- **Adapt issue severities** relative to the modeller's config (`modeller/src/modules/linting/index.js`)
  — express the adapted severities + rationales as a BPMNOS `rule-meta.json` in the workbench shape.

## Packaging the reusable modules (not done yet)

Currently only the demo app is wired; the BPMNOS modules aren't yet exposed as a package API. To make
them reusable, mirror bpmn-workbench's `exports` map (e.g. `./moddle`, `./decision-task`, `./properties`)
so hosts import individual modules, and add a test suite (`node --test test/*.test.mjs`).

## Follow-up: event sub-process dependency

The demo depends on `bpmn-js-collapse-event-subprocess` (^0.2.2) and lacks a "create event sub-process"
palette entry. That package is being consolidated into a new `bpmn-js-event-subprocess` package (palette
+ collapse modules; the old one deprecated). When it lands, **swap the dependency to
`bpmn-js-event-subprocess`** and register both modules.
