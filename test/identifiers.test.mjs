import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';

import {
  collectIdentifiers,
  getHolders,
  isTaken,
  nextIdentifier,
  spacesOf
} from '../src/modules/bpmnos/collectIdentifiers.js';

import IdentifierRegistry from '../src/modules/bpmnos/IdentifierRegistry.js';

import { eventBusStub, parse } from './helper.mjs';

/**
 * The job shop model is a collaboration of two participants, each declaring the keyword pair the engine
 * requires, so it is the model that distinguishes a namespace bounded by the process from one bounded by the
 * model. Its objective attribute `Makespan` is declared on the collaboration and is therefore seen from both.
 */
describe('collectIdentifiers', function() {
  let definitions, registry;

  before(async function() {
    definitions = await parse('job-shop-scheduling-problem');
    registry = collectIdentifiers(definitions);
  });

  it('gives every process a namespace of its own, in document order', function() {
    assert.deepEqual(registry.processes, [ 'JobProcess', 'MachineProcess' ]);
  });

  it('takes the keyword identifiers exactly once in each process', function() {
    for (const identifier of [ 'Instance', 'Timestamp' ]) {
      for (const processId of registry.processes) {
        assert.equal(registry.byProcess.get(processId).get(identifier).length, 1,
          `${identifier} is taken once in ${processId}`);
      }
    }
  });

  it('keeps the two declarations of one keyword apart', function() {
    const inJob = getHolders(registry, 'JobProcess', 'Instance'),
          inMachine = getHolders(registry, 'MachineProcess', 'Instance');

    assert.equal(inJob.length, 1);
    assert.equal(inMachine.length, 1);
    assert.notEqual(inJob[0].declaringElement, inMachine[0].declaringElement);
    assert.notEqual(inJob[0].moddleElement, inMachine[0].moddleElement);
  });

  it('leaves an identifier of one process free in the other', function() {
    assert.equal(isTaken(registry, 'MachineProcess', 'Tasks'), true);
    assert.equal(isTaken(registry, 'JobProcess', 'Tasks'), false);
  });

  it('takes what the collaboration declares in every process', function() {
    for (const processId of registry.processes) {
      assert.equal(isTaken(registry, processId, 'Makespan'), true, `Makespan is taken in ${processId}`);
    }
  });

  it('takes the identifiers of content other than attributes', function() {
    assert.equal(isTaken(registry, 'JobProcess', 'OperatorMakespan'), true);
    assert.equal(isTaken(registry, 'MachineProcess', 'Operator_3pf5m16'), true);
    assert.equal(isTaken(registry, 'MachineProcess', 'Condition_05rdls5'), true);
  });

  it('places content by the element declaring it, at any depth', function() {

    // declared inside an event sub-process, taken in the process containing it
    assert.equal(registry.processOf.get('EventSubProcess'), 'MachineProcess');
    assert.equal(isTaken(registry, 'EventSubProcess', 'Job'), true);
    assert.equal(isTaken(registry, 'EventSubProcess', 'Index'), false);
  });

  it('answers for a pool as for the process it stands for', function() {
    assert.deepEqual(spacesOf(registry, 'Participant_1c07lhk'), [ 'JobProcess' ]);
    assert.equal(isTaken(registry, 'Participant_1c07lhk', 'Index'), true);
  });

  it('answers for the collaboration in every namespace at once', function() {
    assert.deepEqual(spacesOf(registry, 'Job_shop_scheduling_problem'), registry.processes);
    assert.equal(isTaken(registry, 'Job_shop_scheduling_problem', 'Index'), true);
    assert.equal(isTaken(registry, 'Job_shop_scheduling_problem', 'Tasks'), true);
  });

  it('does not report content as a duplicate of itself', function() {
    const [ holder ] = getHolders(registry, 'JobProcess', 'Instance');

    assert.equal(isTaken(registry, 'JobProcess', 'Instance'), true);
    assert.equal(isTaken(registry, 'JobProcess', 'Instance', holder.moddleElement), false);
  });

  it('reports nothing for a model it is not given', function() {
    const empty = collectIdentifiers();

    assert.deepEqual(empty.processes, []);
    assert.equal(isTaken(empty, 'JobProcess', 'Instance'), false);
  });
});

/**
 * Generation is a pure function of the registry, so it is stated against one built by hand rather than
 * against a model contrived to hold the identifiers a counter would otherwise produce.
 */
