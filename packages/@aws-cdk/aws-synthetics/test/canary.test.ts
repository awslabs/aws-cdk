import '@aws-cdk/assert-internal/jest';
import { ABSENT, objectLike } from '@aws-cdk/assert-internal';
import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';
import { Duration, Lazy, Stack } from '@aws-cdk/core';
import * as synthetics from '../lib';

test('Basic canary properties work', () => {
  // GIVEN
  const stack = new Stack();

  // WHEN
  new synthetics.Canary(stack, 'Canary', {
    canaryName: 'mycanary',
    test: synthetics.Test.custom({
      handler: 'index.handler',
      code: synthetics.Code.fromInline('/* Synthetics handler code */'),
    }),
    successRetentionPeriod: Duration.days(10),
    failureRetentionPeriod: Duration.days(10),
    startAfterCreation: false,
    timeToLive: Duration.minutes(30),
    runtime: synthetics.Runtime.SYNTHETICS_1_0,
  });

  // THEN
  expect(stack).toHaveResourceLike('AWS::Synthetics::Canary', {
    Name: 'mycanary',
    SuccessRetentionPeriod: 10,
    FailureRetentionPeriod: 10,
    StartCanaryAfterCreation: false,
    Schedule: objectLike({ DurationInSeconds: '1800' }),
    RuntimeVersion: 'syn-1.0',
  });
});

test('Canary can have generated name', () => {
  // GIVEN
  const stack = new Stack();

  // WHEN
  new synthetics.Canary(stack, 'Canary', {
    test: synthetics.Test.custom({
      handler: 'index.handler',
      code: synthetics.Code.fromInline('/* Synthetics handler code */'),
    }),
    runtime: synthetics.Runtime.SYNTHETICS_NODEJS_PUPPETEER_3_1,
  });

  // THEN
  expect(stack).toHaveResourceLike('AWS::Synthetics::Canary', {
    Name: 'canary',
  });
});

test('Name validation does not fail when using Tokens', () => {
  // GIVEN
  const stack = new Stack();

  // WHEN
  new synthetics.Canary(stack, 'Canary', {
    canaryName: Lazy.string({ produce: () => 'My Canary' }),
    test: synthetics.Test.custom({
      handler: 'index.handler',
      code: synthetics.Code.fromInline('/* Synthetics handler code */'),
    }),
    runtime: synthetics.Runtime.SYNTHETICS_1_0,
  });

  // THEN: no exception
  expect(stack).toHaveResourceLike('AWS::Synthetics::Canary');
});

test('Throws when name is specified incorrectly', () => {
  // GIVEN
  const stack = new Stack();

  // THEN
  expect(() => new synthetics.Canary(stack, 'Canary', {
    canaryName: 'My Canary',
    test: synthetics.Test.custom({
      handler: 'index.handler',
      code: synthetics.Code.fromInline('/* Synthetics handler code */'),
    }),
    runtime: synthetics.Runtime.SYNTHETICS_1_0,
  }))
    .toThrowError('Canary name must be lowercase, numbers, hyphens, or underscores (got "My Canary")');
});

test('Throws when name has more than 21 characters', () => {
  // GIVEN
  const stack = new Stack();

  // THEN
  expect(() => new synthetics.Canary(stack, 'Canary', {
    canaryName: 'a'.repeat(22),
    test: synthetics.Test.custom({
      handler: 'index.handler',
      code: synthetics.Code.fromInline('/* Synthetics handler code */'),
    }),
    runtime: synthetics.Runtime.SYNTHETICS_1_0,
  }))
    .toThrowError(`Canary name is too large, must be between 1 and 21 characters, but is 22 (got "${'a'.repeat(22)}")`);
});

test('An existing role can be specified instead of auto-created', () => {
  // GIVEN
  const stack = new Stack();

  const role = new iam.Role(stack, 'role', {
    assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
  });

  // role.addToPolicy(/* required permissions per the documentation */);

  // WHEN
  new synthetics.Canary(stack, 'Canary', {
    role,
    test: synthetics.Test.custom({
      handler: 'index.handler',
      code: synthetics.Code.fromInline('/* Synthetics handler code */'),
    }),
    runtime: synthetics.Runtime.SYNTHETICS_1_0,
  });

  // THEN
  expect(stack).toHaveResourceLike('AWS::Synthetics::Canary', {
    ExecutionRoleArn: stack.resolve(role.roleArn),
  });
});

