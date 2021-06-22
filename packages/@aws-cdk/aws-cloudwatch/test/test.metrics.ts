import { expect, haveResource, haveResourceLike } from '@aws-cdk/assert-internal';
import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import { Test } from 'nodeunit';
import { Alarm, Metric } from '../lib';

export = {
  'metric grant'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const role = new iam.Role(stack, 'SomeRole', {
      assumedBy: new iam.AnyPrincipal(),
    });

    // WHEN
    Metric.grantPutMetricData(role);

    // THEN
    expect(stack).to(haveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'cloudwatch:PutMetricData',
            Effect: 'Allow',
            Resource: '*',
          },
        ],
      },
    }));

    test.done();
  },

  'can not use invalid period in Metric'(test: Test) {
    test.throws(() => {
      new Metric({ namespace: 'Test', metricName: 'ACount', period: cdk.Duration.seconds(20) });
    }, /'period' must be 1, 5, 10, 30, or a multiple of 60 seconds, received 20/);

    test.done();
  },

  'Metric optimization: "with" with the same period returns the same object'(test: Test) {
    const m = new Metric({ namespace: 'Test', metricName: 'Metric', period: cdk.Duration.minutes(10) });

    // Note: object equality, NOT deep equality on purpose
    test.equals(m.with({}), m);
    test.equals(m.with({ period: cdk.Duration.minutes(10) }), m);

    test.notEqual(m.with({ period: cdk.Duration.minutes(5) }), m);

    test.done();
  },

  'cannot use null dimension value'(test: Test) {
    test.throws(() => {
      new Metric({
        namespace: 'Test',
        metricName: 'ACount',
        period: cdk.Duration.minutes(10),
        dimensions: {
          DimensionWithNull: null,
        },
      });
    }, /Dimension value of 'null' is invalid/);

    test.done();
  },

  'cannot use undefined dimension value'(test: Test) {
    test.throws(() => {
      new Metric({
        namespace: 'Test',
        metricName: 'ACount',
        period: cdk.Duration.minutes(10),
        dimensions: {
          DimensionWithUndefined: undefined,
        },
      });
    }, /Dimension value of 'undefined' is invalid/);

    test.done();
  },

  'cannot use long dimension values'(test: Test) {
    const arr = new Array(256);
    const invalidDimensionValue = arr.fill('A', 0).join('');

    test.throws(() => {
      new Metric({
        namespace: 'Test',
        metricName: 'ACount',
        period: cdk.Duration.minutes(10),
        dimensions: {
          DimensionWithLongValue: invalidDimensionValue,
        },
      });
    }, `Dimension value must be at least 1 and no more than 255 characters; received ${invalidDimensionValue}`);

    test.done();
  },

  'cannot use long dimension values in dimensionsMap'(test: Test) {
    const arr = new Array(256);
    const invalidDimensionValue = arr.fill('A', 0).join('');

    test.throws(() => {
      new Metric({
        namespace: 'Test',
        metricName: 'ACount',
        period: cdk.Duration.minutes(10),
        dimensionsMap: {
          DimensionWithLongValue: invalidDimensionValue,
        },
      });
    }, `Dimension value must be at least 1 and no more than 255 characters; received ${invalidDimensionValue}`);

    test.done();
  },

  'throws error when there are more than 10 dimensions'(test: Test) {
    test.throws(() => {
      new Metric({
        namespace: 'Test',
        metricName: 'ACount',
        period: cdk.Duration.minutes(10),
        dimensions: {
          dimensionA: 'value1',
          dimensionB: 'value2',
          dimensionC: 'value3',
          dimensionD: 'value4',
          dimensionE: 'value5',
          dimensionF: 'value6',
          dimensionG: 'value7',
          dimensionH: 'value8',
          dimensionI: 'value9',
          dimensionJ: 'value10',
          dimensionK: 'value11',
        },
      } );
    }, /The maximum number of dimensions is 10, received 11/);

    test.done();
  },

  'throws error when there are more than 10 dimensions in dimensionsMap'(test: Test) {
    test.throws(() => {
      new Metric({
        namespace: 'Test',
        metricName: 'ACount',
        period: cdk.Duration.minutes(10),
        dimensionsMap: {
          dimensionA: 'value1',
          dimensionB: 'value2',
          dimensionC: 'value3',
          dimensionD: 'value4',
          dimensionE: 'value5',
          dimensionF: 'value6',
          dimensionG: 'value7',
          dimensionH: 'value8',
          dimensionI: 'value9',
          dimensionJ: 'value10',
          dimensionK: 'value11',
        },
      } );
    }, /The maximum number of dimensions is 10, received 11/);

    test.done();
  },

  'can create metric with dimensionsMap property'(test: Test) {
    const stack = new cdk.Stack();
    const metric = new Metric({
      namespace: 'Test',
      metricName: 'Metric',
      dimensionsMap: {
        dimensionA: 'value1',
        dimensionB: 'value2',
      },
    });

    new Alarm(stack, 'Alarm', {
      metric: metric,
      threshold: 10,
      evaluationPeriods: 1,
    });

    test.deepEqual(metric.dimensions, {
      dimensionA: 'value1',
      dimensionB: 'value2',
    });
    expect(stack).to(haveResourceLike('AWS::CloudWatch::Alarm', {
      Namespace: 'Test',
      MetricName: 'Metric',
      Dimensions: [
        {
          Name: 'dimensionA',
          Value: 'value1',
        },
        {
          Name: 'dimensionB',
          Value: 'value2',
        },
      ],
      Threshold: 10,
      EvaluationPeriods: 1,
    }));

    test.done();
  },

  '"with" with a different dimensions property'(test: Test) {
    const dims = {
      dimensionA: 'value1',
    };

    const metric = new Metric({
      namespace: 'Test',
      metricName: 'Metric',
      period: cdk.Duration.minutes(10),
      dimensionsMap: dims,
    });

    const newDims = {
      dimensionB: 'value2',
    };

    test.deepEqual(metric.with({
      dimensionsMap: newDims,
    }).dimensions, newDims);

    test.done();
  },
};
