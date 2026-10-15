import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';

import eventType from '../src/modules/rules/engine/event-type.js';
import processStartEvent from '../src/modules/rules/engine/process-start-event.js';
import cancelEvent from '../src/modules/rules/engine/cancel-event.js';
import terminateEvent from '../src/modules/rules/engine/terminate-event.js';
import linkEvent from '../src/modules/rules/engine/link-event.js';
import callActivity from '../src/modules/rules/engine/call-activity.js';
import transaction from '../src/modules/rules/engine/transaction.js';
import typedTask from '../src/modules/rules/engine/typed-task.js';
import multipleEventDefinitions from '../src/modules/rules/engine/multiple-event-definitions.js';
import nonExecutableProcess from '../src/modules/rules/engine/non-executable-process.js';
import scopeOperators from '../src/modules/rules/bpmnos/scope-operators.js';
import defaultAttributes from '../src/modules/rules/bpmnos/default-attributes.js';

import { findById, parse } from './helper.mjs';

function reportsFor(rule, node) {
  const reports = [];

  rule().check(node, { report: (id, message, options) => reports.push({ id, message, ...options }) });

  return reports;
}

/**
 * Every rule is put the whole fixture, element by element, and what it reports is compared with what it
 * should: which elements, and for the rules that distinguish them, which subtype. Stating the whole set
 * rather than one element at a time is what catches a rule reporting something it should have left alone.
 */
function reportsOver(rule, definitions) {
  const reports = [];

  function walk(node) {
    reportsFor(rule, node).forEach(report => reports.push(report.subtype ? `${report.id}:${report.subtype}` : report.id));
    (node.flowElements || []).forEach(walk);
  }

  (definitions.get('rootElements') || [])
    .filter(rootElement => rootElement.$type === 'bpmn:Process')
    .forEach(walk);

  return reports;
}

/**
 * The fixture holds one process the engine runs and one stating each construct it does not, so that a rule
 * is seen both to report what it must and to leave the supported process alone.
 */
describe('engine rules', function() {
  let definitions;

  before(async function() {
    definitions = await parse('engine-limits');
  });

  it('reports a start event of a process the engine cannot start it with', function() {
    assert.deepEqual(reportsOver(eventType, definitions), [ 'TimerStart' ]);
  });

  it('reports every start event where a process has more than one', function() {
    assert.deepEqual(reportsOver(processStartEvent, definitions), [ 'FirstStart', 'SecondStart', 'TimerStart' ]);
  });

  it('reports a cancel event', function() {
    assert.deepEqual(reportsOver(cancelEvent, definitions), [ 'CancelIt' ]);
  });

  it('reports a terminate event', function() {
    assert.deepEqual(reportsOver(terminateEvent, definitions), [ 'TerminateHere' ]);
  });

  it('reports a link event', function() {
    assert.deepEqual(reportsOver(linkEvent, definitions), [ 'JumpFrom' ]);
  });

  it('reports a call activity', function() {
    assert.deepEqual(reportsOver(callActivity, definitions), [ 'CallSomething' ]);
  });

  it('reports a transaction', function() {
    assert.deepEqual(reportsOver(transaction, definitions), [ 'ATransaction' ]);
  });

  it('reports a typed task', function() {
    assert.deepEqual(reportsOver(typedTask, definitions), [ 'AskSomeone' ]);
  });

  it('reports an event carrying two event definitions', function() {
    assert.deepEqual(reportsOver(multipleEventDefinitions, definitions), [ 'TwoDefinitions' ]);
  });

  it('reports a process that is not executable', function() {
    assert.deepEqual(reportsOver(nonExecutableProcess, definitions), [ 'NotExecutable' ]);
  });
});

describe('bpmnos/scope-operators', function() {
  let definitions;

  before(async function() {
    definitions = await parse('engine-limits');
  });

  it('reports operators declared for a scope or a gateway', function() {
    assert.deepEqual(reportsOver(scopeOperators, definitions), [
      'UnsupportedProcess:scope',
      'AdHocWithOperators:scope',
      'GatewayWithOperators:gateway'
    ]);
  });

  it('says nothing about the corpus', async function() {
    for (const name of [ 'earliest-arrival', 'job-shop-scheduling-problem', 'messages' ]) {
      assert.deepEqual(reportsOver(scopeOperators, await parse(name)), []);
    }
  });
});

describe('bpmnos/default-attributes', function() {
  let definitions;

  before(async function() {
    definitions = await parse('engine-limits');
  });

  it('reports what writes a reserved attribute and what declares none', function() {
    assert.deepEqual(reportsOver(defaultAttributes, definitions), [
      'UnsupportedProcess:timestampAdvanced',
      'UnsupportedProcess:instanceAssigned',
      'AdHocWithOperators:timestampAdvanced',
      'UndeclaredProcess:timestampMissing',
      'UndeclaredProcess:instanceMissing'
    ]);
  });

  it('leaves a regular task free to advance the timestamp, which is how its duration is modelled', function() {
    assert.deepEqual(reportsFor(defaultAttributes, findById(definitions, 'PlainTask')), []);
  });

  it('says nothing about the corpus', async function() {
    for (const name of [ 'earliest-arrival', 'job-shop-scheduling-problem', 'messages', 'redeclared-attributes' ]) {
      assert.deepEqual(reportsOver(defaultAttributes, await parse(name)), []);
    }
  });
});
