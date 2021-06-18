import { Endpoint } from '../lib';

describe('Endpoint', () => {
  test('accepts valid port string numbers', () => {
    // GIVEN
    for (const port of [1, 50, 65535]) {
      // WHEN
      const endpoint = new Endpoint('127.0.0.1', port);

      // THEN
      expect(endpoint.port).toBe(port);
    }
  });
});
