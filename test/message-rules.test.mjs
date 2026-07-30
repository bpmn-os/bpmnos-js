import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';

import messageHeader from '../src/modules/rules/bpmnos/message-header.js';
import messageCandidate from '../src/modules/rules/bpmnos/message-candidate.js';

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
 * The faults are stated in a fixture written for them: three participants, a message flow drawn from one
 * send task to one receive task, and a message for each way a model can fail to say what it exchanges.
 */
describe('bpmnos/message-header', function() {
  let definitions;

  before(async function() {
    definitions = await parse('messages');
  });

  it('accepts an attribute and a quoted string', function() {
    assert.deepEqual(reportsFor(messageHeader, findById(definitions, 'SendRequest')), []);
  });

  it('accepts a parameter without a value', function() {
    assert.deepEqual(reportsFor(messageHeader, findById(definitions, 'ReceiveIllegal')), []);
  });

  it('reports a value that is neither an attribute nor a quoted string', function() {
    const reports = reportsFor(messageHeader, findById(definitions, 'SendIllegal'));

    assert.equal(reports.length, 1);
    assert.equal(reports[0].subtype, 'illegalValue');
    assert.match(reports[0].message, /'machine' of message 'Illegal' states 'count \+ 1'/);
  });

  it('reports an identifier that is not a string', function() {
    const reports = reportsFor(messageHeader, findById(definitions, 'SendToNumber'));

    assert.equal(reports.length, 1);
    assert.equal(reports[0].subtype, 'identifierNotString');
    assert.match(reports[0].message, /'recipient' of message 'Numbered' must state a string/);
  });

  it('says nothing about an element that exchanges no message', function() {
    assert.deepEqual(reportsFor(messageHeader, findById(definitions, 'SendingProcess')), []);
  });
});

describe('bpmnos/message-candidate', function() {
  let definitions, corpus;

  before(async function() {
    definitions = await parse('messages');
    corpus = await parse('job-shop-scheduling-problem');
  });

  it('accepts a pair agreeing in name, keys and types', function() {
    assert.deepEqual(reportsFor(messageCandidate, findById(definitions, 'SendRequest')), []);
    assert.deepEqual(reportsFor(messageCandidate, findById(definitions, 'ReceiveRequest')), []);
  });

  it('accepts a key that states no type against a key that states one', function() {
    assert.deepEqual(reportsFor(messageCandidate, findById(definitions, 'ReceiveIllegal')), []);
  });

  it('reports a message no event catches', function() {
    const reports = reportsFor(messageCandidate, findById(definitions, 'SendUnheard'));

    assert.equal(reports.length, 1);
    assert.equal(reports[0].subtype, 'noRecipient');
    assert.match(reports[0].message, /Message 'Unheard' is exchanged with no catching event/);
  });

  it('reports both sides where the same key holds values of different types', function() {
    assert.equal(reportsFor(messageCandidate, findById(definitions, 'SendCounted'))[0].subtype, 'noRecipient');
    assert.equal(reportsFor(messageCandidate, findById(definitions, 'ReceiveLabelled'))[0].subtype, 'noSender');
  });

  it('reports an event the message flows keep from the only sender that agrees', function() {
    const reports = reportsFor(messageCandidate, findById(definitions, 'ReceiveElsewhere'));

    assert.equal(reports.length, 1);
    assert.equal(reports[0].subtype, 'noSender');
  });

  it('reports a message event without a message', function() {
    const reports = reportsFor(messageCandidate, findById(definitions, 'CatchWithoutMessage'));

    assert.equal(reports.length, 1);
    assert.equal(reports[0].subtype, 'noMessage');
  });

  it('says nothing about the corpus', function() {
    [ 'RequestTask', 'CatchRequestMessage', 'ThrowCompletionMessage', 'NoticeTaskCompletion' ].forEach(function(id) {
      const node = findById(corpus, id);

      assert.ok(node, `${id} is in the fixture`);
      assert.deepEqual(reportsFor(messageCandidate, node), [], id);
      assert.deepEqual(reportsFor(messageHeader, node), [], id);
    });
  });
});
