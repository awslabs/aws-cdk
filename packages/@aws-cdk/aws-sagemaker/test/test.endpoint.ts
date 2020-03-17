import * as ec2 from "@aws-cdk/aws-ec2";
import * as cdk from '@aws-cdk/core';
import { Test } from 'nodeunit';
import * as sagemaker from '../lib';

export = {
  'When searching an Endpoint for a production variant': {
    'that exists, the variant is returned'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const model = sagemaker.Model.fromModelName(stack, 'Model', `model`);
      const endpointConfig = new sagemaker.EndpointConfig(stack, 'EndpointConfig', {
        productionVariant: { variantName: 'variant', model } });
      const endpoint = new sagemaker.Endpoint(stack, 'Endpoint', { endpointConfig });

      // WHEN
      const variant = endpoint.findProductionVariant('variant');

      // THEN
      test.equal(variant.variantName, 'variant');

      test.done();
    },

    'that does not exist, an exception is thrown'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const model = sagemaker.Model.fromModelName(stack, 'Model', `model`);
      const endpointConfig = new sagemaker.EndpointConfig(stack, 'EndpointConfig', {
        productionVariant: { variantName: 'variant', model } });
      const endpoint = new sagemaker.Endpoint(stack, 'Endpoint', { endpointConfig });

      // WHEN
      const when = () => endpoint.findProductionVariant('missing-variant');

      // THEN
      test.throws(when, /No variant with name: 'missing-variant'/);

      test.done();
    },
  },

  'When fetching production variants from an Endpoint': {
    'with one production variant, the variant is returned'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const model = sagemaker.Model.fromModelName(stack, 'Model', `model`);
      const endpointConfig = new sagemaker.EndpointConfig(stack, 'EndpointConfig', {
        productionVariant: { variantName: 'variant', model } });
      const endpoint = new sagemaker.Endpoint(stack, 'Endpoint', { endpointConfig });

      // WHEN
      const variants: sagemaker.IEndpointProductionVariant[] = endpoint.productionVariants;

      // THEN
      test.equal(variants.length, 1);
      test.equal(variants[0].variantName, 'variant');

      test.done();
    }
  },

  'When importing an endpoint by name, the ARN is constructed correctly'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack(undefined, undefined, {
      env:
        {
          region: 'us-west-2',
          account: '123456789012'
        }
    });

    // WHEN
    const endpoint = sagemaker.Endpoint.fromEndpointName(stack, 'Endpoint', 'my-name');

    // THEN
    test.equal(endpoint.endpointArn, 'arn:${Token[AWS::Partition.3]}:sagemaker:us-west-2:123456789012:endpoint/my-name');

    test.done();
  },

  'When auto-scaling a production variant\'s instance count': {
    'with minimum capacity greater than initial instance count, an exception is thrown'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const model = sagemaker.Model.fromModelName(stack, 'Model', `model`);
      const endpointConfig = new sagemaker.EndpointConfig(stack, 'EndpointConfig', {
        productionVariant: { variantName: 'variant', model } });
      const endpoint = new sagemaker.Endpoint(stack, 'Endpoint', { endpointConfig });
      const variant = endpoint.findProductionVariant('variant');

      // WHEN
      const when = () => variant.autoScaleInstanceCount({
        minCapacity: 2,
        maxCapacity: 3,
      });

      // THEN
      test.throws(when, /minCapacity cannot be greater than initial instance count: 1/);

      test.done();
    },

    'with maximum capacity less than initial instance count, an exception is thrown'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const model = sagemaker.Model.fromModelName(stack, 'Model', `model`);
      const endpointConfig = new sagemaker.EndpointConfig(stack, 'EndpointConfig', {
        productionVariant: { variantName: 'variant', model, initialInstanceCount: 2 } });
      const endpoint = new sagemaker.Endpoint(stack, 'Endpoint', { endpointConfig });
      const variant = endpoint.findProductionVariant('variant');

      // WHEN
      const when = () => variant.autoScaleInstanceCount({ maxCapacity: 1 });

      // THEN
      test.throws(when, /maxCapacity cannot be less than initial instance count: 2/);

      test.done();
    },

    'with burstable instance type, an exception is thrown'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const model = sagemaker.Model.fromModelName(stack, 'Model', `model`);
      const endpointConfig = new sagemaker.EndpointConfig(stack, 'EndpointConfig', {
        productionVariant: {
          variantName: 'variant',
          model,
          instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MEDIUM)
        }
      });
      const endpoint = new sagemaker.Endpoint(stack, 'Endpoint', { endpointConfig });
      const variant = endpoint.findProductionVariant('variant');

      // WHEN
      const when = () => variant.autoScaleInstanceCount({ maxCapacity: 3 });

      // THEN
      test.throws(when, /AutoScaling not supported for burstable instance types like t2.medium/);

      test.done();
    },

    'which already has auto-scaling enabled, an exception is thrown'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const model = sagemaker.Model.fromModelName(stack, 'Model', `model`);
      const endpointConfig = new sagemaker.EndpointConfig(stack, 'EndpointConfig', {
        productionVariant: {
          variantName: 'variant',
          model,
          instanceType: ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.LARGE)
        }
      });
      const endpoint = new sagemaker.Endpoint(stack, 'Endpoint', { endpointConfig });
      const variant = endpoint.findProductionVariant('variant');
      variant.autoScaleInstanceCount({ maxCapacity: 3 });

      // WHEN
      const when = () => variant.autoScaleInstanceCount({ maxCapacity: 3 });

      // THEN
      test.throws(when, /AutoScaling of task count already enabled for this service/);

      test.done();
    },
  },
};
