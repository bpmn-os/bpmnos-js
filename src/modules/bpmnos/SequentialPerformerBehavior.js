import inherits from 'inherits';

import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';

import { is } from 'bpmn-js/lib/util/ModelUtil';

import { createElement } from './utils/ElementUtil.js';
import { declaresSequentialPerformer } from './utils/PerformerUtil.js';

/**
 * Declares a sequential performer at every ad-hoc subprocess that is created without one, since the engine
 * refuses an ad-hoc subprocess without a sequential performer. Creating, appending, replacing and pasting a
 * shape all create it through `shape.create`, so that the performer is added in the same undo step. The
 * properties panel removes it again where the ad-hoc subprocess is to share the performer of an enclosing
 * node.
 */
export default function SequentialPerformerBehavior(eventBus, modeling, bpmnFactory) {

  CommandInterceptor.call(this, eventBus);

  // unwrapped: the handler receives the command context
  this.postExecuted('shape.create', function(context) {
    const shape = context.shape;

    if (!is(shape, 'bpmn:AdHocSubProcess') || declaresSequentialPerformer(shape.businessObject)) {
      return;
    }

    const businessObject = shape.businessObject;
    const performer = createElement('bpmn:Performer', { name: 'Sequential' }, businessObject, bpmnFactory);

    modeling.updateProperties(shape, { resources: [ ...(businessObject.get('resources') || []), performer ] });
  }, true);
}

inherits(SequentialPerformerBehavior, CommandInterceptor);

SequentialPerformerBehavior.$inject = [
  'eventBus',
  'modeling',
  'bpmnFactory'
];
