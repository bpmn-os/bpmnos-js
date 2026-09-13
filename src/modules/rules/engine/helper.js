import { is, isAny } from 'bpmnlint-utils';

function getProcess(node) {
  do {
    if ( is(node, 'bpmn:Process') ) {
      return node;
    }
    node = node.$parent;
  } while ( node );
  return;
}

function requiresCheck(node) {
  const process = getProcess(node) || {};
  if (!process.isExecutable) {
    return false;
  }
  while ( node ) {
    node = node.$parent;
    if ( node && is(node, 'bpmn:SubProcess') && node.isExpanded == false ) {
      return true;
    }
  }
  return true;
}

/**
 * Create a checker that identifies unsupported elements.
 *
 * @param {String} type
 *
 * @return {Function} ruleImpl
 */
function unsupportedNode(description, types, property, value) {

  return function() {
    function check(node, reporter) {
      types = Array.isArray(types) ? types : [ types ];
      if ( requiresCheck(node) && isAny(node, types ) ) {
        if (!property) {
          reporter.report(node.id, description);
        }
        else if ( value == undefined && node[property] ) {
          reporter.report(node.id, description);
        }
        else if ( value != undefined && node[property] === value ) {
          reporter.report(node.id, description);
        }
      }
    }

    return {
      check
    };

  };
}

/**
 * Create a checker that identifies an event carrying an event definition the engine does not execute.
 *
 * The engine parses such an event and then has no handling for it, so a token reaching one departs as it
 * would from an untyped node. That is quieter than a refusal and is why it is reported here.
 *
 * @param {String} description
 * @param {String} definitionType
 *
 * @return {Function} ruleImpl
 */
function unsupportedEventDefinition(description, definitionType) {

  return function() {
    function check(node, reporter) {
      if ( requiresCheck(node) && is(node, 'bpmn:Event') ) {
        if ( (node.eventDefinitions || []).some(definition => is(definition, definitionType)) ) {
          reporter.report(node.id, description);
        }
      }
    }

    return {
      check
    };

  };
}

export { getProcess, requiresCheck, unsupportedNode, unsupportedEventDefinition };
