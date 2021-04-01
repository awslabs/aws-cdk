import { expect, haveResource, haveResourceLike } from '@aws-cdk/assert';
import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import { Test } from 'nodeunit';
import { EventBus, EventField, IRule, IRuleTarget, RuleTargetConfig, RuleTargetInput, Schedule } from '../lib';
import { Rule } from '../lib/rule';

/* eslint-disable quote-props */

export = {
  'default rule'(test: Test) {
    const stack = new cdk.Stack();

    new Rule(stack, 'MyRule', {
      schedule: Schedule.rate(cdk.Duration.minutes(10)),
    });

    expect(stack).toMatch({
      'Resources': {
        'MyRuleA44AB831': {
          'Type': 'AWS::Events::Rule',
          'Properties': {
            'ScheduleExpression': 'rate(10 minutes)',
            'State': 'ENABLED',
          },
        },
      },
    });
    test.done();
  },

  'can get rule name'(test: Test) {
    const stack = new cdk.Stack();
    const rule = new Rule(stack, 'MyRule', {
      schedule: Schedule.rate(cdk.Duration.minutes(10)),
    });

    new cdk.CfnResource(stack, 'Res', {
      type: 'Test::Resource',
      properties: {
        RuleName: rule.ruleName,
      },
    });

    expect(stack).to(haveResource('Test::Resource', {
      RuleName: { Ref: 'MyRuleA44AB831' },
    }));

    test.done();
  },

  'get rate as token'(test: Test) {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'MyScheduledStack');
    const lazyDuration = cdk.Duration.minutes(cdk.Lazy.number({ produce: () => 5 }));

    new Rule(stack, 'MyScheduledRule', {
      ruleName: 'rateInMinutes',
      schedule: Schedule.rate(lazyDuration),
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::Events::Rule', {
      'Name': 'rateInMinutes',
      'ScheduleExpression': 'rate(5 minutes)',
    }));

    test.done();
  },

  'Seconds is not an allowed value for Schedule rate'(test: Test) {
    const lazyDuration = cdk.Duration.seconds(cdk.Lazy.number({ produce: () => 5 }));
    test.throws(() => Schedule.rate(lazyDuration), /Allowed units for scheduling/i);
    test.done();
  },

  'Millis is not an allowed value for Schedule rate'(test: Test) {
    const lazyDuration = cdk.Duration.millis(cdk.Lazy.number({ produce: () => 5 }));

    // THEN
    test.throws(() => Schedule.rate(lazyDuration), /Allowed units for scheduling/i);
    test.done();
  },

  'rule with physical name'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    new Rule(stack, 'MyRule', {
      ruleName: 'PhysicalName',
      schedule: Schedule.rate(cdk.Duration.minutes(10)),
    });

    // THEN
    expect(stack).to(haveResource('AWS::Events::Rule', {
      Name: 'PhysicalName',
    }));

    test.done();
  },

  'eventPattern is rendered properly'(test: Test) {
    const stack = new cdk.Stack();

    new Rule(stack, 'MyRule', {
      eventPattern: {
        account: ['account1', 'account2'],
        detail: {
          foo: [1, 2],
        },
        detailType: ['detailType1'],
        id: ['id1', 'id2'],
        region: ['region1', 'region2', 'region3'],
        resources: ['r1'],
        source: ['src1', 'src2'],
        time: ['t1'],
        version: ['0'],
      },
    });

    expect(stack).toMatch({
      'Resources': {
        'MyRuleA44AB831': {
          'Type': 'AWS::Events::Rule',
          'Properties': {
            'EventPattern': {
              account: ['account1', 'account2'],
              detail: { foo: [1, 2] },
              'detail-type': ['detailType1'],
              id: ['id1', 'id2'],
              region: ['region1', 'region2', 'region3'],
              resources: ['r1'],
              source: ['src1', 'src2'],
              time: ['t1'],
              version: ['0'],
            },
            'State': 'ENABLED',
          },
        },
      },
    });

    test.done();
  },

  'fails synthesis if neither eventPattern nor scheudleExpression are specified'(test: Test) {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'MyStack');
    new Rule(stack, 'Rule');
    test.throws(() => app.synth(), /Either 'eventPattern' or 'schedule' must be defined/);
    test.done();
  },

  'addEventPattern can be used to add filters'(test: Test) {
    const stack = new cdk.Stack();

    const rule = new Rule(stack, 'MyRule');
    rule.addEventPattern({
      account: ['12345'],
      detail: {
        foo: ['hello', 'bar', 'hello'],
      },
    });

    rule.addEventPattern({
      source: ['aws.source'],
      detail: {
        foo: ['bar', 'hello'],
        goo: {
          hello: ['world'],
        },
      },
    });

    expect(stack).toMatch({
      'Resources': {
        'MyRuleA44AB831': {
          'Type': 'AWS::Events::Rule',
          'Properties': {
            'EventPattern': {
              'account': [
                '12345',
              ],
              'detail': {
                'foo': [
                  'hello',
                  'bar',
                ],
                'goo': {
                  'hello': [
                    'world',
                  ],
                },
              },
              'source': [
                'aws.source',
              ],
            },
            'State': 'ENABLED',
          },
        },
      },
    });
    test.done();
  },

  'addEventPattern can de-duplicate filters and keep the order'(test: Test) {
    const stack = new cdk.Stack();

    const rule = new Rule(stack, 'MyRule');
    rule.addEventPattern({
      detailType: ['AWS API Call via CloudTrail', 'AWS API Call via CloudTrail'],
    });

    rule.addEventPattern({
      detailType: ['EC2 Instance State-change Notification', 'AWS API Call via CloudTrail'],
    });

    expect(stack).toMatch({
      'Resources': {
        'MyRuleA44AB831': {
          'Type': 'AWS::Events::Rule',
          'Properties': {
            'EventPattern': {
              'detail-type': [
                'AWS API Call via CloudTrail',
                'EC2 Instance State-change Notification',
              ],
            },
            'State': 'ENABLED',
          },
        },
      },
    });
    test.done();
  },

  'targets can be added via props or addTarget with input transformer'(test: Test) {
    const stack = new cdk.Stack();
    const t1: IRuleTarget = {
      bind: () => ({
        id: '',
        arn: 'ARN1',
        kinesisParameters: { partitionKeyPath: 'partitionKeyPath' },
      }),
    };

    const t2: IRuleTarget = {
      bind: () => ({
        id: '',
        arn: 'ARN2',
        input: RuleTargetInput.fromText(`This is ${EventField.fromPath('$.detail.bla')}`),
      }),
    };

    const rule = new Rule(stack, 'EventRule', {
      targets: [t1],
      schedule: Schedule.rate(cdk.Duration.minutes(5)),
    });

    rule.addTarget(t2);

    expect(stack).toMatch({
      'Resources': {
        'EventRule5A491D2C': {
          'Type': 'AWS::Events::Rule',
          'Properties': {
            'ScheduleExpression': 'rate(5 minutes)',
            'State': 'ENABLED',
            'Targets': [
              {
                'Arn': 'ARN1',
                'Id': 'Target0',
                'KinesisParameters': {
                  'PartitionKeyPath': 'partitionKeyPath',
                },
              },
              {
                'Arn': 'ARN2',
                'Id': 'Target1',
                'InputTransformer': {
                  'InputPathsMap': {
                    'detail-bla': '$.detail.bla',
                  },
                  'InputTemplate': '"This is <detail-bla>"',
                },
              },
            ],
          },
        },
      },
    });
    test.done();
  },

  'input template can contain tokens'(test: Test) {
    const stack = new cdk.Stack();

    const rule = new Rule(stack, 'EventRule', {
      schedule: Schedule.rate(cdk.Duration.minutes(1)),
    });

    // a plain string should just be stringified (i.e. double quotes added and escaped)
    rule.addTarget({
      bind: () => ({
        id: '', arn: 'ARN2', input: RuleTargetInput.fromText('Hello, "world"'),
      }),
    });

    // tokens are used here (FnConcat), but this is a text template so we
    // expect it to be wrapped in double quotes automatically for us.
    rule.addTarget({
      bind: () => ({
        id: '',
        arn: 'ARN1',
        kinesisParameters: { partitionKeyPath: 'partitionKeyPath' },
        input: RuleTargetInput.fromText(cdk.Fn.join('', ['a', 'b']).toString()),
      }),
    });

    // jsonTemplate can be used to format JSON documents with replacements
    rule.addTarget({
      bind: () => ({
        id: '',
        arn: 'ARN3',
        input: RuleTargetInput.fromObject({ foo: EventField.fromPath('$.detail.bar') }),
      }),
    });

    // tokens can also used for JSON templates.
    rule.addTarget({
      bind: () => ({
        id: '',
        arn: 'ARN4',
        input: RuleTargetInput.fromText(cdk.Fn.join(' ', ['hello', '"world"']).toString()),
      }),
    });

    expect(stack).toMatch({
      'Resources': {
        'EventRule5A491D2C': {
          'Type': 'AWS::Events::Rule',
          'Properties': {
            'State': 'ENABLED',
            'ScheduleExpression': 'rate(1 minute)',
            'Targets': [
              {
                'Arn': 'ARN2',
                'Id': 'Target0',
                'Input': '"Hello, \\"world\\""',
              },
              {
                'Arn': 'ARN1',
                'Id': 'Target1',
                'Input': '"ab"',
                'KinesisParameters': {
                  'PartitionKeyPath': 'partitionKeyPath',
                },
              },
              {
                'Arn': 'ARN3',
                'Id': 'Target2',
                'InputTransformer': {
                  'InputPathsMap': {
                    'detail-bar': '$.detail.bar',
                  },
                  'InputTemplate': '{"foo":<detail-bar>}',
                },
              },
              {
                'Arn': 'ARN4',
                'Id': 'Target3',
                'Input': '"hello \\"world\\""',
              },
            ],
          },
        },
      },
    });

    test.done();
  },

  'target can declare role which will be used'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    const rule = new Rule(stack, 'EventRule', {
      schedule: Schedule.rate(cdk.Duration.minutes(1)),
    });

    const role = new iam.Role(stack, 'SomeRole', {
      assumedBy: new iam.ServicePrincipal('nobody'),
    });

    // a plain string should just be stringified (i.e. double quotes added and escaped)
    rule.addTarget({
      bind: () => ({
        id: '',
        arn: 'ARN2',
        role,
      }),
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::Events::Rule', {
      'Targets': [
        {
          'Arn': 'ARN2',
          'Id': 'Target0',
          'RoleArn': { 'Fn::GetAtt': ['SomeRole6DDC54DD', 'Arn'] },
        },
      ],
    }));

    test.done();
  },

  'asEventRuleTarget can use the ruleArn and a uniqueId of the rule'(test: Test) {
    const stack = new cdk.Stack();

    let receivedRuleArn = 'FAIL';
    let receivedRuleId = 'FAIL';

    const t1: IRuleTarget = {
      bind: (eventRule: IRule) => {
        receivedRuleArn = eventRule.ruleArn;
        receivedRuleId = cdk.Names.nodeUniqueId(eventRule.node);

        return {
          id: '',
          arn: 'ARN1',
          kinesisParameters: { partitionKeyPath: 'partitionKeyPath' },
        };
      },
    };

    const rule = new Rule(stack, 'EventRule');
    rule.addTarget(t1);

    test.deepEqual(stack.resolve(receivedRuleArn), stack.resolve(rule.ruleArn));
    test.deepEqual(receivedRuleId, cdk.Names.uniqueId(rule));
    test.done();
  },

  'fromEventRuleArn'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const importedRule = Rule.fromEventRuleArn(stack, 'ImportedRule', 'arn:aws:events:us-east-2:123456789012:rule/example');

    // THEN
    test.deepEqual(importedRule.ruleArn, 'arn:aws:events:us-east-2:123456789012:rule/example');
    test.deepEqual(importedRule.ruleName, 'example');
    test.done();
  },

  'rule can be disabled'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    new Rule(stack, 'Rule', {
      schedule: Schedule.expression('foom'),
      enabled: false,
    });

    // THEN
    expect(stack).to(haveResource('AWS::Events::Rule', {
      'State': 'DISABLED',
    }));

    test.done();
  },

  'can add multiple targets with the same id'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const rule = new Rule(stack, 'Rule', {
      schedule: Schedule.expression('foom'),
      enabled: false,
    });
    rule.addTarget(new SomeTarget());
    rule.addTarget(new SomeTarget());

    // THEN
    expect(stack).to(haveResource('AWS::Events::Rule', {
      Targets: [
        {
          'Arn': 'ARN1',
          'Id': 'Target0',
          'KinesisParameters': {
            'PartitionKeyPath': 'partitionKeyPath',
          },
        },
        {
          'Arn': 'ARN1',
          'Id': 'Target1',
          'KinesisParameters': {
            'PartitionKeyPath': 'partitionKeyPath',
          },
        },
      ],
    }));

    test.done();
  },

  'rule and target must be in the same region'(test: Test) {
    const app = new cdk.App();

    const sourceStack = new cdk.Stack(app, 'SourceStack');
    const rule = new Rule(sourceStack, 'Rule');

    const targetStack = new cdk.Stack(app, 'TargetStack', { env: { region: 'us-west-2' } });
    const resource = new cdk.Construct(targetStack, 'Resource');

    test.throws(() => {
      rule.addTarget(new SomeTarget('T', resource));
    }, /Rule and target must be in the same region/);

    test.done();
  },

  'sqsParameters are generated when they are specified in target props'(test: Test) {
    const stack = new cdk.Stack();
    const t1: IRuleTarget = {
      bind: () => ({
        id: '',
        arn: 'ARN1',
        sqsParameters: { messageGroupId: 'messageGroupId' },
      }),
    };

    new Rule(stack, 'EventRule', {
      schedule: Schedule.rate(cdk.Duration.minutes(5)),
      targets: [t1],
    });

    expect(stack).to(haveResource('AWS::Events::Rule', {
      Targets: [
        {
          'Arn': 'ARN1',
          'Id': 'Target0',
          'SqsParameters': {
            'MessageGroupId': 'messageGroupId',
          },
        },
      ],
    }));
    test.done();
  },

  'associate rule with event bus'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const eventBus = new EventBus(stack, 'EventBus');

    // WHEN
    new Rule(stack, 'MyRule', {
      eventPattern: {
        detail: ['detail'],
      },
      eventBus,
    });

    // THEN
    expect(stack).to(haveResource('AWS::Events::Rule', {
      EventBusName: {
        Ref: 'EventBus7B8748AA',
      },
    }));

    test.done();
  },

  'throws with eventBus and schedule'(test: Test) {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'MyStack');
    const eventBus = new EventBus(stack, 'EventBus');

    // THEN
    test.throws(() => new Rule(stack, 'MyRule', {
      schedule: Schedule.rate(cdk.Duration.minutes(10)),
      eventBus,
    }), /Cannot associate rule with 'eventBus' when using 'schedule'/);
    test.done();
  },

  'for cross-account targets': {
    'requires that the source stack specify a concrete account'(test: Test) {
      const app = new cdk.App();

      const sourceStack = new cdk.Stack(app, 'SourceStack');
      const rule = new Rule(sourceStack, 'Rule');

      const targetAccount = '234567890123';
      const targetStack = new cdk.Stack(app, 'TargetStack', { env: { account: targetAccount } });
      const resource = new cdk.Construct(targetStack, 'Resource');

      test.throws(() => {
        rule.addTarget(new SomeTarget('T', resource));
      }, /You need to provide a concrete account for the source stack when using cross-account events/);

      test.done();
    },

    'requires that the target stack specify a concrete account'(test: Test) {
      const app = new cdk.App();

      const sourceAccount = '123456789012';
      const sourceStack = new cdk.Stack(app, 'SourceStack', { env: { account: sourceAccount } });
      const rule = new Rule(sourceStack, 'Rule');

      const targetStack = new cdk.Stack(app, 'TargetStack');
      const resource = new cdk.Construct(targetStack, 'Resource');

      test.throws(() => {
        rule.addTarget(new SomeTarget('T', resource));
      }, /You need to provide a concrete account for the target stack when using cross-account events/);

      test.done();
    },

    'requires that the target stack specify a concrete region'(test: Test) {
      const app = new cdk.App();

      const sourceAccount = '123456789012';
      const sourceStack = new cdk.Stack(app, 'SourceStack', { env: { account: sourceAccount } });
      const rule = new Rule(sourceStack, 'Rule');

      const targetAccount = '234567890123';
      const targetStack = new cdk.Stack(app, 'TargetStack', { env: { account: targetAccount } });
      const resource = new cdk.Construct(targetStack, 'Resource');

      test.throws(() => {
        rule.addTarget(new SomeTarget('T', resource));
      }, /You need to provide a concrete region for the target stack when using cross-account events/);

      test.done();
    },

    'requires that the source and target stacks be part of the same App'(test: Test) {
      const sourceApp = new cdk.App();
      const sourceAccount = '123456789012';
      const sourceStack = new cdk.Stack(sourceApp, 'SourceStack', { env: { account: sourceAccount, region: 'us-west-2' } });
      const rule = new Rule(sourceStack, 'Rule');

      const targetApp = new cdk.App();
      const targetAccount = '234567890123';
      const targetStack = new cdk.Stack(targetApp, 'TargetStack', { env: { account: targetAccount, region: 'us-west-2' } });
      const resource = new cdk.Construct(targetStack, 'Resource');

      test.throws(() => {
        rule.addTarget(new SomeTarget('T', resource));
      }, /Event stack and target stack must belong to the same CDK app/);

      test.done();
    },

    'generates the correct rules in the source and target stacks when eventPattern is passed in the constructor'(test: Test) {
      const app = new cdk.App();

      const sourceAccount = '123456789012';
      const sourceStack = new cdk.Stack(app, 'SourceStack', {
        env: {
          account: sourceAccount,
          region: 'us-west-2',
        },
      });
      const rule = new Rule(sourceStack, 'Rule', {
        eventPattern: {
          source: ['some-event'],
        },
      });

      const targetAccount = '234567890123';
      const targetStack = new cdk.Stack(app, 'TargetStack', {
        env: {
          account: targetAccount,
          region: 'us-west-2',
        },
      });
      const resource1 = new cdk.Construct(targetStack, 'Resource1');
      const resource2 = new cdk.Construct(targetStack, 'Resource2');

      rule.addTarget(new SomeTarget('T1', resource1));
      rule.addTarget(new SomeTarget('T2', resource2));

      expect(sourceStack).to(haveResourceLike('AWS::Events::Rule', {
        'EventPattern': {
          'source': [
            'some-event',
          ],
        },
        'State': 'ENABLED',
        'Targets': [
          {
            'Id': 'T1',
            'Arn': {
              'Fn::Join': [
                '',
                [
                  'arn:',
                  { 'Ref': 'AWS::Partition' },
                  `:events:us-west-2:${targetAccount}:event-bus/default`,
                ],
              ],
            },
          },
        ],
      }));

      expect(targetStack).to(haveResourceLike('AWS::Events::Rule', {
        'EventPattern': {
          'source': [
            'some-event',
          ],
        },
        'State': 'ENABLED',
        'Targets': [
          {
            'Id': 'T1',
            'Arn': 'ARN1',
          },
        ],
      }));
      expect(targetStack).to(haveResourceLike('AWS::Events::Rule', {
        'EventPattern': {
          'source': [
            'some-event',
          ],
        },
        'State': 'ENABLED',
        'Targets': [
          {
            'Id': 'T2',
            'Arn': 'ARN1',
          },
        ],
      }));

      const eventBusPolicyStack = app.node.findChild(`EventBusPolicy-${sourceAccount}-us-west-2-${targetAccount}`) as cdk.Stack;
      expect(eventBusPolicyStack).to(haveResourceLike('AWS::Events::EventBusPolicy', {
        'Action': 'events:PutEvents',
        'StatementId': `Allow-account-${sourceAccount}`,
        'Principal': sourceAccount,
      }));

      test.done();
    },

    'generates the correct rule in the target stack when addEventPattern in the source rule is used'(test: Test) {
      const app = new cdk.App();

      const sourceAccount = '123456789012';
      const sourceStack = new cdk.Stack(app, 'SourceStack', {
        env: {
          account: sourceAccount,
          region: 'us-west-2',
        },
      });
      const rule = new Rule(sourceStack, 'Rule');

      const targetAccount = '234567890123';
      const targetStack = new cdk.Stack(app, 'TargetStack', {
        env: {
          account: targetAccount,
          region: 'us-west-2',
        },
      });
      const resource = new cdk.Construct(targetStack, 'Resource1');

      rule.addTarget(new SomeTarget('T', resource));

      rule.addEventPattern({
        source: ['some-event'],
      });

      expect(targetStack).to(haveResourceLike('AWS::Events::Rule', {
        'EventPattern': {
          'source': [
            'some-event',
          ],
        },
        'State': 'ENABLED',
        'Targets': [
          {
            'Id': 'T',
            'Arn': 'ARN1',
          },
        ],
      }));

      test.done();
    },
  },
};

class SomeTarget implements IRuleTarget {
  // eslint-disable-next-line cdk/no-core-construct
  public constructor(private readonly id?: string, private readonly resource?: cdk.IConstruct) {
  }

  public bind(): RuleTargetConfig {
    return {
      id: this.id || '',
      arn: 'ARN1',
      kinesisParameters: { partitionKeyPath: 'partitionKeyPath' },
      targetResource: this.resource,
    };
  }
}
