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
 * refers to it, which is what lets the objective be declared by a store no diagram shows.
 */
describe('globals, declared by the data stores a model holds', function() {
  let registry;

  before(async function() {
    registry = collectExecutionData(await parse('job-shop-scheduling-problem'));
  });

  it('is seen by every node of every process', function() {
    const inJob = registry.byElement.get('JobProcess').globals.map(attribute => attribute.id),
          inMachine = registry.byElement.get('MachineProcess').globals.map(attribute => attribute.id);

    assert.deepEqual(inJob, [ 'Objective', 'Makespan' ]);
    assert.deepEqual(inMachine, inJob);
  });

  it('names the store that declares it, which is on no diagram', function() {
    const makespan = registry.byElement.get('JobProcess').globals
      .find(attribute => attribute.id === 'Makespan');

    assert.equal(makespan.scope, 'global');
    assert.ok(makespan.declaringElement.startsWith('DataStore'));
  });

  it('puts the objective first, wherever it is declared', function() {
    const globals = registry.byElement.get('JobProcess').globals;

    assert.equal(globals[0].id, 'Objective');

    // and the store declaring it is not the first store of the model, so the order is not the document's
    assert.notEqual(globals[0].declaringElement, globals[1].declaringElement);
  });

  it('carries neither an objective nor a weight, so it does not count towards itself', function() {
    const objective = registry.byElement.get('JobProcess').globals[0];

    assert.equal(objective.objective, undefined);
    assert.equal(objective.weight, undefined);
    assert.equal(objective.name, 'objective := 0');
  });

  it('resolves by identifier within every process', function() {
    assert.ok(registry.byId.get('JobProcess').get('Makespan'));
    assert.ok(registry.byId.get('MachineProcess').get('Makespan'));
  });
});

/**
 * The lookup tables, read from the stores for the same reason the globals are: a table's name becomes a
 * callable in every expression of the model, so it is a property of the store and not of one occurrence of
 * referring to it.
 */
describe('lookup tables, declared by the data stores a model holds', function() {
  let registry;

  before(async function() {
    registry = collectExecutionData(await parse('earliest-arrival'));
  });

  it('reports every table of the model, in document order', function() {
    assert.deepEqual(registry.tables.map(table => table.name),
      [ 'destinations', 'durations', 'departures', 'heuristic' ]);
  });

  it('names the store that declares it rather than the reference to it', function() {
    registry.tables.forEach(table => assert.ok(table.declaringElement.startsWith('DataStore_')));
  });

  it('keeps what each table is read from', function() {
    const durations = registry.tables.find(table => table.name === 'durations');

    assert.equal(durations.source, 'durations.csv');
    assert.equal(durations.header, 'From;To;Duration');
  });

  it('declares the objective even where the model has no collaboration', function() {
    assert.deepEqual(
      registry.byElement.get('EarliestArrival_Process').globals.map(attribute => attribute.id),
      [ 'Objective' ]);
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
    assert.equal(isTaken(registry, 'MachineProcess', 'Objective'), true);
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

  it('takes a lookup table in every process too', async function() {
    const tables = collectIdentifiers(await parse('earliest-arrival'));

    assert.equal(isTaken(tables, 'EarliestArrival_Process', 'Table_1askkpg'), true);
  });
});
