// The BPMNOS model-checking rule set. `rules.json` is the source of truth: it reuses bpmn-workbench's
// essential rules (`@bpmn-workbench/bpmn/*.js`, with severities adapted for optimization/simulation) and
// adds the BPMNOS-specific `engine/*` and `bpmnos/*` rules — no rule .js is copied from bpmn-workbench.
// The bundle carries the rule descriptions, so the Issues panel needs no extra wiring.

import { createRules, ruleContext } from "bpmn-workbench/rules";
import rules from "./rules.json";

// Rule sources: '' = this package's local rules (engine/**, bpmnos/**); '@bpmn-workbench' = the
// essential rules, via the context bpmn-workbench exports (require.context is resolved where written).
const sources = {
  "": require.context("./", true, /\.js$/),
  "@bpmn-workbench": ruleContext
};

export function getRules() {
  return createRules(rules, sources);
}

export default getRules;
