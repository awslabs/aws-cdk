import { expect, haveResource } from '@aws-cdk/assert-internal';
import * as iam from '@aws-cdk/aws-iam';
import { Aws, CfnResource, Stack, Arn } from '@aws-cdk/core';
import { Test } from 'nodeunit';
import { EventBus } from '../lib';

export = {
  'default event bus'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new EventBus(stack, 'Bus');

    // THEN
    expect(stack).to(haveResource('AWS::Events::EventBus', {
      Name: 'Bus',
    }));

    test.done();
  },

  'named event bus'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new EventBus(stack, 'Bus', {
      eventBusName: 'myEventBus',
    });

    // THEN
    expect(stack).to(haveResource('AWS::Events::EventBus', {
      Name: 'myEventBus',
    }));

    test.done();
  },

  'partner event bus'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new EventBus(stack, 'Bus', {
      eventSourceName: 'aws.partner/PartnerName/acct1/repo1',
    });

    // THEN
    expect(stack).to(haveResource('AWS::Events::EventBus', {
      Name: 'aws.partner/PartnerName/acct1/repo1',
      EventSourceName: 'aws.partner/PartnerName/acct1/repo1',
    }));

    test.done();
  },

  'imported event bus'(test: Test) {
    const stack = new Stack();

    const eventBus = new EventBus(stack, 'Bus');

    const importEB = EventBus.fromEventBusArn(stack, 'ImportBus', eventBus.eventBusArn);

    // WHEN
    new CfnResource(stack, 'Res', {
      type: 'Test::Resource',
      properties: {
        EventBusArn1: eventBus.eventBusArn,
        EventBusArn2: importEB.eventBusArn,
      },
    });

    expect(stack).to(haveResource('Test::Resource', {
      EventBusArn1: { 'Fn::GetAtt': ['BusEA82B648', 'Arn'] },
      EventBusArn2: { 'Fn::GetAtt': ['BusEA82B648', 'Arn'] },
    }));

    test.done();
  },

  'imported event bus from name'(test: Test) {
    const stack = new Stack();

    const eventBus = new EventBus(stack, 'Bus', { eventBusName: 'test-bus-to-import-by-name' });

    const importEB = EventBus.fromEventBusName(stack, 'ImportBus', eventBus.eventBusName);

    // WHEN
    test.deepEqual(stack.resolve(eventBus.eventBusName), stack.resolve(importEB.eventBusName));

    test.done();
  },

  'same account imported event bus has right resource env'(test: Test) {
    const stack = new Stack();

    const eventBus = new EventBus(stack, 'Bus');

    const importEB = EventBus.fromEventBusArn(stack, 'ImportBus', eventBus.eventBusArn);

    // WHEN
    test.deepEqual(stack.resolve(importEB.env.account), { 'Fn::Select': [4, { 'Fn::Split': [':', { 'Fn::GetAtt': ['BusEA82B648', 'Arn'] }] }] });
    test.deepEqual(stack.resolve(importEB.env.region), { 'Fn::Select': [3, { 'Fn::Split': [':', { 'Fn::GetAtt': ['BusEA82B648', 'Arn'] }] }] });

    test.done();
  },

  'cross account imported event bus has right resource env'(test: Test) {
    const stack = new Stack();

    const arnParts = {
      resource: 'bus',
      service: 'events',
      account: 'myAccount',
      region: 'us-west-1',
    };

    const arn = Arn.format(arnParts, stack);

    const importEB = EventBus.fromEventBusArn(stack, 'ImportBus', arn);

    // WHEN
    test.deepEqual(importEB.env.account, arnParts.account);
    test.deepEqual(importEB.env.region, arnParts.region);

    test.done();
  },

  'can get bus name'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const bus = new EventBus(stack, 'Bus', {
      eventBusName: 'myEventBus',
    });

    // WHEN
    new CfnResource(stack, 'Res', {
      type: 'Test::Resource',
      properties: {
        EventBusName: bus.eventBusName,
      },
    });

    // THEN
    expect(stack).to(haveResource('Test::Resource', {
      EventBusName: { Ref: 'BusEA82B648' },
    }));

    test.done();
  },

  'can get bus arn'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const bus = new EventBus(stack, 'Bus', {
      eventBusName: 'myEventBus',
    });

    // WHEN
    new CfnResource(stack, 'Res', {
      type: 'Test::Resource',
      properties: {
        EventBusArn: bus.eventBusArn,
      },
    });

    // THEN
    expect(stack).to(haveResource('Test::Resource', {
      EventBusArn: { 'Fn::GetAtt': ['BusEA82B648', 'Arn'] },
    }));

    test.done();
  },

  'event bus name cannot be default'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const createInvalidBus = () => new EventBus(stack, 'Bus', {
      eventBusName: 'default',
    });

    // THEN
    test.throws(() => {
      createInvalidBus();
    }, /'eventBusName' must not be 'default'/);

    test.done();
  },

  'event bus name cannot contain slash'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const createInvalidBus = () => new EventBus(stack, 'Bus', {
      eventBusName: 'my/bus',
    });

    // THEN
    test.throws(() => {
      createInvalidBus();
    }, /'eventBusName' must not contain '\/'/);

    test.done();
  },

  'event bus cannot have name and source name'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const createInvalidBus = () => new EventBus(stack, 'Bus', {
      eventBusName: 'myBus',
      eventSourceName: 'myBus',
    });

    // THEN
    test.throws(() => {
      createInvalidBus();
    }, /'eventBusName' and 'eventSourceName' cannot both be provided/);

    test.done();
  },

  'event bus name cannot be empty string'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const createInvalidBus = () => new EventBus(stack, 'Bus', {
      eventBusName: '',
    });

    // THEN
    test.throws(() => {
      createInvalidBus();
    }, /'eventBusName' must satisfy: /);

    test.done();
  },

  'does not throw if eventBusName is a token'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN / THEN
    test.doesNotThrow(() => new EventBus(stack, 'EventBus', {
      eventBusName: Aws.STACK_NAME,
    }));

    test.done();
  },

  'event bus source name must follow pattern'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const createInvalidBus = () => new EventBus(stack, 'Bus', {
      eventSourceName: 'invalid-partner',
    });

    // THEN
    test.throws(() => {
      createInvalidBus();
    }, /'eventSourceName' must satisfy: \/\^aws/);

    test.done();
  },

  'event bus source name cannot be empty string'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const createInvalidBus = () => new EventBus(stack, 'Bus', {
      eventSourceName: '',
    });

    // THEN
    test.throws(() => {
      createInvalidBus();
    }, /'eventSourceName' must satisfy: /);

    test.done();
  },

  'can grant PutEvents'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const role = new iam.Role(stack, 'Role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    // WHEN
    EventBus.grantPutEvents(role);

    // THEN
    expect(stack).to(haveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'events:PutEvents',
            Effect: 'Allow',
            Resource: '*',
          },
        ],
        Version: '2012-10-17',
      },
      Roles: [
        {
          Ref: 'Role1ABCC5F0',
        },
      ],
    }));

    test.done();
  },

  'can grant PutEvents using grantAllPutEvents'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const role = new iam.Role(stack, 'Role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    // WHEN
    EventBus.grantAllPutEvents(role);

    // THEN
    expect(stack).to(haveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'events:PutEvents',
            Effect: 'Allow',
            Resource: '*',
          },
        ],
        Version: '2012-10-17',
      },
      Roles: [
        {
          Ref: 'Role1ABCC5F0',
        },
      ],
    }));

    test.done();
  },
  'can grant PutEvents to a specific event bus'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const role = new iam.Role(stack, 'Role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    const eventBus = new EventBus(stack, 'EventBus');

    // WHEN
    eventBus.grantPutEventsTo(role);

    // THEN
    expect(stack).to(haveResource('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'events:PutEvents',
            Effect: 'Allow',
            Resource: {
              'Fn::GetAtt': [
                'EventBus7B8748AA',
                'Arn',
              ],
            },
          },
        ],
        Version: '2012-10-17',
      },
      Roles: [
        {
          Ref: 'Role1ABCC5F0',
        },
      ],
    }));

    test.done();
  },
  'can archive events'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const event = new EventBus(stack, 'Bus');

    event.archive('MyArchive', {
      eventPattern: {
        account: [stack.account],
      },
      archiveName: 'MyArchive',
    });

    // THEN
    expect(stack).to(haveResource('AWS::Events::EventBus', {
      Name: 'Bus',
    }));

    expect(stack).to(haveResource('AWS::Events::Archive', {
      SourceArn: {
        'Fn::GetAtt': [
          'BusEA82B648',
          'Arn',
        ],
      },
      Description: {
        'Fn::Join': [
          '',
          [
            'Event Archive for ',
            {
              Ref: 'BusEA82B648',
            },
            ' Event Bus',
          ],
        ],
      },
      EventPattern: {
        account: [
          {
            Ref: 'AWS::AccountId',
          },
        ],
      },
      RetentionDays: 0,
      ArchiveName: 'MyArchive',
    }));

    test.done();
  },
  'can archive events from an imported EventBus'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const bus = new EventBus(stack, 'Bus');

    const importedBus = EventBus.fromEventBusArn(stack, 'ImportedBus', bus.eventBusArn);

    importedBus.archive('MyArchive', {
      eventPattern: {
        account: [stack.account],
      },
      archiveName: 'MyArchive',
    });

    // THEN
    expect(stack).to(haveResource('AWS::Events::EventBus', {
      Name: 'Bus',
    }));

    expect(stack).to(haveResource('AWS::Events::Archive', {
      SourceArn: {
        'Fn::GetAtt': [
          'BusEA82B648',
          'Arn',
        ],
      },
      Description: {
        'Fn::Join': [
          '',
          [
            'Event Archive for ',
            {
              'Fn::Select': [
                1,
                {
                  'Fn::Split': [
                    '/',
                    {
                      'Fn::Select': [
                        5,
                        {
                          'Fn::Split': [
                            ':',
                            {
                              'Fn::GetAtt': [
                                'BusEA82B648',
                                'Arn',
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            ' Event Bus',
          ],
        ],
      },
      EventPattern: {
        account: [
          {
            Ref: 'AWS::AccountId',
          },
        ],
      },
      RetentionDays: 0,
      ArchiveName: 'MyArchive',
    }));

    test.done();
  },
};
