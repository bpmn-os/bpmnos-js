#!/usr/bin/env node

// Model documentation for BPMN-OS: one markdown file per model, holding the diagrams and the execution data
// of every node.
//
// The diagrams come from the same renderer as `bpmnos2svg` (bpmn-workbench's headless bpmn-js driver, which
// also emits one SVG per collapsed sub-process). The execution data comes from this app's `executionData`
// registry, so documentation and modeller answer "what does this node declare and inherit" through one
// implementation. What the tool reports therefore grows with the registry: attributes now, operators and
// restrictions once it holds them.

import fs from 'node:fs';
import path from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer-core';
import { Launcher } from 'chrome-launcher';

import { renderBpmnToSvg, withDevServer } from 'bpmn-workbench/bpmn2svg';

const appDir = dirname(fileURLToPath(import.meta.url));

const USAGE = 'usage: bpmnosdoc [-o <outDir>] <model.bpmn> [...]';

function parseArgs(argv) {
  const files = [];
  let outDir = '.';

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '-o' || argv[i] === '--out') {
      outDir = argv[++i];
    } else if (argv[i] === '-h' || argv[i] === '--help') {
      return null;
    } else {
      files.push(argv[i]);
    }
  }

  return files.length ? { files, outDir } : null;
}

/**
 * Import a model in the running app and read back, per node, its documentation and what it declares and
 * inherits.
 *
 * Only plain values cross the page boundary — bpmn-js elements are cyclic — so registry entries are
 * flattened here.
 */
async function collectModel(page, diagram) {
  await page.evaluate((xml) => modeler.importXML(xml), diagram);

  return page.evaluate(() => {
    const registry = modeler.get('elementRegistry');
    const executionData = modeler.get('executionData');

    const textOf = (businessObject) => businessObject
      ? (businessObject.get('documentation') || []).map((d) => d.text || '').filter(Boolean).join('\n\n')
      : '';

    // a pool's documentation lives on the process it refers to, so take both
    const documentationOf = (businessObject) => [
      textOf(businessObject),
      textOf(businessObject.get && businessObject.get('processRef'))
    ].filter(Boolean).join('\n\n');

    const attribute = (a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      objective: a.objective,
      weight: a.weight,
      declaringElement: a.declaringElement
    });

    const restriction = (r) => ({
      id: r.id,
      expression: r.expression,
      scope: r.scope,
      declaringElement: r.declaringElement
    });

    // a message or signal, flattened: name, header parameters, and the contents mapping attributes to keys
    const exchange = (definition) => ({
      name: definition.name,
      parameters: (definition.parameters || []).map((p) => ({ name: p.name, value: p.value })),
      contents: (definition.contents || []).map((c) => ({ key: c.key, attribute: c.attribute }))
    });

    const processRefOf = (businessObject) => {
      const processRef = businessObject.get && businessObject.get('processRef');

      return processRef ? processRef.id : '';
    };

    const nodes = registry.getAll()
      .filter((element) => element.type !== 'label')
      .map((element) => {
        const {
          status, data, globals, conditions, timer, loop, loopKind, choices, operators, messages, signal,
          entryRestrictions, completionRestrictions, exitRestrictions, guidance
        } = executionData.get(element);

        // a pool stands for the process it refers to: that process documents it, owns its attributes, and
        // is what gets named — a participant id is never shown
        const processRef = processRefOf(element.businessObject);

        return {
          id: element.id,
          isSequenceFlow: element.type === 'bpmn:SequenceFlow',
          displayId: processRef || element.id,
          ids: [ element.id, processRef ].filter(Boolean),
          type: element.type.replace('bpmn:', ''),
          name: element.businessObject.name || '',
          processRef,
          documentation: documentationOf(element.businessObject),
          status: status.map(attribute),
          data: data.map(attribute),
          globals: globals.map(attribute),
          conditions: conditions.map((c) => ({ id: c.id, expression: c.expression })),
          timer: timer.map((t) => ({ name: t.name, value: t.value })),
          loop: loop.map((p) => ({ name: p.name, value: p.value })),
          loopKind,
          choices: choices.map((c) => ({ id: c.id, condition: c.condition })),
          entryRestrictions: entryRestrictions.map(restriction),
          completionRestrictions: completionRestrictions.map(restriction),
          exitRestrictions: exitRestrictions.map(restriction),
          operators: operators.map((o) => ({ id: o.id, expression: o.expression })),
          messages: messages.map(exchange),
          signal: signal.map(exchange),
          guidance: guidance.map((g) => ({
            type: g.type,
            attributes: g.attributes.map(attribute),
            operators: g.operators.map((o) => ({ id: o.id, expression: o.expression })),
            restrictions: g.restrictions.map(restriction)
          })),

          // a receive, decision or catching node applies its operators after the message, everything else
          // before it (Token::advanceToBusy / advanceToCompleted)
          operatorsOnCompletion: element.businessObject.$instanceOf('bpmn:ReceiveTask')
            || element.businessObject.get('type') === 'Decision'
            || element.businessObject.$instanceOf('bpmn:CatchEvent')
        };
      });

    const tables = executionData.getTables().map((t) => ({
      id: t.id,
      name: t.name,
      source: t.source,
      header: t.header
    }));

    const root = registry.getAll().find((element) => element.type === 'bpmn:Process')
      || registry.getAll().find((element) => element.type === 'bpmn:Collaboration');

    return {
      root: root && {
        id: root.id,
        displayId: processRefOf(root.businessObject) || root.id,
        ids: [ root.id, processRefOf(root.businessObject) ].filter(Boolean),
        type: root.type.replace('bpmn:', ''),
        name: root.businessObject.name || '',
        processRef: processRefOf(root.businessObject),
        documentation: documentationOf(root.businessObject)
      },
      nodes,
      tables
    };
  });
}

