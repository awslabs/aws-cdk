// Integration test to deploy some resources, create an alarm on it and create a dashboard.
//
// Because literally every other library is going to depend on @aws-cdk/aws-cloudwatch, we drop down
// to the very lowest level to create CloudFormation resources by hand, without even generated
// library support.

import * as cdk from '@aws-cdk/core';
import * as cloudwatch from '../lib';

const app = new cdk.App();

const stack = new cdk.Stack(app, 'aws-cdk-cloudwatch-alarms');

const queue = new cdk.CfnResource(stack, 'queue', { type: 'AWS::SQS::Queue' });

const numberOfMessagesVisibleMetric = new cloudwatch.Metric({
  namespace: 'AWS/SQS',
  metricName: 'ApproximateNumberOfMessagesVisible',
  dimensions: { QueueName: queue.getAtt('QueueName') },
});

const sentMessageSizeMetric = new cloudwatch.Metric({
  namespace: 'AWS/SQS',
  metricName: 'SentMessageSize',
  dimensions: { QueueName: queue.getAtt('QueueName') },
});

const alarm = numberOfMessagesVisibleMetric.createAlarm(stack, 'Alarm', {
  threshold: 100,
  evaluationPeriods: 3,
  datapointsToAlarm: 2,
});

const dashboard = new cloudwatch.Dashboard(stack, 'Dash', {
  dashboardName: 'MyCustomDashboardName',
  start: '-9H',
  end: '2018-12-17T06:00:00.000Z',
  periodOverride: cloudwatch.PeriodOverride.INHERIT,
});
dashboard.addWidgets(
  new cloudwatch.TextWidget({ markdown: '# This is my dashboard' }),
  new cloudwatch.TextWidget({ markdown: 'you like?' }),
);
dashboard.addWidgets(new cloudwatch.AlarmWidget({
  title: 'Messages in queue',
  alarm,
}));
dashboard.addWidgets(new cloudwatch.GraphWidget({
  title: 'More messages in queue with alarm annotation',
  left: [numberOfMessagesVisibleMetric],
  leftAnnotations: [alarm.toAnnotation()],
}));
dashboard.addWidgets(new cloudwatch.SingleValueWidget({
  title: 'Current messages in queue',
  metrics: [numberOfMessagesVisibleMetric],
}));
dashboard.addWidgets(new cloudwatch.LogQueryWidget({
  title: 'Errors in my log group',
  logGroupNames: ['my-log-group'],
  queryString: `fields @message
                | filter @message like /Error/`,
}));
dashboard.addWidgets(new cloudwatch.LogQueryWidget({
  title: 'Errors in my log group - bar',
  view: cloudwatch.LogQueryVisualizationType.BAR,
  logGroupNames: ['my-log-group'],
  queryString: `fields @message
                | filter @message like /Error/`,
}));
dashboard.addWidgets(new cloudwatch.LogQueryWidget({
  title: 'Errors in my log group - line',
  view: cloudwatch.LogQueryVisualizationType.LINE,
  logGroupNames: ['my-log-group'],
  queryString: `fields @message
                | filter @message like /Error/`,
}));
dashboard.addWidgets(new cloudwatch.LogQueryWidget({
  title: 'Errors in my log group - stacked',
  view: cloudwatch.LogQueryVisualizationType.STACKEDAREA,
  logGroupNames: ['my-log-group'],
  queryString: `fields @message
                | filter @message like /Error/`,
}));
dashboard.addWidgets(new cloudwatch.LogQueryWidget({
  title: 'Errors in my log group - pie',
  view: cloudwatch.LogQueryVisualizationType.PIE,
  logGroupNames: ['my-log-group'],
  queryString: `fields @message
                | filter @message like /Error/`,
}));
dashboard.addWidgets(new cloudwatch.SingleValueWidget({
  title: 'Sent message size',
  metrics: [sentMessageSizeMetric],
  fullPrecision: false,
}));
dashboard.addWidgets(new cloudwatch.SingleValueWidget({
  title: 'Sent message size with full precision',
  metrics: [sentMessageSizeMetric],
  fullPrecision: true,
}));
dashboard.addWidgets(new cloudwatch.ContributorInsightsWidget({
  title: 'Top 50 callers',
  ruleName: 'my-contributor-insights-rule',
  contributorSelection: cloudwatch.TopContributors.TOP50,
}));

app.synth();
