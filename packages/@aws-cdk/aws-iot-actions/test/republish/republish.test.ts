import '@aws-cdk/assert/jest';
import * as iot from '@aws-cdk/aws-iot';
import * as sns from '@aws-cdk/aws-sns';
import { Stack } from '@aws-cdk/core';
import * as actions from '../../lib';

let stack: Stack;
let rule: iot.TopicRule;

test('add republish action', () => {
  stack = new Stack();
  rule = new iot.TopicRule(stack, 'RepublishRule', {
    sql: 'SELECT * FROM \'topic/subtopic\'',
  });

  const downstream = new iot.TopicRule(stack, 'DownstreamRule', {
    sql: 'SELECT teapot FROM \'coffe/shop\'',
    actions: [new actions.SnsTopic(new sns.Topic(stack, 'MySnsTopic'))],
  });

  rule.addAction(new actions.RepublishTopic(downstream, { topic: 'coffee/shop' }));

  expect(stack).toHaveResourceLike('AWS::IoT::TopicRule', {
    TopicRulePayload: {
      Actions: [
        {
          Republish: {
            Qos: 0,
            RoleArn: { 'Fn::GetAtt': ['RepublishRuleAllowIotB39A8B3C', 'Arn'] },
            Topic: 'coffee/shop',
          },
        },
      ],
      RuleDisabled: false,
      Sql: 'SELECT * FROM \'topic/subtopic\'',
    },
  });
  expect(stack).toHaveResource('AWS::IAM::Policy', {
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
                ':topic/coffee/shop',
              ],
            ],
          },
        },
      ],
      Version: '2012-10-17',
    },
    PolicyName: 'RepublishRuleAllowIotDefaultPolicy3B0C81B5',
    Roles: [
      { Ref: 'RepublishRuleAllowIotB39A8B3C' },
    ],
  });
});
