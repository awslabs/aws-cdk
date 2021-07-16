import { Duration, Stack } from '@aws-cdk/core';
import { Alarm, AlarmWidget, Color, GraphWidget, GraphWidgetView, LegendPosition, LogQueryWidget, Metric, Shading, SingleValueWidget, LogQueryVisualizationType } from '../lib';

describe('Graphs', () => {
  test('add stacked property to graphs', () => {
    // WHEN
    const stack = new Stack();
    const widget = new GraphWidget({
      title: 'Test widget',
      stacked: true,
    });

    // THEN
    expect(stack.resolve(widget.toJson())).toEqual([{
      type: 'metric',
      width: 6,
      height: 6,
      properties: {
        view: 'timeSeries',
        title: 'Test widget',
        region: { Ref: 'AWS::Region' },
        stacked: true,
        yAxis: {},
      },
    }]);


  });

  test('add metrics to graphs on either axis', () => {
    // WHEN
    const stack = new Stack();
    const widget = new GraphWidget({
      title: 'My fancy graph',
      left: [
        new Metric({ namespace: 'CDK', metricName: 'Test' }),
      ],
      right: [
        new Metric({ namespace: 'CDK', metricName: 'Tast' }),
      ],
    });

    // THEN
    expect(stack.resolve(widget.toJson())).toEqual([{
      type: 'metric',
      width: 6,
      height: 6,
      properties: {
        view: 'timeSeries',
        title: 'My fancy graph',
        region: { Ref: 'AWS::Region' },
        metrics: [
          ['CDK', 'Test'],
          ['CDK', 'Tast', { yAxis: 'right' }],
        ],
        yAxis: {},
      },
    }]);


  });

  test('add metrics to graphs on either axis lazily', () => {
    // WHEN
    const stack = new Stack();
    const widget = new GraphWidget({
      title: 'My fancy graph',
    });
    widget.addLeftMetric(new Metric({ namespace: 'CDK', metricName: 'Test' }));
    widget.addRightMetric(new Metric({ namespace: 'CDK', metricName: 'Tast' }));

    // THEN
    expect(stack.resolve(widget.toJson())).toEqual([{
      type: 'metric',
      width: 6,
      height: 6,
      properties: {
        view: 'timeSeries',
        title: 'My fancy graph',
        region: { Ref: 'AWS::Region' },
        metrics: [
          ['CDK', 'Test'],
          ['CDK', 'Tast', { yAxis: 'right' }],
        ],
        yAxis: {},
      },
    }]);


  });

  test('label and color are respected in constructor', () => {
    // WHEN
    const stack = new Stack();
    const widget = new GraphWidget({
      left: [new Metric({ namespace: 'CDK', metricName: 'Test', label: 'MyMetric', color: '000000' })],
    });

    // THEN
    expect(stack.resolve(widget.toJson())).toEqual([{
      type: 'metric',
      width: 6,
      height: 6,
      properties: {
        view: 'timeSeries',
        region: { Ref: 'AWS::Region' },
        metrics: [
          ['CDK', 'Test', { label: 'MyMetric', color: '000000' }],
        ],
        yAxis: {},
      },
    }]);


  });

  test('bar view', () => {
    // WHEN
    const stack = new Stack();
    const widget = new GraphWidget({
      title: 'Test widget',
      view: GraphWidgetView.BAR,
    });

    // THEN
    expect(stack.resolve(widget.toJson())).toEqual([{
      type: 'metric',
      width: 6,
      height: 6,
      properties: {
        view: 'bar',
        title: 'Test widget',
        region: { Ref: 'AWS::Region' },
        yAxis: {},
      },
    }]);


  });

  test('singlevalue widget', () => {
    // GIVEN
    const stack = new Stack();
    const metric = new Metric({ namespace: 'CDK', metricName: 'Test' });

    // WHEN
    const widget = new SingleValueWidget({
      metrics: [metric],
    });

    // THEN
    expect(stack.resolve(widget.toJson())).toEqual([{
      type: 'metric',
      width: 6,
      height: 3,
      properties: {
        view: 'singleValue',
        region: { Ref: 'AWS::Region' },
        metrics: [
          ['CDK', 'Test'],
        ],
      },
    }]);


  });

  test('query result widget', () => {
    // GIVEN
    const stack = new Stack();
    const logGroup = { logGroupName: 'my-log-group' };

    // WHEN
    const widget = new LogQueryWidget({
      logGroupNames: [logGroup.logGroupName],
      queryLines: [
        'fields @message',
        'filter @message like /Error/',
      ],
    });

    // THEN
    expect(stack.resolve(widget.toJson())).toEqual([{
      type: 'log',
      width: 6,
      height: 6,
      properties: {
        view: 'table',
        region: { Ref: 'AWS::Region' },
        query: `SOURCE '${logGroup.logGroupName}' | fields @message\n| filter @message like /Error/`,
      },
    }]);


  });

  test('query result widget - bar', () => {
    // GIVEN
    const stack = new Stack();
    const logGroup = { logGroupName: 'my-log-group' };

    // WHEN
    const widget = new LogQueryWidget({
      logGroupNames: [logGroup.logGroupName],
      view: LogQueryVisualizationType.BAR,
      queryLines: [
        'fields @message',
        'filter @message like /Error/',
      ],
    });

    // THEN
    expect(stack.resolve(widget.toJson())).toEqual([{
      type: 'log',
      width: 6,
      height: 6,
      properties: {
        view: 'bar',
        region: { Ref: 'AWS::Region' },
        query: `SOURCE '${logGroup.logGroupName}' | fields @message\n| filter @message like /Error/`,
      },
    }]);


  });

  test('query result widget - pie', () => {
    // GIVEN
    const stack = new Stack();
    const logGroup = { logGroupName: 'my-log-group' };

    // WHEN
    const widget = new LogQueryWidget({
      logGroupNames: [logGroup.logGroupName],
      view: LogQueryVisualizationType.PIE,
      queryLines: [
        'fields @message',
        'filter @message like /Error/',
      ],
    });

    // THEN
    expect(stack.resolve(widget.toJson())).toEqual([{
      type: 'log',
      width: 6,
      height: 6,
      properties: {
        view: 'pie',
        region: { Ref: 'AWS::Region' },
        query: `SOURCE '${logGroup.logGroupName}' | fields @message\n| filter @message like /Error/`,
      },
    }]);


  });

  test('query result widget - line', () => {
    // GIVEN
    const stack = new Stack();
    const logGroup = { logGroupName: 'my-log-group' } ;

    // WHEN
    const widget = new LogQueryWidget({
      logGroupNames: [logGroup.logGroupName],
      view: LogQueryVisualizationType.LINE,
      queryLines: [
        'fields @message',
        'filter @message like /Error/',
      ],
    });

    // THEN
    expect(stack.resolve(widget.toJson())).toEqual([{
      type: 'log',
      width: 6,
      height: 6,
      properties: {
        view: 'timeSeries',
        stacked: false,
        region: { Ref: 'AWS::Region' },
        query: `SOURCE '${logGroup.logGroupName}' | fields @message\n| filter @message like /Error/`,
      },
    }]);


  });

  test('query result widget - stackedarea', () => {
    // GIVEN
    const stack = new Stack();
    const logGroup = { logGroupName: 'my-log-group' };

    // WHEN
    const widget = new LogQueryWidget({
      logGroupNames: [logGroup.logGroupName],
      view: LogQueryVisualizationType.STACKEDAREA,
      queryLines: [
        'fields @message',
        'filter @message like /Error/',
      ],
    });

    // THEN
    expect(stack.resolve(widget.toJson())).toEqual([{
      type: 'log',
      width: 6,
      height: 6,
      properties: {
        view: 'timeSeries',
        stacked: true,
        region: { Ref: 'AWS::Region' },
        query: `SOURCE '${logGroup.logGroupName}' | fields @message\n| filter @message like /Error/`,
      },
    }]);


  });

  test('alarm widget', () => {
    // GIVEN
    const stack = new Stack();

    const alarm = new Metric({ namespace: 'CDK', metricName: 'Test' }).createAlarm(stack, 'Alarm', {
      evaluationPeriods: 2,
      threshold: 1000,
    });

    // WHEN
    const widget = new AlarmWidget({
      alarm,
    });

    // THEN
    expect(stack.resolve(widget.toJson())).toEqual([{
      type: 'metric',
      width: 6,
      height: 6,
      properties: {
        view: 'timeSeries',
        region: { Ref: 'AWS::Region' },
        annotations: {
          alarms: [{ 'Fn::GetAtt': ['Alarm7103F465', 'Arn'] }],
        },
        yAxis: {},
      },
    }]);


  });

  test('add annotations to graph', () => {
    // WHEN
    const stack = new Stack();
    const widget = new GraphWidget({
      title: 'My fancy graph',
      left: [
        new Metric({ namespace: 'CDK', metricName: 'Test' }),
      ],
      leftAnnotations: [{
        value: 1000,
        color: '667788',
        fill: Shading.BELOW,
        label: 'this is the annotation',
      }],
    });

    // THEN
    expect(stack.resolve(widget.toJson())).toEqual([{
      type: 'metric',
      width: 6,
      height: 6,
      properties: {
        view: 'timeSeries',
        title: 'My fancy graph',
        region: { Ref: 'AWS::Region' },
        metrics: [
          ['CDK', 'Test'],
        ],
        annotations: {
          horizontal: [{
            yAxis: 'left',
            value: 1000,
            color: '667788',
            fill: 'below',
            label: 'this is the annotation',
          }],
        },
        yAxis: {},
      },
    }]);


  });

  test('convert alarm to annotation', () => {
    // GIVEN
    const stack = new Stack();

    const metric = new Metric({ namespace: 'CDK', metricName: 'Test' });

    const alarm = metric.createAlarm(stack, 'Alarm', {
      evaluationPeriods: 7,
      datapointsToAlarm: 2,
      threshold: 1000,
    });

    // WHEN
    const widget = new GraphWidget({
      right: [metric],
      rightAnnotations: [alarm.toAnnotation()],
    });

    // THEN
    expect(stack.resolve(widget.toJson())).toEqual([{
      type: 'metric',
      width: 6,
      height: 6,
      properties: {
        view: 'timeSeries',
        region: { Ref: 'AWS::Region' },
        metrics: [
          ['CDK', 'Test', { yAxis: 'right' }],
        ],
        annotations: {
          horizontal: [{
            yAxis: 'right',
            value: 1000,
            label: 'Test >= 1000 for 2 datapoints within 35 minutes',
          }],
        },
        yAxis: {},
      },
    }]);


  });

  test('add yAxis to graph', () => {
    // WHEN
    const stack = new Stack();
    const widget = new GraphWidget({
      title: 'My fancy graph',
      left: [
        new Metric({ namespace: 'CDK', metricName: 'Test' }),
      ],
      right: [
        new Metric({ namespace: 'CDK', metricName: 'Tast' }),
      ],
      leftYAxis: ({
        label: 'Left yAxis',
        max: 100,
      }),
      rightYAxis: ({
        label: 'Right yAxis',
        min: 10,
        showUnits: false,
      }),
    });

    // THEN
    expect(stack.resolve(widget.toJson())).toEqual([{
      type: 'metric',
      width: 6,
      height: 6,
      properties: {
        view: 'timeSeries',
        title: 'My fancy graph',
        region: { Ref: 'AWS::Region' },
        metrics: [
          ['CDK', 'Test'],
          ['CDK', 'Tast', { yAxis: 'right' }],
        ],
        yAxis: {
          left: { label: 'Left yAxis', max: 100 },
          right: { label: 'Right yAxis', min: 10, showUnits: false },
        },
      },
    }]);


  });

  test('specify liveData property on graph', () => {
    // WHEN
    const stack = new Stack();
    const widget = new GraphWidget({
      title: 'My live graph',
      left: [
        new Metric({ namespace: 'CDK', metricName: 'Test' }),
      ],
      liveData: true,
    });

    // THEN
    expect(stack.resolve(widget.toJson())).toEqual([{
      type: 'metric',
      width: 6,
      height: 6,
      properties: {
        view: 'timeSeries',
        title: 'My live graph',
        region: { Ref: 'AWS::Region' },
        metrics: [
          ['CDK', 'Test'],
        ],
        liveData: true,
        yAxis: {},
      },
    }]);


  });

  test('can use imported alarm with graph', () => {
    // GIVEN
    const stack = new Stack();
    const alarm = Alarm.fromAlarmArn(stack, 'Alarm', 'arn:aws:cloudwatch:region:account-id:alarm:alarm-name');

    // WHEN
    new AlarmWidget({
      title: 'My fancy graph',
      alarm,
    });

    // THEN: Compiles


  });

  test('add setPeriodToTimeRange to singleValueWidget', () => {
    // GIVEN
    const stack = new Stack();
    const metric = new Metric({ namespace: 'CDK', metricName: 'Test' });

    // WHEN
    const widget = new SingleValueWidget({
      metrics: [metric],
      setPeriodToTimeRange: true,
    });

    // THEN
    expect(stack.resolve(widget.toJson())).toEqual([{
      type: 'metric',
      width: 6,
      height: 3,
      properties: {
        view: 'singleValue',
        region: { Ref: 'AWS::Region' },
        metrics: [
          ['CDK', 'Test'],
        ],
        setPeriodToTimeRange: true,
      },
    }]);


  });

  test('add singleValueFullPrecision to singleValueWidget', () => {
    // GIVEN
    const stack = new Stack();
    const metric = new Metric({ namespace: 'CDK', metricName: 'Test' });

    // WHEN
    const widget = new SingleValueWidget({
      metrics: [metric],
      fullPrecision: true,
    });

    // THEN
    expect(stack.resolve(widget.toJson())).toEqual([{
      type: 'metric',
      width: 6,
      height: 3,
      properties: {
        view: 'singleValue',
        region: { Ref: 'AWS::Region' },
        metrics: [
          ['CDK', 'Test'],
        ],
        singleValueFullPrecision: true,
      },
    }]);


  });

  test('allows overriding custom values of dashboard widgets', () => {
    class HiddenMetric extends Metric {
      public toMetricConfig() {
        const ret = super.toMetricConfig();
        // @ts-ignore
        ret.renderingProperties.visible = false;
        return ret;
      }
    }

    const stack = new Stack();
    const widget = new GraphWidget({
      left: [
        new HiddenMetric({ namespace: 'CDK', metricName: 'Test' }),
      ],
    });

    expect(stack.resolve(widget.toJson())[0].properties.metrics[0])
      .toEqual(['CDK', 'Test', { visible: false }]);


  });

  test('GraphColor is correctly converted into the correct hexcode', () => {
    // GIVEN
    const stack = new Stack();
    const metric = new Metric({ namespace: 'CDK', metricName: 'Test' });

    // WHEN
    const widget = new GraphWidget({
      left: [metric.with({
        color: Color.BLUE,
      })],
      leftAnnotations: [
        { color: Color.RED, value: 100 },
      ],
    });

    expect(stack.resolve(widget.toJson())[0].properties.metrics[0]).toEqual(['CDK', 'Test', { color: '#1f77b4' }]);
    expect(stack.resolve(widget.toJson())[0].properties.annotations.horizontal[0]).toEqual({ yAxis: 'left', value: 100, color: '#d62728' });

  });

  test('legend position is respected in constructor', () => {
    // WHEN
    const stack = new Stack();
    const widget = new GraphWidget({
      left: [new Metric({ namespace: 'CDK', metricName: 'Test' })],
      legendPosition: LegendPosition.RIGHT,
    });

    // THEN
    expect(stack.resolve(widget.toJson())).toEqual([{
      type: 'metric',
      width: 6,
      height: 6,
      properties: {
        view: 'timeSeries',
        region: { Ref: 'AWS::Region' },
        metrics: [
          ['CDK', 'Test'],
        ],
        yAxis: {},
        legend: {
          position: 'right',
        },
      },
    }]);


  });

  test('add setPeriodToTimeRange to GraphWidget', () => {
    // GIVEN
    const stack = new Stack();
    const widget = new GraphWidget({
      left: [new Metric({ namespace: 'CDK', metricName: 'Test' })],
      view: GraphWidgetView.PIE,
      setPeriodToTimeRange: true,
    });

    // THEN
    expect(stack.resolve(widget.toJson())).toEqual([{
      type: 'metric',
      width: 6,
      height: 6,
      properties: {
        view: 'pie',
        region: { Ref: 'AWS::Region' },
        metrics: [
          ['CDK', 'Test'],
        ],
        yAxis: {},
        setPeriodToTimeRange: true,
      },
    }]);


  });

  test('GraphWidget supports stat and period', () => {
    // GIVEN
    const stack = new Stack();
    const widget = new GraphWidget({
      left: [new Metric({ namespace: 'CDK', metricName: 'Test' })],
      statistic: 'Average',
      period: Duration.days(2),
    });

    // THEN
    expect(stack.resolve(widget.toJson())).toEqual([{
      type: 'metric',
      width: 6,
      height: 6,
      properties: {
        view: 'timeSeries',
        region: { Ref: 'AWS::Region' },
        metrics: [
          ['CDK', 'Test'],
        ],
        yAxis: {},
        stat: 'Average',
        period: 172800,
      },
    }]);


  });
});
