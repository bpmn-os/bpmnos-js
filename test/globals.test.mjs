import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';

import { collectExecutionData } from '../src/modules/bpmnos/collectExecutionData.js';
import { collectIdentifiers, isTaken, getHolders } from '../src/modules/bpmnos/collectIdentifiers.js';

import { parse } from './helper.mjs';

/**
 * What a model declares model-wide, which is what its `bpmn:DataStore`s declare.
 *
 * A global and a lookup table are read from the stores a model holds and never from the references to them,
 * exactly as the data of a scope is read from the data objects it contains: a reference refers to a store
 * and does not declare one. A store therefore contributes what it declares whether or not any process
 * refers to it.
 */
describe('globals, declared by the data stores a model holds', function() {
  let registry;

  before(async function() {
    registry = collectExecutionData(await parse('job-shop-scheduling-problem'));
  });

  it('is seen by every node of every process', function() {
    const inJob = registry.byElement.get('JobProcess').globals.map(attribute => attribute.id),
          inMachine = registry.byElement.get('MachineProcess').globals.map(attribute => attribute.id);

    assert.deepEqual(inJob, [ 'Makespan' ]);
    assert.deepEqual(inMachine, inJob);
  });

  it('names the store that declares it, which is on no diagram', function() {
    const makespan = registry.byElement.get('JobProcess').globals
      .find(attribute => attribute.id === 'Makespan');

    assert.equal(makespan.scope, 'global');
    assert.ok(makespan.declaringElement.startsWith('DataStore'));
  });

  it('resolves by identifier within every process', function() {
    assert.ok(registry.byId.get('JobProcess').get('Makespan'));
    assert.ok(registry.byId.get('MachineProcess').get('Makespan'));
  });
});

/**
 * The inputs, read from the stores for the same reason the globals are: an input's name is read in every
 * expression of the model, a lookup's as a callable, so it is a property of the store and not of one
 * occurrence of referring to it.
 */
describe('inputs, declared by the data stores a model holds', function() {
  let registry;

  before(async function() {
    registry = collectExecutionData(await parse('earliest-arrival'));
  });

  it('reports every input of the model, in document order', function() {
    assert.deepEqual(registry.inputs.map(input => input.name),
      [ 'destinations', 'durations', 'departures', 'heuristic' ]);
  });

  it('names the store that declares it rather than the reference to it', function() {
    registry.inputs.forEach(input => assert.ok(input.declaringElement.startsWith('DataStore_')));
  });

  it('keeps the type of each input, what it is read from, and its schema', function() {
    const durations = registry.inputs.find(input => input.name === 'durations');

    assert.equal(durations.type, 'lookup');
    assert.equal(durations.source, 'durations.csv');
    assert.equal(durations.schema, 'From: string;To: string;Duration: decimal');
  });
});

/**
 * A store belongs to no one process, so what it declares must be free in all of them, which is the rule the
 * collaboration's content followed before the stores existed.
 */
describe('identifiers, of what a data store declares', function() {
  let registry;

  before(async function() {
    registry = collectIdentifiers(await parse('job-shop-scheduling-problem'));
  });

  it('takes a global in every process', function() {
    assert.equal(isTaken(registry, 'JobProcess', 'Makespan'), true);
    assert.equal(isTaken(registry, 'MachineProcess', 'Makespan'), true);
  });

  it('leaves what one process declares taken in that process alone', function() {
    const holders = getHolders(registry, 'JobProcess', 'Timestamp');

    assert.equal(holders.length, 1);
    assert.equal(holders[0].declaringElement, 'JobProcess');
  });

  it('refuses a global clashing with what any process declares', function() {
    const dataStore = getHolders(registry, 'JobProcess', 'Makespan')[0].declaringElement;

    // asked for the store, every process is consulted, and each declares a Timestamp of its own
    assert.equal(isTaken(registry, dataStore, 'Timestamp'), true);
  });

  it('names the store as the holder of what it declares', function() {
    const holders = getHolders(registry, 'JobProcess', 'Makespan');

    assert.equal(holders.length, 1);
    assert.ok(holders[0].declaringElement.startsWith('DataStore'));
    assert.equal(holders[0].type, 'bpmnos:Attribute');
  });

  it('takes an input in every process too', async function() {
    const identifiers = collectIdentifiers(await parse('earliest-arrival'));

    assert.equal(isTaken(identifiers, 'EarliestArrival_Process', 'Table_1askkpg'), true);
  });
});
