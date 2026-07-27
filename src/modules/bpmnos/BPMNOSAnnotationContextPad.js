import { canHaveAnnotation, isAnnotation, isHidden, getHost } from './utils/AnnotationUtil';

// bpmn-js puts "Add text annotation" in the 'model' group; joining it and following that key puts our entry
// right next to the annotation icon in the pad.
const ANNOTATION_ENTRY = 'append.text-annotation';
const ENTRY = 'bpmnos-annotation';

// a box keeps nothing of the standard pad; it is still deleted by selecting it and pressing Del
const KEPT_ON_BOX = [];

/**
 * One entry per state: a lightbulb on the host to create or show its execution data, a slashed one to hide
 * it — on the host and on the box itself.
 */
export default class BPMNOSAnnotationContextPad {
  constructor(contextPad, eventBus, bpmnosAnnotation, translate) {
    this._annotation = bpmnosAnnotation;
    this._translate = translate;

    contextPad.registerProvider(this);

    // The pad refreshes itself only when its own element changes, but showing and hiding changes the box —
    // so the host's entry would keep the icon and action it was opened with. Rebuild it, and close the box's
    // own pad when the box it belongs to has just been hidden.
    eventBus.on('element.changed', function(event) {
      const element = event.element;

      if (!isAnnotation(element)) {
        return;
      }

      if (isHidden(element) && contextPad.isOpen(element)) {
        contextPad.close();
        return;
      }

      const host = getHost(element);

      if (host && contextPad.isOpen(host)) {
        contextPad.open(host, true);
      }
    });
  }

  getContextPadEntries(element) {
    const annotation = this._annotation,
          translate = this._translate;

    if (isAnnotation(element)) {
      return function(entries) {
        const kept = {};

        KEPT_ON_BOX.forEach(function(id) {
          if (id in entries) {
            kept[id] = entries[id];
          }
        });

        return {
          [ ENTRY ]: {
            group: 'edit',
            className: 'bpmnos-icon-annotation-hide',
            title: translate('Hide execution data'),
            action: {
              click: function(event, element) {
                annotation.hide(element);
              }
            }
          },
          ...kept
        };
      };
    }

    if (!canHaveAnnotation(element)) {
      return {};
    }

    // an updater, so the entry can be placed after the annotation one rather than appended at the end
    return function(entries) {
      const box = annotation.get(element);

      // one entry that toggles: create it, show it again, or hide the shown one
      const entry = !box
        ? {
          className: 'bpmnos-icon-annotation-show',
          title: translate('Create execution data'),
          action: function(event, element) {
            annotation.create(element);
          }
        }
        : annotation.isHidden(box)
          ? {
            className: 'bpmnos-icon-annotation-show',
            title: translate('Show execution data'),
            action: function() {
              annotation.show(box);
            }
          }
          : {
            className: 'bpmnos-icon-annotation-hide',
            title: translate('Hide execution data'),
            action: function() {
              annotation.hide(box);
            }
          };

      return insertAfter(entries, ANNOTATION_ENTRY, ENTRY, {
        group: 'model',
        className: entry.className,
        title: entry.title,
        action: { click: entry.action }
      });
    };
  }
}

BPMNOSAnnotationContextPad.$inject = [ 'contextPad', 'eventBus', 'bpmnosAnnotation', 'translate' ];

function insertAfter(entries, afterId, id, entry) {
  if (!(afterId in entries)) {
    return { ...entries, [ id ]: entry };
  }

  return Object.keys(entries).reduce(function(result, key) {
    result[key] = entries[key];

    if (key === afterId) {
      result[id] = entry;
    }

    return result;
  }, {});
}
