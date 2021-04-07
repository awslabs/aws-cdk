import { expect, haveResource, countResources, haveResourceLike } from '@aws-cdk/assert';
import * as iam from '@aws-cdk/aws-iam';
import { Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { Test } from 'nodeunit';
import { FilterPattern, ILogGroup, ILogSubscriptionDestination, LogGroup, SubscriptionFilter } from '../lib';

export = {
  'trivial instantiation'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const logGroup = new LogGroup(stack, 'LogGroup');

    // WHEN
    new SubscriptionFilter(stack, 'Subscription', {
      logGroup,
      destination: new FakeDestination(),
      filterPattern: FilterPattern.literal('some pattern'),
    });

    // THEN
    expect(stack).to(haveResource('AWS::Logs::SubscriptionFilter', {
      DestinationArn: 'arn:bogus',
      FilterPattern: 'some pattern',
      LogGroupName: { Ref: 'LogGroupF5B46931' },
    }));

    test.done();
  },

  'an existing role can be specified to loggroup instead of auto-created in destination'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const lg = new LogGroup(stack, 'LogGroup');
    // const stream = new kinesis.Stream(stack, 'MyStream');
    const importedRole = iam.Role.fromRoleArn(stack, 'ImportedRole', 'arn:aws:iam::123456789012:role/HelloDude');

    lg.addSubscriptionFilter('SubscriptionFilter', {
      destination: new FakeDestination(),
      filterPattern: FilterPattern.allEvents(),
      role: importedRole,
    });

    // THEN
    expect(stack).to(countResources('AWS::IAM::Role', 0));
    expect(stack).to(haveResourceLike('AWS::Logs::SubscriptionFilter', {
      RoleArn: 'arn:aws:iam::123456789012:role/HelloDude',
    }));

    test.done();
  },

  'created with minimal properties creates a new IAM Role in destination'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const lg = new LogGroup(stack, 'LogGroup');
    // const stream = new kinesis.Stream(stack, 'MyStream');

    lg.addSubscriptionFilter('SubscriptionFilter', {
      destination: new FakeDestination(),
      filterPattern: FilterPattern.allEvents(),
    });

    // THEN
    expect(stack).to(countResources('AWS::IAM::Role', 1));
    expect(stack).to(haveResourceLike('AWS::Logs::SubscriptionFilter', {
      RoleArn: {
        'Fn::GetAtt': [
          'LogGroupSubscriptionFilterRole0AA43A6D',
          'Arn',
        ],
      },
    }));

    test.done();
  },
};

class FakeDestination implements ILogSubscriptionDestination {
  public bind(_scope: Construct, _sourceLogGroup: ILogGroup) {
    return {
      arn: 'arn:bogus',
      role: _sourceLogGroup.role || new iam.Role(_scope, 'Role', {
        assumedBy: new iam.ServicePrincipal('logs.us-east-2.amazonaws.com'),
      }),
    };
  }
}
