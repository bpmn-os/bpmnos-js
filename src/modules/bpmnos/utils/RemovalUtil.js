import { without } from 'min-dash';

/**
 * The commands that remove a piece of extension content, together with every container it leaves empty.
 *
 * A container that holds nothing of its own, `bpmnos:Status`, `bpmnos:Attributes` and their like up to
 * `bpmn:ExtensionElements` itself, has no meaning once its last child is gone and is removed with it, so
 * that removing the last attribute of an element leaves that element as it was before the first one was
 * added. A container that carries something of its own, a `bpmnos:Guidance` with its type or a
 * `bpmnos:Message` with its name, stays: it is content in its own right, and whether it is wanted is the
 * user's to say rather than a consequence of its list running empty.
 *
 * Which of the two a container is follows from what the element holds rather than from a list of types kept
 * here, so a type added to the extension is judged correctly without this function being touched.
 *
 * The commands are returned rather than executed, so that a caller adds them to those it has already
 * gathered and the whole removal is one entry in the undo stack.
 *
 * Model-level, in the manner of `collectExecutionData`: it reads the moddle tree and the descriptors moddle
 * writes onto it, and touches no canvas API, so it can be tested without a modeller.
 *
 * @param {djs.model.Base} element  the element the panel is editing, against which the command is recorded
 * @param {ModdleElement} item      the content to remove
 *
 * @return {Array} commands for `properties-panel.multi-command-executor`
 */
export function removeCustomItemCommands(element, item) {
  let child = item;

  for (;;) {
    const parent = child && child.$parent;

    // content held by nothing has nothing to be removed from
    if (!parent) {
      return [];
    }

    // the topmost container is held by a property of its own rather than by a list
    if (child.$type === 'bpmn:ExtensionElements') {
      return [ updateModdleProperties(element, parent, { extensionElements: undefined }) ];
    }

    const property = propertyHolding(parent, child);

    if (!property) {
      return [];
    }

    const kept = without(parent.get(property), child);

    if (kept.length || !isEmptied(parent, property)) {
      return [ updateModdleProperties(element, parent, { [ property ]: kept }) ];
    }

    // the parent holds nothing of its own and nothing would be left in it, so it is what is removed instead
    child = parent;
  }
}

// the list property of the parent that holds the child
function propertyHolding(parent, child) {
  const properties = descriptorProperties(parent);

  const property = properties.find(descriptor =>
    descriptor.isMany && (parent.get(descriptor.name) || []).includes(child));

  return property && property.name;
}

/**
 * Whether removing the last child from the given property leaves the container empty and meaningless: every
 * other list of it is empty already, and it holds no value of its own.
 *
 * Holding a value is what the judgement rests on rather than being able to hold one, because the archetypal
 * container is able to: `bpmn:ExtensionElements` declares `valueRef` and `extensionAttributeDefinition`
 * after the BPMN specification, which nothing here ever sets. A `bpmnos:Guidance` with its type and a
 * `bpmnos:Message` with its name and identifier do hold theirs, and are therefore kept.
 */
function isEmptied(container, property) {
  const properties = descriptorProperties(container);

  if (!properties.length) {
    return false;
  }

  return properties.every(descriptor => {
    if (descriptor.isMany) {
      return descriptor.name === property || !(container.get(descriptor.name) || []).length;
    }

    const value = container.get(descriptor.name);

    return value === undefined || value === null || value === '';
  });
}

function descriptorProperties(moddleElement) {
  return (moddleElement.$descriptor && moddleElement.$descriptor.properties) || [];
}

function updateModdleProperties(element, moddleElement, properties) {
  return {
    cmd: 'element.updateModdleProperties',
    context: { element, moddleElement, properties }
  };
}
