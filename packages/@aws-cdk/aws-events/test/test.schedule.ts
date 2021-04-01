import { Duration, Stack, Lazy } from '@aws-cdk/core';
import { Test } from 'nodeunit';
import * as events from '../lib';

export = {
  'cron expressions day and dow are mutex: given weekday'(test: Test) {
    // Run every 10 minutes Monday through Friday
    test.equal('cron(0/10 * ? * MON-FRI *)', events.Schedule.cron({
      minute: '0/10',
      weekDay: 'MON-FRI',
    }).expressionString);
    test.done();
  },

  'cron expressions day and dow are mutex: given month day'(test: Test) {
    // Run at 8:00 am (UTC) every 1st day of the month
    test.equal('cron(0 8 1 * ? *)', events.Schedule.cron({
      minute: '0',
      hour: '8',
      day: '1',
    }).expressionString);
    test.done();
  },

  'cron expressions day and dow are mutex: given neither'(test: Test) {
    // Run at 10:00 am (UTC) every day
    test.equal('cron(0 10 * * ? *)', events.Schedule.cron({
      minute: '0',
      hour: '10',
    }).expressionString);
    test.done();
  },

  'rate must be whole number of minutes'(test: Test) {
    test.throws(() => {
      events.Schedule.rate(Duration.minutes(0.13456));
    }, /'0.13456 minutes' cannot be converted into a whole number of seconds/);
    test.done();
  },

  'rate must be whole number'(test: Test) {
    test.throws(() => {
      events.Schedule.rate(Duration.minutes(1/8));
    }, /'0.125 minutes' cannot be converted into a whole number of seconds/);
    test.done();
  },

  'rate cannot be 0'(test: Test) {
    test.throws(() => {
      events.Schedule.rate(Duration.days(0));
    }, /Duration cannot be 0/);
    test.done();
  },

  'rate can be from a token'(test: Test) {
    const stack = new Stack();
    const lazyDuration = Duration.minutes(Lazy.number({ produce: () => 5 }));
    const rate = events.Schedule.rate(lazyDuration);
    test.equal('rate(5 minutes)', stack.resolve(rate).expressionString);
    test.done();
  },

  'rate can be in minutes'(test: Test) {
    test.equal('rate(10 minutes)',
      events.Schedule.rate(Duration.minutes(10))
        .expressionString);
    test.done();
  },

  'rate can be in days'(test: Test) {
    test.equal('rate(10 days)',
      events.Schedule.rate(Duration.days(10))
        .expressionString);
    test.done();
  },

  'rate can be in hours'(test: Test) {
    test.equal('rate(10 hours)',
      events.Schedule.rate(Duration.hours(10))
        .expressionString);
    test.done();
  },

  'rate can be in seconds'(test: Test) {
    test.equal('rate(2 minutes)',
      events.Schedule.rate(Duration.seconds(120))
        .expressionString);
    test.done();
  },

  'rate must not be in seconds when specified as a token'(test: Test) {
    test.throws(() => {
      events.Schedule.rate(Duration.seconds(Lazy.number({ produce: () => 5 })));
    }, /Allowed units for scheduling/);
    test.done();
  },
};
