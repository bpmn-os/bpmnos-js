import inherits from 'inherits';

import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';

import {
  isAnnotation,
  isHidden,
  getAnnotation,
  getHost,
  isProtectedAssociation,
  toggleCollapsed
} from './utils/AnnotationUtil';
import { layout, HEADER_HEIGHT } from './utils/AnnotationLayout';

// runs after bpmn-js's TextAnnotationBehavior, which would otherwise derive the height from the (empty) text
const RESIZE_PRIORITY = 500;

// runs before bpmn-js's own delete behaviours
const HIGH_PRIORITY = 1500;

// tolerance when deciding which edge a growing box is anchored to
const TOLERANCE = 2;

/**
 * Keeps an execution data box consistent with the model:
 *
 * - marks a freshly appended annotation, from `postExecuted` so it shares the append's undo step;
 * - redraws a box when what it renders changes — the host is reached only through the association, which
 *   exists neither when the shape is first drawn nor during import;
 * - fits the height to the content, growing away from the host;
 * - applies the persisted `visible`/`hidden` state to the box and its association.
 */
export default function BPMNOSAnnotationBehavior(
    eventBus, modeling, elementRegistry, graphicsFactory, selection, executionData, canvas) {

  CommandInterceptor.call(this, eventBus);

  // (1) mark the appended annotation ---------------------------------------------------------------

  // unwrapped: the handler receives the command context
  this.postExecuted('shape.append', function(context) {
    const hints = context.hints || {};

    if (!hints.annotation) {
      return;
    }

    modeling.updateProperties(context.shape, { annotation: hints.annotation });
  }, true);

  // (2) a box lives and dies with its element --------------------------------------------------------

  this.preExecute('elements.delete', HIGH_PRIORITY, function(context) {
    const elements = context.elements.slice();

    // a box describes exactly one element, so deleting that element takes the box with it. The
    // association needs no mention: removing the box removes what is attached to it.
    elements.forEach(function(element) {
      const box = element.outgoing && getAnnotation(element);

      if (box && elements.indexOf(box) === -1) {
        elements.push(box);
      }
    });

    // and the association may not go on its own — a backstop below the rule in BPMNOSAnnotationRules, which
    // programmatic deletion never consults
    context.elements = elements.filter(element => !isProtectedAssociation(element, elements));
  }, true);

  // (3) a box travels with its element ---------------------------------------------------------------

  // the boxes of the given shapes, minus those already among them
  function boxesOf(shapes) {
    return shapes.reduce(function(boxes, shape) {
      const box = shape.outgoing && getAnnotation(shape);

      if (box && shapes.indexOf(box) === -1 && boxes.indexOf(box) === -1) {
        boxes.push(box);
      }

      return boxes;
    }, []);
  }

  // dragging: the box joins the drag, so it is previewed and moved with its element
  eventBus.on('shape.move.start', HIGH_PRIORITY, function(event) {
    const context = event.context,
          boxes = boxesOf(context.shapes);

    if (boxes.length) {
      context.shapes = context.shapes.concat(boxes);
    }
  });

  // and the same for a programmatic move, which never starts a drag
  this.preExecute('elements.move', HIGH_PRIORITY, function(context) {
    const boxes = boxesOf(context.shapes);

    if (boxes.length) {
      context.shapes = context.shapes.concat(boxes);
    }
  }, true);

  // (4) height follows the content ------------------------------------------------------------------

  this.preExecute('shape.resize', RESIZE_PRIORITY, function(context) {
    const shape = context.shape;

    if (!isAnnotation(shape)) {
      return;
    }

    const bounds = context.newBounds,
          height = layout(shape, executionData).height;

    // Only the width is the user's — bpmn-js restricts annotations to the west/east handles. Its
    // TextAnnotationBehavior has already rewritten newBounds.height to the height of the (empty) text, so
    // the vertical anchor is taken from the shape as it stands, not from those bounds.
    context.newBounds = {
      x: bounds.x,
      y: anchoredY(shape, shape, height),
      width: bounds.width,
      height
    };
  }, true);

  function fitHeight(box) {
    const height = layout(box, executionData).height;

    if (Math.abs(height - box.height) < 0.5) {
      return false;
    }

    modeling.resizeShape(box, {
      x: box.x,
      y: anchoredY(box, box, height),
      width: box.width,
      height
    });

    return true;
  }

  // (5) redraw and visibility ------------------------------------------------------------------------

  function redraw(element) {
    const gfx = element && elementRegistry.getGraphics(element);

    if (gfx) {
      graphicsFactory.update(element.waypoints ? 'connection' : 'shape', element, gfx);
    }
  }

  function applyVisibility(box) {
    const hidden = isHidden(box);

    [ box ].concat(box.incoming || []).forEach(function(element) {
      if (element.hidden !== hidden) {
        element.hidden = hidden;
        redraw(element);
      }

      // a hidden element stays selected otherwise, leaving its outline and handles floating on the canvas
      if (hidden && selection.isSelected(element)) {
        selection.deselect(element);
      }
    });
  }

  eventBus.on([ 'connection.added', 'connection.changed', 'connection.removed' ], function(event) {
    const connection = event.element;

    [ connection.source, connection.target ].forEach(function(element) {
      if (element && isAnnotation(element)) {
        applyVisibility(element);

        if (!fitHeight(element)) {
          redraw(element);
        }
      }
    });
  });

  eventBus.on('element.changed', function(event) {
    const element = event.element;

    if (!element) {
      return;
    }

    if (isAnnotation(element)) {
      applyVisibility(element);
      return;
    }

    // the host changed: its box renders the host's id and declarations
    if (element.outgoing) {
      const box = getAnnotation(element);

      if (box && !fitHeight(box)) {
        redraw(box);
      }
    }
  });

  // (6) folding what the element inherits ------------------------------------------------------------

  // A click on a toggle row folds or unfolds that group. The box is one shape, so the row is found by
  // hit-testing the click against the layout — `element.click` fires only when the click was not a drag,
  // which keeps this out of the way of moving and resizing.
  // interaction events carry no diagram coordinates, so a mouse position is converted through the viewbox
  function localY(originalEvent, box) {
    const viewbox = canvas.viewbox(),
          bounds = canvas.getContainer().getBoundingClientRect();

    return viewbox.y + (originalEvent.clientY - bounds.top) / viewbox.scale - box.y;
  }

  // Only the header drags the box. Everywhere else a press would start a move and swallow the click that
  // folds a group, so the drag is suppressed before diagram-js's Move sees the event.
  function onHeader(originalEvent, box) {
    return localY(originalEvent, box) <= HEADER_HEIGHT;
  }

  eventBus.on('element.mousedown', HIGH_PRIORITY, function(event) {
    const box = event.element,
          originalEvent = event.originalEvent;

    if (!isAnnotation(box) || !originalEvent) {
      return;
    }

    if (!onHeader(originalEvent, box)) {
      return false;
    }
  });

  // and the pointer says so: a move cursor over the header, the default cursor over the content
  eventBus.on('element.mousemove', function(event) {
    const box = event.element,
          originalEvent = event.originalEvent,
          gfx = event.gfx;

    if (!isAnnotation(box) || !originalEvent || !gfx) {
      return;
    }

    const cursor = onHeader(originalEvent, box) ? 'move' : 'default';

    // the cursor belongs on the hit area: `.djs-element .djs-hit-all { cursor: move }` would otherwise win
    // over anything inherited from the group
    [ gfx, ...gfx.querySelectorAll('.djs-hit, .djs-hit-all, .djs-hit-click-stroke, .djs-hit-stroke') ]
      .forEach(node => { node.style.cursor = cursor; });
  });

  eventBus.on('element.click', function(event) {
    const box = event.element,
          originalEvent = event.originalEvent;

    if (!isAnnotation(box) || !originalEvent) {
      return;
    }

    const local = localY(originalEvent, box);

    const row = layout(box, executionData).rows.find(
      row => row.kind === 'toggle' && local >= row.y && local < row.y + row.height
    );

    if (!row) {
      return;
    }

    toggleCollapsed(box, row.key);

    if (!fitHeight(box)) {
      redraw(box);
    }
  });

  // a hidden box must come back hidden
  eventBus.on('import.done', function() {
    elementRegistry.filter(isAnnotation).forEach(applyVisibility);
  });

  // A box shows what its host declares and inherits, so it changes when the declarations do — and those may
  // be edited on another element entirely (a data object, or the collaboration holding the globals). The
  // registry announces the rebuild; every box redraws and refits.
  let updating = false;

  eventBus.on('executionData.changed', function() {
    if (updating) {
      return;
    }

    updating = true;

    try {
      elementRegistry.filter(isAnnotation).forEach(function(box) {
        if (!fitHeight(box)) {
          redraw(box);
        }
      });
    } finally {
      updating = false;
    }
  });
}

inherits(BPMNOSAnnotationBehavior, CommandInterceptor);

BPMNOSAnnotationBehavior.$inject = [
  'eventBus',
  'modeling',
  'elementRegistry',
  'graphicsFactory',
  'selection',
  'executionData',
  'canvas'
];

/**
 * The box grows away from its host: anchored at the bottom when it sits above, at the top when it sits
 * below, and at its centre when it overlaps the host's vertical band (beside it, or inside a container).
 */
function anchoredY(box, bounds, height) {
  const host = getHost(box);

  if (!host) {
    return bounds.y;
  }

  if (bounds.y + bounds.height <= host.y + TOLERANCE) {
    return bounds.y + bounds.height - height;
  }

  if (bounds.y >= host.y + host.height - TOLERANCE) {
    return bounds.y;
  }

  return bounds.y + (bounds.height - height) / 2;
}
