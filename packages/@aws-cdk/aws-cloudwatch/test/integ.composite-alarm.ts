import { App, Stack, StackProps } from '@aws-cdk/core';
import { Alarm, AlarmRule, AlarmState, CompositeAlarm, Metric } from '../lib';

class CompositeAlarmIntegrationTest extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    const testMetric = new Metric({
      namespace: 'CDK/Test',
      metricName: 'Metric',
    });

    const alarm1 = new Alarm(this, 'Alarm1', {
      metric: testMetric,
      threshold: 100,
      evaluationPeriods: 3,
    });

    const alarm2 = new Alarm(this, 'Alarm2', {
      metric: testMetric,
      threshold: 1000,
      evaluationPeriods: 3,
    });

    const alarm3 = new Alarm(this, 'Alarm3', {
      metric: testMetric,
      threshold: 10000,
      evaluationPeriods: 3,
    });

    const alarm4 = new Alarm(this, 'Alarm4', {
      metric: testMetric,
      threshold: 100000,
      evaluationPeriods: 3,
    });

    const alarm5 = new Alarm(this, 'Alarm5', {
      alarmName: 'Alarm with space in name',
      metric: testMetric,
      threshold: 100000,
      evaluationPeriods: 3,
    });

    const alarmRule = AlarmRule.anyOf(
      AlarmRule.allOf(
        AlarmRule.anyOf(
          alarm1,
          AlarmRule.fromAlarm(alarm2, AlarmState.OK),
          alarm3,
          alarm5,
        ),
        AlarmRule.not(AlarmRule.fromAlarm(alarm4, AlarmState.INSUFFICIENT_DATA)),
      ),
      AlarmRule.fromBoolean(false),
    );

    new CompositeAlarm(this, 'CompositeAlarm', {
      alarmRule,
    });
  }
}

const app = new App();

new CompositeAlarmIntegrationTest(app, 'CompositeAlarmIntegrationTest');

app.synth();
