import { expect, haveResource } from '@aws-cdk/assert';
import { Role, ServicePrincipal } from '@aws-cdk/aws-iam';
import { App, Stack } from '@aws-cdk/core';
import { nodeunitShim, Test } from 'nodeunit-shim';
import { TopicRule, ITopicRuleAction, TopicRuleActionConfig } from '../lib';

nodeunitShim({
  'can create topic rules'(test: Test) {
    // GIVEN
    const stack = new Stack();
    // WHEN
    new TopicRule(stack, 'IotTopicRule', {
      sql: 'SELECT * FROM \'topic/subtopic\'',
      actions: [new DummyAction()],
    });
    // THEN
    expect(stack).to(haveResource('AWS::IoT::TopicRule', {
      TopicRulePayload: {
        Actions: [{
          Republish: {
            RoleArn: 'arn:iam::::role/MyRole',
            Topic: 'topic/subtopic',
          },
        }],
        AwsIotSqlVersion: '2015-10-08',
        RuleDisabled: false,
        Sql: 'SELECT * FROM \'topic/subtopic\'',
      },
    }));
    test.done();
  },
  'can add role after construction'(test: Test) {
    // GIVEN
    const stack = new Stack();
    // WHEN
    const rule = new TopicRule(stack, 'IotTopicRule', {
      sql: 'SELECT * FROM \'topic/subtopic\'',
    });

    rule.addAction(new DummyAction());

    // THEN
    expect(stack).to(haveResource('AWS::IoT::TopicRule', {
      TopicRulePayload: {
        Actions: [{
          Republish: {
            RoleArn: 'arn:iam::::role/MyRole',
            Topic: 'topic/subtopic',
          },
        }],
        AwsIotSqlVersion: '2015-10-08',
        RuleDisabled: false,
        Sql: 'SELECT * FROM \'topic/subtopic\'',
      },
    }));
    test.done();
  },
  'from topic rule arn'(test: Test) {
    const stack = new Stack();
    const topicRuleArn = 'arn:aws:iot:::rule/MyTopicRule';
    let topic = TopicRule.fromTopicRuleArn(stack, 'ImportedTopic', topicRuleArn );
    test.deepEqual(topic.ruleName, 'MyTopicRule');
    test.done();
  },
  'can construct with error action'(test: Test) {
    // GIVEN
    const stack = new Stack();
    // WHEN
    const rule = new TopicRule(stack, 'IotTopicRule', {
      sql: 'SELECT * FROM \'topic/subtopic\'',
      errorAction: new DummyAction(),
    });

    rule.addAction(new DummyAction());

    // THEN
    expect(stack).to(haveResource('AWS::IoT::TopicRule', {
      TopicRulePayload: {
        Actions: [{
          Republish: {
            RoleArn: 'arn:iam::::role/MyRole',
            Topic: 'topic/subtopic',
          },
        }],
        AwsIotSqlVersion: '2015-10-08',
        ErrorAction: {
          Republish: {
            RoleArn: 'arn:iam::::role/MyRole',
            Topic: 'topic/subtopic',
          },
        },
        RuleDisabled: false,
        Sql: 'SELECT * FROM \'topic/subtopic\'',
      },
    }));
    test.done();
  },
  'can add error action after construction'(test: Test) {
    // GIVEN
    const stack = new Stack();
    // WHEN
    const rule = new TopicRule(stack, 'IotTopicRule', {
      sql: 'SELECT * FROM \'topic/subtopic\'',
      actions: [new DummyAction()],
    });

    rule.addErrorAction(new DummyAction());

    // THEN
    expect(stack).to(haveResource('AWS::IoT::TopicRule', {
      TopicRulePayload: {
        Actions: [{
          Republish: {
            RoleArn: 'arn:iam::::role/MyRole',
            Topic: 'topic/subtopic',
          },
        }],
        AwsIotSqlVersion: '2015-10-08',
        ErrorAction: {
          Republish: {
            RoleArn: 'arn:iam::::role/MyRole',
            Topic: 'topic/subtopic',
          },
        },
        RuleDisabled: false,
        Sql: 'SELECT * FROM \'topic/subtopic\'',
      },
    }));
    test.done();
  },
  'throws when not given actions'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app);
    // WHEN
    new TopicRule(stack, 'IotTopicRule', {
      sql: 'SELECT * FROM \'topic/subtopic\'',
    });
    test.throws(() => app.synth(), /Topic invalid/);
    test.done();
  },
  'grant publish to topic arn'(test: Test) {
    const stack = new Stack();
    const role = new Role(stack, 'MyRole', {
      assumedBy: new ServicePrincipal('iot.amazonaws.com'),
    });
    const topic = new TopicRule(stack, 'IotTopicRule', {
      sql: 'SELECT * FROM \'topic/subtopic\'',
      actions: [new DummyAction()],
    });
    topic.grantPublish(role, 'coffee/shops');
    expect(stack).to(haveResource('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: { Service: 'iot.amazonaws.com' },
          },
        ],
        Version: '2012-10-17',
      },
    }));
    expect(stack).to(haveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'iot:Publish',
            Effect: 'Allow',
            Resource: {
              'Fn::Join': [
                '',
                [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':iot:',
                  { Ref: 'AWS::Region' },
                  ':',
                  { Ref: 'AWS::AccountId' },
                  ':topic/coffee/shops',
                ],
              ],
            },
          },
        ],
        Version: '2012-10-17',
      },
      PolicyName: 'MyRoleDefaultPolicyA36BE1DD',
      Roles: [{ Ref: 'MyRoleF48FFE04' }],
    }));
    test.done();
  },
});

class DummyAction implements ITopicRuleAction {
  public bind(): TopicRuleActionConfig {
    return {
      republish: {
        roleArn: 'arn:iam::::role/MyRole',
        topic: 'topic/subtopic',
      },
    };
  };
};

