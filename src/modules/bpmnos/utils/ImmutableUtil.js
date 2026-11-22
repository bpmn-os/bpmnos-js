/**
 * Immutable attributes, read from the moddle tree alone, so that the properties panel and a test ask the same
 * way and the module is loadable under Node.
 *
 * An attribute declared immutable, `immutable="true"`, receives its value when the scope declaring it is
 * initialised, from its initial value, from the instance data or, for an attribute of a process, a subprocess
 * or an event subprocess, from the operators of the start event of that scope, and nothing changes it
 * afterwards. An attribute not declared immutable may be changed by the model and by the environment of a run.
 */

/** The identifiers of the attributes the engine writes or holds fixed itself, which are never declared immutable. */
const ENGINE_ATTRIBUTES = [ 'Time', 'Timestamp', 'Instance' ];

/**
 * Returns true if the attribute is declared immutable.
 *
 * @param {ModdleElement} attribute  a `bpmnos:Attribute`
 *
 * @return {boolean}
 */
export function isImmutable(attribute) {
  return attribute.get('immutable') === true;
}

/**
 * Returns true if the attribute may be declared immutable.
 *
 * The engine writes the time at every clock tick and the timestamp of a token at every change of its state,
 * so neither can be immutable, and the instance is immutable whether or not it is declared so, nothing being
 * allowed to write it. An attribute of a guidance takes the values the operators of the guidance give it at
 * every evaluation, so that immutability means nothing for it.
 *
 * @param {ModdleElement} attribute  a `bpmnos:Attribute`
 *
 * @return {boolean}
 */
export function mayBeImmutable(attribute) {
  if ( ENGINE_ATTRIBUTES.includes(attribute.get('id')) ) {
    return false;
  }

  const container = attribute.$parent && attribute.$parent.$parent;

  return !( container && container.$instanceOf && container.$instanceOf('bpmnos:Guidance') );
}
