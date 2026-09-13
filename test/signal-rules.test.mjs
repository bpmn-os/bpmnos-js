import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';

import eventTrigger from '../src/modules/rules/bpmnos/event-trigger.js';
import signalSelfTrigger from '../src/modules/rules/bpmnos/signal-self-trigger.js';

import { findById, parse } from './helper.mjs';

/**
 * A rule is a function of the moddle tree, so it is put the elements directly and its reports collected,
 * rather than run through bpmnlint.
 */
function reportsFor(rule, node) {
  const reports = [];

  rule().check(node, { report: (id, message, options) => reports.push({ id, message, ...options }) });

  return reports;
}

/**
 * The fixture states each way a signal can be written wrongly beside one written rightly: a process
 * instantiated by a signal another process throws, a process throwing the signal that instantiates itself,
 * and events carrying a signal event definition but no signal.
 */
describe('bpmnos/event-trigger, signals', function() {
  let definitions;

  before(async function() {
    definitions = await parse('signals');
  });

  it('accepts a throwing event that names its signal', function() {
    assert.deepEqual(reportsFor(eventTrigger, findById(definitions, 'ThrowTrigger')), []);
  });

  it('accepts a signal start event that names its signal', function() {
    assert.deepEqual(reportsFor(eventTrigger, findById(definitions, 'TriggerStart')), []);
  });

  it('reports a throwing event without a signal', function() {
    const reports = reportsFor(eventTrigger, findById(definitions, 'ThrowUndefined'));

    assert.equal(reports.length, 1);
    assert.equal(reports[0].subtype, 'signal');
    assert.match(reports[0].message, /Signal event without a signal/);
  });

  it('reports a catching event without a signal', function() {
    const reports = reportsFor(eventTrigger, findById(definitions, 'CatchUndefined'));

    assert.equal(reports.length, 1);
    assert.equal(reports[0].subtype, 'signal');
  });

  it('says nothing about an event carrying no signal event definition', function() {
    assert.deepEqual(reportsFor(eventTrigger, findById(definitions, 'EmitterStart')), []);
  });
});

describe('bpmnos/signal-self-trigger', function() {
  let definitions;

  before(async function() {
    definitions = await parse('signals');
  });

  it('reports the throw that instantiates its own process', function() {
    const reports = reportsFor(signalSelfTrigger, findById(definitions, 'SelfTriggeringProcess'));

    assert.equal(reports.length, 1);
    assert.equal(reports[0].id, 'ThrowLoop');
    assert.equal(reports[0].subtype, 'selfTrigger');
    assert.match(reports[0].message, /Signal 'Loop' instantiates the process throwing it/);
  });

  it('says nothing where the signal thrown instantiates another process', function() {
    assert.deepEqual(reportsFor(signalSelfTrigger, findById(definitions, 'EmittingProcess')), []);
  });

  it('says nothing about the process the signal instantiates, which throws nothing', function() {
    assert.deepEqual(reportsFor(signalSelfTrigger, findById(definitions, 'TriggeredProcess')), []);
  });

  it('says nothing about the corpus', async function() {
    for (const name of [ 'earliest-arrival', 'job-shop-scheduling-problem', 'messages' ]) {
      const corpus = await parse(name);

      (corpus.get('rootElements') || [])
        .filter(rootElement => rootElement.$type === 'bpmn:Process')
        .forEach(process => assert.deepEqual(reportsFor(signalSelfTrigger, process), []));
    }
  });
});
