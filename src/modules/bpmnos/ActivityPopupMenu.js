import { is } from 'bpmn-js/lib/util/ModelUtil';

// Standard bpmn-replace entry ids, grouped so the menu can enforce the activity funnel
//   typed task  <->  untyped task  <->  (flow) sub-process
// A typed task (user/service/... or a decision task) can change type or revert to an untyped task, but
// never become a sub-process. A flow sub-process can be flattened to an untyped task (when collapsed) or
// changed to another sub-process, but never become a typed task. Only the untyped task bridges the two.
// Whether an activity's triggeredByEvent can be flipped (flow activity <-> event sub-process) is gated by
// config.activityPopupMenu.unlockedTriggeredByEvent (locked by default).
const TYPED_TASK_ENTRIES = [
  "replace-with-user-task",
  "replace-with-service-task",
  "replace-with-send-task",
  "replace-with-receive-task",
  "replace-with-manual-task",
  "replace-with-rule-task",
  "replace-with-script-task",
  "replace-with-decision-task"
];

const SUBPROCESS_ENTRIES = [
  "replace-with-subprocess", // the generic "Sub-process" from the transaction / event-sub-process option set
  "replace-with-collapsed-subprocess",
  "replace-with-expanded-subprocess",
  "replace-with-ad-hoc-subprocess",
  "replace-with-collapsed-ad-hoc-subprocess",
  "replace-with-transaction",
  "replace-with-call-activity"
];

export default class ActivityPopupMenu {
  constructor(config, popupMenu, bpmnReplace, modeling) {
    // Locked by default: event sub-processes stay separate from flow activities. A flow activity cannot be
    // turned into an event sub-process, and an event sub-process cannot be turned into a task or a flow
    // sub-process. Unlock to let triggeredByEvent be flipped in both directions.
    this._triggeredByEventUnlocked = !!(config && config.unlockedTriggeredByEvent);
    // register below the default priority (1000) so this runs after bpmn-js's ReplaceMenuProvider has
    // populated the entries, letting the funnel add and remove options against the final set
    popupMenu.registerProvider("bpmn-replace", 500, this);
    this.replaceElement = bpmnReplace.replaceElement;
    this.modeling = modeling;
  }

  getPopupMenuHeaderEntries(element) {
    return function (entries) {
      return entries;
    };
  }

  getPopupMenuEntries(element) {
    const self = this;

    // Toggle the BPMNOS `type` on a fresh element. A decision task is a plain bpmn:Task carrying
    // type="Decision"; reverting clears it. Never reuse the old businessObject (that corrupts a typed
    // subtype such as a user task); let replaceElement build a clean bpmn:Task and set the attribute
    // via modeling so it is a proper, undoable model change.
    const setType = function (type) {
      let target = element;
      if (target.type !== "bpmn:Task") {
        target = self.replaceElement(target, { type: "bpmn:Task" });
      }
      if ((target.businessObject.type || undefined) !== type) {
        self.modeling.updateProperties(target, { type: type });
      }
      return target;
    };

    const untypedTask = {
      label: "Task",
      className: "bpmn-icon-task",
      action: function () {
        return setType(undefined);
      }
    };

    const decisionTask = {
      label: "Decision Task",
      className: "bpmn-icon-decision-task",
      action: function () {
        return setType("Decision");
      }
    };

    // flatten a sub-process to a fresh, untyped task (its contents are dropped)
    const toTask = {
      label: "Task",
      className: "bpmn-icon-task",
      action: function () {
        return self.replaceElement(element, { type: "bpmn:Task" });
      }
    };

    return function (entries) {
      const businessObject = element.businessObject;

      // an event sub-process is not a flow activity: by default it never becomes a task or a flow
      // sub-process. bpmn-js offers those conversions for both a collapsed event sub-process (the plain
      // task/sub-process replace options) and an expanded one (the EVENT_SUB_PROCESS set carries the same
      // task/sub-process targets), so strip them unless conversion is enabled.
      if ( is(element, "bpmn:SubProcess") && businessObject.triggeredByEvent ) {
        if ( !self._triggeredByEventUnlocked ) {
          [ "replace-with-task", ...TYPED_TASK_ENTRIES, ...SUBPROCESS_ENTRIES ].forEach(function (id) {
            delete entries[id];
          });
        }
        return entries;
      }

      // turning a flow sub-process into an event sub-process is opt-in (see the constructor)
      if ( !self._triggeredByEventUnlocked ) {
        delete entries["replace-with-event-subprocess"];
      }

      if ( is(element, "bpmn:Task") ) {
        // Task and Decision Task at the top, in that order, above the standard task types
        entries = {
          "replace-with-task": untypedTask,
          "replace-with-decision-task": decisionTask,
          ...entries
        };
        // drop the entry matching the element's current identity (a plain task needs no "Task", a
        // decision task needs no "Decision Task")
        if ( element.type === "bpmn:Task" ) {
          delete entries[ businessObject.type === "Decision" ? "replace-with-decision-task" : "replace-with-task" ];
        }
        // a typed task can change type or revert to a task but never become a sub-process; an untyped
        // task keeps the sub-process options
        if ( element.type !== "bpmn:Task" || businessObject.type ) {
          SUBPROCESS_ENTRIES.forEach(function (id) { delete entries[id]; });
        }
        return entries;
      }

      if ( is(element, "bpmn:SubProcess") || is(element, "bpmn:CallActivity") ) {
        // a sub-process never becomes a typed task
        TYPED_TASK_ENTRIES.forEach(function (id) { delete entries[id]; });
        // a collapsed sub-process or a call activity can be flattened to an (untyped) task
        if ( element.collapsed || is(element, "bpmn:CallActivity") ) {
          entries = { "replace-with-task": toTask, ...entries };
        }
        return entries;
      }

      return entries;
    };
  }
}

ActivityPopupMenu.$inject = ["config.activityPopupMenu", "popupMenu", "bpmnReplace", "modeling"];