test('An existing bucket and prefix can be specified instead of auto-created', () => {
  // GIVEN
  const stack = new Stack();
  const bucket = new s3.Bucket(stack, 'mytestbucket');
  const prefix = 'canary';

  // WHEN
  new synthetics.Canary(stack, 'Canary', {
    artifactsBucketLocation: { bucket, prefix },
    test: synthetics.Test.custom({
      handler: 'index.handler',
      code: synthetics.Code.fromInline('/* Synthetics handler code */'),
    }),
    runtime: synthetics.Runtime.SYNTHETICS_1_0,
  });

  // THEN
  expect(stack).toHaveResourceLike('AWS::Synthetics::Canary', {
    ArtifactS3Location: stack.resolve(bucket.s3UrlForObject(prefix)),
  });
});

test('Runtime can be specified', () => {
  // GIVEN
  const stack = new Stack();

  // WHEN
  new synthetics.Canary(stack, 'Canary', {
    runtime: synthetics.Runtime.SYNTHETICS_1_0,
    test: synthetics.Test.custom({
      handler: 'index.handler',
      code: synthetics.Code.fromInline('/* Synthetics handler code */'),
    }),
  });

  // THEN
  expect(stack).toHaveResourceLike('AWS::Synthetics::Canary', {
    RuntimeVersion: 'syn-1.0',
  });
});

test('environment variables can be specified', () => {
  // GIVEN
  const stack = new Stack();
  const environmentVariables = {
    TEST_KEY_1: 'TEST_VALUE_1',
    TEST_KEY_2: 'TEST_VALUE_2',
  };

  // WHEN
  new synthetics.Canary(stack, 'Canary', {
    runtime: synthetics.Runtime.SYNTHETICS_1_0,
    test: synthetics.Test.custom({
      handler: 'index.handler',
      code: synthetics.Code.fromInline('/* Synthetics handler code */'),
    }),
    environmentVariables: environmentVariables,
  });

  // THEN
  expect(stack).toHaveResourceLike('AWS::Synthetics::Canary', {
    RunConfig: {
      EnvironmentVariables: environmentVariables,
    },
  });
});

test('environment variables are skipped if not provided', () => {
  // GIVEN
  const stack = new Stack();

  // WHEN
  new synthetics.Canary(stack, 'Canary', {
    runtime: synthetics.Runtime.SYNTHETICS_1_0,
    test: synthetics.Test.custom({
      handler: 'index.handler',
      code: synthetics.Code.fromInline('/* Synthetics handler code */'),
    }),
  });

  // THEN
  expect(stack).toHaveResourceLike('AWS::Synthetics::Canary', {
    RunConfig: ABSENT,
  });
});

test('Runtime can be customized', () => {
  // GIVEN
  const stack = new Stack();

  // WHEN
  new synthetics.Canary(stack, 'Canary', {
    runtime: new synthetics.Runtime('fancy-future-runtime-1337.42'),
    test: synthetics.Test.custom({
      handler: 'index.handler',
      code: synthetics.Code.fromInline('/* Synthetics handler code */'),
    }),
  });

  // THEN
  expect(stack).toHaveResourceLike('AWS::Synthetics::Canary', {
    RuntimeVersion: 'fancy-future-runtime-1337.42',
  });
});

test('Schedule can be set with Rate', () => {
  // GIVEN
  const stack = new Stack();

  // WHEN
  new synthetics.Canary(stack, 'Canary', {
    schedule: synthetics.Schedule.rate(Duration.minutes(3)),
    test: synthetics.Test.custom({
      handler: 'index.handler',
      code: synthetics.Code.fromInline('/* Synthetics handler code */'),
    }),
    runtime: synthetics.Runtime.SYNTHETICS_1_0,
  });

  // THEN
  expect(stack).toHaveResourceLike('AWS::Synthetics::Canary', {
    Schedule: objectLike({ Expression: 'rate(3 minutes)' }),
  });
});

test('Schedule can be set to 1 minute', () => {
  // GIVEN
  const stack = new Stack();

  // WHEN
  new synthetics.Canary(stack, 'Canary', {
    schedule: synthetics.Schedule.rate(Duration.minutes(1)),
    test: synthetics.Test.custom({
      handler: 'index.handler',
      code: synthetics.Code.fromInline('/* Synthetics handler code */'),
    }),
    runtime: synthetics.Runtime.SYNTHETICS_NODEJS_2_0,
  });

  // THEN
  expect(stack).toHaveResourceLike('AWS::Synthetics::Canary', {
    Schedule: objectLike({ Expression: 'rate(1 minute)' }),
  });
});

