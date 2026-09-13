import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';

import messageHeader from '../src/modules/rules/bpmnos/message-header.js';
import messageCandidate from '../src/modules/rules/bpmnos/message-candidate.js';

import { findById, parse } from './helper.mjs';

function reportsFor(rule, node) {
  const reports = [];

  rule().check(node, { report: (id, message, options) => reports.push({ id, message, ...options }) });

  return reports;
}

/**
 * A message instantiating a process is matched by its name alone, the instance not existing before it
 * arrives. The fixture states each way that can be contradicted beside the way it is written rightly: a
 * process instantiated by `Order`, an element throwing it plainly, elements throwing it with a header key
 * and with a recipient, a second element catching the name, and a start event stating a header of its own.
 */
describe('bpmnos/message-header, instantiating messages', function() {
  let definitions;

  before(async function() {
    definitions = await parse('triggering-messages');
  });

  it('accepts a message start event stating no header parameter', function() {
    assert.deepEqual(reportsFor(messageHeader, findById(definitions, 'OrderStart')), []);
  });

  it('accepts an element throwing it that states no header parameter', function() {
    assert.deepEqual(reportsFor(messageHeader, findById(definitions, 'PlaceOrder')), []);
  });

  it('reports a header parameter at the message start event', function() {
    const reports = reportsFor(messageHeader, findById(definitions, 'DeliveryStart'));

    assert.equal(reports.length, 1);
    assert.equal(reports[0].subtype, 'triggerHeader');
    assert.match(reports[0].message, /must state no header parameter, message 'Delivery' being matched by its name alone/);
  });

  it('reports a header key at an element throwing it', function() {
    const reports = reportsFor(messageHeader, findById(definitions, 'PlaceOrderWithKey'));

    assert.equal(reports.length, 1);
    assert.equal(reports[0].subtype, 'triggerHeader');
    assert.match(reports[0].message, /instantiates process 'TriggeredProcess'/);
  });

  it('reports a recipient at an element throwing it', function() {
    const reports = reportsFor(messageHeader, findById(definitions, 'PlaceOrderWithRecipient'));

    assert.equal(reports.length, 1);
    assert.equal(reports[0].subtype, 'triggerRecipient');
    assert.match(reports[0].message, /the instance not existing until it arrives/);
  });
});

describe('bpmnos/message-candidate, instantiating messages', function() {
  let definitions;

  before(async function() {
    definitions = await parse('triggering-messages');
  });

  it('accepts the start event the message instantiates', function() {
    assert.deepEqual(reportsFor(messageCandidate, findById(definitions, 'OrderStart')), []);
  });

  it('reports a second element catching the name', function() {
    const reports = reportsFor(messageCandidate, findById(definitions, 'CatchOrder'));

    assert.equal(reports.length, 1);
    assert.equal(reports[0].subtype, 'triggerCaughtElsewhere');
    assert.match(reports[0].message, /must be caught by its start event alone/);
  });

  it('says nothing about an element throwing it, several senders being permitted', function() {
    assert.deepEqual(reportsFor(messageCandidate, findById(definitions, 'PlaceOrder')), []);
  });
});
