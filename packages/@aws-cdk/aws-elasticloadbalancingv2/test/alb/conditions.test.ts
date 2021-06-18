import '@aws-cdk/assert-internal/jest';
import * as elbv2 from '../../lib';

describe('tests', () => {
  test('pathPatterns length greater than 5 will throw exception', () => {
    //GIVEN
    const array = ['/u1', '/u2', '/u3', '/u4', '/u5'];

    //WHEN
    elbv2.ListenerCondition.pathPatterns(array); // Does not throw
    array.push('/u6');

    // THEN
    expect(() => {
      elbv2.ListenerCondition.pathPatterns(array);
    }).toThrow(/A rule can only have '5' condition values/);
  });
});
