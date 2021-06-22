const baseConfig = require('cdk-build-tools/config/eslintrc');
baseConfig.parserOptions.project = __dirname + '/tsconfig.json';
module.exports = {
  ...baseConfig,
  ignorePatterns: [...baseConfig.ignorePatterns, 'lib/vendored/'],
  rules: {
    ...baseConfig.rules,
    '@typescript-eslint/explicit-function-return-type': ['error'],
  }
};
