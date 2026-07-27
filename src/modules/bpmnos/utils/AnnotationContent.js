/**
 * The content of an element's execution data box, as plain data:
 *
 *   {
 *     title: String,                                     // header compartment, naming the element
 *     compartments: [ { label: String, items: [ String ] } ]
 *   }
 *
 * AnnotationLayout turns this into rows and a height, and the renderer draws one compartment per entry,
 * in order, whatever their number — so this is the only file to change once the content is specified. It
 * touches no canvas API, so a documentation generator can render a box straight from the model.
 *
 * TODO: the compartments below are placeholders. Replace with the status attributes, data, globals,
 * operators and restrictions the element declares; drop a compartment (or return none) when it has no items.
 */
export function getAnnotationContent(element) {
  return {
    title: element.id,
    compartments: [
      {
        label: 'Attributes',
        items: [ 'attribute: type', 'attribute: type' ]
      },
      {
        label: 'Operators',
        items: [ 'operator' ]
      }
    ]
  };
}
