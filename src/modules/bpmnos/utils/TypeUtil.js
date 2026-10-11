/**
 * The types of an attribute as far as the modeller distinguishes them.
 *
 * An attribute's `type` is either one of the scalar types or a custom type, the schema of an array or of a
 * value with fields, e.g. `integer[5]` or `{ x: decimal, flags: boolean[3] }[]`. The schema is written in the
 * engine's grammar and read by the engine alone, so nothing here parses it: a custom type is any type that is
 * not a scalar one.
 */

/** The scalar types an attribute may have. */
export const SCALAR_TYPES = [ 'integer', 'decimal', 'boolean', 'string' ];

/** The types an attribute contributing to the objective may have, the engine refusing an objective otherwise. */
export const OBJECTIVE_TYPES = [ 'integer', 'decimal', 'boolean' ];

/**
 * Returns true if the type is a scalar type.
 *
 * @param {string} type
 *
 * @return {boolean}
 */
export function isScalarType(type) {
  return SCALAR_TYPES.includes(type);
}

/**
 * Returns true if an attribute of the type may contribute to the objective.
 *
 * @param {string} type
 *
 * @return {boolean}
 */
export function isObjectiveType(type) {
  return OBJECTIVE_TYPES.includes(type);
}

/**
 * Returns the type without whitespace, which the grammar of types ignores, so that two ways of spacing one
 * type compare equal.
 *
 * @param {string} type
 *
 * @return {string}
 */
export function normalizeType(type) {
  return (type || '').replace(/\s+/g, '');
}
