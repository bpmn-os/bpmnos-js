#!/usr/bin/env node
/**
 * Move what a BPMN-OS model declares model-wide onto the data stores that declare it.
 *
 * A global used to be declared by the `bpmn:collaboration` and a lookup table by a `bpmn:dataStoreReference`.
 * Neither says what it means. A collaboration describes who talks to whom, so a model with a single process,
 * which has no collaboration at all, could declare no global; and a reference refers to a store rather than
 * declaring one, so a table sat on an occurrence of using a thing rather than on the thing. Both are now
 * declared by the `bpmn:dataStore`, which BPMN makes a root element precisely because a store outlives any
 * one process instance, and the objective joins them as a global of its own.
 *
 * Each model is rewritten in place:
 *
 *   - a data store declaring `Objective`, initialised to zero and carrying neither an objective nor a
 *     weight, is added unless the model declares one already, and no reference points at it;
 *   - the attributes a collaboration declares move to a store of their own, referred to from the first
 *     process by a reference the reader can select, drawn in the plane;
 *   - the tables a data store reference declares move to the store behind it, which is created and linked
 *     where the model left the reference pointing at nothing.
 *
 * Reading and writing go through the same moddle that reads the result, so what is produced is what the
 * modeller and the collectors will read, rather than what a regular expression over XML would leave behind.
 *
 * Running it twice changes nothing the second time: every step asks what the model already declares.
 *
 *   node migrate2datastore.mjs <model.bpmn>...
 *
 * This is a tool for one migration and is expected to be deleted once every model has been through it. It
 * stays in the history of the commit that moved the declarations, which is where to look for it should a
 * model written in the old form turn up after all.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BpmnModdle } from 'bpmn-moddle';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const bpmnos = JSON.parse(fs.readFileSync(path.join(HERE, 'src/modules/bpmnos/bpmnos.json'), 'utf8'));

const OBJECTIVE = 'Objective';

// the size bpmn-js gives a data store reference, and the room left around it
const SHAPE = { width: 50, height: 50 }, MARGIN = 30;

async function migrate(file) {
  const moddle = new BpmnModdle({ bpmnos });
  const { rootElement: definitions, warnings } = await moddle.fromXML(fs.readFileSync(file, 'utf8'));

  const done = [];

  if (addObjectiveStore(definitions, moddle)) {
    done.push('objective');
  }

  const globals = moveCollaborationGlobals(definitions, moddle);
  if (globals) {
    done.push(`globals (${globals})`);
  }

  const tables = moveReferenceTables(definitions, moddle);
  if (tables) {
    done.push(`tables (${tables})`);
  }

  if (done.length) {
    const { xml } = await moddle.toXML(definitions, { format: true });

    fs.writeFileSync(file, xml);
  }

  return { done, warnings };
}

// ---- the objective ---------------------------------------------------------------------------------

/**
 * Declare the objective among the globals, on a store of its own that no reference points at.
 *
 * It needs none: a reference is how a reader is shown that a process uses a store and how the editor is
 * offered for it, and the objective is neither the reader's to place nor theirs to edit. This is what
 * `ensureDefaultAttributes` builds when a process is made executable, so a migrated model and a model made
 * executable in the modeller declare it the same way.
 */
function addObjectiveStore(definitions, moddle) {
  const declared = rootElementsOf(definitions, 'bpmn:DataStore')
    .some(dataStore => attributesOf(dataStore).some(attribute => attribute.get('id') === OBJECTIVE));

  if (declared) {
    return false;
  }

  const attribute = moddle.create('bpmnos:Attribute', {
    id: OBJECTIVE, name: 'objective := 0', type: 'decimal'
  });

  addRootElement(definitions, storeHolding(definitions, moddle, [ attribute ]), moddle);

  return true;
}

// ---- the globals -----------------------------------------------------------------------------------

/**
 * Move the attributes a collaboration declares onto a store, and refer to that store from a process.
 *
 * The reference is what makes the globals editable again: the store is not on the canvas, so the modeller
 * offers the editor on the reference to it, and a reference the plane does not draw cannot be selected.
 */
