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

    const processRefOf = (businessObject) => {
      const processRef = businessObject.get && businessObject.get('processRef');

      return processRef ? processRef.id : '';
    };

    const nodes = registry.getAll()
      .filter((element) => element.type !== 'label')
      .map((element) => {
        const { status, data, globals, conditions, timer } = executionData.get(element);

        // a pool stands for the process it refers to: that process documents it, owns its attributes, and
        // is what gets named — a participant id is never shown
        const processRef = processRefOf(element.businessObject);

        return {
          id: element.id,
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
          timer: timer.map((t) => ({ name: t.name, value: t.value }))
        };
      });

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
      nodes
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
  return !!(node.documentation || node.status.length || node.data.length || node.globals.length
    || node.conditions.length || node.timer.length);
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

  return '- ' + parts.join(' ');
}

function listSection(title, items, level, slug) {
  if (!items.length) {
    return [];
  }

  slug(title);

  return [ '#'.repeat(level) + ' ' + title, '', ...items.map((item) => '- ' + item), '' ];
}

function conditionLines(node) {
  return node.conditions.map((condition) => '`' + (condition.expression || condition.id) + '`');
}

function timerLines(node) {
  return node.timer.map((parameter) => `*${parameter.name}:* \`${parameter.value}\``);
}

function section(title, attributes, ownIds, level, anchors, slug) {
  if (!attributes.length) {
    return [];
  }

  slug(title);

  return [
    '#'.repeat(level) + ' ' + title,
    '',
    ...attributes.map((attribute) => attributeItem(attribute, ownIds, anchors)),
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
  const { root, nodes } = model,
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
      ...listSection('Conditions', conditionLines(rootNode), 2, slug),
      ...listSection('Timer', timerLines(rootNode), 2, slug)
    );
  }

  nodes
    .filter((node) => (!root || node.id !== root.id) && hasContent(node))
    .forEach((node) => {
      const text = headingText(node);

      register(node.ids, slug(text));

      lines.push('## ' + text, '');

      if (node.documentation) {
        lines.push(node.documentation, '');
      }

      lines.push(
        ...section('Status', node.status, node.ids, 3, anchors, slug),
        ...section('Data', node.data, node.ids, 3, anchors, slug),
        ...section('Globals', node.globals, node.ids, 3, anchors, slug),
        ...listSection('Conditions', conditionLines(node), 3, slug),
        ...listSection('Timer', timerLines(node), 3, slug)
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
