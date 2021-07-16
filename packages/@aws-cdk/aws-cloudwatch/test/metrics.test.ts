import '@aws-cdk/assert-internal/jest';
import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import { Alarm, Metric } from '../lib';

describe('Metrics', () => {
  test('metric grant', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const role = new iam.Role(stack, 'SomeRole', {
      assumedBy: new iam.AnyPrincipal(),
    });

    // WHEN
    Metric.grantPutMetricData(role);

    // THEN
    expect(stack).toHaveResource('AWS::IAM::Policy', {
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
    });


  });

  test('can not use invalid period in Metric', () => {
    expect(() => {
      new Metric({ namespace: 'Test', metricName: 'ACount', period: cdk.Duration.seconds(20) });
    }).toThrow(/'period' must be 1, 5, 10, 30, or a multiple of 60 seconds, received 20/);


  });

  test('Metric optimization: "with" with the same period returns the same object', () => {
    const m = new Metric({ namespace: 'Test', metricName: 'Metric', period: cdk.Duration.minutes(10) });

    // Note: object equality, NOT deep equality on purpose
    expect(m.with({})).toEqual(m);
    expect(m.with({ period: cdk.Duration.minutes(10) })).toEqual(m);

    expect(m.with({ period: cdk.Duration.minutes(5) })).not.toEqual(m);


  });

  test('cannot use null dimension value', () => {
    expect(() => {
      new Metric({
        namespace: 'Test',
        metricName: 'ACount',
        period: cdk.Duration.minutes(10),
        dimensions: {
          DimensionWithNull: null,
        },
      });
    }).toThrow(/Dimension value of 'null' is invalid/);


  });

  test('cannot use undefined dimension value', () => {
    expect(() => {
      new Metric({
        namespace: 'Test',
        metricName: 'ACount',
        period: cdk.Duration.minutes(10),
        dimensions: {
          DimensionWithUndefined: undefined,
        },
      });
    }).toThrow(/Dimension value of 'undefined' is invalid/);


  });

  test('cannot use long dimension values', () => {
    const arr = new Array(256);
    const invalidDimensionValue = arr.fill('A', 0).join('');

    expect(() => {
      new Metric({
        namespace: 'Test',
        metricName: 'ACount',
        period: cdk.Duration.minutes(10),
        dimensions: {
          DimensionWithLongValue: invalidDimensionValue,
        },
      });
    }).toThrow(`Dimension value must be at least 1 and no more than 255 characters; received ${invalidDimensionValue}`);


  });

  test('cannot use long dimension values in dimensionsMap', () => {
    const arr = new Array(256);
    const invalidDimensionValue = arr.fill('A', 0).join('');

    expect(() => {
      new Metric({
        namespace: 'Test',
        metricName: 'ACount',
        period: cdk.Duration.minutes(10),
        dimensionsMap: {
          DimensionWithLongValue: invalidDimensionValue,
        },
      });
    }).toThrow(`Dimension value must be at least 1 and no more than 255 characters; received ${invalidDimensionValue}`);


  });

  test('throws error when there are more than 10 dimensions', () => {
    expect(() => {
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
    }).toThrow(/The maximum number of dimensions is 10, received 11/);


  });

  test('throws error when there are more than 10 dimensions in dimensionsMap', () => {
    expect(() => {
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
    }).toThrow(/The maximum number of dimensions is 10, received 11/);


  });

  test('can create metric with dimensionsMap property', () => {
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

    expect(metric.dimensions).toEqual({
      dimensionA: 'value1',
      dimensionB: 'value2',
    });
    expect(stack).toHaveResourceLike('AWS::CloudWatch::Alarm', {
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
    });


  });

  test('"with" with a different dimensions property', () => {
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

    expect(metric.with({
      dimensionsMap: newDims,
    }).dimensions).toEqual(newDims);


  });

  test('metric accepts a variety of statistics', () => {
    new Metric({
      namespace: 'Test',
      metricName: 'Metric',
      statistic: 'myCustomStatistic',
    });


  });
});
