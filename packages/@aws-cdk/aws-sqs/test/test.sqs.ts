import { expect, haveResource, ResourcePart } from '@aws-cdk/assert-internal';
import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import { CfnParameter, Duration, Stack, App } from '@aws-cdk/core';
import { Test } from 'nodeunit';
import * as sqs from '../lib';

/* eslint-disable quote-props */

export = {
  'default properties'(test: Test) {
    const stack = new Stack();
    const q = new sqs.Queue(stack, 'Queue');

    test.deepEqual(q.fifo, false);

    expect(stack).toMatch({
      'Resources': {
        'Queue4A7E3555': {
          'Type': 'AWS::SQS::Queue',
          'UpdateReplacePolicy': 'Delete',
          'DeletionPolicy': 'Delete',
        },
      },
    });

    expect(stack).to(haveResource('AWS::SQS::Queue', {
      DeletionPolicy: 'Delete',
    }, ResourcePart.CompleteDefinition));

    test.done();
  },
  'with a dead letter queue'(test: Test) {
    const stack = new Stack();
    const dlq = new sqs.Queue(stack, 'DLQ');
    new sqs.Queue(stack, 'Queue', { deadLetterQueue: { queue: dlq, maxReceiveCount: 3 } });

    expect(stack).toMatch({
      'Resources': {
        'DLQ581697C4': {
          'Type': 'AWS::SQS::Queue',
          'UpdateReplacePolicy': 'Delete',
          'DeletionPolicy': 'Delete',
        },
        'Queue4A7E3555': {
          'Type': 'AWS::SQS::Queue',
          'Properties': {
            'RedrivePolicy': {
              'deadLetterTargetArn': {
                'Fn::GetAtt': [
                  'DLQ581697C4',
                  'Arn',
                ],
              },
              'maxReceiveCount': 3,
            },
          },
          'UpdateReplacePolicy': 'Delete',
          'DeletionPolicy': 'Delete',
        },
      },
    });

    test.done();
  },

  'message retention period must be between 1 minute to 14 days'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // THEN
    test.throws(() => new sqs.Queue(stack, 'MyQueue', {
      retentionPeriod: Duration.seconds(30),
    }), /message retention period must be 60 seconds or more/);

    test.throws(() => new sqs.Queue(stack, 'AnotherQueue', {
      retentionPeriod: Duration.days(15),
    }), /message retention period must be 1209600 seconds or less/);

    test.done();
  },

  'message retention period can be provided as a parameter'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const parameter = new CfnParameter(stack, 'my-retention-period', {
      type: 'Number',
      default: 30,
    });

    // WHEN
    new sqs.Queue(stack, 'MyQueue', {
      retentionPeriod: Duration.seconds(parameter.valueAsNumber),
    });

    // THEN
    expect(stack).toMatch({
      'Parameters': {
        'myretentionperiod': {
          'Type': 'Number',
          'Default': 30,
        },
      },
      'Resources': {
        'MyQueueE6CA6235': {
          'Type': 'AWS::SQS::Queue',
          'Properties': {
            'MessageRetentionPeriod': {
              'Ref': 'myretentionperiod',
            },
          },
          'UpdateReplacePolicy': 'Delete',
          'DeletionPolicy': 'Delete',
        },
      },
    });

    test.done();
  },

  'addToPolicy will automatically create a policy for this queue'(test: Test) {
    const stack = new Stack();
    const queue = new sqs.Queue(stack, 'MyQueue');
    queue.addToResourcePolicy(new iam.PolicyStatement({
      resources: ['*'],
      actions: ['sqs:*'],
      principals: [new iam.ArnPrincipal('arn')],
    }));

    expect(stack).toMatch({
      'Resources': {
        'MyQueueE6CA6235': {
          'Type': 'AWS::SQS::Queue',
          'UpdateReplacePolicy': 'Delete',
          'DeletionPolicy': 'Delete',
        },
        'MyQueuePolicy6BBEDDAC': {
          'Type': 'AWS::SQS::QueuePolicy',
          'Properties': {
            'PolicyDocument': {
              'Statement': [
                {
                  'Action': 'sqs:*',
                  'Effect': 'Allow',
                  'Principal': {
                    'AWS': 'arn',
                  },
                  'Resource': '*',
                },
              ],
              'Version': '2012-10-17',
            },
            'Queues': [
              {
                'Ref': 'MyQueueE6CA6235',
              },
            ],
          },
        },
      },
    });
    test.done();
  },

  'export and import': {
    'importing works correctly'(test: Test) {
      // GIVEN
      const stack = new Stack();

      // WHEN
      const imports = sqs.Queue.fromQueueArn(stack, 'Imported', 'arn:aws:sqs:us-east-1:123456789012:queue1');

      // THEN

      // "import" returns an IQueue bound to `Fn::ImportValue`s.
      test.deepEqual(stack.resolve(imports.queueArn), 'arn:aws:sqs:us-east-1:123456789012:queue1');
      test.deepEqual(stack.resolve(imports.queueUrl), {
        'Fn::Join':
        ['', ['https://sqs.us-east-1.', { Ref: 'AWS::URLSuffix' }, '/123456789012/queue1']],
      });
      test.deepEqual(stack.resolve(imports.queueName), 'queue1');
      test.done();
    },

    'importing fifo and standard queues are detected correctly'(test: Test) {
      const stack = new Stack();
      const stdQueue = sqs.Queue.fromQueueArn(stack, 'StdQueue', 'arn:aws:sqs:us-east-1:123456789012:queue1');
      const fifoQueue = sqs.Queue.fromQueueArn(stack, 'FifoQueue', 'arn:aws:sqs:us-east-1:123456789012:queue2.fifo');
      test.deepEqual(stdQueue.fifo, false);
      test.deepEqual(fifoQueue.fifo, true);
      test.done();
    },

    'importing works correctly for cross region queue'(test: Test) {
      // GIVEN
      const stack = new Stack(undefined, 'Stack', { env: { region: 'us-east-1' } });

      // WHEN
      const imports = sqs.Queue.fromQueueArn(stack, 'Imported', 'arn:aws:sqs:us-west-2:123456789012:queue1');

      // THEN

      // "import" returns an IQueue bound to `Fn::ImportValue`s.
      test.deepEqual(stack.resolve(imports.queueArn), 'arn:aws:sqs:us-west-2:123456789012:queue1');
      test.deepEqual(stack.resolve(imports.queueUrl), {
        'Fn::Join':
        ['', ['https://sqs.us-west-2.', { Ref: 'AWS::URLSuffix' }, '/123456789012/queue1']],
      });
      test.deepEqual(stack.resolve(imports.queueName), 'queue1');
      test.done();
    },
  },

  'grants': {
    'grantConsumeMessages'(test: Test) {
      testGrant((q, p) => q.grantConsumeMessages(p),
        'sqs:ReceiveMessage',
        'sqs:ChangeMessageVisibility',
        'sqs:GetQueueUrl',
        'sqs:DeleteMessage',
        'sqs:GetQueueAttributes',
      );
      test.done();
    },

    'grantSendMessages'(test: Test) {
      testGrant((q, p) => q.grantSendMessages(p),
        'sqs:SendMessage',
        'sqs:GetQueueAttributes',
        'sqs:GetQueueUrl',
      );
      test.done();
    },

    'grantPurge'(test: Test) {
      testGrant((q, p) => q.grantPurge(p),
        'sqs:PurgeQueue',
        'sqs:GetQueueAttributes',
        'sqs:GetQueueUrl',
      );
      test.done();
    },

    'grant() is general purpose'(test: Test) {
      testGrant((q, p) => q.grant(p, 'service:hello', 'service:world'),
        'service:hello',
        'service:world',
      );
      test.done();
    },

    'grants also work on imported queues'(test: Test) {
      const stack = new Stack();
      const queue = sqs.Queue.fromQueueAttributes(stack, 'Import', {
        queueArn: 'arn:aws:sqs:us-east-1:123456789012:queue1',
        queueUrl: 'https://queue-url',
      });

      const user = new iam.User(stack, 'User');

      queue.grantPurge(user);

      expect(stack).to(haveResource('AWS::IAM::Policy', {
        'PolicyDocument': {
          'Statement': [
            {
              'Action': [
                'sqs:PurgeQueue',
                'sqs:GetQueueAttributes',
                'sqs:GetQueueUrl',
              ],
              'Effect': 'Allow',
              'Resource': 'arn:aws:sqs:us-east-1:123456789012:queue1',
            },
          ],
          'Version': '2012-10-17',
        },
      }));

      test.done();
    },
  },

  'queue encryption': {
    'encryptionMasterKey can be set to a custom KMS key'(test: Test) {
      const stack = new Stack();

      const key = new kms.Key(stack, 'CustomKey');
      const queue = new sqs.Queue(stack, 'Queue', { encryptionMasterKey: key });

      test.same(queue.encryptionMasterKey, key);
      expect(stack).to(haveResource('AWS::SQS::Queue', {
        'KmsMasterKeyId': { 'Fn::GetAtt': ['CustomKey1E6D0D07', 'Arn'] },
      }));

      test.done();
    },

    'a kms key will be allocated if encryption = kms but a master key is not specified'(test: Test) {
      const stack = new Stack();

      new sqs.Queue(stack, 'Queue', { encryption: sqs.QueueEncryption.KMS });

      expect(stack).to(haveResource('AWS::KMS::Key'));
      expect(stack).to(haveResource('AWS::SQS::Queue', {
        'KmsMasterKeyId': {
          'Fn::GetAtt': [
            'QueueKey39FCBAE6',
            'Arn',
          ],
        },
      }));

      test.done();
    },

    'it is possible to use a managed kms key'(test: Test) {
      const stack = new Stack();

      new sqs.Queue(stack, 'Queue', { encryption: sqs.QueueEncryption.KMS_MANAGED });
      expect(stack).toMatch({
        'Resources': {
          'Queue4A7E3555': {
            'Type': 'AWS::SQS::Queue',
            'Properties': {
              'KmsMasterKeyId': 'alias/aws/sqs',
            },
            'UpdateReplacePolicy': 'Delete',
            'DeletionPolicy': 'Delete',
          },
        },
      });
      test.done();
    },

    'grant also affects key on encrypted queue'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const queue = new sqs.Queue(stack, 'Queue', {
        encryption: sqs.QueueEncryption.KMS,
      });
      const role = new iam.Role(stack, 'Role', {
        assumedBy: new iam.ServicePrincipal('someone'),
      });

      // WHEN
      queue.grantSendMessages(role);

      // THEN
      expect(stack).to(haveResource('AWS::IAM::Policy', {
        'PolicyDocument': {
          'Statement': [
            {
              'Action': [
                'sqs:SendMessage',
                'sqs:GetQueueAttributes',
                'sqs:GetQueueUrl',
              ],
              'Effect': 'Allow',
              'Resource': { 'Fn::GetAtt': ['Queue4A7E3555', 'Arn'] },
            },
            {
              'Action': [
                'kms:Decrypt',
                'kms:Encrypt',
                'kms:ReEncrypt*',
                'kms:GenerateDataKey*',
              ],
              'Effect': 'Allow',
              'Resource': { 'Fn::GetAtt': ['QueueKey39FCBAE6', 'Arn'] },
            },
          ],
          'Version': '2012-10-17',
        },
      }));

      test.done();
    },
  },

  'test ".fifo" suffixed queues register as fifo'(test: Test) {
    const stack = new Stack();
    const queue = new sqs.Queue(stack, 'Queue', {
      queueName: 'MyQueue.fifo',
    });

    test.deepEqual(queue.fifo, true);

    expect(stack).toMatch({
      'Resources': {
        'Queue4A7E3555': {
          'Type': 'AWS::SQS::Queue',
          'Properties': {
            'QueueName': 'MyQueue.fifo',
            'FifoQueue': true,
          },
          'UpdateReplacePolicy': 'Delete',
          'DeletionPolicy': 'Delete',
        },
      },
    });

    test.done();
  },

  'test a fifo queue is observed when the "fifo" property is specified'(test: Test) {
    const stack = new Stack();
    const queue = new sqs.Queue(stack, 'Queue', {
      fifo: true,
    });

    test.deepEqual(queue.fifo, true);

    expect(stack).toMatch({
      'Resources': {
        'Queue4A7E3555': {
          'Type': 'AWS::SQS::Queue',
          'Properties': {
            'FifoQueue': true,
          },
          'UpdateReplacePolicy': 'Delete',
          'DeletionPolicy': 'Delete',
        },
      },
    });

    test.done();
  },

  'test a fifo queue is observed when high throughput properties are specified'(test: Test) {
    const stack = new Stack();
    const queue = new sqs.Queue(stack, 'Queue', {
      fifo: true,
      fifoThroughputLimit: sqs.FifoThroughputLimit.PER_MESSAGE_GROUP_ID,
      deduplicationScope: sqs.DeduplicationScope.MESSAGE_GROUP,
    });

    test.deepEqual(queue.fifo, true);
    expect(stack).toMatch({
      'Resources': {
        'Queue4A7E3555': {
          'Type': 'AWS::SQS::Queue',
          'Properties': {
            'DeduplicationScope': 'messageGroup',
            'FifoQueue': true,
            'FifoThroughputLimit': 'perMessageGroupId',
          },
          'UpdateReplacePolicy': 'Delete',
          'DeletionPolicy': 'Delete',
        },
      },
    });

    test.done();
  },

  'test a queue throws when fifoThroughputLimit specified on non fifo queue'(test: Test) {
    const stack = new Stack();
    test.throws(() => {
      new sqs.Queue(stack, 'Queue', {
        fifo: false,
        fifoThroughputLimit: sqs.FifoThroughputLimit.PER_MESSAGE_GROUP_ID,
      });
    });
    test.done();
  },

  'test a queue throws when deduplicationScope specified on non fifo queue'(test: Test) {
    const stack = new Stack();
    test.throws(() => {
      new sqs.Queue(stack, 'Queue', {
        fifo: false,
        deduplicationScope: sqs.DeduplicationScope.MESSAGE_GROUP,
      });
    });
    test.done();
  },

  'test metrics'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const queue = new sqs.Queue(stack, 'Queue');

    // THEN
    test.deepEqual(stack.resolve(queue.metricNumberOfMessagesSent()), {
      dimensions: { QueueName: { 'Fn::GetAtt': ['Queue4A7E3555', 'QueueName'] } },
      namespace: 'AWS/SQS',
      metricName: 'NumberOfMessagesSent',
      period: Duration.minutes(5),
      statistic: 'Sum',
    });

    test.deepEqual(stack.resolve(queue.metricSentMessageSize()), {
      dimensions: { QueueName: { 'Fn::GetAtt': ['Queue4A7E3555', 'QueueName'] } },
      namespace: 'AWS/SQS',
      metricName: 'SentMessageSize',
      period: Duration.minutes(5),
      statistic: 'Average',
    });

    test.done();
  },

  'fails if queue policy has no actions'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'my-stack');
    const queue = new sqs.Queue(stack, 'Queue');

    // WHEN
    queue.addToResourcePolicy(new iam.PolicyStatement({
      resources: ['*'],
      principals: [new iam.ArnPrincipal('arn')],
    }));

    // THEN
    test.throws(() => app.synth(), /A PolicyStatement must specify at least one \'action\' or \'notAction\'/);
    test.done();
  },

  'fails if queue policy has no IAM principals'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'my-stack');
    const queue = new sqs.Queue(stack, 'Queue');

    // WHEN
    queue.addToResourcePolicy(new iam.PolicyStatement({
      resources: ['*'],
      actions: ['sqs:*'],
    }));

    // THEN
    test.throws(() => app.synth(), /A PolicyStatement used in a resource-based policy must specify at least one IAM principal/);
    test.done();
  },
};

function testGrant(action: (q: sqs.Queue, principal: iam.IPrincipal) => void, ...expectedActions: string[]) {
  const stack = new Stack();
  const queue = new sqs.Queue(stack, 'MyQueue');
  const principal = new iam.User(stack, 'User');

  action(queue, principal);

  expect(stack).to(haveResource('AWS::IAM::Policy', {
    'PolicyDocument': {
      'Statement': [
        {
          'Action': expectedActions,
          'Effect': 'Allow',
          'Resource': {
            'Fn::GetAtt': [
              'MyQueueE6CA6235',
              'Arn',
            ],
          },
        },
      ],
      'Version': '2012-10-17',
    },
  }));
}
