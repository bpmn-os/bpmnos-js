import { getAnnotation, isHidden, VISIBLE, HIDDEN } from './utils/AnnotationUtil.js';
import { layout } from './utils/AnnotationLayout.js';

// default width; the user owns it from then on, while the height always follows the content
export const DEFAULT_WIDTH = 180;

// distance between the host's top edge and the bottom of a freshly created box
const GAP = 40;

/**
 * Creating, finding, showing and hiding the execution data box of an element. One box per element.
 */
export default class BPMNOSAnnotation {
  constructor(modeling) {
    this._modeling = modeling;
  }

  get(host) {
    return getAnnotation(host);
  }

  isHidden(box) {
    return isHidden(box);
  }

  /**
   * Create the box above the host, left-aligned with it. The association is created by `appendShape`,
   * which asks the rules for the connection type and gets a bpmn:Association.
   */
  create(host) {
    const existing = this.get(host);

    if (existing) {
      return this.show(existing);
    }

    // where to hang the box: above a shape and left-aligned with it, above the middle of a connection —
    // a root element has neither, and a programmatic call must not produce a shape at NaN
    const anchor = anchorOf(host);

    if (!anchor) {
      return;
    }

    // the host is only reachable through the association, which does not exist yet, so the content height
    // cannot be measured here; BPMNOSAnnotationBehavior fits it once the box is attached
    const height = layout({ incoming: [] }).height;

    // appendShape positions by the new shape's centre
    const position = {
      x: anchor.x + DEFAULT_WIDTH / 2,
      y: anchor.y - GAP - height / 2
    };

    return this._modeling.appendShape(
      host,
      { type: 'bpmn:TextAnnotation', width: DEFAULT_WIDTH, height },
      position,
      host.parent,

      // picked up by BPMNOSAnnotationBehavior, which marks the annotation within the same undo step
      { annotation: VISIBLE }
    );
  }

  show(box) {
    if (isHidden(box)) {
      this._modeling.updateProperties(box, { annotation: VISIBLE });
    }

    return box;
  }

  hide(box) {
    if (!isHidden(box)) {
      this._modeling.updateProperties(box, { annotation: HIDDEN });
    }

    return box;
  }
}

BPMNOSAnnotation.$inject = [ 'modeling' ];

/**
 * What the box is placed against: the top left of a shape, or the middle waypoint of a connection — a
 * gatekeeper's box hangs above the flow it belongs to, wherever that flow runs.
 */
function anchorOf(host) {
  if (isFinite(host.x) && isFinite(host.y)) {
    return { x: host.x, y: host.y };
  }

  const waypoints = host.waypoints || [];

  if (!waypoints.length) {
    return null;
  }

  const middle = waypoints[Math.floor(waypoints.length / 2)];

  return isFinite(middle.x) && isFinite(middle.y) ? { x: middle.x - DEFAULT_WIDTH / 2, y: middle.y } : null;
}