describe('nextIdentifier', function() {
  const registry = {
    processes: [ 'P', 'Q' ],
    processOf: new Map([ [ 'Task_1', 'P' ], [ 'Task_2', 'Q' ] ]),
    byProcess: new Map([
      [ 'P', new Map([
        [ 'Attribute_1', [ { id: 'Attribute_1' } ] ],
        [ 'Attribute_2', [ { id: 'Attribute_2' } ] ]
      ]) ],
      [ 'Q', new Map() ]
    ])
  };

  // the generator is a parameter so that where a candidate comes from can be stated; the modeller never
  // passes one and takes the random generator the module holds
  function generatorYielding(...candidates) {
    let next = 0;

    return () => candidates[next++];
  }

  it('yields a candidate the process has not taken', function() {
    assert.equal(
      nextIdentifier(registry, 'Task_1', 'Attribute_', generatorYielding('Attribute_free')),
      'Attribute_free');
  });

  it('generates again until a candidate is free', function() {
    assert.equal(
      nextIdentifier(registry, 'Task_1', 'Attribute_',
        generatorYielding('Attribute_1', 'Attribute_2', 'Attribute_free')),
      'Attribute_free');
  });

  it('judges a candidate against the process the element belongs to', function() {

    // taken in P and free in Q, so the same candidate is refused for one and taken for the other
    assert.equal(
      nextIdentifier(registry, 'Task_2', 'Attribute_', generatorYielding('Attribute_1')),
      'Attribute_1');
    assert.equal(
      nextIdentifier(registry, 'Task_1', 'Attribute_', generatorYielding('Attribute_1', 'Attribute_free')),
      'Attribute_free');
  });

  it('must be free in every namespace for content of the collaboration', function() {

    // an element in neither process stands for content seen from both, so it clears both
    assert.equal(
      nextIdentifier(registry, 'Collaboration_1', 'Attribute_',
        generatorYielding('Attribute_1', 'Attribute_free')),
      'Attribute_free');
  });

  it('generates at random when no generator is given, and never repeats itself', function() {
    const generated = new Set();

    for (let count = 0; count < 100; count++) {
      const identifier = nextIdentifier(registry, 'Task_1', 'Attribute_');

      assert.ok(identifier.startsWith('Attribute_'), `${identifier} carries the prefix`);
      assert.equal(isTaken(registry, 'Task_1', identifier), false);
      assert.equal(generated.has(identifier), false, `${identifier} was generated twice`);

      generated.add(identifier);
    }
  });
});

/**
 * The service adds only currency to the collector: it holds no knowledge of a model of its own.
 */
describe('IdentifierRegistry', function() {
  let definitions;

  before(async function() {
    definitions = await parse('job-shop-scheduling-problem');
  });

  function create() {
    const eventBus = eventBusStub();

    return { eventBus, identifiers: new IdentifierRegistry(eventBus, { getDefinitions: () => definitions }) };
  }

  it('holds nothing until a model is imported', function() {
    const { identifiers } = create();

    assert.equal(identifiers.isTaken('JobProcess', 'Instance'), false);
  });

  it('collects on import and announces that it changed', function() {
    const { eventBus, identifiers } = create();

    eventBus.fire('import.done');

    assert.equal(identifiers.isTaken('JobProcess', 'Instance'), true);
    assert.ok(eventBus.fired.includes('identifiers.changed'));
  });

  it('collects again on every edit', function() {
    const { eventBus, identifiers } = create();

    eventBus.fire('elements.changed');

    assert.equal(identifiers.isTaken('MachineProcess', 'Tasks'), true);
  });

  it('forgets the model when the diagram is cleared', function() {
    const { eventBus, identifiers } = create();

    eventBus.fire('import.done');
    eventBus.fire('diagram.clear');

    assert.equal(identifiers.isTaken('JobProcess', 'Instance'), false);
  });

  it('generates an identifier the process has not taken', function() {
    const { eventBus, identifiers } = create();

    eventBus.fire('import.done');

    const identifier = identifiers.nextId('JobProcess', 'Attribute_');

    assert.equal(identifiers.isTaken('JobProcess', identifier), false);
    assert.ok(identifier.startsWith('Attribute_'));
  });

  it('follows an element renamed', async function() {
    const model = await parse('job-shop-scheduling-problem');
    const eventBus = eventBusStub(),
          identifiers = new IdentifierRegistry(eventBus, { getDefinitions: () => model });

    eventBus.fire('import.done');

    const process = model.get('rootElements').find(rootElement => rootElement.id === 'JobProcess'),
          task = process.get('flowElements').find(flowElement => flowElement.id === 'TaskActivity');

    task.id = 'TaskActivityRenamed';
    eventBus.fire('elements.changed');

    assert.deepEqual(identifiers.getProcesses('TaskActivityRenamed'), [ 'JobProcess' ]);
    assert.equal(identifiers.isTaken('TaskActivityRenamed', 'Index'), true);

    // an id the model no longer holds is answered for in every namespace at once, which is the strictest
    // answer rather than the emptiest: a stale lookup can refuse an identifier, never admit a duplicate
    assert.deepEqual(identifiers.getProcesses('TaskActivity'), [ 'JobProcess', 'MachineProcess' ]);
  });

  it('follows a process renamed, and the pool that stands for it with it', async function() {
    const model = await parse('job-shop-scheduling-problem');
    const eventBus = eventBusStub(),
          identifiers = new IdentifierRegistry(eventBus, { getDefinitions: () => model });

    eventBus.fire('import.done');

    const process = model.get('rootElements').find(rootElement => rootElement.id === 'JobProcess');

    process.id = 'JobProcessRenamed';
    eventBus.fire('elements.changed');

    assert.deepEqual(identifiers.getProcesses('TaskActivity'), [ 'JobProcessRenamed' ]);
    assert.deepEqual(identifiers.getProcesses('Participant_1c07lhk'), [ 'JobProcessRenamed' ]);

    // the namespace moved with the process rather than being rebuilt around it
    assert.equal(identifiers.isTaken('TaskActivity', 'Index'), true);
    assert.equal(identifiers.isTaken('TaskActivity', 'Tasks'), false);
  });

  it('takes a diagram element, a business object or an id alike', function() {
    const { eventBus, identifiers } = create();

    eventBus.fire('import.done');

    assert.equal(identifiers.isTaken('TaskActivity', 'Index'), true);
    assert.equal(identifiers.isTaken({ id: 'TaskActivity' }, 'Index'), true);
  });
});
