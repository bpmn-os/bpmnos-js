import ActivityPopupMenu from './ActivityPopupMenu';
import DecisionTaskDecorator from './DecisionTaskDecorator';

// The decision-task renderer plus the activity replace menu (funnel + decision task). See
// ActivityPopupMenu for the type-change rules and the supportEventSubProcess option.
export default {
  __init__: [ 'activityPopupMenu', 'decisionTaskDecorator' ],
  activityPopupMenu: [ 'type', ActivityPopupMenu ],
  decisionTaskDecorator: [ 'type', DecisionTaskDecorator ]
};
