import { expect, haveResource } from '@aws-cdk/assert-internal';
import { Duration, Stack } from '@aws-cdk/core';
import { Test } from 'nodeunit';
import { EventBus } from '../lib';
import { Archive } from '../lib/archive';

export = {
  'creates an archive for an EventBus'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    let eventBus = new EventBus(stack, 'Bus');

    new Archive(stack, 'Archive', {
      sourceEventBus: eventBus,
      eventPattern: {
        account: [stack.account],
      },
      retention: Duration.days(10),
    });

    // THEN
    expect(stack).to(haveResource('AWS::Events::EventBus', {
      Name: 'Bus',
    }));

    expect(stack).to(haveResource('AWS::Events::Archive', {
      EventPattern: {
        account: [{
          Ref: 'AWS::AccountId',
        }],
      },
      RetentionDays: 10,
      SourceArn: {
        'Fn::GetAtt': [
          'BusEA82B648',
          'Arn',
        ],
      },
    }));

    test.done();
  },
  'creates an archive for an EventBus with a pattern including a detailType property'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    let eventBus = new EventBus(stack, 'Bus');

    new Archive(stack, 'Archive', {
      sourceEventBus: eventBus,
      eventPattern: {
        account: [stack.account],
        detailType: ['Custom Detail Type'],
      },
      retention: Duration.days(10),
    });

    // THEN
    expect(stack).to(haveResource('AWS::Events::EventBus', {
      Name: 'Bus',
    }));

    expect(stack).to(haveResource('AWS::Events::Archive', {
      EventPattern: {
        'account': [{
          Ref: 'AWS::AccountId',
        }],
        'detail-type': ['Custom Detail Type'],
      },
      RetentionDays: 10,
      SourceArn: {
        'Fn::GetAtt': [
          'BusEA82B648',
          'Arn',
        ],
      },
    }));

    test.done();
  },
}
