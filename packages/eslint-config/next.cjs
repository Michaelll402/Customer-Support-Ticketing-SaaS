module.exports = {
  extends: [require.resolve('./base.cjs'), 'next/core-web-vitals', 'next/typescript'],
  ignorePatterns: ['dist', 'coverage', 'node_modules', '.next'],
};
