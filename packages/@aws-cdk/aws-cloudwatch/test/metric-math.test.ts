import '@aws-cdk/assert-internal/jest';
import { Duration, Stack } from '@aws-cdk/core';
import { Alarm, GraphWidget, IWidget, MathExpression, Metric } from '../lib';

const a = new Metric({ namespace: 'Test', metricName: 'ACount' });
const b = new Metric({ namespace: 'Test', metricName: 'BCount', statistic: 'Average' });
const c = new Metric({ namespace: 'Test', metricName: 'CCount' });
const b99 = new Metric({ namespace: 'Test', metricName: 'BCount', statistic: 'p99' });

let stack: Stack;
describe('Metric Math', () => {
  beforeEach(() => {
    stack = new Stack();
  });

  test('can not use invalid variable names in MathExpression', () => {
    expect(() => {
      new MathExpression({
        expression: 'HAPPY + JOY',
        usingMetrics: {
          HAPPY: a,
          JOY: b,
        },
      });
    }).toThrow(/Invalid variable names in expression/);


  });

  test('cannot reuse variable names in nested MathExpressions', () => {
    // WHEN
    expect(() => {
      new MathExpression({
        expression: 'a + e',
        usingMetrics: {
          a,
          e: new MathExpression({
            expression: 'a + c',
            usingMetrics: { a: b, c },
          }),
        },
      });
    }).toThrow(/The ID 'a' used for two metrics in the expression: 'BCount' and 'ACount'. Rename one/);


  });

  test('can not use invalid period in MathExpression', () => {
    expect(() => {
      new MathExpression({
        expression: 'a+b',
        usingMetrics: { a, b },
        period: Duration.seconds(20),
      });
    }).toThrow(/'period' must be 1, 5, 10, 30, or a multiple of 60 seconds, received 20/);


  });

  test('MathExpression optimization: "with" with the same period returns the same object', () => {
    const m = new MathExpression({ expression: 'SUM(METRICS())', usingMetrics: {}, period: Duration.minutes(10) });

    // Note: object equality, NOT deep equality on purpose
    expect(m.with({})).toEqual(m);
    expect(m.with({ period: Duration.minutes(10) })).toEqual(m);

    expect(m.with({ period: Duration.minutes(5) })).not.toEqual(m);


  });

  describe('in graphs', () => {
    test('MathExpressions can be added to a graph', () => {
      // GIVEN
      const graph = new GraphWidget({
        left: [
          new MathExpression({
            expression: 'a + b',
            usingMetrics: { a, b },
          }),
        ],
      });

      // THEN
      graphMetricsAre(graph, [
        [{ expression: 'a + b', label: 'a + b' }],
        ['Test', 'ACount', { visible: false, id: 'a' }],
        ['Test', 'BCount', { visible: false, id: 'b' }],
      ]);


    });

    test('can nest MathExpressions in a graph', () => {
      // GIVEN
      const graph = new GraphWidget({
        left: [
          new MathExpression({
            expression: 'a + e',
            usingMetrics: {
              a,
              e: new MathExpression({
                expression: 'b + c',
                usingMetrics: { b, c },
              }),
            },
          }),
        ],
      });

      // THEN
      graphMetricsAre(graph, [
        [{ label: 'a + e', expression: 'a + e' }],
        ['Test', 'ACount', { visible: false, id: 'a' }],
        [{ expression: 'b + c', visible: false, id: 'e' }],
        ['Test', 'BCount', { visible: false, id: 'b' }],
        ['Test', 'CCount', { visible: false, id: 'c' }],
      ]);


    });

    test('can add the same metric under different ids', () => {
      const graph = new GraphWidget({
        left: [
          new MathExpression({
            expression: 'a + e',
            usingMetrics: {
              a,
              e: new MathExpression({
                expression: 'b + c',
                usingMetrics: { b: a, c },
              }),
            },
          }),
        ],
      });

      graphMetricsAre(graph, [
        [{ label: 'a + e', expression: 'a + e' }],
        ['Test', 'ACount', { visible: false, id: 'a' }],
        [{ expression: 'b + c', visible: false, id: 'e' }],
        ['Test', 'ACount', { visible: false, id: 'b' }],
        ['Test', 'CCount', { visible: false, id: 'c' }],
      ]);


    });

    test('can reuse identifiers in MathExpressions if metrics are the same', () => {
      const graph = new GraphWidget({
        left: [
          new MathExpression({
            expression: 'a + e',
            usingMetrics: {
              a,
              e: new MathExpression({
                expression: 'a + c',
                usingMetrics: { a, c },
              }),
            },
          }),
        ],
      });

      // THEN
      graphMetricsAre(graph, [
        [{ label: 'a + e', expression: 'a + e' }],
        ['Test', 'ACount', { visible: false, id: 'a' }],
        [{ expression: 'a + c', visible: false, id: 'e' }],
        ['Test', 'CCount', { visible: false, id: 'c' }],
      ]);


    });

    test('MathExpression and its constituent metrics can both be added to a graph', () => {
      const graph = new GraphWidget({
        left: [
          a,
          new MathExpression({
            expression: 'a + b',
            usingMetrics: { a, b },
          }),
        ],
      });

      // THEN
      graphMetricsAre(graph, [
        ['Test', 'ACount', { id: 'a' }],
        [{ label: 'a + b', expression: 'a + b' }],
        ['Test', 'BCount', { visible: false, id: 'b' }],
      ]);

    });

    test('MathExpression controls period of metrics directly used in it', () => {
      // Check that if we add A with { period: 10s } to a mathexpression of period 5m
      // then two metric lines are added for A, one at 10s and one at 5m
      const graph = new GraphWidget({
        left: [
          a.with({ period: Duration.seconds(10) }),
          new MathExpression({
            expression: 'a + b',
            usingMetrics: { a: a.with({ period: Duration.seconds(10) }), b },
          }),
        ],
      });

      // THEN
      graphMetricsAre(graph, [
        ['Test', 'ACount', { period: 10 }],
        [{ label: 'a + b', expression: 'a + b' }],
        ['Test', 'ACount', { visible: false, id: 'a' }],
        ['Test', 'BCount', { visible: false, id: 'b' }],
      ]);

    });

    test('top level period in a MathExpression is respected in its metrics', () => {
      const graph = new GraphWidget({
        left: [
          a,
          new MathExpression({
            expression: 'a + b',
            usingMetrics: { a, b },
            period: Duration.minutes(1),
          }),
        ],
      });

      // THEN
      graphMetricsAre(graph, [
        ['Test', 'ACount'],
        [{ label: 'a + b', expression: 'a + b', period: 60 }],
        ['Test', 'ACount', { visible: false, id: 'a', period: 60 }],
        ['Test', 'BCount', { visible: false, id: 'b', period: 60 }],
      ]);

    });

    test('MathExpression controls period of metrics transitively used in it', () => {
      // Same as the previous test, but recursively

      const graph = new GraphWidget({
        left: [
          new MathExpression({
            expression: 'a + e',
            usingMetrics: {
              a,
              e: new MathExpression({
                expression: 'a + b',
                period: Duration.minutes(1),
                usingMetrics: { a, b },
              }),
            },
          }),
        ],
      });

      // THEN
      graphMetricsAre(graph, [
        [{ expression: 'a + e', label: 'a + e' }],
        ['Test', 'ACount', { visible: false, id: 'a' }],
        [{ expression: 'a + b', visible: false, id: 'e' }],
        ['Test', 'BCount', { visible: false, id: 'b' }],
      ]);

    });

    test('can use percentiles in expression metrics in graphs', () => {
      // GIVEN
      const graph = new GraphWidget({
        left: [
          new MathExpression({
            expression: 'a + b99',
            usingMetrics: { a, b99 },
          }),
        ],
      });

      // THEN
      graphMetricsAre(graph, [
        [{ expression: 'a + b99', label: 'a + b99' }],
        ['Test', 'ACount', { visible: false, id: 'a' }],
        ['Test', 'BCount', { visible: false, id: 'b99', stat: 'p99' }],
      ]);


    });

    test('can reuse the same metric between left and right axes', () => {
      // GIVEN
      const graph = new GraphWidget({
        left: [
          new MathExpression({
            expression: 'a + 1',
            usingMetrics: { a },
          }),
        ],
        right: [
          new MathExpression({
            expression: 'a + 2',
            usingMetrics: { a },
          }),
        ],
      });

      // THEN
      graphMetricsAre(graph, [
        [{ label: 'a + 1', expression: 'a + 1' }],
        ['Test', 'ACount', { visible: false, id: 'a' }],
        [{ label: 'a + 2', expression: 'a + 2', yAxis: 'right' }],
      ]);


    });

    test('detect name conflicts between left and right axes', () => {
      // GIVEN
      const graph = new GraphWidget({
        left: [
          new MathExpression({
            expression: 'm1 + 1',
            usingMetrics: { m1: a },
          }),
        ],
        right: [
          new MathExpression({
            expression: 'm1 + 1',
            usingMetrics: { m1: b },
          }),
        ],
      });

      // THEN
      expect(() => {
        graphMetricsAre(graph, []);
      }).toThrow(/Cannot have two different metrics share the same id \('m1'\)/);


    });
  });

  describe('in alarms', () => {
    test('MathExpressions can be used for an alarm', () => {
      // GIVEN
      new Alarm(stack, 'Alarm', {
        threshold: 1,
        evaluationPeriods: 1,
        metric: new MathExpression({
          expression: 'a + b',
          usingMetrics: { a, b },
        }),
      });

      // THEN
      alarmMetricsAre([
        {
          Expression: 'a + b',
          Id: 'expr_1',
        },
        {
          Id: 'a',
          MetricStat: {
            Metric: {
              MetricName: 'ACount',
              Namespace: 'Test',
            },
            Period: 300,
            Stat: 'Average',
          },
          ReturnData: false,
        },
        {
          Id: 'b',
          MetricStat: {
            Metric: {
              MetricName: 'BCount',
              Namespace: 'Test',
            },
            Period: 300,
            Stat: 'Average',
          },
          ReturnData: false,
        },

      ]);


    });

    test('can nest MathExpressions in an alarm', () => {
      // GIVEN
      new Alarm(stack, 'Alarm', {
        threshold: 1,
        evaluationPeriods: 1,
        metric: new MathExpression({
          expression: 'a + e',
          usingMetrics: {
            a,
            e: new MathExpression({
              expression: 'b + c',
              usingMetrics: { b, c },
            }),
          },
        }),
      });

      // THEN
      alarmMetricsAre([
        {
          Expression: 'a + e',
          Id: 'expr_1',
        },
        {
          Id: 'a',
          MetricStat: {
            Metric: {
              MetricName: 'ACount',
              Namespace: 'Test',
            },
            Period: 300,
            Stat: 'Average',
          },
          ReturnData: false,
        },
        {
          Expression: 'b + c',
          Id: 'e',
          ReturnData: false,
        },
        {
          Id: 'b',
          MetricStat: {
            Metric: {
              MetricName: 'BCount',
              Namespace: 'Test',
            },
            Period: 300,
            Stat: 'Average',
          },
          ReturnData: false,
        },
        {
          Id: 'c',
          MetricStat: {
            Metric: {
              MetricName: 'CCount',
              Namespace: 'Test',
            },
            Period: 300,
            Stat: 'Average',
          },
          ReturnData: false,
        },
      ]);


    });

    test('MathExpression controls period of metrics transitively used in it with alarms', () => {
      // GIVEN
      new Alarm(stack, 'Alarm', {
        threshold: 1,
        evaluationPeriods: 1,
        metric: new MathExpression({
          expression: 'a + e',
          usingMetrics: {
            a,
            e: new MathExpression({
              expression: 'b + c',
              usingMetrics: { b, c },
              period: Duration.minutes(1),
            }),
          },
          period: Duration.seconds(30),
        }),
      });

      // THEN
      alarmMetricsAre([
        {
          Expression: 'a + e',
          Id: 'expr_1',
        },
        {
          Id: 'a',
          MetricStat: {
            Metric: {
              MetricName: 'ACount',
              Namespace: 'Test',
            },
            Period: 30,
            Stat: 'Average',
          },
          ReturnData: false,
        },
        {
          Expression: 'b + c',
          Id: 'e',
          ReturnData: false,
        },
        {
          Id: 'b',
          MetricStat: {
            Metric: {
              MetricName: 'BCount',
              Namespace: 'Test',
            },
            Period: 30,
            Stat: 'Average',
          },
          ReturnData: false,
        },
        {
          Id: 'c',
          MetricStat: {
            Metric: {
              MetricName: 'CCount',
              Namespace: 'Test',
            },
            Period: 30,
            Stat: 'Average',
          },
          ReturnData: false,
        },
      ]);


    });

    test('MathExpression without inner metrics emits its own period', () => {
      // WHEN
      new Alarm(stack, 'Alarm', {
        threshold: 1,
        evaluationPeriods: 1,
        metric: new MathExpression({
          expression: 'INSIGHT_RULE_METRIC("SomeId", UniqueContributors)',
          usingMetrics: {},
        }),
      });

      // THEN
      alarmMetricsAre([
        {
          Expression: 'INSIGHT_RULE_METRIC("SomeId", UniqueContributors)',
          Id: 'expr_1',
          Period: 300,
        },
      ]);


    });

    test('annotation for a mathexpression alarm is calculated based upon constituent metrics', () => {
      // GIVEN
      const alarm = new Alarm(stack, 'Alarm', {
        threshold: 1,
        evaluationPeriods: 1,
        metric: new MathExpression({
          period: Duration.minutes(10),
          expression: 'a + b',
          usingMetrics: { a, b: b.with({ period: Duration.minutes(20) }) }, // This is overridden
        }),
      });

      // WHEN
      const alarmLabel = alarm.toAnnotation().label;

      // THEN
      expect(alarmLabel).toEqual('a + b >= 1 for 1 datapoints within 10 minutes');


    });

    test('can use percentiles in expression metrics in alarms', () => {
      // GIVEN
      new Alarm(stack, 'Alarm', {
        threshold: 1,
        evaluationPeriods: 1,
        metric: new MathExpression({
          expression: 'a + b99',
          usingMetrics: { a, b99 },
        }),
      });

      // THEN
      alarmMetricsAre([
        {
          Expression: 'a + b99',
          Id: 'expr_1',
        },
        {
          Id: 'a',
          MetricStat: {
            Metric: {
              MetricName: 'ACount',
              Namespace: 'Test',
            },
            Period: 300,
            Stat: 'Average',
          },
          ReturnData: false,
        },
        {
          Id: 'b99',
          MetricStat: {
            Metric: {
              MetricName: 'BCount',
              Namespace: 'Test',
            },
            Period: 300,
            Stat: 'p99',
          },
          ReturnData: false,
        },
      ]);


    });
  });
});

function graphMetricsAre(w: IWidget, metrics: any[]) {
  expect(stack.resolve(w.toJson())).toEqual([{
    type: 'metric',
    width: 6,
    height: 6,
    properties:
    {
      view: 'timeSeries',
      region: { Ref: 'AWS::Region' },
      metrics,
      yAxis: {},
    },
  }]);
}

function alarmMetricsAre(metrics: any[]) {
  expect(stack).toHaveResourceLike('AWS::CloudWatch::Alarm', {
    Metrics: metrics,
  });
}
