import { getAnnotationContent } from './AnnotationContent.js';
import { getHost, isCollapsed } from './AnnotationUtil.js';

// Row metrics of the box. A UML-class-diagram shape in spirit: the header names the element, then one
// compartment per kind of declaration, separated by full-width rules.
export const HEADER_HEIGHT = 24;
export const LABEL_HEIGHT = 13;
export const ITEM_HEIGHT = 15;
export const COMPARTMENT_PADDING = 5;
export const PADDING_X = 8;

// the gap between the two rules that separate the declarations from the sequence; two hairlines rather than
// one thicker rule, since a gap survives zooming out and a weight difference does not
export const DOUBLE_GAP = 3;

/**
 * Turn a box into rows to draw and a height to fit. The content is derived from the host through the
 * execution data registry; the box itself stores none of it.
 *
 * @returns { rows: [ { kind, text, y, height } ], separators: [ { y, double } ], height }
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

  let y = HEADER_HEIGHT,
      previousGroup = null;

  const items = function(list) {
    list.forEach(function(item) {

      // an item may itself be a fold — the header and content of a message, say
      rows.push({
        kind: item.kind || 'item',
        key: item.key,

        // a fold's own state, which the renderer turns into the direction of its caret
        collapsed: item.collapsed || false,
        type: item.type,
        text: item.text,

        // an entry standing in for a name the model does not carry, which the renderer marks; where only
        // part of the row stands in, that part follows the text and is marked alone
        fallback: item.fallback || false,
        fallbackText: item.fallbackText || '',

        // a label set lighter than a compartment's own, as the kinds within a guidance are
        subdued: item.subdued || false,
        indent: item.indent || 0,
        y,
        height: ITEM_HEIGHT
      });

      y += ITEM_HEIGHT;
    });
  };

  (content.compartments || []).forEach(function(compartment) {

    // the boundary between the declarations and the execution sequence is drawn twice; it exists only where
    // both halves do, and never right below the header
    const group = compartment.group || 'declared',
          double = Boolean(previousGroup) && previousGroup !== group;

    separators.push({ y, double });

    previousGroup = group;

    y += double ? DOUBLE_GAP : 0;
    y += COMPARTMENT_PADDING / 2;

    // A compartment either folds as a whole, its label being the toggle — globals, which are inherited by
    // everything, and guidance, which is bulky and rarely what a reader is after — or lists what the
    // element declares and folds only what it inherits, as Status and Data do.
    const foldsWhole = compartment.foldsWhole
      || (!compartment.own.length && compartment.inherited.length && compartment.key === 'globals');

    const collapsed = isCollapsed(box, compartment.key);

    // what a chevron counts is entries, which is not what it hides where an entry takes more than one row
    const inheritedCount = compartment.inheritedCount === undefined
            ? compartment.inherited.length
            : compartment.inheritedCount,
          ownCount = compartment.ownCount === undefined ? compartment.own.length : compartment.ownCount;

    if (foldsWhole) {
      const folded = compartment.own.length ? compartment.own : compartment.inherited,
            foldedCount = compartment.own.length ? ownCount : inheritedCount,
            count = compartment.count === undefined ? foldedCount : compartment.count;

      // a count where the entries are of one kind and countable; none where they are not, as in guidance,
      // which holds attributes, operators and restrictions at once
      const label = count === null ? compartment.label : `${compartment.label} (${count})`;

      rows.push({
        kind: 'toggle',
        key: compartment.key,
        text: label,
        collapsed,

        // a fold that stands for a compartment is set as a compartment label rather than as apparatus
        emphasis: Boolean(compartment.emphasis),
        y,
        height: LABEL_HEIGHT
      });
      y += LABEL_HEIGHT;

      if (!collapsed) {
        items(folded);
      }
    } else {
      rows.push({ kind: 'label', text: compartment.label, y, height: LABEL_HEIGHT });
      y += LABEL_HEIGHT;

      if (compartment.inherited.length) {
        rows.push({
          kind: 'toggle',
          key: compartment.key,
          text: `inherited (${inheritedCount})`,
          collapsed,
          y,
          height: ITEM_HEIGHT
        });
        y += ITEM_HEIGHT;

        if (!collapsed) {
          items(compartment.inherited);
        }
      }

      // What the element declares itself folds too, under a chevron of its own — open unless the reader has
      // closed it, since it is the half the box is usually consulted for. A compartment that makes no such
      // split (a kind the element simply carries, such as the conditions) has no `ownKey` and no chevron.
      if (compartment.ownKey && compartment.own.length) {
        const ownCollapsed = isCollapsed(box, compartment.ownKey);

        rows.push({
          kind: 'toggle',
          key: compartment.ownKey,
          text: `owned (${ownCount})`,
          collapsed: ownCollapsed,
          y,
          height: ITEM_HEIGHT
        });
        y += ITEM_HEIGHT;

        if (!ownCollapsed) {
          items(compartment.own);
        }
      } else {
        items(compartment.own);
      }
    }

    y += COMPARTMENT_PADDING / 2;
  });

  return { rows, separators, height: Math.max(y, HEADER_HEIGHT) };
}
