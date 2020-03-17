import * as cdk from '@aws-cdk/core';
import { Test } from 'nodeunit';
import * as path from 'path';
import * as sagemaker from '../lib';

export = {
  'When creating model data from a local asset': {
    'by supplying a directory, an exception is thrown'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      const when = () =>
        sagemaker.ModelData.fromAsset(stack, 'ModelData', path.join(__dirname, 'test-artifacts'));

      // THEN
      test.throws(when, /Asset must be a .tar.gz file/);

      test.done();
    },

    'by supplying a zip file, an exception is thrown'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      const when = () =>
        sagemaker.ModelData.fromAsset(stack, 'ModelData', path.join(__dirname, 'test-artifacts', 'invalid-artifact.zip'));

      // THEN
      test.throws(when, /Asset must be a .tar.gz file/);

      test.done();
    },

    'by supplying a file with an unsupported extension, an exception is thrown'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      const when = () =>
        sagemaker.ModelData.fromAsset(stack, 'ModelData', path.join(__dirname, 'test-artifacts', 'invalid-artifact.tar'));

      // THEN
      test.throws(when, /Asset must be a .tar.gz file/);

      test.done();
    },
  },
};
