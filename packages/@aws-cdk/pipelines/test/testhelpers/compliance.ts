interface SkippedSuite {
  legacy(reason?: string): void;

  modern(reason?: string): void;
}

interface Suite {
  readonly doesNotApply: SkippedSuite;

  legacy(fn: () => void): void;

  modern(fn: () => void): void;

  additional(description: string, fn: () => void): void;
}

// eslint-disable-next-line jest/no-export
export function behavior(name: string, cb: (suite: Suite) => void) {
  // 'describe()' adds a nice grouping in Jest
  describe(name, () => {
    const unwritten = new Set(['modern', 'legacy']);

    function scratchOff(flavor: string) {
      if (!unwritten.has(flavor)) {
        throw new Error(`Already had test for ${flavor}. Use .additional() to add more tests.`);
      }
      unwritten.delete(flavor);
    }


    cb({
      legacy: (testFn) => {
        scratchOff('legacy');
        test('legacy', testFn);
      },
      modern: (testFn) => {
        scratchOff('modern');
        test('modern', testFn);
      },
      additional: test,
      doesNotApply: {
        modern: (reason?: string) => {
          scratchOff('modern');

          if (reason != null) {
            // eslint-disable-next-line jest/no-disabled-tests
            test.skip(`modern - ${reason}`, () => {});
          }
        },

        legacy: (reason?: string) => {
          scratchOff('legacy');

          if (reason != null) {
            // eslint-disable-next-line jest/no-disabled-tests
            test.skip(`legacy - ${reason}`, () => {});
          }
        },
      },
    });

    for (const missing of unwritten) {
      test.todo(missing);
    }
  });
}
