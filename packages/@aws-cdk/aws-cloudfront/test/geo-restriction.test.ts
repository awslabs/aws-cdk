import '@aws-cdk/assert-internal/jest';
import { GeoRestriction } from '../lib';

describe.each([
  ['whitelist', GeoRestriction.allowlist],
  ['blacklist', GeoRestriction.denylist],
])('%s', (type, geoFn) => {
  test('throws is location is empty', () => {
    expect(() => { geoFn(); }).toThrow(/Should provide at least 1 location/);
  });

  test('throws if locations are the wrong format', () => {
    const error = /Invalid location format for location: .*/;
    expect(() => { geoFn('a'); }).toThrow(error);
    expect(() => { geoFn('abc'); }).toThrow(error);
    expect(() => { geoFn('ab'); }).toThrow(error);
    expect(() => { geoFn('a1'); }).toThrow(error);
  });

  test('includes proper restriction type and location list', () => {
    const restriction = geoFn('US', 'GB');
    expect(restriction.restrictionType).toEqual(type);
    expect(restriction.locations).toEqual(['US', 'GB']);
  });
});
