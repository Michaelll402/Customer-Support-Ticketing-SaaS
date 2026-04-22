module.exports = {
  extends: [require.resolve('./base.cjs')],
  env: {
    node: true,
  },
  ignorePatterns: ['dist', 'coverage', 'node_modules'],
};
