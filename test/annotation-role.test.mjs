import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';

import { annotationRole } from '../src/modules/bpmnos/utils/AnnotationUtil.js';

import { findById, parse } from './helper.mjs';

/**
 * What an element is to an execution data box. A host that keeps part of the modeller alive while a run is
 * on asks this one question and permits what it wants of each answer, so the answers are what is pinned
 * here rather than how a box is put together.
 *
 * A diagram element is a business object with the shape or the connection around it, so the elements below
 * are that pair, built over a parsed model: what the function reads of an element is its business object,
 * its waypoints and its target, and nothing that only a rendered diagram would have.
 */
describe('annotationRole', function() {
  let definitions;

  const shape = (id) => ({ id, businessObject: findById(definitions, id) });

  before(async function() {
    definitions = await parse('redeclared-attributes');
  });

  it('calls an element that may carry a box its host', function() {
    assert.equal(annotationRole(shape('Clean')), 'host');
  });

  it('calls a marked text annotation a box, and an unmarked one nothing', function() {
    const box = { id: 'Box', businessObject: annotationOf({ annotation: 'visible' }) },
          plain = { id: 'Plain', businessObject: annotationOf({}) };

    assert.equal(annotationRole(box), 'box');
    assert.equal(annotationRole(plain), null, 'a text annotation of the user\'s own is not one of ours');
  });

  it('calls the connection to a box its association', function() {
    const box = { id: 'Box', businessObject: annotationOf({ annotation: 'visible' }) };

    assert.equal(annotationRole({ id: 'A', waypoints: [], target: box }), 'association');
    assert.equal(annotationRole({ id: 'B', waypoints: [], target: shape('Clean') }), null,
      'a connection to anything else is not');
  });

  it('calls a label nothing, having nothing of its own to describe', function() {
    assert.equal(annotationRole({ id: 'L', labelTarget: shape('Clean') }), null);
  });
});

// a `bpmn:TextAnnotation` business object, marked or not, as moddle would produce it
function annotationOf(attributes) {
  return {
    $type: 'bpmn:TextAnnotation',
    $instanceOf: (type) => type === 'bpmn:TextAnnotation',
    get: (property) => attributes[property],
    ...attributes
  };
}
