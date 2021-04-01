import * as kinesis from '@aws-cdk/aws-kinesis';
import * as lambda from '@aws-cdk/aws-lambda';
import * as cdk from '@aws-cdk/core';
import { KinesisEventSource } from '../lib';
import { TestFunction } from './test-function';

class KinesisEventSourceTest extends cdk.Stack {
  constructor(scope: cdk.App, id: string) {
    super(scope, id);

    const fn = new TestFunction(this, 'F');
    const stream = new kinesis.Stream(this, 'Q');

    fn.addEventSource(new KinesisEventSource(stream, {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
      tumblingWindow: cdk.Duration.seconds(60),
    }));
  }
}

const app = new cdk.App();
new KinesisEventSourceTest(app, 'lambda-event-source-kinesis');
app.synth();
