import inherits from 'inherits';

import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';

import { is } from 'bpmn-js/lib/util/ModelUtil';

import { createElement } from './utils/ElementUtil.js';
import { declaresSequentialPerformer } from './utils/PerformerUtil.js';

/**
 * Makes every ad-hoc subprocess created in the modeller one the engine accepts. The engine refuses an ad-hoc
 * subprocess whose ordering is not `Sequential` (`SequentialAdHocSubProcess.cpp`), an unset ordering meaning
 * `Parallel` by the default of BPMN, and one without a sequential performer. An ad-hoc subprocess created
 * without an ordering is therefore given the ordering `Sequential`, written into the model rather than only
 * shown, and one created without a performer declares a sequential performer. Creating, appending, replacing
 * and pasting a shape all create it through `shape.create`, so that both are added in the same undo step. An
 * ordering the shape already carries, as a pasted copy may, is left as it is, and the properties panel removes
 * the performer again where the ad-hoc subprocess is to share the performer of an enclosing node.
 */
export default function SequentialPerformerBehavior(eventBus, modeling, bpmnFactory) {

  CommandInterceptor.call(this, eventBus);

  // unwrapped: the handler receives the command context
  this.postExecuted('shape.create', function(context) {
    const shape = context.shape;

    if (!is(shape, 'bpmn:AdHocSubProcess')) {
      return;
    }

    const businessObject = shape.businessObject;
    const properties = {};

    if (!businessObject.get('ordering')) {
      properties.ordering = 'Sequential';
    }

    if (!declaresSequentialPerformer(businessObject)) {
      const performer = createElement('bpmn:Performer', { name: 'Sequential' }, businessObject, bpmnFactory);
      properties.resources = [ ...(businessObject.get('resources') || []), performer ];
    }

    if (Object.keys(properties).length) {
      modeling.updateProperties(shape, properties);
    }
  }, true);
}

inherits(SequentialPerformerBehavior, CommandInterceptor);

SequentialPerformerBehavior.$inject = [
  'eventBus',
  'modeling',
  'bpmnFactory'
];
