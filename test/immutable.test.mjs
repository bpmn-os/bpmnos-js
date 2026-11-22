import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, beforeEach } from 'node:test';

import { BpmnModdle } from 'bpmn-moddle';

import { isImmutable, mayBeImmutable } from '../src/modules/bpmnos/utils/ImmutableUtil.js';

import { findAll, parse } from './helper.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const bpmnos = JSON.parse(fs.readFileSync(path.join(HERE, '../src/modules/bpmnos/bpmnos.json'), 'utf8'));

function attribute(definitions, id) {
  return findAll(definitions, 'bpmnos:Attribute').find(candidate => candidate.get('id') === id);
}

/**
 * The fixture declares immutable a global, a status and a data attribute, leaves a global and a data attribute
 * changeable, and holds the three attributes the engine writes or keeps fixed itself and an attribute of a
 * message guidance.
 */
describe('immutable attributes', function() {
  let definitions;

  beforeEach(async function() {
    definitions = await parse('immutable');
  });

  it('are read as declared, and an attribute stating nothing is not immutable', function() {
    for ( const id of [ 'Doors', 'Pallet', 'Home' ] ) {
      assert.equal(isImmutable(attribute(definitions, id)), true, id);
    }

    for ( const id of [ 'Open', 'Requests' ] ) {
      assert.equal(isImmutable(attribute(definitions, id)), false, id);
    }
  });

  it('may not be the time, the timestamp, the instance or an attribute of a guidance', function() {
    for ( const id of [ 'Time', 'Timestamp', 'Instance', 'Approach' ] ) {
      assert.equal(mayBeImmutable(attribute(definitions, id)), false, id);
    }

    for ( const id of [ 'Doors', 'Open', 'Pallet', 'Home', 'Requests' ] ) {
      assert.equal(mayBeImmutable(attribute(definitions, id)), true, id);
    }
  });

  it('are written back as declared, and an attribute stating nothing states nothing', async function() {
    const moddle = new BpmnModdle({ bpmnos });
    const { xml } = await moddle.toXML(definitions);

    assert.match(xml, /id="Doors"[^>]*immutable="true"/);
    assert.match(xml, /id="Home"[^>]*immutable="true"/);
    assert.doesNotMatch(xml, /id="Open"[^>]*immutable=/);

    const { rootElement } = await moddle.fromXML(xml);

    assert.equal(isImmutable(attribute(rootElement, 'Pallet')), true);
    assert.equal(isImmutable(attribute(rootElement, 'Requests')), false);
  });

  it('is no longer stated once the declaration is removed', async function() {
    const moddle = new BpmnModdle({ bpmnos });

    // what the checkbox does when it is unticked
    attribute(definitions, 'Doors').set('immutable', undefined);

    const { xml } = await moddle.toXML(definitions);

    assert.doesNotMatch(xml, /id="Doors"[^>]*immutable=/);
  });
});
