import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';

import attributeRedeclared from '../src/modules/rules/bpmnos/attribute-redeclared.js';

import { findById, parse } from './helper.mjs';

/**
 * A rule is a function of the moddle tree, so it is put the elements directly and its reports collected,
 * rather than run through bpmnlint: what is under test is what the rule says about a model, and the runner
 * that walks the model on its behalf is not this repository's.
 */
function reportsFor(node) {
  const reports = [];

  attributeRedeclared().check(node, { report: (id, message) => reports.push({ id, message }) });

  return reports;
}

/**
 * The corpus holds no model with a redeclared attribute, so the faults are stated in a fixture written for
 * them: a process declaring `Timestamp` and `shared`, and five elements beneath it, one for each fault and
 * one for none.
 */
describe('bpmnos/attribute-redeclared', function() {
  let definitions;

  before(async function() {
    definitions = await parse('redeclared-attributes');
  });

  it('reports an id declared twice on one element', function() {
    const reports = reportsFor(findById(definitions, 'DuplicateIdHere'));

    assert.equal(reports.length, 1);
    assert.match(reports[0].message, /id 'Twice' is declared twice on this element/);
  });

  it('reports a name declared twice on one element, whatever follows the assignment', function() {
    const reports = reportsFor(findById(definitions, 'DuplicateNameHere'));

    // the second declares `same := 1`, and a name is what stands before the assignment
    assert.equal(reports.length, 1);
    assert.match(reports[0].message, /'same' is declared twice on this element/);
  });

  it('reports an id redeclared from the one it inherits', function() {
    const reports = reportsFor(findById(definitions, 'RedeclaresInheritedId'));

    assert.equal(reports.length, 1);
    assert.match(reports[0].message, /id 'Shared' is redeclared, it is inherited from 'Process_Redeclared'/);
  });

  it('reports a name shadowing the one it inherits', function() {
    const reports = reportsFor(findById(definitions, 'ShadowsInheritedName'));

    assert.equal(reports.length, 1);
    assert.match(reports[0].message, /'shared' shadows the attribute inherited from 'Process_Redeclared'/);
  });

  it('reports nothing where an element declares two attributes of its own', function() {
    assert.deepEqual(reportsFor(findById(definitions, 'Clean')), []);
  });

  it('reports nothing for an element declaring nothing', function() {
    assert.deepEqual(reportsFor(findById(definitions, 'Process_Redeclared')).length, 0);
  });

  it('reports each fault once rather than once per attribute of the pair', function() {
    const reports = reportsFor(findById(definitions, 'DuplicateIdHere'));

    // the second of the pair is the one reported, the first having been well formed when it was declared
    assert.equal(reports.length, 1);
  });

  it('reports nothing on the corpus, whose models declare no attribute twice', async function() {
    const jobShop = await parse('job-shop-scheduling-problem');

    const elements = [ 'JobProcess', 'MachineProcess', 'TaskActivity', 'ConductTask', 'EventSubProcess' ];

    for (const id of elements) {
      assert.deepEqual(reportsFor(findById(jobShop, id)), [], `${id} is reported`);
    }
  });
});
