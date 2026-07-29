import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import { removeCustomItemCommands } from '../src/modules/bpmnos/utils/RemovalUtil.js';

import { findAll, findById, parse } from './helper.mjs';

const ELEMENT = { id: 'TaskActivity' };

// what the commands say, in the form the assertions are written against
function described(commands) {
  return commands.map(({ cmd, context }) => ({
    cmd,
    type: context.moddleElement.$type,
    properties: Object.fromEntries(Object.entries(context.properties)
      .map(([ key, value ]) => [ key, Array.isArray(value) ? value.length : value ]))
  }));
}

describe('removeCustomItemCommands', function() {
  let definitions, status, attributes;

  beforeEach(async function() {

    // parsed anew for each test, since the commands are read against a tree the tests reshape
    definitions = await parse('job-shop-scheduling-problem');

    const task = findById(definitions, 'TaskActivity');

    status = task.get('extensionElements').get('values').find(value => value.$type === 'bpmnos:Status');
    attributes = status.get('attributes')[0];
  });

  it('shrinks the list when something is left in it', function() {
    const [ attribute ] = attributes.get('attribute');

    assert.deepEqual(described(removeCustomItemCommands(ELEMENT, attribute)), [
      { cmd: 'element.updateModdleProperties', type: 'bpmnos:Attributes', properties: { attribute: 2 } }
    ]);
  });

  it('removes the containers the last child leaves empty, and stops at the first that is not', function() {
    attributes.attribute = attributes.get('attribute').slice(0, 1);

    // the attribute empties bpmnos:Attributes, which empties bpmnos:Status, but the element still carries
    // its loop characteristics, so bpmn:ExtensionElements survives with that one value
    assert.deepEqual(described(removeCustomItemCommands(ELEMENT, attributes.get('attribute')[0])), [
      { cmd: 'element.updateModdleProperties', type: 'bpmn:ExtensionElements', properties: { values: 1 } }
    ]);
  });

  it('removes bpmn:ExtensionElements itself when the last extension goes with it', function() {
    const extensionElements = findById(definitions, 'TaskActivity').get('extensionElements');

    extensionElements.values = [ status ];
    attributes.attribute = attributes.get('attribute').slice(0, 1);

    assert.deepEqual(described(removeCustomItemCommands(ELEMENT, attributes.get('attribute')[0])), [
      { cmd: 'element.updateModdleProperties', type: 'bpmn:SubProcess', properties: { extensionElements: undefined } }
    ]);
  });

  it('keeps a container that carries something of its own', function() {
    const [ message ] = findAll(definitions, 'bpmnos:Message').filter(m => (m.get('content') || []).length);

    message.content = message.get('content').slice(0, 1);

    // a message has a name and an id, so an empty content list does not make it meaningless
    assert.deepEqual(described(removeCustomItemCommands(ELEMENT, message.get('content')[0])), [
      { cmd: 'element.updateModdleProperties', type: 'bpmnos:Message', properties: { content: 0 } }
    ]);
  });

  it('reports nothing for content that is held by nothing', function() {
    const [ attribute ] = attributes.get('attribute');

    attribute.$parent = undefined;

    assert.deepEqual(removeCustomItemCommands(ELEMENT, attribute), []);
  });

  it('reports nothing for content its parent does not hold', function() {
    const [ attribute ] = attributes.get('attribute');

    attributes.attribute = attributes.get('attribute').slice(1);

    assert.deepEqual(removeCustomItemCommands(ELEMENT, attribute), []);
  });
});
