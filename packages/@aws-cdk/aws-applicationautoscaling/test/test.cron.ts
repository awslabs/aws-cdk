import { Duration, Stack, Lazy } from '@aws-cdk/core';
import { Test } from 'nodeunit';
import * as appscaling from '../lib';

export = {
  'test utc cron, hour only'(test: Test) {
    test.equals(appscaling.Schedule.cron({ hour: '18', minute: '0' }).expressionString, 'cron(0 18 * * ? *)');
    test.done();
  },

  'test utc cron, hour and minute'(test: Test) {
    test.equals(appscaling.Schedule.cron({ hour: '18', minute: '24' }).expressionString, 'cron(24 18 * * ? *)');
    test.done();
  },

  'rate must be whole number of minutes'(test: Test) {
    test.throws(() => {
      appscaling.Schedule.rate(Duration.minutes(0.13456));
    }, /'0.13456 minutes' cannot be converted into a whole number of seconds/);
    test.done();
  },

  'rate can be in seconds'(test: Test) {
    const duration = appscaling.Schedule.rate(Duration.seconds(120));
    test.equal('rate(2 minutes)', duration.expressionString);
    test.done();
  },

  'rate must not be in seconds when specified as a token'(test: Test) {
    test.throws(() => {
      appscaling.Schedule.rate(Duration.seconds(Lazy.number({ produce: () => 5 })));
    }, /Allowed units for scheduling/);
    test.done();
  },

  'rate cannot be 0'(test: Test) {
    test.throws(() => {
      appscaling.Schedule.rate(Duration.days(0));
    }, /Duration cannot be 0/);
    test.done();
  },

  'rate can be token'(test: Test) {
    const stack = new Stack();
    const lazyDuration = Duration.minutes(Lazy.number({ produce: () => 5 }));
    const rate = appscaling.Schedule.rate(lazyDuration);
    test.equal('rate(5 minutes)', stack.resolve(rate).expressionString);
    test.done();
  },

  'rate can be in allowed type hours'(test: Test) {
    test.equal('rate(1 hour)', appscaling.Schedule.rate(Duration.hours(1))
      .expressionString);
    test.done();
  },
};
