import { Stack } from '@aws-cdk/core';
import { Metric, Alarm, AlarmStatusWidget } from '../lib';
describe('Alarm Status Widget', () => {
  test('alarm status widget', () => {
    // GIVEN
    const stack = new Stack();
    const metric = new Metric({ namespace: 'CDK', metricName: 'Test' });
    const alarm = new Alarm(stack, 'Alarm', {
      metric,
      threshold: 1,
      evaluationPeriods: 1,
    });

    // WHEN
    const widget = new AlarmStatusWidget({
      alarms: [alarm],
    });

    // THEN
    expect(stack.resolve(widget.toJson())).toEqual([
      {
        type: 'alarm',
        width: 6,
        height: 3,
        properties: {
          title: 'Alarm Status',
          alarms: [{ 'Fn::GetAtt': ['Alarm7103F465', 'Arn'] }],
        },
      },
    ]);


  });
});
