// The BPMNOS model-checking rule set. `rules.json` is the source of truth: it reuses bpmn-workbench's
// essential rules (`@bpmn-workbench/bpmn/*.js`, with severities adapted for optimization/simulation) and
// adds the BPMNOS-specific `engine/*` and `bpmnos/*` rules — no rule .js is copied from bpmn-workbench.
// The bundle carries the rule descriptions, so the Issues panel needs no extra wiring.

import { createRules, createContext, ruleContext } from "bpmn-workbench/rules";
import rules from "./rules.json";

// This package's rule implementations, imported explicitly and assembled into a context with
// createContext. No require.context or import.meta.glob, so the module is bundler-agnostic (works under
// webpack, Vite, Rollup, Node). Keys are locators relative to this directory, matching the paths
// createRules derives from rules.json.
import * as nonExecutableProcess from "./engine/non-executable-process.js";
import * as typedTask from "./engine/typed-task.js";
import * as eventType from "./engine/event-type.js";
import * as multipleEventDefinitions from "./engine/multiple-event-definitions.js";
import * as callActivity from "./engine/call-activity.js";
import * as transaction from "./engine/transaction.js";
import * as inclusiveGateway from "./engine/inclusive-gateway.js";
import * as defaultAttributes from "./bpmnos/default-attributes.js";
import * as attributeRedeclared from "./bpmnos/attribute-redeclared.js";
import * as attributeUndeclared from "./bpmnos/attribute-undeclared.js";
import * as gatekeeperRestrictions from "./bpmnos/gatekeeper-restrictions.js";
import * as allocation from "./bpmnos/allocation.js";

// Rule sources: '' = this package's local rules (engine/**, bpmnos/**); '@bpmn-workbench' = the
// essential rules, via the context bpmn-workbench exports.
const sources = {
  "": createContext({
    "./engine/non-executable-process.js": nonExecutableProcess,
    "./engine/typed-task.js": typedTask,
    "./engine/event-type.js": eventType,
    "./engine/multiple-event-definitions.js": multipleEventDefinitions,
    "./engine/call-activity.js": callActivity,
    "./engine/transaction.js": transaction,
    "./engine/inclusive-gateway.js": inclusiveGateway,
    "./bpmnos/default-attributes.js": defaultAttributes,
    "./bpmnos/attribute-redeclared.js": attributeRedeclared,
    "./bpmnos/attribute-undeclared.js": attributeUndeclared,
    "./bpmnos/gatekeeper-restrictions.js": gatekeeperRestrictions,
    "./bpmnos/allocation.js": allocation
  }),
  "@bpmn-workbench": ruleContext
};

export function getRules() {
  return createRules(rules, sources);
}

export default getRules;
