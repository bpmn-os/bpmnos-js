import ActivityPopupMenu from './ActivityPopupMenu.js';
import DecisionTaskDecorator from './DecisionTaskDecorator.js';

// The decision-task renderer plus the activity replace menu (funnel + decision task). See
// ActivityPopupMenu for the type-change rules and the unlockedTriggeredByEvent option.
export default {
  __init__: [ 'activityPopupMenu', 'decisionTaskDecorator' ],
  activityPopupMenu: [ 'type', ActivityPopupMenu ],
  decisionTaskDecorator: [ 'type', DecisionTaskDecorator ]
};
