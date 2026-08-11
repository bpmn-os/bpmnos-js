import { defineConfig, transformWithEsbuild } from 'vite';

// The BPMNOS properties panel is authored in preact JSX inside .js files (via @bpmn-io/properties-panel).
// Vite/Rollup do not parse JSX in .js by default, so transform src/*.js through esbuild's jsx loader with
// the preact automatic runtime before the rest of the pipeline runs.
function preactJsxInJs() {
  return {
    name: 'bpmnos-preact-jsx-in-js',
    enforce: 'pre',
    async transform(code, id) {
      const [ path ] = id.split('?');
      if (path.includes('/node_modules/') || !/\/src\/.*\.js$/.test(path)) {
        return null;
      }
      return transformWithEsbuild(code, path, {
        loader: 'jsx',
        jsx: 'automatic',
        jsxImportSource: '@bpmn-io/properties-panel/preact'
      });
    }
  };
}

// Builds the demo modeller (src/app.js + index.html), deployed to GitHub Pages. `base` is the gh-pages
// sub-path (https://bpmn-os.github.io/bpmnos-js/) when *building* in CI. It must stay '/' for the dev
// server: bpmnosdoc drives that server headlessly in CI too, and a sub-path base makes vite 404 the
// root URL, so no app — and no diagrams — ever load. react is aliased to the properties-panel preact
// compat build so any `react` import resolves to preact.
export default defineConfig(({ command }) => ({
  base: command === 'build' && process.env.GITHUB_ACTIONS ? '/bpmnos-js/' : '/',
  plugins: [ preactJsxInJs() ],
  resolve: {
    alias: {
      react: '@bpmn-io/properties-panel/preact/compat'
    },
    // A package linked from the working tree resolves its own imports against its own node_modules, so a
    // module developed beside this one would bring a second bpmn-js and a second diagram-js into the page.
    // Two copies of either are two sets of classes, and an element built by one is not recognised by the
    // other. One copy is taken for the whole app, whether a dependency is linked or installed.
    dedupe: [ 'bpmn-js', 'diagram-js' ]
  },
  // the dev dependency scanner and pre-bundler run esbuild directly (not the plugin above), so they need
  // the same jsx loader to parse the preact JSX in src/*.js
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' },
      jsx: 'automatic',
      jsxImportSource: '@bpmn-io/properties-panel/preact'
    }
  }
}));
