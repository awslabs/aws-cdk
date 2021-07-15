// Run `jest --setupFilesAfterEnv path/to/jest-fail-fast-setup.js --` to stop after the first failing test
// Use the `best` script in this directory for convenience.
const failFast = require('jasmine-fail-fast');
jasmine.getEnv().addReporter(failFast.init());