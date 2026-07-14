import { is } from 'bpmn-js/lib/util/ModelUtil';

// Standard bpmn-replace entry ids, grouped so the menu can enforce the activity funnel
//   typed task  <->  untyped task  <->  (flow) sub-process
// A typed task (user/service/... or a decision task) can change type or revert to an untyped task, but
// never become a sub-process. A flow sub-process can be flattened to an untyped task (when collapsed) or
// changed to another sub-process, but never become a typed task. Only the untyped task bridges the two.
// Turning a flow sub-process into an event sub-process is opt-in (config.activityPopupMenu.supportEventSubProcess).
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
  "replace-with-collapsed-subprocess",
  "replace-with-expanded-subprocess",
  "replace-with-ad-hoc-subprocess",
  "replace-with-collapsed-ad-hoc-subprocess",
  "replace-with-transaction",
  "replace-with-call-activity"
];

export default class ActivityPopupMenu {
  constructor(config, popupMenu, bpmnReplace) {
    // opt-in: allow turning a flow sub-process into an event sub-process. Off by default. This is a
    // temporary creation path until bpmn-js-event-subprocess provides a palette entry, after which the
    // option is expected to be dropped.
    this._supportEventSubProcess = !!(config && config.supportEventSubProcess);
    popupMenu.registerProvider("bpmn-replace", this);
    this.replaceElement = bpmnReplace.replaceElement;
  }

  getPopupMenuHeaderEntries(element) {
    return function (entries) {
      return entries;
    };
  }

  getPopupMenuEntries(element) {
    const self = this;

    const untypedTask = {
      label: "Task",
      className: "bpmn-icon-task",
      action: function () {
        const businessObject = element.businessObject;
        delete businessObject.type;
        return self.replaceElement(element, { type: "bpmn:Task", businessObject });
      }
    };

    const decisionTask = {
      label: "Decision Task",
      className: "bpmn-icon-decision-task",
      action: function () {
        const businessObject = element.businessObject;
        businessObject.type = "Decision";
        return self.replaceElement(element, { type: "bpmn:Task", businessObject });
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

      // an event sub-process keeps its own standard menu (later owned by bpmn-js-event-subprocess)
      if ( is(element, "bpmn:SubProcess") && businessObject.triggeredByEvent ) {
        return entries;
      }

      // turning a flow sub-process into an event sub-process is opt-in (see the constructor)
      if ( !self._supportEventSubProcess ) {
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

ActivityPopupMenu.$inject = ["config.activityPopupMenu", "popupMenu", "bpmnReplace"];
