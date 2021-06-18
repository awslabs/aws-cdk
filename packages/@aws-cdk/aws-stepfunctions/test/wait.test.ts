import '@aws-cdk/assert-internal/jest';
import * as cdk from '@aws-cdk/core';
import { Pass, Wait, WaitTime } from '../lib';
import { render } from './private/render-util';

describe('Wait State', () => {
  test('wait time from ISO8601 timestamp', () => {
    // GIVEN
    const timestamp = '2025-01-01T00:00:00Z';

    // WHEN
    const waitTime = WaitTime.timestamp(timestamp);

    // THEN
    expect(waitTime).toEqual({
      json: {
        Timestamp: '2025-01-01T00:00:00Z',
      },
    });
  });

  test('wait time from seconds path in state object', () => {
    // GIVEN
    const secondsPath = '$.waitSeconds';

    // WHEN
    const waitTime = WaitTime.secondsPath(secondsPath);

    // THEN
    expect(waitTime).toEqual({
      json: {
        SecondsPath: '$.waitSeconds',
      },
    });
  });

  test('wait time from timestamp path in state object', () => {
    // GIVEN
    const path = '$.timestampPath';

    // WHEN
    const waitTime = WaitTime.timestampPath(path);

    // THEN
    expect(waitTime).toEqual({
      json: {
        TimestampPath: '$.timestampPath',
      },
    });
  });

  test('supports adding a next state', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const chain = new Wait(stack, 'myWaitState', {
      time: WaitTime.duration(cdk.Duration.seconds(30)),
    });

    // WHEN
    chain.next(new Pass(stack, 'final pass', {}));

    // THEN
    expect(render(stack, chain)).toEqual({
      StartAt: 'myWaitState',
      States: {
        'final pass': {
          End: true,
          Type: 'Pass',
        },
        'myWaitState': {
          Next: 'final pass',
          Seconds: 30,
          Type: 'Wait',
        },
      },
    });
  });
});