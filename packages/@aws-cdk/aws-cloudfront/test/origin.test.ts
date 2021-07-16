import '@aws-cdk/assert-internal/jest';
import { App, Stack, Duration } from '@aws-cdk/core';
import { TestOrigin } from './test-origin';

let app: App;
let stack: Stack;

beforeEach(() => {
  app = new App();
  stack = new Stack(app, 'Stack', {
    env: { account: '1234', region: 'testregion' },
  });
});

test.each([
  Duration.seconds(0),
  Duration.seconds(0.5),
  Duration.seconds(10.5),
  Duration.seconds(11),
  Duration.minutes(5),
])('validates connectionTimeout is an int between 1 and 10 seconds', (connectionTimeout) => {
  expect(() => {
    new TestOrigin('www.example.com', {
      connectionTimeout,
    });
  }).toThrow(`connectionTimeout: Must be an int between 1 and 10 seconds (inclusive); received ${connectionTimeout.toSeconds()}.`);
});

test.each([-0.5, 0.5, 1.5, 4])
('validates connectionAttempts is an int between 1 and 3', (connectionAttempts) => {
  expect(() => {
    new TestOrigin('www.example.com', {
      connectionAttempts,
    });
  }).toThrow(`connectionAttempts: Must be an int between 1 and 3 (inclusive); received ${connectionAttempts}.`);
});

test.each(['api', '/api', '/api/', 'api/'])
('enforces that originPath starts but does not end, with a /', (originPath) => {
  const origin = new TestOrigin('www.example.com', {
    originPath,
  });
  const originBindConfig = origin.bind(stack, { originId: '0' });

  expect(originBindConfig.originProperty?.originPath).toEqual('/api');
});


test.each(['us-east-1', 'ap-southeast-2', 'eu-west-3', 'me-south-1'])
('ensures that originShieldRegion is a valid aws region', (originShieldRegion) => {
  const origin = new TestOrigin('www.example.com', {
    originShieldRegion,
  });
  const originBindConfig = origin.bind(stack, { originId: '0' });

  expect(originBindConfig.originProperty?.originShield).toEqual({
    enabled: true,
    originShieldRegion,
  });
});

test.each(['region', 'nowhere-2', 'place-west-3', 'me-south-one'])
('throws when originShieldRegion is not a valid aws region', (originShieldRegion) => {
  const origin = new TestOrigin('www.example.com', {
    originShieldRegion,
  });
  expect(() => {
    origin.bind(stack, { originId: '0' });
  }).toThrow(`originShieldRegion ${originShieldRegion} is not a valid AWS region.`);
});