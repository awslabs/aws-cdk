import * as ec2 from '@aws-cdk/aws-ec2';
import * as cdk from '@aws-cdk/core';
import { Test } from 'nodeunit';
import * as sagemaker from '../lib';

export = {
  'When validating stack containing an EndpointConfig': {
    'with more than 10 production variants, an error is recorded'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const model = sagemaker.Model.fromModelName(stack, `Model`, `model`);
      const endpointConfig = new sagemaker.EndpointConfig(stack, 'EndpointConfig', {
        productionVariant: {
          variantName: 'variant',
          model
        }
      });
      for (let i = 0; i < 10; i++) {
        endpointConfig.addProductionVariant({ variantName: `variant-${i}`, model });
      }

      // WHEN
      const errors = validate(stack);

      // THEN
      test.deepEqual(errors.map(e => e.message), ["Can\'t have more than 10 Production Variants"]);

      test.done();
    },
  },

  'When adding a production variant to an EndpointConfig': {
    'with too few instances specified, an exception is thrown'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const model = sagemaker.Model.fromModelName(stack, `Model`, `model`);
      const endpointConfig = new sagemaker.EndpointConfig(stack, 'EndpointConfig', {
        productionVariant: { variantName: 'variant', model } });

      // WHEN
      const when = () =>
        endpointConfig.addProductionVariant({
          variantName: 'new-variant',
          model,
          initialInstanceCount: 0,
        });

      // THEN
      test.throws(when, /Invalid Production Variant Props: Must have at least one instance/);

      test.done();
    },

    'with a negative weight, an exception is thrown'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const model = sagemaker.Model.fromModelName(stack, `Model`, `model`);
      const endpointConfig = new sagemaker.EndpointConfig(stack, 'EndpointConfig', {
        productionVariant: { variantName: 'variant', model } });

      // WHEN
      const when = () =>
        endpointConfig.addProductionVariant({
          variantName: 'new-variant',
          model,
          initialVariantWeight: -1,
        });

      // THEN
      test.throws(when, /Invalid Production Variant Props: Cannot have negative variant weight/);

      test.done();
    },

    'with an unsupported instance type, an exception is thrown'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const model = sagemaker.Model.fromModelName(stack, `Model`, `model`);
      const endpointConfig = new sagemaker.EndpointConfig(stack, 'EndpointConfig', {
        productionVariant: { variantName: 'variant', model } });

      // WHEN
      const when = () =>
        endpointConfig.addProductionVariant({
          variantName: 'new-variant',
          model,
          instanceType: ec2.InstanceType.of(ec2.InstanceClass.ARM1, ec2.InstanceSize.XLARGE),
        });

      // THEN
      test.throws(when, /Invalid Production Variant Props: Invalid instance type for a SageMaker Endpoint Production Variant: a1.xlarge/);

      test.done();
    },

    'with a duplicate variant name, an exception is thrown'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const model = sagemaker.Model.fromModelName(stack, `Model`, `model`);
      const endpointConfig = new sagemaker.EndpointConfig(stack, 'EndpointConfig', {
        productionVariant: { variantName: 'variant', model } });

      // WHEN
      const when = () => endpointConfig.addProductionVariant({ variantName: 'variant', model });

      // THEN
      test.throws(when, /There is already a Production Variant with name 'variant'/);

      test.done();
    },
  },

  'When searching an EndpointConfig for a production variant': {
    'that exists, the variant is returned'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const model = sagemaker.Model.fromModelName(stack, `Model`, `model`);
      const endpointConfig = new sagemaker.EndpointConfig(stack, 'EndpointConfig', {
        productionVariant: { variantName: 'variant', model } });

      // WHEN
      const variant = endpointConfig.findProductionVariant('variant');

      // THEN
      test.equal(variant.variantName, 'variant');

      test.done();
    },

    'that does not exist, an exception is thrown'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const model = sagemaker.Model.fromModelName(stack, `Model`, `model`);
      const endpointConfig = new sagemaker.EndpointConfig(stack, 'EndpointConfig', {
        productionVariant: { variantName: 'variant', model } });

      // WHEN
      const when = () => endpointConfig.findProductionVariant('missing-variant');

      // THEN
      test.throws(when, /No variant with name: 'missing-variant'/);

      test.done();
    },
  },

  'When importing an endpoint configuration by name, the ARN is constructed correctly'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack(undefined, undefined, {
      env:
        {
          region: 'us-west-2',
          account: '123456789012'
        }
    });

    // WHEN
    const endpointConfig = sagemaker.EndpointConfig.fromEndpointConfigName(stack, 'EndpointConfig', 'my-name');

    // THEN
    test.equal(endpointConfig.endpointConfigArn, 'arn:${Token[AWS::Partition.3]}:sagemaker:us-west-2:123456789012:endpoint-config/my-name');

    test.done();
  },
};

function validate(construct: cdk.IConstruct): cdk.ValidationError[] {
  cdk.ConstructNode.prepare(construct.node);
  return cdk.ConstructNode.validate(construct.node);
}
