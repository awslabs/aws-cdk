import { expect, haveResource } from '@aws-cdk/assert-internal';
import * as notifications from '@aws-cdk/aws-codestarnotifications';
import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import * as cdk from '@aws-cdk/core';
import { Test } from 'nodeunit';
import * as sns from '../lib';

/* eslint-disable quote-props */

export = {
  'topic tests': {
    'all defaults'(test: Test) {
      const stack = new cdk.Stack();
      new sns.Topic(stack, 'MyTopic');

      expect(stack).toMatch({
        'Resources': {
          'MyTopic86869434': {
            'Type': 'AWS::SNS::Topic',
          },
        },
      });

      test.done();
    },

    'specify topicName'(test: Test) {
      const stack = new cdk.Stack();

      new sns.Topic(stack, 'MyTopic', {
        topicName: 'topicName',
      });

      expect(stack).toMatch({
        'Resources': {
          'MyTopic86869434': {
            'Type': 'AWS::SNS::Topic',
            'Properties': {
              'TopicName': 'topicName',
            },
          },
        },
      });

      test.done();
    },

    'specify displayName'(test: Test) {
      const stack = new cdk.Stack();

      new sns.Topic(stack, 'MyTopic', {
        displayName: 'displayName',
      });

      expect(stack).toMatch({
        'Resources': {
          'MyTopic86869434': {
            'Type': 'AWS::SNS::Topic',
            'Properties': {
              'DisplayName': 'displayName',
            },
          },
        },
      });

      test.done();
    },

    'specify kmsMasterKey'(test: Test) {
      const stack = new cdk.Stack();
      const key = new kms.Key(stack, 'CustomKey');

      new sns.Topic(stack, 'MyTopic', {
        masterKey: key,
      });

      expect(stack).to(haveResource('AWS::SNS::Topic', {
        'KmsMasterKeyId': { 'Fn::GetAtt': ['CustomKey1E6D0D07', 'Arn'] },
      }));

      test.done();
    },

    'specify displayName and topicName'(test: Test) {
      const stack = new cdk.Stack();

      new sns.Topic(stack, 'MyTopic', {
        topicName: 'topicName',
        displayName: 'displayName',
      });

      expect(stack).toMatch({
        'Resources': {
          'MyTopic86869434': {
            'Type': 'AWS::SNS::Topic',
            'Properties': {
              'DisplayName': 'displayName',
              'TopicName': 'topicName',
            },
          },
        },
      });

      test.done();
    },

    // NOTE: This test case should be invalid when CloudFormation problem reported in CDK issue 12386 is resolved
    // see https://github.com/aws/aws-cdk/issues/12386
    'throw with missing topicName on fifo topic'(test: Test) {
      const stack = new cdk.Stack();

      test.throws(() => new sns.Topic(stack, 'MyTopic', {
        fifo: true,
      }), /FIFO SNS topics must be given a topic name./);

      test.done();
    },

    'specify fifo without .fifo suffix in topicName'(test: Test) {
      const stack = new cdk.Stack();

      new sns.Topic(stack, 'MyTopic', {
        fifo: true,
        topicName: 'topicName',
      });

      expect(stack).toMatch({
        'Resources': {
          'MyTopic86869434': {
            'Type': 'AWS::SNS::Topic',
            'Properties': {
              'FifoTopic': true,
              'TopicName': 'topicName.fifo',
            },
          },
        },
      });

      test.done();
    },

    'specify fifo with .fifo suffix in topicName'(test: Test) {
      const stack = new cdk.Stack();

      new sns.Topic(stack, 'MyTopic', {
        fifo: true,
        topicName: 'topicName.fifo',
      });

      expect(stack).toMatch({
        'Resources': {
          'MyTopic86869434': {
            'Type': 'AWS::SNS::Topic',
            'Properties': {
              'FifoTopic': true,
              'TopicName': 'topicName.fifo',
            },
          },
        },
      });

      test.done();
    },

    'specify fifo without contentBasedDeduplication'(test: Test) {
      const stack = new cdk.Stack();

      new sns.Topic(stack, 'MyTopic', {
        fifo: true,
        topicName: 'topicName',
      });

      expect(stack).toMatch({
        'Resources': {
          'MyTopic86869434': {
            'Type': 'AWS::SNS::Topic',
            'Properties': {
              'FifoTopic': true,
              'TopicName': 'topicName.fifo',
            },
          },
        },
      });

      test.done();
    },

    'specify fifo with contentBasedDeduplication'(test: Test) {
      const stack = new cdk.Stack();

      new sns.Topic(stack, 'MyTopic', {
        contentBasedDeduplication: true,
        fifo: true,
        topicName: 'topicName',
      });

      expect(stack).toMatch({
        'Resources': {
          'MyTopic86869434': {
            'Type': 'AWS::SNS::Topic',
            'Properties': {
              'ContentBasedDeduplication': true,
              'FifoTopic': true,
              'TopicName': 'topicName.fifo',
            },
          },
        },
      });

      test.done();
    },

    'throw with contentBasedDeduplication on non-fifo topic'(test: Test) {
      const stack = new cdk.Stack();

      test.throws(() => new sns.Topic(stack, 'MyTopic', {
        contentBasedDeduplication: true,
      }), /Content based deduplication can only be enabled for FIFO SNS topics./);

      test.done();
    },
  },

  'can add a policy to the topic'(test: Test) {
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
    expect(stack).to(haveResource('AWS::SNS::TopicPolicy', {
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
    }));

    test.done();
  },

  'give publishing permissions'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const topic = new sns.Topic(stack, 'Topic');
    const user = new iam.User(stack, 'User');

    // WHEN
    topic.grantPublish(user);

    // THEN
    expect(stack).to(haveResource('AWS::IAM::Policy', {
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
    }));

    test.done();
  },

  'TopicPolicy passed document'(test: Test) {
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
    expect(stack).toMatch({
      'Resources': {
        'MyTopic86869434': {
          'Type': 'AWS::SNS::Topic',
        },
        'topicpolicyF8CF12FD': {
          'Type': 'AWS::SNS::TopicPolicy',
          'Properties': {
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
          },
        },
      },
    });

    test.done();
  },

  'Add statements to policy'(test: Test) {
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
    expect(stack).toMatch({
      'Resources': {
        'MyTopic86869434': {
          'Type': 'AWS::SNS::Topic',
        },
        'TopicPolicyA24B096F': {
          'Type': 'AWS::SNS::TopicPolicy',
          'Properties': {
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
          },
        },
      },
    });
    test.done();
  },

  'topic resource policy includes unique SIDs'(test: Test) {
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

    expect(stack).toMatch({
      'Resources': {
        'MyTopic86869434': {
          'Type': 'AWS::SNS::Topic',
        },
        'MyTopicPolicy12A5EC17': {
          'Type': 'AWS::SNS::TopicPolicy',
          'Properties': {
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
          },
        },
      },
    });

    test.done();
  },

  'fromTopicArn'(test: Test) {
    // GIVEN
    const stack2 = new cdk.Stack();

    // WHEN
    const imported = sns.Topic.fromTopicArn(stack2, 'Imported', 'arn:aws:sns:*:123456789012:my_corporate_topic');

    // THEN
    test.deepEqual(imported.topicName, 'my_corporate_topic');
    test.deepEqual(imported.topicArn, 'arn:aws:sns:*:123456789012:my_corporate_topic');
    test.done();
  },

  'test metrics'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const topic = new sns.Topic(stack, 'Topic');

    // THEN
    test.deepEqual(stack.resolve(topic.metricNumberOfMessagesPublished()), {
      dimensions: { TopicName: { 'Fn::GetAtt': ['TopicBFC7AF6E', 'TopicName'] } },
      namespace: 'AWS/SNS',
      metricName: 'NumberOfMessagesPublished',
      period: cdk.Duration.minutes(5),
      statistic: 'Sum',
    });

    test.deepEqual(stack.resolve(topic.metricPublishSize()), {
      dimensions: { TopicName: { 'Fn::GetAtt': ['TopicBFC7AF6E', 'TopicName'] } },
      namespace: 'AWS/SNS',
      metricName: 'PublishSize',
      period: cdk.Duration.minutes(5),
      statistic: 'Average',
    });

    test.done();
  },

  'subscription is created under the topic scope by default'(test: Test) {
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
    expect(stack).to(haveResource('AWS::SNS::Subscription'));
    test.done();
  },

  'if "scope" is defined, subscription will be created under that scope'(test: Test) {
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
    expect(stack).notTo(haveResource('AWS::SNS::Subscription'));
    expect(stack2).to(haveResource('AWS::SNS::Subscription'));
    test.done();
  },

  'fails if topic policy has no actions'(test: Test) {
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
    test.throws(() => app.synth(), /A PolicyStatement must specify at least one \'action\' or \'notAction\'/);
    test.done();
  },

  'fails if topic policy has no IAM principals'(test: Test) {
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
    test.throws(() => app.synth(), /A PolicyStatement used in a resource-based policy must specify at least one IAM principal/);
    test.done();
  },

  'topic policy should be set if topic as a notifications rule target'(test: Test) {
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

    expect(stack).to(haveResource('AWS::SNS::TopicPolicy', {
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
    }));

    test.done();
  },
};
