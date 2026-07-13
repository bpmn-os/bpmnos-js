var CopyPlugin = require('copy-webpack-plugin');

var path = require('path');

module.exports = {
  mode: 'development',
  entry: './src/app.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'app.js'
  },
  devtool: 'source-map',
  module: {
    rules: [
      {
        // The BPMNOS properties panel is authored in preact JSX (via @bpmn-io/properties-panel).
        test: /\.m?js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            plugins: [
              [ '@babel/plugin-transform-react-jsx', {
                importSource: '@bpmn-io/properties-panel/preact',
                runtime: 'automatic'
              } ]
            ]
          }
        }
      },
      {
        test: /\.less$/i,
        use: [ 'style-loader', 'css-loader', 'less-loader' ]
      },
      {
        // plain CSS imported from JS (e.g. bpmn-workbench/toolbar ships its own stylesheet)
        test: /\.css$/i,
        use: [ 'style-loader', 'css-loader' ]
      },
      {
        test: /\.bpmn$/,
        use: { loader: 'raw-loader' }
      }
    ]
  },
  resolve: {
    mainFields: [ 'browser', 'module', 'main' ],
    alias: {
      // the properties-panel components render with preact
      react: '@bpmn-io/properties-panel/preact/compat'
    }
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'src/index.html', to: '.' },
        { from: 'src/BPMNOS.svg', to: '.' },
        { from: 'node_modules/bpmn-js/dist/assets', to: 'vendor/bpmn-js/' },
        { from: 'node_modules/@bpmn-io/properties-panel/dist/assets', to: 'vendor/@bpmn-io/properties-panel/' },
        { from: 'node_modules/bpmn-js-bpmnlint/dist/assets/css', to: 'vendor/bpmn-js-bpmnlint/' },
        { from: 'node_modules/bpmn-js-side-panel/assets/side-panel.css', to: 'vendor/bpmn-js-side-panel/' },
        { from: 'src/modules/bpmnos/css', to: 'modules/bpmnos/' }
      ]
    })
  ]
};
