import * as iot from '@aws-cdk/aws-iot';
import * as sns from '@aws-cdk/aws-sns';
import * as cdk from '@aws-cdk/core';
import * as actions from '../../lib';

/**
* Define a rule that triggers to republish received data.
* Automatically creates invoke lambda permission
*/
const app = new cdk.App();

const stack = new cdk.Stack(app, 'aws-cdk-republish-topic-rule-action');

const downstream = new iot.TopicRule(stack, 'DownstreamTopic', {
  sql: 'SELECT teapots FROM \'inventory\'',
  actions: [new actions.SnsTopic(new sns.Topic(stack, 'MyTopic'))],
});

new iot.TopicRule(stack, 'MyRepublishTopicRule', {
  sql: 'SELECT teapots FROM \'coffee/shop\'',
  actions: [new actions.RepublishTopic(downstream, { topic: 'inventory' })],
});

app.synth();
