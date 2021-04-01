import * as path from 'path';
import { checkRequiredVersions, generateShrinkwrap } from '../lib';

test('generate lock for fixture directory', async () => {
  const lockFile = await generateShrinkwrap({
    packageJsonFile: path.join(__dirname, 'test-fixture', 'package1', 'package.json'),
    hoist: false,
  });

  expect(lockFile).toEqual({
    lockfileVersion: 1,
    name: 'package1',
    requires: true,
    version: '1.1.1',
    dependencies: {
      package2: {
        version: '2.2.2',
      },
      registrydependency1: {
        dependencies: {
          registrydependency2: {
            integrity: 'sha512-pineapple',
            resolved: 'https://registry.bla.com/stuff',
            version: '2.3.999',
          },
        },
        integrity: 'sha512-banana',
        requires: {
          registrydependency2: '^2.3.4',
        },
        resolved: 'https://registry.bla.com/stuff',
        version: '1.2.999',
      },
    },
  });
});

test('generate hoisted lock for fixture directory', async () => {
  const lockFile = await generateShrinkwrap({
    packageJsonFile: path.join(__dirname, 'test-fixture', 'package1', 'package.json'),
    hoist: true,
  });

  expect(lockFile).toEqual({
    lockfileVersion: 1,
    name: 'package1',
    requires: true,
    version: '1.1.1',
    dependencies: {
      package2: {
        version: '2.2.2',
      },
      registrydependency1: {
        integrity: 'sha512-banana',
        requires: {
          registrydependency2: '^2.3.4',
        },
        resolved: 'https://registry.bla.com/stuff',
        version: '1.2.999',
      },
      registrydependency2: {
        integrity: 'sha512-pineapple',
        resolved: 'https://registry.bla.com/stuff',
        version: '2.3.999',
      },
    },
  });
});

test('fail when requires cannot be satisfied', async () => {
  const lockFile = {
    lockfileVersion: 1,
    name: 'package1',
    requires: true,
    version: '1.1.1',
    dependencies: {
      package1: {
        version: '2.2.2',
        requires: {
          package2: '^3.3.3', // <- this needs to be adjusted
        },
      },
      package2: {
        version: '4.4.4',
      },
    },
  };

  expect(() => checkRequiredVersions(lockFile)).toThrow(/This can never/);
});
