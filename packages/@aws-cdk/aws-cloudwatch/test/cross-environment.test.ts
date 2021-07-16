import '@aws-cdk/assert-internal/jest';
import { Stack } from '@aws-cdk/core';
import { Alarm, GraphWidget, IWidget, Metric } from '../lib';

const a = new Metric({ namespace: 'Test', metricName: 'ACount' });

let stack1: Stack;
let stack2: Stack;
describe('cross environment', () => {
  beforeEach(() => {
    stack1 = new Stack(undefined, undefined, { env: { region: 'pluto', account: '1234' } });
    stack2 = new Stack(undefined, undefined, { env: { region: 'mars', account: '5678' } });

  });

  describe('in graphs', () => {
    test('metric attached to stack1 will not render region and account in stack1', () => {
      // GIVEN
      const graph = new GraphWidget({
        left: [
          a.attachTo(stack1),
        ],
      });

      // THEN
      graphMetricsAre(stack1, graph, [
        ['Test', 'ACount'],
      ]);


    });

    test('metric attached to stack1 will render region and account in stack2', () => {
      // GIVEN
      const graph = new GraphWidget({
        left: [
          a.attachTo(stack1),
        ],
      });

      // THEN
      graphMetricsAre(stack2, graph, [
        ['Test', 'ACount', { region: 'pluto', accountId: '1234' }],
      ]);


    });

    test('metric with explicit account and region will render in environment agnostic stack', () => {
      // GIVEN
      const graph = new GraphWidget({
        left: [
          a.with({ account: '1234', region: 'us-north-5' }),
        ],
      });

      // THEN
      graphMetricsAre(new Stack(), graph, [
        ['Test', 'ACount', { accountId: '1234', region: 'us-north-5' }],
      ]);


    });

    test('metric attached to agnostic stack will not render in agnostic stack', () => {
      // GIVEN
      const graph = new GraphWidget({
        left: [
          a.attachTo(new Stack()),
        ],
      });

      // THEN
      graphMetricsAre(new Stack(), graph, [
        ['Test', 'ACount'],
      ]);


    });
  });

  describe('in alarms', () => {
    test('metric attached to stack1 will not render region and account in stack1', () => {
      // GIVEN
      new Alarm(stack1, 'Alarm', {
        threshold: 1,
        evaluationPeriods: 1,
        metric: a.attachTo(stack1),
      });

      // THEN
      expect(stack1).toHaveResourceLike('AWS::CloudWatch::Alarm', {
        MetricName: 'ACount',
        Namespace: 'Test',
        Period: 300,
      });


    });

    test('metric attached to stack1 will throw in stack2', () => {
      // Cross-region/cross-account metrics are supported in Dashboards but not in Alarms

      // GIVEN
      expect(() => {
        new Alarm(stack2, 'Alarm', {
          threshold: 1,
          evaluationPeriods: 1,
          metric: a.attachTo(stack1),
        });
      }).toThrow(/Cannot create an Alarm in region 'mars' based on metric 'ACount' in 'pluto'/);


    });
  });
});

function graphMetricsAre(stack: Stack, w: IWidget, metrics: any[]) {
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