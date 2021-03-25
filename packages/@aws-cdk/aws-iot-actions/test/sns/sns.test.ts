import { expect, haveResource, countResources } from '@aws-cdk/assert';
import * as iam from '@aws-cdk/aws-iam';
import * as iot from '@aws-cdk/aws-iot';
import * as sns from '@aws-cdk/aws-sns';
import { Stack } from '@aws-cdk/core';
import * as actions from '../../lib';

test('sns topic as a rule action', () => {
  // GIVEN
  const stack = new Stack();
  const topic = new sns.Topic(stack, 'MyTopic');
  const rule = new iot.TopicRule(stack, 'MyRule', {
    sql: 'SELECT',
  });

  // WHEN
  rule.addAction(new actions.SnsTopic(topic));

  // THEN
  expect(stack).to(haveResource('AWS::SNS::TopicPolicy', {
    PolicyDocument: {
      Statement: [
        {
          Sid: '0',
          Action: 'sns:Publish',
          Effect: 'Allow',
          Principal: { Service: 'iot.amazonaws.com' },
          Resource: { Ref: 'MyTopic86869434' },
        },
      ],
      Version: '2012-10-17',
    },
    Topics: [{ Ref: 'MyTopic86869434' }],
  }));
  expect(stack).to(haveResource('AWS::IoT::TopicRule', {
    TopicRulePayload: {
      Actions: [
        {
          Sns: {
            MessageFormat: 'RAW',
            RoleArn: {
              'Fn::GetAtt': ['MyRuleAllowIot33481905', 'Arn'],
            },
            TargetArn: { Ref: 'MyTopic86869434' },
          },
        },
      ],
      AwsIotSqlVersion: '2015-10-08',
      RuleDisabled: false,
      Sql: 'SELECT',
    },
  }));
});

test('sns topic with role as a rule action', () => {
  // GIVEN
  const stack = new Stack();
  const topic = new sns.Topic(stack, 'MyTopic');
  const role = new iam.Role(stack, 'MyCustomRole', {
    assumedBy: new iam.ServicePrincipal('iot.amazonaws.com'),
  });
  const rule = new iot.TopicRule(stack, 'MyRule', {
    sql: 'SELECT',
  });

  // WHEN
  rule.addAction(new actions.SnsTopic(topic, { role: role }));

  expect(stack).to(haveResource('AWS::IoT::TopicRule', {
    TopicRulePayload: {
      Actions: [
        {
          Sns: {
            MessageFormat: 'RAW',
            RoleArn: {
              'Fn::GetAtt': ['MyCustomRoleC8C89DCB', 'Arn'],
            },
            TargetArn: { Ref: 'MyTopic86869434' },
          },
        },
      ],
      AwsIotSqlVersion: '2015-10-08',
      RuleDisabled: false,
      Sql: 'SELECT',
    },
  }));
});
test('multiple uses of a topic as a target results in a single policy statement', () => {
  // GIVEN
  const stack = new Stack();
  const topic = new sns.Topic(stack, 'MyTopic');

  //WHEN
  for (let i = 0; i < 5; ++i) {
    const rule = new iot.TopicRule(stack, `Rule${i}`, {
      sql: 'SELECT',
    });
    rule.addAction(new actions.SnsTopic(topic));
  }

  // THEN
  expect(stack).to(countResources('AWS::SNS::TopicPolicy', 1));
  expect(stack).to(haveResource('AWS::SNS::TopicPolicy', {
    PolicyDocument: {
      Statement: [
        {
          Sid: '0',
          Action: 'sns:Publish',
          Effect: 'Allow',
          Principal: { Service: 'iot.amazonaws.com' },
          Resource: { Ref: 'MyTopic86869434' },
        },
      ],
      Version: '2012-10-17',
    },
    Topics: [{ Ref: 'MyTopic86869434' }],
  }));
});
