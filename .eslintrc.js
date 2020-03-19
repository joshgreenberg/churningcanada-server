module.exports = {
  root: true,
  env: {
    node: true,
    es6: true,
  },
  extends: ['prettier'],
  plugins: ['prettier'],
  parserOptions: {
    parser: 'babel-eslint',
  },
}
