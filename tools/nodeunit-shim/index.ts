/**
 * Jest/Nodeunit compatibility shim
 *
 * Use this to mass-convert Nodeunit tests to Jest tests.
 */

/**
 * Compatibility shim test
 */
export class Test {
  constructor(private readonly cb: () => void) {
  }

  public equal(actual: any, expected: any, _message?: string) {
    expect(actual).toEqual(expected);
  }

  public notEqual(actual: any, expected: any, _message?: string) {
    expect(actual).not.toEqual(expected);
  }

  public equals(actual: any, expected: any, _message?: string) {
    expect(actual).toEqual(expected);
  }

  public strictEqual(actual: any, expected: any, _message?: string) {
    expect(actual).toEqual(expected);
  }

  public deepEqual(actual: any, expected: any, _message?: string) {
    expect(actual).toEqual(expected);
  }

  public notDeepEqual(actual: any, expected: any, _message?: string) {
    expect(actual).not.toEqual(expected);
  }

  public ok(actual: any, _message?: string) {
    expect(actual).toBeTruthy();
  }

  public same(actual: any, expected: any) {
    expect(actual).toBe(expected);
  }

  public throws(block: () => any, error?: string | RegExp | ErrorConstructor, _message?: string) {
    expect(block).toThrow(error);
  }

  public doesNotThrow(block: () => any, error?: string | RegExp | ErrorConstructor, _message?: string) {
    expect(block).not.toThrow(error);
  }

  public done() {
    this.cb();
  }
}

export function nodeunitShim(exports: Record<string, any>) {
  if (exports.setUp) {
    beforeEach(() => {
      return new Promise(ok => {
        exports.setUp(ok);
      });
    });
  }
  if (exports.tearDown) {
    afterEach(() => {
      return new Promise(ok => {
        exports.tearDown(ok);
      });
    });
  }
  for (const [testName, testObj] of Object.entries(exports)) {
    if (testName === 'setUp' || testName === 'tearDown') { continue; }

    if (typeof testObj === 'object') {
      // It's a suite
      describe(testName, () => {
        nodeunitShim(testObj);
      });
    } else {
      // It's a test
      test(testName, () => new Promise(ok => {
        testObj(new Test(ok));
      }));
    }
  }
}

type ErrorConstructor = new (...args: any[]) => Error;
