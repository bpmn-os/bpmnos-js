import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';

import {
  collectExecutionData,
  getAttribute,
  getElements,
  spacesOf
} from '../src/modules/bpmnos/collectExecutionData.js';

import ExecutionData from '../src/modules/bpmnos/ExecutionData.js';

import { eventBusStub, parse } from './helper.mjs';

/**
 * The job shop model is a collaboration of two participants, each declaring the keyword pair the engine
 * requires. It is therefore the model on which a lookup by identifier must say which process it means: both
 * processes hold an `Instance` and a `Timestamp`, and they are different attributes.
 */
describe('collectExecutionData, by identifier', function() {
  let definitions, registry;

  before(async function() {
    definitions = await parse('job-shop-scheduling-problem');
    registry = collectExecutionData(definitions);
  });

  it('gives every process a namespace of its own, in document order', function() {
    assert.deepEqual(registry.processes, [ 'JobProcess', 'MachineProcess' ]);
  });

  it('reports each participant of one identifier separately', function() {
    const inJob = getAttribute(registry, 'JobProcess', 'Instance'),
          inMachine = getAttribute(registry, 'MachineProcess', 'Instance');

    assert.ok(inJob);
    assert.ok(inMachine);
    assert.notEqual(inJob, inMachine);
    assert.notEqual(inJob.declaringElement, inMachine.declaringElement);
  });

  it('never returns the elements of one process for the other', function() {
    const job = getElements(registry, 'JobProcess', 'Instance'),
          machine = getElements(registry, 'MachineProcess', 'Instance');

    assert.ok(job.length);
    assert.ok(machine.length);
    assert.deepEqual(job.filter(id => machine.includes(id)), [],
      'no element sees both declarations');
  });

  it('answers for an element by the process containing it', function() {
    assert.deepEqual(spacesOf(registry, 'TaskActivity'), [ 'JobProcess' ]);
    assert.equal(getAttribute(registry, 'TaskActivity', 'Index').name, 'index');

    // `Index` is declared in the job process alone, so the other process knows nothing of it
    assert.equal(getAttribute(registry, 'ConductTask', 'Index'), undefined);
    assert.deepEqual(getElements(registry, 'ConductTask', 'Index'), []);
  });

  it('answers for a pool as for the process it stands for', function() {
    assert.deepEqual(spacesOf(registry, 'Participant_1c07lhk'), [ 'JobProcess' ]);
    assert.equal(getAttribute(registry, 'Participant_1c07lhk', 'Index').name, 'index');
  });

  it('records what the collaboration declares in every process', function() {
    for (const processId of registry.processes) {
      assert.equal(getAttribute(registry, processId, 'Makespan').name, 'makespan := 0',
        `Makespan is seen from ${processId}`);
    }

    // and the elements seeing it are those of the process asked about, save the collaboration itself, which
    // declares the globals and therefore stands in both namespaces
    const job = getElements(registry, 'JobProcess', 'Makespan'),
          machine = getElements(registry, 'MachineProcess', 'Makespan');

    assert.ok(job.length > 1);
    assert.ok(machine.length > 1);
    assert.deepEqual(job.filter(id => machine.includes(id)), [ 'Job_shop_scheduling_problem' ]);
  });

  it('reports nothing for a model it is not given', function() {
    const empty = collectExecutionData();

    assert.deepEqual(empty.processes, []);
    assert.equal(getAttribute(empty, 'JobProcess', 'Instance'), undefined);
    assert.deepEqual(getElements(empty, 'JobProcess', 'Instance'), []);
  });
});

/**
 * The service adds only currency to the collector, and takes an element where the collector takes an id.
 */
describe('ExecutionData', function() {
  let definitions;

  before(async function() {
    definitions = await parse('job-shop-scheduling-problem');
  });

  function create() {
    const eventBus = eventBusStub();

    return { eventBus, executionData: new ExecutionData(eventBus, { getDefinitions: () => definitions }) };
  }

  it('reports what an element declares and inherits', function() {
    const { eventBus, executionData } = create();

    eventBus.fire('import.done');

    const entry = executionData.get('TaskActivity');

    assert.ok(entry.status.length);
    assert.ok(entry.data.length);
    assert.deepEqual(entry.globals.map(attribute => attribute.id), [ 'Makespan' ]);
  });

  it('resolves an identifier within the process of the element asked about', function() {
    const { eventBus, executionData } = create();

    eventBus.fire('import.done');

    assert.notEqual(
      executionData.getAttribute('JobProcess', 'Timestamp'),
      executionData.getAttribute('MachineProcess', 'Timestamp'));

    assert.deepEqual(executionData.getProcesses('TaskActivity'), [ 'JobProcess' ]);
    assert.equal(executionData.getElements('ConductTask', 'Index').length, 0);
  });

  it('takes a diagram element, a business object or an id alike', function() {
    const { eventBus, executionData } = create();

    eventBus.fire('import.done');

    assert.equal(
      executionData.getAttribute({ id: 'TaskActivity' }, 'Index'),
      executionData.getAttribute('TaskActivity', 'Index'));
  });

  it('announces that it changed, and forgets the model when the diagram is cleared', function() {
    const { eventBus, executionData } = create();

    eventBus.fire('import.done');
    assert.ok(eventBus.fired.includes('executionData.changed'));

    eventBus.fire('diagram.clear');
    assert.equal(executionData.getAttribute('JobProcess', 'Instance'), undefined);
  });
});
