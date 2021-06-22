import { nodeunitShim, Test } from 'nodeunit-shim';
import { Duration, Lazy, Stack, Token } from '../lib';

nodeunitShim({
  'negative amount'(test: Test) {
    test.throws(() => Duration.seconds(-1), /negative/);

    test.done();
  },

  'unresolved amount'(test: Test) {
    const stack = new Stack();
    const lazyDuration = Duration.seconds(Token.asNumber({ resolve: () => 1337 }));
    test.equals(stack.resolve(lazyDuration.toSeconds()), 1337);
    test.throws(
      () => stack.resolve(lazyDuration.toMinutes()),
      /Unable to perform time unit conversion on un-resolved token/,
    );

    test.done();
  },

  'Duration in seconds'(test: Test) {
    const duration = Duration.seconds(300);

    test.equal(duration.toSeconds(), 300);
    test.equal(duration.toMinutes(), 5);
    test.throws(() => duration.toDays(), /'300 seconds' cannot be converted into a whole number of days/);
    floatEqual(test, duration.toDays({ integral: false }), 300 / 86_400);

    test.equal(Duration.seconds(60 * 60 * 24).toDays(), 1);

    test.done();
  },

  'Duration in minutes'(test: Test) {
    const duration = Duration.minutes(5);

    test.equal(duration.toSeconds(), 300);
    test.equal(duration.toMinutes(), 5);
    test.throws(() => duration.toDays(), /'5 minutes' cannot be converted into a whole number of days/);
    floatEqual(test, duration.toDays({ integral: false }), 300 / 86_400);

    test.equal(Duration.minutes(60 * 24).toDays(), 1);

    test.done();
  },

  'Duration in hours'(test: Test) {
    const duration = Duration.hours(5);

    test.equal(duration.toSeconds(), 18_000);
    test.equal(duration.toMinutes(), 300);
    test.throws(() => duration.toDays(), /'5 hours' cannot be converted into a whole number of days/);
    floatEqual(test, duration.toDays({ integral: false }), 5 / 24);

    test.equal(Duration.hours(24).toDays(), 1);

    test.done();
  },

  'seconds to milliseconds'(test: Test) {
    const duration = Duration.seconds(5);

    test.equal(duration.toMilliseconds(), 5_000);

    test.done();
  },

  'Duration in days'(test: Test) {
    const duration = Duration.days(1);

    test.equal(duration.toSeconds(), 86_400);
    test.equal(duration.toMinutes(), 1_440);
    test.equal(duration.toDays(), 1);

    test.done();
  },

  'toISOString'(test: Test) {
    test.equal(Duration.millis(0).toISOString(), 'PT0S');
    test.equal(Duration.seconds(0).toISOString(), 'PT0S');
    test.equal(Duration.minutes(0).toISOString(), 'PT0S');
    test.equal(Duration.hours(0).toISOString(), 'PT0S');
    test.equal(Duration.days(0).toISOString(), 'PT0S');

    test.equal(Duration.millis(5).toISOString(), 'PT0.005S');
    test.equal(Duration.seconds(5).toISOString(), 'PT5S');
    test.equal(Duration.minutes(5).toISOString(), 'PT5M');
    test.equal(Duration.hours(5).toISOString(), 'PT5H');
    test.equal(Duration.days(5).toISOString(), 'P5D');

    test.equal(Duration.seconds(1 + 60 * (1 + 60 * (1 + 24))).toISOString(), 'P1DT1H1M1S');

    test.done();
  },

  'toIsoString'(test: Test) {
    test.equal(Duration.millis(0).toIsoString(), 'PT0S');
    test.equal(Duration.seconds(0).toIsoString(), 'PT0S');
    test.equal(Duration.minutes(0).toIsoString(), 'PT0S');
    test.equal(Duration.hours(0).toIsoString(), 'PT0S');
    test.equal(Duration.days(0).toIsoString(), 'PT0S');

    test.equal(Duration.millis(5).toIsoString(), 'PT0.005S');
    test.equal(Duration.seconds(5).toIsoString(), 'PT5S');
    test.equal(Duration.minutes(5).toIsoString(), 'PT5M');
    test.equal(Duration.hours(5).toIsoString(), 'PT5H');
    test.equal(Duration.days(5).toIsoString(), 'P5D');

    test.equal(Duration.seconds(65).toIsoString(), 'PT1M5S');
    test.equal(Duration.seconds(1 + 60 * (1 + 60 * (1 + 24))).toIsoString(), 'P1DT1H1M1S');

    test.done();
  },

  'parse'(test: Test) {
    test.equal(Duration.parse('PT0S').toSeconds(), 0);
    test.equal(Duration.parse('PT0M').toSeconds(), 0);
    test.equal(Duration.parse('PT0H').toSeconds(), 0);
    test.equal(Duration.parse('P0D').toSeconds(), 0);

    test.equal(Duration.parse('PT5S').toSeconds(), 5);
    test.equal(Duration.parse('PT5M').toSeconds(), 300);
    test.equal(Duration.parse('PT5H').toSeconds(), 18_000);
    test.equal(Duration.parse('P5D').toSeconds(), 432_000);

    test.equal(Duration.parse('P1DT1H1M1S').toSeconds(), 1 + 60 * (1 + 60 * (1 + 24)));

    test.done();
  },

  'reject illegal parses'(test: Test) {
    const err = 'Not a valid ISO duration';
    test.throws(() => {
      Duration.parse('PT1D');
    }, err);

    test.throws(() => {
      Duration.parse('P5S');
    }, err);

    test.done();
  },

  'to human string'(test: Test) {
    test.equal(Duration.minutes(0).toHumanString(), '0 minutes');
    test.equal(Duration.minutes(Lazy.number({ produce: () => 5 })).toHumanString(), '<token> minutes');

    test.equal(Duration.days(1).toHumanString(), '1 day');
    test.equal(Duration.hours(1).toHumanString(), '1 hour');
    test.equal(Duration.minutes(1).toHumanString(), '1 minute');
    test.equal(Duration.seconds(1).toHumanString(), '1 second');
    test.equal(Duration.millis(1).toHumanString(), '1 milli');

    test.equal(Duration.minutes(10).toHumanString(), '10 minutes');

    test.equal(Duration.minutes(62).toHumanString(), '1 hour 2 minutes');

    test.equal(Duration.seconds(3666).toHumanString(), '1 hour 1 minute');

    test.equal(Duration.millis(3000).toHumanString(), '3 seconds');
    test.equal(Duration.millis(3666).toHumanString(), '3 seconds 666 millis');

    test.equal(Duration.millis(3.6).toHumanString(), '3.6 millis');

    test.done();
  },

  'add two durations'(test: Test) {
    test.equal(Duration.minutes(1).plus(Duration.seconds(30)).toSeconds(), Duration.seconds(90).toSeconds());
    test.equal(Duration.minutes(1).plus(Duration.seconds(30)).toMinutes({ integral: false }), Duration.seconds(90).toMinutes({ integral: false }));

    test.done();
  },

  'get unit label from duration'(test: Test) {
    test.equal(Duration.minutes(Lazy.number({ produce: () => 10 })).unitLabel(), 'minutes');
    test.equal(Duration.minutes(62).unitLabel(), 'minutes');
    test.equal(Duration.seconds(10).unitLabel(), 'seconds');
    test.equal(Duration.millis(1).unitLabel(), 'millis');
    test.equal(Duration.hours(1000).unitLabel(), 'hours');
    test.equal(Duration.days(2).unitLabel(), 'days');
    test.done();
  },

  'format number token to number'(test: Test) {
    const stack = new Stack();
    const lazyDuration = Duration.minutes(Lazy.number({ produce: () => 10 }));
    test.equal(stack.resolve(lazyDuration.formatTokenToNumber()), '10 minutes');
    test.equal(Duration.hours(10).formatTokenToNumber(), '10 hours');
    test.equal(Duration.days(5).formatTokenToNumber(), '5 days');
    test.done();
  },

  'duration is unresolved'(test: Test) {
    const lazyDuration = Duration.minutes(Lazy.number({ produce: () => 10 }));
    test.equal(lazyDuration.isUnresolved(), true);
    test.equal(Duration.hours(10).isUnresolved(), false);
    test.done();
  },
});

function floatEqual(test: Test, actual: number, expected: number) {
  test.ok(
    // Floats are subject to rounding errors up to Number.ESPILON
    actual >= expected - Number.EPSILON && actual <= expected + Number.EPSILON,
    `${actual} == ${expected}`,
  );
}