/**
 * GitHub's heading slugs: lowercase, drop everything but word characters, spaces and hyphens, spaces to
 * hyphens, and a numeric suffix for repeats. Kept next to the code that writes the headings, since the two
 * must agree for the links to resolve.
 */
function createSlugger() {
  const seen = new Map();

  return function(text) {
    const base = text.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-'),
          count = seen.get(base) || 0;

    seen.set(base, count + 1);

    return count ? `${base}-${count}` : base;
  };
}

/**
 * A process is titled by its name — a pool counting as the process it refers to — and everything else by
 * type and id, since only processes are things a reader knows by name.
 */
function headingText(node) {
  const id = node.displayId || node.id;

  if (node.type === 'Process' || node.processRef) {
    return (node.name ? node.name + ' ' : '') + '`' + id + '`';
  }

  return `${node.type} \`${id}\``;
}

function hasContent(node) {
  if (node.isSequenceFlow) {
    return !!(node.documentation || node.conditions.length);
  }

  return !!(node.documentation || node.status.length || node.data.length || node.globals.length
    || node.conditions.length || node.timer.length || node.loop.length
    || node.choices.length || node.operators.length
    || node.entryRestrictions.length || node.completionRestrictions.length || node.exitRestrictions.length
    || node.messages.length || node.signal.length || node.guidance.length);
}

/**
 * `*type:* **name**` followed by the owner when the attribute is inherited, or by its initialization when
 * it is the node's own and has one.
 *
 * The model keeps name and initialization in one string, `name := expression`, as the properties panel
 * edits them ("Name (and initial value)"). An owner is linked to the section documenting it when there is
 * one — the owner is a scope, while sections are canvas elements, so a process is found under its pool.
 */
