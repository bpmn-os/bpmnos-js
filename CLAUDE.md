# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

Working. A Vite demo app (`npm run dev`) wires a modern bpmn-js modeller with the BPMNOS extension, a
Properties tab, and an Issues tab. The three BPMNOS modules were extracted from the (archived) modeller
and are exposed via a package `exports` API. The essential rules and the Issues tab are consumed from
bpmn-workbench; the BPMNOS-specific lint rules are added on top. All source is ESM and bundler-agnostic
(no webpack `require.context`, no Vite-only `import.meta.glob`), so the package is publishable under any
bundler.

## Commands

```sh
npm install
npm run dev       # Vite dev server (HMR)
npm run build     # production build → dist/
npm run preview   # serve the production build
npm test          # node --test test/*.test.mjs  (no tests yet)
```

Runtime smoke test (no browser test harness yet): with `npm run dev` running, `google-chrome
--headless=new --dump-dom --virtual-time-budget=12000 http://localhost:5173/` and check the DOM for
`djs-container`, the `Properties`/`Issues` side-panel tabs, and `bjsl-` (lint output).

## What this project is

`bpmnos-js` provides **reusable [bpmn-js](https://github.com/bpmn-io/bpmn-js) modules for BPMN-OS** (BPMN
for optimization and simulation), for any bpmn-js host. Exposed via the package `exports` map:

- **`.`** — the full BPMNOS DI module: the decision-task decorator + activity replace menu, the
  properties panel, and the extension-element id replacer (`ReplaceIds`).
- **`./moddle`** (`bpmnos.json`) — the `bpmnos:` moddle extension (decisions, attributes, restrictions,
  operators, messages, guidance, allocations, lookup tables, etc.).
- **`./decision-task`** — the decision-task renderer + `ActivityPopupMenu` (the type-change funnel and the
  decision task).
- **`./properties`** — a `@bpmn-io/properties-panel` provider (`BPMNOSPropertiesProvider` + updater),
  surfaced **as a tab in a `bpmn-js-side-panel`**.

It also ships a **demo modeller** (`src/app.js`) wiring these with the Issues panel and Properties tab.
Simulation is out of scope here — it belongs to bpmn-workbench / a future workbench.

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

**Build: Vite** (`vite.config.js`). The properties panel is authored in **preact JSX** inside `.js`
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

**Linting** is bpmnlint via `bpmn-js-bpmnlint` (`linting: { bpmnlint: getRules() }`). `src/modules/rules`
composes the set: `rules.json` is the source of truth, mapping each rule **locator** to severity +
rationale — the reused bpmn-workbench essentials (`@bpmn-workbench/bpmn/*.js`, severities adapted) plus
the BPMNOS `engine/*` and `bpmnos/*` rules. `createRules(rules, sources)` (from `bpmn-workbench/rules`)
builds the bundle; `sources` maps `''` → the local rules (`createContext` over explicit imports) and
`'@bpmn-workbench'` → the essentials' exported `ruleContext`. The bundle carries `descriptions` (the
per-subtype `description`/`reference`/`url` in `rules.json`), which the Issues panel reads directly.
BPMNOS severities must be **>= bpmn-workbench's** (never looser).

## Open

- **No test suite** (`npm test` matches nothing). Add `test/*.test.mjs` covering the rules, the moddle,
  and the `exports` API.
- `npm audit` reports toolchain vulnerabilities (Vite/esbuild transitive) — review before relying on it.
