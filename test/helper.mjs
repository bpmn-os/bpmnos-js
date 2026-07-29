import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BpmnModdle } from 'bpmn-moddle';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const FIXTURES = path.join(HERE, 'fixtures');

// read rather than imported, since an import attribute is the only portable way to import JSON and it is
// younger than the Node versions a contributor may still be running
const bpmnos = JSON.parse(fs.readFileSync(path.join(HERE, '../src/modules/bpmnos/bpmnos.json'), 'utf8'));

/**
 * Parse a fixture and return its `bpmn:Definitions`.
 *
 * The tests run under `node --test`, so a model is read with `bpmn-moddle` rather than imported into a
 * modeller: everything this package collects from a model is a function of the moddle tree alone, and
 * bpmn-js is not loadable from Node. The BPMNOS moddle extension is registered here, without which the
 * extension elements parse as anonymous content and every collector reports an empty model rather than
 * failing.
 *
 * @param {String} name  a file in `test/fixtures`, without its extension
 *
 * @return {Promise<ModdleElement>}
 */
export async function parse(name) {
  const xml = fs.readFileSync(path.join(FIXTURES, `${name}.bpmn`), 'utf8');

  const { rootElement } = await new BpmnModdle({ bpmnos }).fromXML(xml);

  return rootElement;
}

/**
 * Every `bpmnos:` element of a kind, anywhere beneath a `bpmn:Definitions`, in document order.
 *
 * A test states what it needs by type rather than by walking the fixture, so that the fixture may be
 * replaced without every test being rewritten around its shape.
 *
 * @param {ModdleElement} root
 * @param {String} type
 */
export function findAll(root, type) {
  return findWhere(root, moddleElement => moddleElement.$type === type);
}

/**
 * The element of the given id, wherever it sits.
 */
export function findById(root, id) {
  return findWhere(root, moddleElement => moddleElement.id === id)[0];
}

function findWhere(root, matches) {
  const found = [], seen = new Set();

  (function visit(moddleElement) {
    if (!moddleElement || typeof moddleElement !== 'object' || seen.has(moddleElement)) {
      return;
    }

    seen.add(moddleElement);

    if (matches(moddleElement)) {
      found.push(moddleElement);
    }

    Object.keys(moddleElement)
      .filter(key => !key.startsWith('$'))
      .forEach(key => {
        const value = moddleElement[key];

        if (Array.isArray(value)) {
          value.forEach(visit);
        } else if (value && typeof value === 'object' && value.$type) {
          visit(value);
        }
      });
  })(root);

  return found;
}

/**
 * A stand-in for diagram-js's event bus, holding the listeners a service registers and recording what it
 * fires, which is what a service's reaction to an edit is tested through.
 */
export function eventBusStub() {
  const listeners = new Map(), fired = [];

  return {
    fired,

    // diagram-js allows a priority between the event and the listener, which is accepted and ignored here
    on(events, priority, callback) {
      const listener = callback || priority;

      [].concat(events).forEach(event => {
        listeners.set(event, (listeners.get(event) || []).concat(listener));
      });
    },

    fire(event, ...args) {
      fired.push(event);

      (listeners.get(event) || []).forEach(callback => callback(...args));
    }
  };
}
