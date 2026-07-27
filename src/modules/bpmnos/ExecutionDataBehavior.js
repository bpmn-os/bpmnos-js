import inherits from 'inherits';

import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';

import { isExecutionData, isHidden, getExecutionData, getHost } from './utils/ExecutionDataUtil';
import { layout } from './utils/ExecutionDataLayout';

// runs after bpmn-js's TextAnnotationBehavior, which would otherwise derive the height from the (empty) text
const RESIZE_PRIORITY = 500;

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
export default function ExecutionDataBehavior(
    eventBus, modeling, elementRegistry, graphicsFactory, selection) {

  CommandInterceptor.call(this, eventBus);

  // (1) mark the appended annotation ---------------------------------------------------------------

  // unwrapped: the handler receives the command context
  this.postExecuted('shape.append', function(context) {
    const hints = context.hints || {};

    if (!hints.executionData) {
      return;
    }

    modeling.updateProperties(context.shape, { executionData: hints.executionData });
  }, true);

  // (2) height follows the content ------------------------------------------------------------------

  this.preExecute('shape.resize', RESIZE_PRIORITY, function(context) {
    const shape = context.shape;

    if (!isExecutionData(shape)) {
      return;
    }

    const bounds = context.newBounds,
          height = layout(shape).height;

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
    const height = layout(box).height;

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

  // (3) redraw and visibility ------------------------------------------------------------------------

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
      if (element && isExecutionData(element)) {
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

    if (isExecutionData(element)) {
      applyVisibility(element);
      return;
    }

    // the host changed: its box renders the host's id and declarations
    if (element.outgoing) {
      const box = getExecutionData(element);

      if (box && !fitHeight(box)) {
        redraw(box);
      }
    }
  });

  // a hidden box must come back hidden
  eventBus.on('import.done', function() {
    elementRegistry.filter(isExecutionData).forEach(applyVisibility);
  });
}

inherits(ExecutionDataBehavior, CommandInterceptor);

ExecutionDataBehavior.$inject = [ 'eventBus', 'modeling', 'elementRegistry', 'graphicsFactory', 'selection' ];

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
