import { getAnnotation, isHidden, VISIBLE, HIDDEN } from './utils/AnnotationUtil';
import { layout } from './utils/AnnotationLayout';

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

    // the host is only reachable through the association, which does not exist yet, so the content height
    // cannot be measured here; BPMNOSAnnotationBehavior fits it once the box is attached
    const height = layout({ incoming: [] }).height;

    // appendShape positions by the new shape's centre
    const position = {
      x: host.x + DEFAULT_WIDTH / 2,
      y: host.y - GAP - height / 2
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
