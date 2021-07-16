import { TemplateAssertions } from '@aws-cdk/assertions';
import * as notifications from '@aws-cdk/aws-codestarnotifications';
import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import * as cdk from '@aws-cdk/core';
import * as sns from '../lib';

/* eslint-disable quote-props */

describe('Topic', () => {
  describe('topic tests', () => {
    test('all defaults', () => {
      const stack = new cdk.Stack();
      new sns.Topic(stack, 'MyTopic');

      TemplateAssertions.fromStack(stack).resourceCountIs('AWS::SNS::Topic', 1);

    });

    test('specify topicName', () => {
      const stack = new cdk.Stack();

      new sns.Topic(stack, 'MyTopic', {
        topicName: 'topicName',
      });

      TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::SNS::Topic', {
        'TopicName': 'topicName',
      });


    });

    test('specify displayName', () => {
      const stack = new cdk.Stack();

      new sns.Topic(stack, 'MyTopic', {
        displayName: 'displayName',
      });

      TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::SNS::Topic', {
        'DisplayName': 'displayName',
      });


    });

    test('specify kmsMasterKey', () => {
      const stack = new cdk.Stack();
      const key = new kms.Key(stack, 'CustomKey');

      new sns.Topic(stack, 'MyTopic', {
        masterKey: key,
      });

      TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::SNS::Topic', {
        'KmsMasterKeyId': { 'Fn::GetAtt': ['CustomKey1E6D0D07', 'Arn'] },
      });


    });

    test('specify displayName and topicName', () => {
      const stack = new cdk.Stack();

      new sns.Topic(stack, 'MyTopic', {
        topicName: 'topicName',
        displayName: 'displayName',
      });

      TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::SNS::Topic', {
        'DisplayName': 'displayName',
        'TopicName': 'topicName',
      });


    });

    // NOTE: This test case should be invalid when CloudFormation problem reported in CDK issue 12386 is resolved
    // see https://github.com/aws/aws-cdk/issues/12386
    test('throw with missing topicName on fifo topic', () => {
      const stack = new cdk.Stack();

      expect(() => new sns.Topic(stack, 'MyTopic', {
        fifo: true,
      })).toThrow(/FIFO SNS topics must be given a topic name./);


    });

    test('specify fifo without .fifo suffix in topicName', () => {
      const stack = new cdk.Stack();

      new sns.Topic(stack, 'MyTopic', {
        fifo: true,
        topicName: 'topicName',
      });

      TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::SNS::Topic', {
        'FifoTopic': true,
        'TopicName': 'topicName.fifo',
      });


    });

    test('specify fifo with .fifo suffix in topicName', () => {
      const stack = new cdk.Stack();

      new sns.Topic(stack, 'MyTopic', {
        fifo: true,
        topicName: 'topicName.fifo',
      });

      TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::SNS::Topic', {
        'FifoTopic': true,
        'TopicName': 'topicName.fifo',
      });


    });

    test('specify fifo without contentBasedDeduplication', () => {
      const stack = new cdk.Stack();

      new sns.Topic(stack, 'MyTopic', {
        fifo: true,
        topicName: 'topicName',
      });

      TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::SNS::Topic', {
        'FifoTopic': true,
        'TopicName': 'topicName.fifo',
      });


    });

    test('specify fifo with contentBasedDeduplication', () => {
      const stack = new cdk.Stack();

      new sns.Topic(stack, 'MyTopic', {
        contentBasedDeduplication: true,
        fifo: true,
        topicName: 'topicName',
      });

      TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::SNS::Topic', {
        'ContentBasedDeduplication': true,
        'FifoTopic': true,
        'TopicName': 'topicName.fifo',
      });


    });

    test('throw with contentBasedDeduplication on non-fifo topic', () => {
      const stack = new cdk.Stack();

      expect(() => new sns.Topic(stack, 'MyTopic', {
        contentBasedDeduplication: true,
      })).toThrow(/Content based deduplication can only be enabled for FIFO SNS topics./);


    });
  });

  test('can add a policy to the topic', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const topic = new sns.Topic(stack, 'Topic');

    // WHEN
    topic.addToResourcePolicy(new iam.PolicyStatement({
      resources: ['*'],
      actions: ['sns:*'],
      principals: [new iam.ArnPrincipal('arn')],
    }));

    // THEN
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::SNS::TopicPolicy', {
      PolicyDocument: {
        Version: '2012-10-17',
        Statement: [{
          'Sid': '0',
          'Action': 'sns:*',
          'Effect': 'Allow',
          'Principal': { 'AWS': 'arn' },
          'Resource': '*',
        }],
      },
    });


  });

  test('give publishing permissions', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const topic = new sns.Topic(stack, 'Topic');
    const user = new iam.User(stack, 'User');

    // WHEN
    topic.grantPublish(user);

    // THEN
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::IAM::Policy', {
      'PolicyDocument': {
        Version: '2012-10-17',
        'Statement': [
          {
            'Action': 'sns:Publish',
            'Effect': 'Allow',
            'Resource': stack.resolve(topic.topicArn),
          },
        ],
      },
    });


  });

  test('TopicPolicy passed document', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const topic = new sns.Topic(stack, 'MyTopic');
    const ps = new iam.PolicyStatement({
      actions: ['service:statement0'],
      principals: [new iam.ArnPrincipal('arn')],
    });

    // WHEN
    new sns.TopicPolicy(stack, 'topicpolicy', { topics: [topic], policyDocument: new iam.PolicyDocument({ assignSids: true, statements: [ps] }) });

    // THEN
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::SNS::TopicPolicy', {
      'PolicyDocument': {
        'Statement': [
          {
            'Action': 'service:statement0',
            'Effect': 'Allow',
            'Principal': { 'AWS': 'arn' },
            'Sid': '0',
          },
        ],
        'Version': '2012-10-17',
      },
      'Topics': [
        {
          'Ref': 'MyTopic86869434',
        },
      ],
    });


  });

  test('Add statements to policy', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const topic = new sns.Topic(stack, 'MyTopic');

    // WHEN
    const topicPolicy = new sns.TopicPolicy(stack, 'TopicPolicy', {
      topics: [topic],
    });
    topicPolicy.document.addStatements(new iam.PolicyStatement({
      actions: ['service:statement0'],
      principals: [new iam.ArnPrincipal('arn')],
    }));

    // THEN
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::SNS::TopicPolicy', {
      'PolicyDocument': {
        'Statement': [
          {
            'Action': 'service:statement0',
            'Effect': 'Allow',
            'Principal': { 'AWS': 'arn' },
            'Sid': '0',
          },
        ],
        'Version': '2012-10-17',
      },
      'Topics': [
        {
          'Ref': 'MyTopic86869434',
        },
      ],
    });

  });

  test('topic resource policy includes unique SIDs', () => {
    const stack = new cdk.Stack();

    const topic = new sns.Topic(stack, 'MyTopic');

    topic.addToResourcePolicy(new iam.PolicyStatement({
      actions: ['service:statement0'],
      principals: [new iam.ArnPrincipal('arn')],
    }));
    topic.addToResourcePolicy(new iam.PolicyStatement({
      actions: ['service:statement1'],
      principals: [new iam.ArnPrincipal('arn')],
    }));

    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::SNS::TopicPolicy', {
      'PolicyDocument': {
        'Statement': [
          {
            'Action': 'service:statement0',
            'Effect': 'Allow',
            'Principal': { 'AWS': 'arn' },
            'Sid': '0',
          },
          {
            'Action': 'service:statement1',
            'Effect': 'Allow',
            'Principal': { 'AWS': 'arn' },
            'Sid': '1',
          },
        ],
        'Version': '2012-10-17',
      },
      'Topics': [
        {
          'Ref': 'MyTopic86869434',
        },
      ],
    });


  });

  test('fromTopicArn', () => {
    // GIVEN
    const stack2 = new cdk.Stack();

    // WHEN
    const imported = sns.Topic.fromTopicArn(stack2, 'Imported', 'arn:aws:sns:*:123456789012:my_corporate_topic');

    // THEN
    expect(imported.topicName).toEqual('my_corporate_topic');
    expect(imported.topicArn).toEqual('arn:aws:sns:*:123456789012:my_corporate_topic');

  });

  test('test metrics', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const topic = new sns.Topic(stack, 'Topic');

    // THEN
    expect(stack.resolve(topic.metricNumberOfMessagesPublished())).toEqual({
      dimensions: { TopicName: { 'Fn::GetAtt': ['TopicBFC7AF6E', 'TopicName'] } },
      namespace: 'AWS/SNS',
      metricName: 'NumberOfMessagesPublished',
      period: cdk.Duration.minutes(5),
      statistic: 'Sum',
    });

    expect(stack.resolve(topic.metricPublishSize())).toEqual({
      dimensions: { TopicName: { 'Fn::GetAtt': ['TopicBFC7AF6E', 'TopicName'] } },
      namespace: 'AWS/SNS',
      metricName: 'PublishSize',
      period: cdk.Duration.minutes(5),
      statistic: 'Average',
    });


  });

  test('subscription is created under the topic scope by default', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const topic = new sns.Topic(stack, 'Topic');

    // WHEN
    topic.addSubscription({
      bind: () => ({
        protocol: sns.SubscriptionProtocol.HTTP,
        endpoint: 'http://foo/bar',
        subscriberId: 'my-subscription',
      }),
    });

    // THEN
    TemplateAssertions.fromStack(stack).resourceCountIs('AWS::SNS::Subscription', 1);

  });

  test('if "scope" is defined, subscription will be created under that scope', () => {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'A');
    const stack2 = new cdk.Stack(app, 'B');
    const topic = new sns.Topic(stack, 'Topic');

    // WHEN
    topic.addSubscription({
      bind: () => ({
        protocol: sns.SubscriptionProtocol.HTTP,
        endpoint: 'http://foo/bar',
        subscriberScope: stack2,
        subscriberId: 'subscriberId',
      }),
    });

    // THEN
    TemplateAssertions.fromStack(stack).resourceCountIs('AWS::SNS::Subscription', 0);
    TemplateAssertions.fromStack(stack2).resourceCountIs('AWS::SNS::Subscription', 1);

  });

  test('fails if topic policy has no actions', () => {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'my-stack');
    const topic = new sns.Topic(stack, 'Topic');

    // WHEN
    topic.addToResourcePolicy(new iam.PolicyStatement({
      resources: ['*'],
      principals: [new iam.ArnPrincipal('arn')],
    }));

    // THEN
    expect(() => app.synth()).toThrow(/A PolicyStatement must specify at least one \'action\' or \'notAction\'/);

  });

  test('fails if topic policy has no IAM principals', () => {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'my-stack');
    const topic = new sns.Topic(stack, 'Topic');

    // WHEN
    topic.addToResourcePolicy(new iam.PolicyStatement({
      resources: ['*'],
      actions: ['sns:*'],
    }));

    // THEN
    expect(() => app.synth()).toThrow(/A PolicyStatement used in a resource-based policy must specify at least one IAM principal/);

  });

  test('topic policy should be set if topic as a notifications rule target', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'my-stack');
    const topic = new sns.Topic(stack, 'Topic');
    const rule = new notifications.NotificationRule(stack, 'MyNotificationRule', {
      source: {
        bindAsNotificationRuleSource: () => ({
          sourceArn: 'ARN',
        }),
      },
      events: ['codebuild-project-build-state-succeeded'],
    });

    rule.addTarget(topic);

    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::SNS::TopicPolicy', {
      PolicyDocument: {
        Version: '2012-10-17',
        Statement: [{
          'Sid': '0',
          'Action': 'sns:Publish',
          'Effect': 'Allow',
          'Principal': { 'Service': 'codestar-notifications.amazonaws.com' },
          'Resource': { 'Ref': 'TopicBFC7AF6E' },
        }],
      },
      Topics: [{
        Ref: 'TopicBFC7AF6E',
      }],
    });


  });
});
