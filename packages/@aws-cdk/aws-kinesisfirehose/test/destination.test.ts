import '@aws-cdk/assert-internal/jest';
import * as iam from '@aws-cdk/aws-iam';
import * as logs from '@aws-cdk/aws-logs';
import * as cdk from '@aws-cdk/core';
import { Duration, Size } from '@aws-cdk/core';
import { Construct } from 'constructs';
import * as firehose from '../lib';

describe('destination', () => {
  let stack: cdk.Stack;
  let deliveryStreamRole: iam.IRole;
  let deliveryStream: firehose.IDeliveryStream;

  const deliveryStreamRoleArn = 'arn:aws:iam::111122223333:role/DeliveryStreamRole';

  beforeEach(() => {
    stack = new cdk.Stack();
    deliveryStreamRole = iam.Role.fromRoleArn(stack, 'Delivery Stream Role', deliveryStreamRoleArn);
    deliveryStream = firehose.DeliveryStream.fromDeliveryStreamAttributes(stack, 'Delivery Stream', {
      deliveryStreamName: 'mydeliverystream',
      role: deliveryStreamRole,
    });
  });

  describe('createLoggingOptions', () => {
    class LoggingDestination extends firehose.DestinationBase {
      public bind(scope: Construct, options: firehose.DestinationBindOptions): firehose.DestinationConfig {
        return {
          properties: {
            testDestinationConfig: {
              loggingConfig: this.createLoggingOptions(scope, options.deliveryStream, 'streamId'),
            },
          },
        };
      }
    }

    test('creates resources and configuration by default', () => {
      const testDestination = new LoggingDestination();

      const testDestinationConfig = testDestination.bind(stack, { deliveryStream });

      expect(stack).toHaveResource('AWS::Logs::LogGroup');
      expect(stack).toHaveResource('AWS::Logs::LogStream');
      expect(stack.resolve(testDestinationConfig)).toStrictEqual({
        properties: {
          testDestinationConfig: {
            loggingConfig: {
              enabled: true,
              logGroupName: {
                Ref: 'LogGroupF5B46931',
              },
              logStreamName: {
                Ref: 'LogGroupstreamId3B940622',
              },
            },
          },
        },
      });
    });
    test('does not create resources or configuration if disabled', () => {
      const testDestination = new LoggingDestination({ logging: false });

      const testDestinationConfig = testDestination.bind(stack, { deliveryStream });

      expect(stack.resolve(testDestinationConfig)).toStrictEqual({
        properties: {
          testDestinationConfig: {},
        },
      });
    });

    test('creates configuration if log group provided', () => {
      const testDestination = new LoggingDestination({ logGroup: new logs.LogGroup(stack, 'Log Group') });

      const testDestinationConfig = testDestination.bind(stack, { deliveryStream });

      expect(stack.resolve(testDestinationConfig)).toMatchObject({
        properties: {
          testDestinationConfig: {
            loggingConfig: {
              enabled: true,
            },
          },
        },
      });
    });

    test('throws error if logging disabled but log group provided', () => {
      const testDestination = new LoggingDestination({ logging: false, logGroup: new logs.LogGroup(stack, 'Log Group') });

      expect(() => testDestination.bind(stack, { deliveryStream })).toThrowError('logging cannot be set to false when logGroup is provided');
    });

    test('uses provided log group', () => {
      const testDestination = new LoggingDestination({ logGroup: new logs.LogGroup(stack, 'Log Group') });

      const testDestinationConfig = testDestination.bind(stack, { deliveryStream });

      expect(stack).toCountResources('AWS::Logs::LogGroup', 1);
      expect(stack.resolve(testDestinationConfig)).toMatchObject({
        properties: {
          testDestinationConfig: {
            loggingConfig: {
              enabled: true,
              logGroupName: {
                Ref: 'LogGroupD9735569',
              },
              logStreamName: {
                Ref: 'LogGroupstreamIdA1293DC2',
              },
            },
          },
        },
      });
    });

    test('re-uses log group if called multiple times', () => {
      const testDestination = new class extends firehose.DestinationBase {
        public bind(scope: Construct, options: firehose.DestinationBindOptions): firehose.DestinationConfig {
          return {
            properties: {
              testDestinationConfig: {
                loggingConfig: this.createLoggingOptions(scope, options.deliveryStream, 'streamId'),
                anotherLoggingConfig: this.createLoggingOptions(scope, options.deliveryStream, 'anotherStreamId'),
              },
            },
          };
        }
      }();

      const testDestinationConfig = testDestination.bind(stack, { deliveryStream });

      expect(stack).toCountResources('AWS::Logs::LogGroup', 1);
      expect(stack.resolve(testDestinationConfig)).toMatchObject({
        properties: {
          testDestinationConfig: {
            loggingConfig: {
              logGroupName: {
                Ref: 'LogGroupF5B46931',
              },
              logStreamName: {
                Ref: 'LogGroupstreamId3B940622',
              },
            },
            anotherLoggingConfig: {
              logGroupName: {
                Ref: 'LogGroupF5B46931',
              },
              logStreamName: {
                Ref: 'LogGroupanotherStreamIdF2754481',
              },
            },
          },
        },
      });
    });
  });

  describe('createBufferingHints', () => {
    interface BufferingDestinationProps extends firehose.DestinationProps {
      bufferingInterval?: Duration,
      bufferingSize?: Size,
    }
    class BufferingDestination extends firehose.DestinationBase {
      constructor(protected readonly props: BufferingDestinationProps = {}) {
        super(props);
      }

      public bind(_scope: Construct, _options: firehose.DestinationBindOptions): firehose.DestinationConfig {
        return {
          properties: {
            testDestinationConfig: {
              bufferingConfig: this.createBufferingHints(this.props?.bufferingInterval, this.props?.bufferingSize),
            },
          },
        };
      }
    }

    test('does not create configuration by default', () => {
      const testDestination = new BufferingDestination();

      const testDestinationConfig = testDestination.bind(stack, { deliveryStream });

      expect(stack.resolve(testDestinationConfig)).toStrictEqual({
        properties: {
          testDestinationConfig: {},
        },
      });
    });

    test('creates configuration when interval and size provided', () => {
      const testDestination = new BufferingDestination({
        bufferingInterval: cdk.Duration.minutes(1),
        bufferingSize: cdk.Size.kibibytes(1024),
      });

      const testDestinationConfig = testDestination.bind(stack, { deliveryStream });

      expect(stack.resolve(testDestinationConfig)).toStrictEqual({
        properties: {
          testDestinationConfig: {
            bufferingConfig: {
              intervalInSeconds: 60,
              sizeInMBs: 1,
            },
          },
        },
      });
    });

    test('throws when only one of interval and size provided', () => {
      expect(() => new BufferingDestination({ bufferingInterval: cdk.Duration.minutes(1) }).bind(stack, { deliveryStream }))
        .toThrowError('If bufferingInterval is specified, bufferingSize must also be specified');
      expect(() => new BufferingDestination({ bufferingSize: cdk.Size.kibibytes(1024) }).bind(stack, { deliveryStream }))
        .toThrowError('If bufferingSize is specified, bufferingInterval must also be specified');
    });

    test('validates bufferingInterval', () => {
      expect(() => new BufferingDestination({
        bufferingInterval: cdk.Duration.seconds(30),
        bufferingSize: cdk.Size.mebibytes(1),
      }).bind(stack, { deliveryStream }))
        .toThrowError('Buffering interval must be between 60 and 900 seconds');
      expect(() => new BufferingDestination({
        bufferingInterval: cdk.Duration.minutes(16),
        bufferingSize: cdk.Size.mebibytes(1),
      }).bind(stack, { deliveryStream }))
        .toThrowError('Buffering interval must be between 60 and 900 seconds');
    });

    test('validates bufferingSize', () => {
      expect(() => new BufferingDestination({
        bufferingSize: cdk.Size.mebibytes(0),
        bufferingInterval: cdk.Duration.minutes(1),
      }).bind(stack, { deliveryStream }))
        .toThrowError('Buffering size must be between 1 and 128 MBs');
      expect(() => new BufferingDestination({
        bufferingSize: cdk.Size.mebibytes(256),
        bufferingInterval: cdk.Duration.minutes(1),
      }).bind(stack, { deliveryStream }))
        .toThrowError('Buffering size must be between 1 and 128 MBs');
    });
  });
});
