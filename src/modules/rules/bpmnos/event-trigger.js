import { is } from 'bpmnlint-utils';

/**
 * A rule that checks that a timer event says when it fires, a conditional event says on what, and a signal
 * event says which signal it is.
 *
 * The engine binds `bpmnos:timer` to timer start, boundary and catch events and expects a parameter telling
 * it when to trigger (`Timer`), and binds `bpmnos:restrictions` to conditional events as the conditions
 * deciding whether they trigger (`Conditions`). Without those the event never fires, which is a silent
 * failure at execution rather than an error.
 *
 * A signal event is different in that the engine refuses the model outright, a signal being matched by its
 * name and there being none to match. The rule reports it where it is written rather than leaving it to the
 * refusal.
 *
 * Whether what they refer to is declared is the business of `attribute-undeclared`.
 */
export default function() {

  function check(node, reporter) {
    if (!is(node, 'bpmn:Event')) {
      return;
    }

    const eventDefinitions = node.eventDefinitions || [],
          extensionElements = (node.extensionElements && node.extensionElements.values) || [];

    if (eventDefinitions.some(definition => is(definition, 'bpmn:TimerEventDefinition'))) {
      const timer = extensionElements.find(element => is(element, 'bpmnos:Timer'));

      if (!timer || !(timer.get('parameter') || []).length) {
        reporter.report(node.id, 'Timer event without a trigger', { subtype: 'timer' });
      }
    }

    if (eventDefinitions.some(definition => is(definition, 'bpmn:ConditionalEventDefinition'))) {
      const restrictions = extensionElements.find(element => is(element, 'bpmnos:Restrictions'));

      if (!restrictions || !(restrictions.get('restriction') || []).length) {
        reporter.report(node.id, 'Conditional event without a condition', { subtype: 'condition' });
      }
    }

    if (eventDefinitions.some(definition => is(definition, 'bpmn:SignalEventDefinition'))) {
      const signal = extensionElements.find(element => is(element, 'bpmnos:Signal'));

      if (!signal) {
        reporter.report(node.id, 'Signal event without a signal', { subtype: 'signal' });
      }
    }
  }

  return {
    check
  };

};
