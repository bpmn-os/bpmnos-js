import { getExecutionData, isHidden, VISIBLE, HIDDEN } from './utils/ExecutionDataUtil';
import { layout } from './utils/ExecutionDataLayout';

// default width; the user owns it from then on, while the height always follows the content
export const DEFAULT_WIDTH = 180;

// distance between the host's top edge and the bottom of a freshly created box
const GAP = 40;

/**
 * Creating, finding, showing and hiding the execution data box of an element. One box per element.
 */
export default class ExecutionData {
  constructor(modeling) {
    this._modeling = modeling;
  }

  get(host) {
    return getExecutionData(host);
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
    // cannot be measured here; ExecutionDataBehavior fits it once the box is attached
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

      // picked up by ExecutionDataBehavior, which marks the annotation within the same undo step
      { executionData: VISIBLE }
    );
  }

  show(box) {
    if (isHidden(box)) {
      this._modeling.updateProperties(box, { executionData: VISIBLE });
    }

    return box;
  }

  hide(box) {
    if (!isHidden(box)) {
      this._modeling.updateProperties(box, { executionData: HIDDEN });
    }

    return box;
  }
}

ExecutionData.$inject = [ 'modeling' ];
