const baseConfig = require('../../../tools/cdk-build-tools/config/jest.config');
module.exports = {
  ...baseConfig,
  coverageThreshold: {
    global: {
      branches: 70,
      statements: 80,
    },
  },
};
