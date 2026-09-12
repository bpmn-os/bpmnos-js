import { is } from 'bpmnlint-utils';

/**
 * What the engine reads from `bpmnos:loopCharacteristics`, and for which kind of loop.
 *
 * A multi-instance activity is sized by `cardinality` and may name an `index` attribute to number its
 * instances (`StateMachine::createMultiInstanceActivityTokens`); a standard loop repeats while `condition`
 * holds, up to `maximum` iterations counted in `index` (`Token::advanceToEntered`, `advanceToExiting`).
 */
export const KNOWN = [ 'cardinality', 'index', 'condition', 'maximum' ];

export const READ_BY = {
  multiInstance: [ 'cardinality', 'index' ],
  standard: [ 'condition', 'maximum', 'index' ]
};

export function loopParametersOf(node) {
  const loopCharacteristics = extensionElementsOf(node)
    .find(element => is(element, 'bpmnos:LoopCharacteristics'));

  return loopCharacteristics ? (loopCharacteristics.get('parameter') || []) : [];
}

/**
 * The value of a loop parameter, or '' when it is missing or blank — which the engine treats alike, since a
 * parameter without an expression is one it cannot evaluate.
 */
export function loopValue(parameters, name) {
  const parameter = parameters.find(parameter => parameter.get('name') === name);

  return parameter ? (parameter.get('value') || '').trim() : '';
}

/**
 * Which loop the engine runs, taken from the BPMN loop characteristics rather than from the parameters:
 * without them it does not loop at all, whatever the parameters say.
 */
export function loopKindOf(node) {
  const loopCharacteristics = node.loopCharacteristics;

  if (!loopCharacteristics) {
    return '';
  }

  return is(loopCharacteristics, 'bpmn:MultiInstanceLoopCharacteristics') ? 'multiInstance' : 'standard';
}

function extensionElementsOf(node) {
  return (node.extensionElements && node.extensionElements.values) || [];
}
