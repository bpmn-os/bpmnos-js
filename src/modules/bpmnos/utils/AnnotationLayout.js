import { getAnnotationContent } from './AnnotationContent';
import { getHost, isCollapsed } from './AnnotationUtil';

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
  // the content decides what a fold hides, so it is given the box's fold state
  const collapsedGroup = key => isCollapsed(box, key);

  const host = getHost(box),
        content = host
          ? getAnnotationContent(host, executionData, collapsedGroup)
          : { title: '', compartments: [] };

  const rows = [ { kind: 'title', text: content.title, y: 0, height: HEADER_HEIGHT } ],
        separators = [];

  let y = HEADER_HEIGHT;

  const items = function(list) {
    list.forEach(function(item) {

      // an item may itself be a fold — the header and content of a message, say
      rows.push({
        kind: item.kind || 'item',
        key: item.key,
        type: item.type,
        text: item.text,
        indent: item.indent || 0,
        y,
        height: ITEM_HEIGHT
      });

      y += ITEM_HEIGHT;
    });
  };

  (content.compartments || []).forEach(function(compartment) {
    separators.push(y);

    y += COMPARTMENT_PADDING / 2;

    // Globals are inherited by everything, so the compartment folds as a whole and its label is the
    // toggle; Status and Data list what the element declares and fold only what it inherits.
    const foldsWhole = !compartment.own.length && compartment.inherited.length && compartment.key === 'globals',
          collapsed = isCollapsed(box, compartment.key);

    if (foldsWhole) {
      rows.push({
        kind: 'toggle',
        key: compartment.key,
        text: `${collapsed ? '▸' : '▾'} ${compartment.label} (${compartment.inherited.length})`,
        y,
        height: LABEL_HEIGHT
      });
      y += LABEL_HEIGHT;

      if (!collapsed) {
        items(compartment.inherited);
      }
    } else {
      rows.push({ kind: 'label', text: compartment.label, y, height: LABEL_HEIGHT });
      y += LABEL_HEIGHT;

      if (compartment.inherited.length) {
        rows.push({
          kind: 'toggle',
          key: compartment.key,
          text: `${collapsed ? '▸' : '▾'} inherited (${compartment.inherited.length})`,
          y,
          height: ITEM_HEIGHT
        });
        y += ITEM_HEIGHT;

        if (!collapsed) {
          items(compartment.inherited);
        }
      }

      items(compartment.own);
    }

    y += COMPARTMENT_PADDING / 2;
  });

  return { rows, separators, height: Math.max(y, HEADER_HEIGHT) };
}