function moveCollaborationGlobals(definitions, moddle) {
  let moved = 0;

  rootElementsOf(definitions, 'bpmn:Collaboration').forEach(collaboration => {
    const attributes = extensionsOf(collaboration).filter(value => value.$type === 'bpmnos:Attributes');

    if (!attributes.length) {
      return;
    }

    const declared = attributes.flatMap(item => item.get('attribute') || []);

    if (!declared.length) {
      detach(collaboration, attributes);
      return;
    }

    const dataStore = storeHolding(definitions, moddle, declared);

    addRootElement(definitions, dataStore, moddle);
    detach(collaboration, attributes);

    const process = processOf(collaboration) || rootElementsOf(definitions, 'bpmn:Process')[0];

    if (process) {
      addReference(definitions, process, dataStore, moddle);
    }

    moved += declared.length;
  });

  return moved;
}

// ---- the lookup tables -----------------------------------------------------------------------------

/**
 * Move the tables a data store reference declares onto the store behind it.
 *
 * A table's name becomes a callable in every expression of the model, as a global is visible at every node,
 * so both are properties of the store rather than of one occurrence of referring to it. Where the reference
 * points at nothing, which is every reference the corpus holds, the store it always lacked is created and
 * linked, since the tables would otherwise have nowhere to go.
 */
function moveReferenceTables(definitions, moddle) {
  let moved = 0;

  referencesIn(definitions).forEach(reference => {
    const tables = extensionsOf(reference).filter(value => value.$type === 'bpmnos:Tables');

    if (!tables.length) {
      return;
    }

    let dataStore = reference.get('dataStoreRef');

    if (!dataStore) {
      dataStore = moddle.create('bpmn:DataStore', { id: freeId(definitions, 'DataStore'), name: reference.get('name') });
      addRootElement(definitions, dataStore, moddle);
      reference.dataStoreRef = dataStore;
    }

    detach(reference, tables);
    tables.forEach(item => attach(dataStore, item, moddle));

    moved += tables.flatMap(item => item.get('table') || []).length;
  });

  return moved;
}

// ---- the model -------------------------------------------------------------------------------------

function rootElementsOf(definitions, type) {
  return (definitions.get('rootElements') || []).filter(rootElement => rootElement.$type === type);
}

// the extension values an element carries, whichever of them holds what is looked for
function extensionsOf(element) {
  const extensionElements = element.get('extensionElements');

  return extensionElements ? extensionElements.get('values') || [] : [];
}

function attributesOf(element) {
  return extensionsOf(element)
    .filter(value => value.$type === 'bpmnos:Attributes')
    .flatMap(attributes => attributes.get('attribute') || []);
}

// a store carrying the attributes, in a `bpmnos:Attributes` of its own
function storeHolding(definitions, moddle, declared) {
  const dataStore = moddle.create('bpmn:DataStore', { id: freeId(definitions, 'DataStore') });
  const attributes = moddle.create('bpmnos:Attributes', { attribute: declared });

  declared.forEach(attribute => { attribute.$parent = attributes; });

  attach(dataStore, attributes, moddle);

  return dataStore;
}

// add a piece of extension content to an element, creating its `bpmn:ExtensionElements` if it has none
function attach(element, item, moddle) {
  let extensionElements = element.get('extensionElements');

  if (!extensionElements) {
    extensionElements = moddle.create('bpmn:ExtensionElements', { values: [] });
    extensionElements.$parent = element;
    element.extensionElements = extensionElements;
  }

  item.$parent = extensionElements;
  extensionElements.get('values').push(item);
}

// take pieces of extension content away, and the container with them when nothing is left in it
function detach(element, items) {
  const extensionElements = element.get('extensionElements'),
        values = extensionElements.get('values').filter(value => !items.includes(value));

  if (values.length) {
    extensionElements.values = values;
  }
  else {
    element.extensionElements = undefined;
  }
}

function addRootElement(definitions, rootElement, moddle) { // eslint-disable-line no-unused-vars
  rootElement.$parent = definitions;
  definitions.get('rootElements').push(rootElement);
}

// the process of a collaboration's first participant, which is the one a migrated model refers from
function processOf(collaboration) {
  const participant = (collaboration.get('participants') || [])[0];

  return participant && participant.get('processRef');
}

