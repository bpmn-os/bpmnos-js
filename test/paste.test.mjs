import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import PasteIdentifiers from '../src/modules/bpmnos/PasteIdentifiers.js';

import { eventBusStub, findById, parse } from './helper.mjs';

const TARGET = { id: 'MachineProcess' };

/**
 * The service is fed the descriptors a paste produces and a stand-in registry, so that what it asks and what
 * it writes can both be stated. A registry of its own is what makes the two rules separable: an identifier
 * the target process holds is replaced, one it does not hold is kept.
 */
describe('PasteIdentifiers', function() {
  let definitions, generated;

  function registryHolding(...taken) {
    generated = 0;

    return {
      isTaken: (element, identifier) => taken.includes(identifier),
      nextId: (element, prefix) => `${prefix}${++generated}`
    };
  }

  // one paste is one `elements.create`; a command event carries the command's context beside it, which is
  // the shape diagram-js fires and therefore the shape the service must read
  function paste(identifiers, ...businessObjects) {
    const eventBus = eventBusStub();

    PasteIdentifiers(eventBus, identifiers);

    eventBus.fire('commandStack.elements.create.preExecute', {
      context: {
        elements: businessObjects.map(businessObject => ({ businessObject })),
        parent: TARGET
      }
    });
  }

  // the attributes of a copied element, as a paste hands them over: real moddle objects, so `get` and `set`
  // behave as they do in the modeller
  function attributesOf(businessObject) {
    return businessObject.get('extensionElements').get('values')
      .find(value => value.$type === 'bpmnos:Status')
      .get('attributes')[0].get('attribute');
  }

  beforeEach(async function() {
    definitions = await parse('job-shop-scheduling-problem');
  });

  it('keeps an identifier the target process does not hold', function() {
    const businessObject = findById(definitions, 'TaskActivity');

    paste(registryHolding('SomethingElse'), businessObject);

    assert.deepEqual(attributesOf(businessObject).map(attribute => attribute.get('id')),
      [ 'Index', 'RequestedMachine', 'Duration' ]);
  });

  it('replaces an identifier the target process holds, keeping the name it is recognised by', function() {
    const businessObject = findById(definitions, 'TaskActivity');

    paste(registryHolding('Index', 'Duration'), businessObject);

    const [ index, requestedMachine, duration ] = attributesOf(businessObject)
      .map(attribute => attribute.get('id'));

    assert.equal(index, 'Index_1');
    assert.equal(requestedMachine, 'RequestedMachine');
    assert.equal(duration, 'Duration_2');
  });

  it('replaces the suffix rather than appending to it', function() {
    const businessObject = findById(definitions, 'ConductTask');

    // the operator of the fixture is `Operator_3pf5m16`, so the prefix it is generated from is `Operator_`
    paste(registryHolding('Operator_3pf5m16'), businessObject);

    const operator = businessObject.get('extensionElements').get('values')
      .find(value => value.$type === 'bpmnos:Status')
      .get('operators')[0].get('operator')[0];

    assert.equal(operator.get('id'), 'Operator_1');
  });

  it('does not hand the same identifier to two elements of one paste', async function() {

    // two elements of one paste, each carrying `Index`, which a second parse of the fixture provides
    const first = findById(definitions, 'TaskActivity'),
          second = findById(await parse('job-shop-scheduling-problem'), 'TaskActivity');

    // free in the target, so both would keep `Index` were what has been given out not remembered
    const identifiers = {
      isTaken: () => false,
      nextId: (element, prefix) => `${prefix}${++generated}`
    };
    generated = 0;

    paste(identifiers, first, second);

    assert.notDeepEqual(
      attributesOf(first).map(attribute => attribute.get('id')),
      attributesOf(second).map(attribute => attribute.get('id')));
  });

  it('starts afresh at the next paste', function() {
    const businessObject = findById(definitions, 'TaskActivity');
    const identifiers = registryHolding('Index');

    paste(identifiers, businessObject);
    assert.equal(attributesOf(businessObject)[0].get('id'), 'Index_1');

    // `Index_1` is no longer held back by a paste that has not given it out
    paste(identifiers, businessObject);
    assert.equal(attributesOf(businessObject)[0].get('id'), 'Index_1');
  });

  it('names nothing when the command carries no target or no business object', function() {
    const eventBus = eventBusStub();

    PasteIdentifiers(eventBus, registryHolding('Index'));

    const businessObject = findById(definitions, 'TaskActivity');

    eventBus.fire('commandStack.elements.create.preExecute', { context: { elements: [ { businessObject } ] } });
    eventBus.fire('commandStack.elements.create.preExecute', { context: { elements: [ {} ], parent: TARGET } });

    assert.equal(generated, 0);
    assert.equal(attributesOf(businessObject)[0].get('id'), 'Index');
  });
});
