import { getAnnotationContent } from './AnnotationContent';
import { getHost } from './AnnotationUtil';

// Row metrics of the box. A UML-class-diagram shape in spirit: the header names the element, then one
// compartment per kind of declaration, separated by full-width rules.
export const HEADER_HEIGHT = 24;
export const LABEL_HEIGHT = 13;
export const ITEM_HEIGHT = 15;
export const COMPARTMENT_PADDING = 5;
export const PADDING_X = 8;

/**
 * Turn a box into rows to draw and a height to fit. The content is derived from the host through the
 * execution data registry; the box itself stores none of it.
 *
 * @returns { rows: [ { kind, text, y, height } ], separators: [ y ], height }
 */
export function layout(box, executionData) {
  const host = getHost(box),
        content = host ? getAnnotationContent(host, executionData) : { title: '', compartments: [] };

  const rows = [ { kind: 'title', text: content.title, y: 0, height: HEADER_HEIGHT } ],
        separators = [];

  let y = HEADER_HEIGHT;

  (content.compartments || []).forEach(function(compartment) {
    separators.push(y);

    y += COMPARTMENT_PADDING / 2;

    if (compartment.label) {
      rows.push({ kind: 'label', text: compartment.label, y, height: LABEL_HEIGHT });
      y += LABEL_HEIGHT;
    }

    (compartment.items || []).forEach(function(item) {
      rows.push({ kind: 'item', type: item.type, text: item.text, y, height: ITEM_HEIGHT });
      y += ITEM_HEIGHT;
    });

    y += COMPARTMENT_PADDING / 2;
  });

  return { rows, separators, height: Math.max(y, HEADER_HEIGHT) };
}