test('Schedule can be set with Expression', () => {
  // GIVEN
  const stack = new Stack();

  // WHEN
  new synthetics.Canary(stack, 'Canary', {
    schedule: synthetics.Schedule.expression('rate(1 hour)'),
    test: synthetics.Test.custom({
      handler: 'index.handler',
      code: synthetics.Code.fromInline('/* Synthetics handler code */'),
    }),
    runtime: synthetics.Runtime.SYNTHETICS_NODEJS_2_0,
  });

  // THEN
  expect(stack).toHaveResourceLike('AWS::Synthetics::Canary', {
    Schedule: objectLike({ Expression: 'rate(1 hour)' }),
  });
});

test('Schedule can be set to run once', () => {
  // GIVEN
  const stack = new Stack();

  // WHEN
  new synthetics.Canary(stack, 'Canary', {
    schedule: synthetics.Schedule.once(),
    test: synthetics.Test.custom({
      handler: 'index.handler',
      code: synthetics.Code.fromInline('/* Synthetics handler code */'),
    }),
    runtime: synthetics.Runtime.SYNTHETICS_NODEJS_2_0,
  });

  // THEN
  expect(stack).toHaveResourceLike('AWS::Synthetics::Canary', {
    Schedule: objectLike({ Expression: 'rate(0 minutes)' }),
  });
});

test('Throws when rate above 60 minutes', () => {
  // GIVEN
  const stack = new Stack();

  // THEN
  expect(() => new synthetics.Canary(stack, 'Canary', {
    schedule: synthetics.Schedule.rate(Duration.minutes(61)),
    test: synthetics.Test.custom({
      handler: 'index.handler',
      code: synthetics.Code.fromInline('/* Synthetics handler code */'),
    }),
    runtime: synthetics.Runtime.SYNTHETICS_NODEJS_2_0,
  }))
    .toThrowError('Schedule duration must be between 1 and 60 minutes');
});

test('Throws when rate above is not a whole number of minutes', () => {
  // GIVEN
  const stack = new Stack();

  // THEN
  expect(() => new synthetics.Canary(stack, 'Canary', {
    schedule: synthetics.Schedule.rate(Duration.seconds(59)),
    test: synthetics.Test.custom({
      handler: 'index.handler',
      code: synthetics.Code.fromInline('/* Synthetics handler code */'),
    }),
    runtime: synthetics.Runtime.SYNTHETICS_NODEJS_2_0,
  }))
    .toThrowError('\'59 seconds\' cannot be converted into a whole number of minutes.');
});

test('Can share artifacts bucket between canaries', () => {
  // GIVEN
  const stack = new Stack();

  // WHEN
  const canary1 = new synthetics.Canary(stack, 'Canary1', {
    schedule: synthetics.Schedule.once(),
    test: synthetics.Test.custom({
      handler: 'index.handler',
      code: synthetics.Code.fromInline('/* Synthetics handler code */'),
    }),
    runtime: synthetics.Runtime.SYNTHETICS_NODEJS_2_0,
  });

  const canary2 = new synthetics.Canary(stack, 'Canary2', {
    schedule: synthetics.Schedule.once(),
    test: synthetics.Test.custom({
      handler: 'index.handler',
      code: synthetics.Code.fromInline('/* Synthetics handler code */'),
    }),
    artifactsBucketLocation: { bucket: canary1.artifactsBucket },
    runtime: synthetics.Runtime.SYNTHETICS_NODEJS_2_0,
  });

  // THEN
  expect(canary1.artifactsBucket).toEqual(canary2.artifactsBucket);
});

test('can specify custom test', () => {
  // GIVEN
  const stack = new Stack();

  // WHEN
  new synthetics.Canary(stack, 'Canary', {
    test: synthetics.Test.custom({
      handler: 'index.handler',
      code: synthetics.Code.fromInline(`
        exports.handler = async () => {
          console.log(\'hello world\');
        };`),
    }),
    runtime: synthetics.Runtime.SYNTHETICS_NODEJS_2_0,
  });

  // THEN
  expect(stack).toHaveResourceLike('AWS::Synthetics::Canary', {
    Code: {
      Handler: 'index.handler',
      Script: `
        exports.handler = async () => {
          console.log(\'hello world\');
        };`,
    },
  });
});
