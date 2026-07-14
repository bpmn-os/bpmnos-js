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
  so a sub-process never becomes a typed task directly. Turning a flow sub-process into an event
  sub-process is opt-in via `activityPopupMenu: { supportEventSubProcess: true }`.
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
npm start        # build, then watch (webpack + lessc) and serve dist/
npm run bundle   # one-off build to dist/
```

## License

MIT. See [LICENSE](LICENSE).