function attributeItem(attribute, ownIds, anchors) {
  const raw = attribute.name || attribute.id,
        separator = raw.indexOf(':=');

  const name = separator === -1 ? raw.trim() : raw.slice(0, separator).trim();

  const parts = [];

  if (attribute.type) {
    parts.push(`*${attribute.type}:*`);
  }

  parts.push(`**${name}**`);

  if (!ownIds.includes(attribute.declaringElement)) {
    const owner = '`' + attribute.declaringElement + '`',
          anchor = anchors.get(attribute.declaringElement);

    parts.push(`(from ${anchor ? `[${owner}](#${anchor})` : owner})`);
  } else if (separator !== -1) {
    parts.push('(initialized by `' + raw.trim() + '`)');
  }

  return [ '- ' + parts.join(' '), ...objectiveTerm(attribute, name) ];
}

/**
 * The objective term an attribute contributes, as a line beneath its declaration:
 * `→ minimize 1 * distance`.
 *
 * Shown wherever the attribute is listed, as its type is, because the objective belongs to the attribute
 * rather than to the node reading it — which is what lets a global's objective be seen at all, globals
 * being declared on the collaboration and inherited everywhere. An objective of `none`, or none at all,
 * contributes nothing (`Attribute.cpp:48-63`). A weight is required whenever there is an objective; when a
 * model omits it, the term is shown without one rather than inventing a factor.
 */
function objectiveTerm(attribute, name) {
  const objective = attribute.objective;

  if (!objective || objective === 'none') {
    return [];
  }

  const weight = attribute.weight;

  const factor = weight === undefined || weight === null || weight === '' ? '' : `${weight} * `;

  return [ `  - \`→ ${objective} ${factor}${name || attribute.id}\`` ];
}

/**
 * A restriction as written, naming its owner when it is inherited rather than declared here. Nothing is said
 * about its scope: the section it sits in is when it is checked, and a full-scope one sits in all three.
 */
function restrictionItem(restriction, ownIds, anchors) {
  const parts = [ '`' + (restriction.expression || restriction.id) + '`' ];

  if (!ownIds.includes(restriction.declaringElement)) {
    const owner = '`' + restriction.declaringElement + '`',
          anchor = anchors.get(restriction.declaringElement);

    parts.push(`(from ${anchor ? `[${owner}](#${anchor})` : owner})`);
  }

  return '- ' + parts.join(' ');
}

function restrictionSection(title, restrictions, ownIds, level, anchors, slug) {
  if (!restrictions.length) {
    return [];
  }

  slug(title);

  return [
    '#'.repeat(level) + ' ' + title,
    '',
    ...restrictions.map((r) => restrictionItem(r, ownIds, anchors)),
    ''
  ];
}

function listSection(title, items, level, slug) {
  if (!items.length) {
    return [];
  }

  slug(title);

  return [ '#'.repeat(level) + ' ' + title, '', ...items.map((item) => '- ' + item), '' ];
}

/**
 * A message or signal as a subsection of its own: the name as the heading, its parameters and contents as
 * the list beneath. Markdown gives the nesting, so no indentation is needed.
 */
function exchangeSections(title, definitions, level, slug) {
  if (!definitions.length) {
    return [];
  }

  slug(title);

  const out = [ '#'.repeat(level) + ' ' + title, '' ];

  definitions.forEach((definition) => {
    const heading = definition.name || '(unnamed)';

    slug(heading);
    out.push('#'.repeat(level + 1) + ' *Name* ' + heading, '');

    // the header the engine matches senders and recipients on, then the content carried; both always
    // shown with their count, so an empty header reads as such
    const group = (title, entries, render) => {
      slug(`${title} (${entries.length})`);
      out.push(`${'#'.repeat(level + 2)} ${title} (${entries.length})`, '');
      entries.forEach((entry) => out.push(render(entry)));
      out.push('');
    };

    group('Header', definition.parameters, (p) => `- *${p.name}:* \`${p.value}\``);
    group('Content', definition.contents, (c) => `- *${c.key}:* **${c.attribute}**`);
  });

  return out;
}

function choiceLines(node) {
  return node.choices.map((choice) => '`' + (choice.condition || choice.id) + '`');
}

function operatorLines(node) {
  return node.operators.map((operator) => '`' + (operator.expression || operator.id) + '`');
}

function conditionLines(node) {
  return node.conditions.map((condition) => '`' + (condition.expression || condition.id) + '`');
}

function timerLines(node) {
  return node.timer.map((parameter) => `*${parameter.name}:* \`${parameter.value}\``);
}

/**
 * How often the node runs: its own section between what it declares and what it does, since the parameters
 * frame the whole passage rather than happening at a point in it. The heading names the kind, which is what
 * says when they are read — a multi-instance cardinality before the instance tokens exist, a standard
 * loop's condition and maximum after the exit restrictions have passed.
 */
function loopLines(node) {
  return node.loop.map((parameter) => `*${parameter.name}:* \`${parameter.value}\``);
}

// what each guidance type advises, named as a reader would say it
const GUIDANCE_LABELS = {
  entry: 'Entry guidance',
  message: 'Message guidance',
  choice: 'Choice guidance',
  exit: 'Exit guidance'
};

/**
 * Guidance: one section per type, after everything the token does, with the attributes, operators and
 * restrictions it holds beneath it, each present only when the guidance carries it. It advises whoever
 * decides rather than constraining the execution that follows.
 */
function guidanceSections(node, level, slug) {
  return node.guidance.flatMap((definition) => {
    const title = GUIDANCE_LABELS[definition.type] || definition.type || 'Guidance';

    const group = (label, entries, render) => {
      if (!entries.length) {
        return [];
      }

      slug(label);

      return [ '#'.repeat(level + 1) + ' ' + label, '', ...entries.flatMap(render), '' ];
    };

    const groups = [
      ...group('Attributes', definition.attributes,
        (a) => [
          `- ${a.type ? `*${a.type}:* ` : ''}**${(a.name || a.id || '').trim()}**`,
          ...objectiveTerm(a, (a.name || a.id || '').trim())
        ]),
      ...group('Operators', definition.operators, (o) => '- `' + (o.expression || o.id) + '`'),
      ...group('Restrictions', definition.restrictions, (r) => '- `' + (r.expression || r.id) + '`')
    ];

    if (!groups.length) {
      return [];
    }

    slug(title);

    return [ '#'.repeat(level) + ' ' + title, '', ...groups ];
  });
}

/**
 * The lookup tables the model declares, at model level: a table's name is a callable in expressions, so
 * `durations(current_location,next_location)` in an operator reads the table named there — which is the one
 * thing the expression itself does not say.
 */
function tableSection(tables, slug) {
  if (!tables.length) {
    return [];
  }

  slug('Lookup tables');

  return [
    '## Lookup tables',
    '',
    ...tables.map((table) => {
      const columns = (table.header || '').split(';').map((column) => column.trim()).filter(Boolean);

      const parts = [ `- **${table.name || table.id}**` ];

      if (table.source) {
        parts.push('(from `' + table.source + '`)');
      }

      if (columns.length) {
        parts.push('with columns ' + columns.map((column) => '`' + column + '`').join(', '));
      }

      return parts.join(' ');
    }),
    ''
  ];
}

function loopTitle(node) {
  return node.loopKind === 'multiInstance' ? 'Multi-instance' : 'Loop';
}

function section(title, attributes, ownIds, level, anchors, slug) {
  if (!attributes.length) {
    return [];
  }

  slug(title);

  return [
    '#'.repeat(level) + ' ' + title,
    '',
    ...attributes.flatMap((attribute) => attributeItem(attribute, ownIds, anchors)),
    ''
  ];
}

/**
 * Render the document, registering the slug of every heading that identifies an element.
 *
 * Run twice: once to collect the anchors, once with them in hand. Links are inline, so they never change a
 * heading and the slugs come out the same both times.
 */
function render({ baseName, diagrams, model, anchors, register }) {
  const { root, nodes, tables } = model,
        slug = createSlugger();

  const titleText = root ? headingText(root) : baseName,
        titleSlug = slug(titleText);

  register(root ? root.ids : [], titleSlug);

  const lines = [ '# ' + titleText, '' ];

  if (root && root.documentation) {
    lines.push(root.documentation, '');
  }

  diagrams.forEach(({ title, file }) => {
    slug(title);
    lines.push(`## ${title}`, '', `![${title}](${file})`, '');
  });

  // what the root itself declares — the heading above already names it, so only its sections follow
  const rootNode = root && nodes.find((node) => node.id === root.id);

  if (rootNode) {
    lines.push(
      ...section('Status', rootNode.status, rootNode.ids, 2, anchors, slug),
      ...section('Data', rootNode.data, rootNode.ids, 2, anchors, slug),
      ...section('Globals', rootNode.globals, rootNode.ids, 2, anchors, slug),
      ...listSection(loopTitle(rootNode), loopLines(rootNode), 2, slug),
      ...listSection('Conditions', conditionLines(rootNode), 2, slug),
      ...listSection('Timer', timerLines(rootNode), 2, slug),
      ...restrictionSection('Entry restrictions', rootNode.entryRestrictions, rootNode.ids, 2, anchors, slug),
      ...(rootNode.operatorsOnCompletion ? [] : [
        ...listSection('Choices', choiceLines(rootNode), 2, slug),
        ...listSection('Operators', operatorLines(rootNode), 2, slug)
      ]),
      ...exchangeSections('Message', rootNode.messages, 2, slug),
      ...exchangeSections('Signal', rootNode.signal, 2, slug),
      ...(rootNode.operatorsOnCompletion ? [
        ...listSection('Choices', choiceLines(rootNode), 2, slug),
        ...listSection('Operators', operatorLines(rootNode), 2, slug)
      ] : []),
      ...restrictionSection('Completion restrictions', rootNode.completionRestrictions, rootNode.ids, 2, anchors, slug),
      ...restrictionSection('Exit restrictions', rootNode.exitRestrictions, rootNode.ids, 2, anchors, slug),
      ...guidanceSections(rootNode, 2, slug)
    );
  }

  // model-level, after what the model itself declares and before the nodes
  lines.push(...tableSection(tables || [], slug));

  nodes
    .filter((node) => (!root || node.id !== root.id) && hasContent(node))
    .forEach((node) => {
      const text = headingText(node);

      register(node.ids, slug(text));

      lines.push('## ' + text, '');

      if (node.documentation) {
        lines.push(node.documentation, '');
      }

      // a flow carries nothing but its gatekeeper: the attributes visible at it are those of the scope
      // around it, documented at its nodes
      lines.push(
        ...(node.isSequenceFlow ? [] : [
          ...section('Status', node.status, node.ids, 3, anchors, slug),
          ...section('Data', node.data, node.ids, 3, anchors, slug),
          ...section('Globals', node.globals, node.ids, 3, anchors, slug)
        ]),
        ...listSection(loopTitle(node), loopLines(node), 3, slug),
        ...listSection(node.isSequenceFlow ? 'Gatekeeper' : 'Conditions', conditionLines(node), 3, slug),
        ...listSection('Timer', timerLines(node), 3, slug),
        ...(node.isSequenceFlow ? [] :
          restrictionSection('Entry restrictions', node.entryRestrictions, node.ids, 3, anchors, slug)),
        ...(node.operatorsOnCompletion ? [] : [
          ...listSection('Choices', choiceLines(node), 3, slug),
          ...listSection('Operators', operatorLines(node), 3, slug)
        ]),
        ...exchangeSections('Message', node.messages, 3, slug),
        ...exchangeSections('Signal', node.signal, 3, slug),
        ...(node.operatorsOnCompletion ? [
          ...listSection('Choices', choiceLines(node), 3, slug),
          ...listSection('Operators', operatorLines(node), 3, slug)
        ] : []),
        ...(node.isSequenceFlow ? [] : [
          ...restrictionSection('Completion restrictions', node.completionRestrictions, node.ids, 3, anchors, slug),
          ...restrictionSection('Exit restrictions', node.exitRestrictions, node.ids, 3, anchors, slug)
        ]),
        ...guidanceSections(node, 3, slug)
      );
    });

  return lines.join('\n');
}

function markdown({ baseName, diagrams, model }) {
  const anchors = new Map();

  const collect = (ids, slug) => ids.filter(Boolean).forEach((id) => anchors.set(id, slug));

  render({ baseName, diagrams, model, anchors, register: collect });

  return render({ baseName, diagrams, model, anchors, register: () => {} });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args) {
    console.error(USAGE);
    process.exit(1);
  }

  const { files, outDir } = args;

  const chromePath = Launcher.getFirstInstallation();

  if (!chromePath) {
    throw new Error('Cannot find Chrome. To install run: sudo apt install google-chrome-stable');
  }

  fs.mkdirSync(outDir, { recursive: true });

  await withDevServer(appDir, async (serverURL) => {
    const browser = await puppeteer.launch({
      executablePath: chromePath,
      args: [ '--no-sandbox', '--disable-setuid-sandbox' ],
      headless: true
    });

    try {
      const page = await browser.newPage();

      page.on('pageerror', (err) => console.error('[page error]', err.message));
      await page.goto(serverURL);
      await page.waitForFunction(() => typeof window.modeler !== 'undefined', { timeout: 20000 });

      for (const file of files) {
        const baseName = path.basename(file, path.extname(file));

        // diagrams: the root plane plus one per collapsed sub-process
        await renderBpmnToSvg({ serverURL, file, outDir });

        const diagrams = fs.readdirSync(outDir)
          .filter((name) => name === baseName + '.svg' || name.startsWith(baseName + '-'))
          .filter((name) => name.endsWith('.svg'))
          .sort()
          .map((name) => ({
            title: name === baseName + '.svg' ? 'Diagram' : 'Diagram: ' + name.slice(baseName.length + 1, -4),
            file: name
          }));

        const model = await collectModel(page, fs.readFileSync(file, 'utf-8'));

        const target = path.join(outDir, baseName + '.md');

        fs.writeFileSync(target, markdown({ baseName, diagrams, model }), 'utf-8');
        console.log(`${target} (${diagrams.length} diagram(s), ${model.nodes.length} node(s))`);
      }
    } finally {
      await browser.close();
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