// data store references sit among the flow elements of a scope, at any depth
function referencesIn(element) {
  return (element.get('rootElements') || element.get('flowElements') || []).flatMap(child => {
    if (child.$type === 'bpmn:DataStoreReference') {
      return [ child ];
    }

    return child.get && child.get('flowElements') ? referencesIn(child) : [];
  });
}

// an identifier the model does not already hold, formed from the prefix
function freeId(definitions, prefix) {
  const taken = new Set();

  (function walk(element) {
    if (!element || typeof element !== 'object') {
      return;
    }

    if (element.id) {
      taken.add(element.id);
    }

    Object.keys(element)
      .filter(key => !key.startsWith('$'))
      .forEach(key => {
        const value = element[key];

        if (Array.isArray(value)) {
          value.forEach(walk);
        }
        else if (value && typeof value === 'object' && value.$type) {
          walk(value);
        }
      });
  })(definitions);

  for (let n = 1; ; n++) {
    const id = `${prefix}_${n}`;

    if (!taken.has(id)) {
      return id;
    }
  }
}

// ---- the diagram -----------------------------------------------------------------------------------

/**
 * Refer to the store from a process, and draw the reference where the reader can reach it.
 *
 * It is drawn inside the pool of the process where the model has one, since that is where the process is
 * shown, and below everything else where the process is the plane itself.
 */
function addReference(definitions, process, dataStore, moddle) {
  const reference = moddle.create('bpmn:DataStoreReference', {
    id: freeId(definitions, 'DataStoreReference'),
    name: 'Globals',
    dataStoreRef: dataStore
  });

  reference.$parent = process;
  process.get('flowElements').push(reference);

  const plane = planeOf(definitions);

  if (!plane) {
    return;
  }

  const bounds = moddle.create('dc:Bounds', { ...SHAPE, ...placeIn(plane, participantShapeOf(plane, process)) });
  const shape = moddle.create('bpmndi:BPMNShape', { id: `${reference.id}_di`, bpmnElement: reference, bounds });

  bounds.$parent = shape;
  shape.$parent = plane;
  plane.get('planeElement').push(shape);
}

function planeOf(definitions) {
  const diagram = (definitions.get('diagrams') || [])[0];

  return diagram && diagram.get('plane');
}

function participantShapeOf(plane, process) {
  return (plane.get('planeElement') || []).find(element =>
    element.$type === 'bpmndi:BPMNShape'
    && element.get('bpmnElement')
    && element.get('bpmnElement').$type === 'bpmn:Participant'
    && element.get('bpmnElement').get('processRef') === process);
}

// inside the pool at its lower left where there is one, and below the whole plane where there is not
function placeIn(plane, participantShape) {
  if (participantShape) {
    const bounds = participantShape.get('bounds');

    return {
      x: bounds.get('x') + MARGIN,
      y: bounds.get('y') + bounds.get('height') - SHAPE.height - MARGIN
    };
  }

  const drawn = (plane.get('planeElement') || [])
    .filter(element => element.$type === 'bpmndi:BPMNShape' && element.get('bounds'))
    .map(element => element.get('bounds'));

  if (!drawn.length) {
    return { x: 160, y: 80 };
  }

  return {
    x: Math.min(...drawn.map(bounds => bounds.get('x'))),
    y: Math.max(...drawn.map(bounds => bounds.get('y') + bounds.get('height'))) + 2 * MARGIN
  };
}

// ---- the command line ------------------------------------------------------------------------------

const files = process.argv.slice(2);

if (!files.length) {
  console.error('Usage: node migrate2datastore.mjs <model.bpmn>...');
  process.exit(1);
}

let failed = 0;

for (const file of files) {
  try {
    const { done, warnings } = await migrate(file);

    console.log(`${done.length ? '✓' : '–'} ${file}${done.length ? ': ' + done.join(', ') : ': already migrated'}`);

    (warnings || []).forEach(warning => console.warn(`  ! ${warning.message}`));
  }
  catch (error) {
    failed++;
    console.error(`✗ ${file}: ${error.message}`);
  }
}

process.exit(failed ? 1 : 0);
