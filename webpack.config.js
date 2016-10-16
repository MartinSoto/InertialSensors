var webpack = require("webpack");
var CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: [
    './src/main.js'
  ],
  output: {
    path: __dirname + '/public',
    filename: 'bundle.js'
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /(node_modules)/,
        loader: 'babel',
        query: {
          presets: ['es2015', 'react']
        }
      }
    ]
  },
  devtool: 'inline-source-map',

  plugins: [
    new CopyWebpackPlugin([
      { context: 'src', from: '*.html' },
      { context: 'src', from: '*.css' }
    ])
  ]
};
