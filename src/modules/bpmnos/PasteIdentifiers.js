import { identifiedContent } from './collectIdentifiers.js';

/**
 * Gives pasted extension content identifiers that are free in the process it lands in.
 *
 * An identifier is unique within a process, so content pasted into the process it was copied from must be
 * given new identifiers, while content pasted into another process may keep the ones it has: the identifiers
 * of one process say nothing about another, and a task copied from one pool to the next is more useful with
 * its `Index` intact than with an invented name. What is free is therefore kept and only what is taken is
 * replaced, the replacement being generated from the identifier it replaces, so `Index` becomes `Index_` and
 * a suffix rather than something unrecognisable.
 *
 * **This happens when the elements are created and not when they are copied**, because a copy has no target
 * yet: the same clipboard may be pasted into either process, or into several in turn, and which identifiers
 * are free is not known until it is known where the content lands. Nor is the target known when the pasted
 * descriptors are made, since a paste from the keyboard hands the elements to the mouse and the user drops
 * them where they please. What both paths do share is the command that adds the elements to the diagram,
 * `elements.create`, which carries the elements and the parent they are added to, so the naming is done
 * there, before the command executes and therefore within it: undoing the paste undoes the naming with it.
 *
 * Content created a piece at a time through the properties panel is already named from the registry and
 * needs nothing here; what this covers is content that arrives ready-made, by paste or by duplication.
 */
export default function PasteIdentifiers(eventBus, identifiers) {

  eventBus.on('commandStack.elements.create.preExecute', function(event) {

    // a command event carries the command's own context beside it rather than being it
    const context = event.context || {};

    const elements = context.elements || [],
          parent = context.parent;

    if (!parent) {
      return;
    }

    // what has been given out within this command, since the registry is rebuilt only once it has run
    const claimed = new Set();

    elements.forEach(element => {
      const businessObject = element && element.businessObject;

      if (!businessObject) {
        return;
      }

      identifiedContent(businessObject.get('extensionElements')).forEach(content => {
        const identifier = content.get('id');

        if (!identifier || !(claimed.has(identifier) || identifiers.isTaken(parent, identifier))) {
          claimed.add(identifier);

          return;
        }

        const replacement = free(identifiers, parent, claimed, prefixOf(identifier));

        content.set('id', replacement);
        claimed.add(replacement);
      });
    });
  });
}

PasteIdentifiers.$inject = [ 'eventBus', 'identifiers' ];

// an identifier free in the process and not already given out within this command
function free(identifiers, parent, claimed, prefix) {
  for (;;) {
    const identifier = identifiers.nextId(parent, prefix);

    if (!claimed.has(identifier)) {
      return identifier;
    }
  }
}

/**
 * The prefix a replacement is generated from: what stands before the last underscore of the identifier being
 * replaced, so that a replacement keeps the name it is recognised by, or the identifier itself where it
 * carries no underscore.
 */
function prefixOf(identifier) {
  const underscore = identifier.lastIndexOf('_');

  return underscore === -1 ? `${identifier}_` : identifier.substring(0, underscore + 1);
}
