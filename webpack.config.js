const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {
    background: './src/background.js',
    popup: './src/popup.js', // If you have a popup HTML file
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },
  plugins: [
    new CopyWebpackPlugin({ patterns: [{ from: 'src', to: 'src' }] }),
    new HtmlWebpackPlugin({
      template: './src/popup.html', // If you have a popup HTML file
      chunks: ['popup'],
      filename: 'popup.html',
    }),
  ],
};
