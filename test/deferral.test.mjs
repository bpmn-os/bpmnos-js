import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, beforeEach } from 'node:test';

import { BpmnModdle } from 'bpmn-moddle';

import { getDeferral, getDeferralHolder } from '../src/modules/bpmnos/utils/DeferralUtil.js';
import { removeCustomItemCommands } from '../src/modules/bpmnos/utils/RemovalUtil.js';

import { findById, parse } from './helper.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const ELEMENT = { id: 'element' };

function guidanceOf(node) {
  return node.get('extensionElements').get('values').find(value => value.$type === 'bpmnos:Guidance');
}

function deferralAt(definitions, id) {
  const node = findById(definitions, id);
  const holder = getDeferralHolder(node, guidanceOf(node));

  return holder && getDeferral(holder);
}

// what the commands say, in the form the assertions are written against
function described(commands) {
  return commands.map(({ context }) => ({
    type: context.moddleElement.$type,
    properties: Object.fromEntries(Object.entries(context.properties)
      .map(([ key, value ]) => [ key, Array.isArray(value) ? value.length : value ]))
  }));
}

/**
 * The fixture states a deferral at the performer of the process, shared by the two tasks of the ad-hoc
 * subprocess `Shared`, none at the performer of the ad-hoc subprocess `OwnPerformer`, and one in the choice
 * guidance of a decision task and in the message guidance of a receive task.
 */
describe('deferral', function() {
  let definitions;

  beforeEach(async function() {

    // parsed anew for each test, since the commands are read against a tree the tests reshape
    definitions = await parse('deferral');
  });

  it('is read from the performer for an entry guidance and shared by every sequential activity of it', function() {
    const deferral = deferralAt(definitions, 'SharedTask');

    assert.equal(deferral.get('condition'), 'count < 3');
    assert.equal(deferralAt(definitions, 'OtherSharedTask'), deferral);
    assert.equal(deferral.$parent.$parent, findById(definitions, 'Deferrals').get('resources')[0]);
  });

  it('is absent at a performer stating none', function() {
    const node = findById(definitions, 'OwnPerformerTask');

    assert.equal(getDeferralHolder(node, guidanceOf(node)).$type, 'bpmn:Performer');
    assert.equal(deferralAt(definitions, 'OwnPerformerTask'), undefined);
  });

  it('is read from a choice guidance with its observed attributes in the order stated', function() {
    const deferral = deferralAt(definitions, 'ChoiceTask');

    assert.equal(deferral.get('condition'), 'time < 10');
    assert.deepEqual(deferral.get('parameter').map(parameter => [ parameter.get('name'), parameter.get('value') ]),
      [ [ 'observable', 'count' ], [ 'observable', 'time' ] ]);
  });

  it('is read from a message guidance', function() {
    assert.equal(deferralAt(definitions, 'ReceiveTask').get('condition'), 'count > 0');
  });

  it('survives export and import unchanged', async function() {
    const moddle = new BpmnModdle({
      bpmnos: JSON.parse(fs.readFileSync(path.join(HERE, '../src/modules/bpmnos/bpmnos.json'), 'utf8'))
    });
    const { xml } = await moddle.toXML(definitions);
    const { rootElement } = await moddle.fromXML(xml);

    for ( const id of [ 'SharedTask', 'ChoiceTask', 'ReceiveTask' ] ) {
      const before = deferralAt(definitions, id), after = deferralAt(rootElement, id);

      assert.equal(after.get('condition'), before.get('condition'));
      assert.deepEqual(after.get('parameter').map(parameter => parameter.get('value')),
        before.get('parameter').map(parameter => parameter.get('value')));
    }
  });

  it('is kept with its condition when its last observed attribute is removed', function() {
    const deferral = deferralAt(definitions, 'ReceiveTask');

    assert.deepEqual(described(removeCustomItemCommands(ELEMENT, deferral.get('parameter')[0])), [
      { type: 'bpmnos:Deferral', properties: { parameter: 0 } }
    ]);
  });

  it('is removed from its guidance, which keeps its type', function() {
    const deferral = deferralAt(definitions, 'ChoiceTask');

    assert.deepEqual(described(removeCustomItemCommands(ELEMENT, deferral)), [
      { type: 'bpmnos:Guidance', properties: { deferral: 0 } }
    ]);
  });

  it('is removed from the performer together with the extension elements it leaves empty', function() {
    const deferral = deferralAt(definitions, 'SharedTask');

    assert.deepEqual(described(removeCustomItemCommands(ELEMENT, deferral)), [
      { type: 'bpmn:Performer', properties: { extensionElements: undefined } }
    ]);
  });
});
