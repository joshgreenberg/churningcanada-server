module.exports = {
  root: true,
  env: {
    node: true,
    es6: true,
  },
  parserOptions: {
    ecmaVersion: 2020,
    parser: 'babel-eslint',
  },
  extends: ['eslint:recommended', 'prettier'],
  plugins: ['prettier'],
}
