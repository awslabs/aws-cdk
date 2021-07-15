import * as os from 'os';
import { PackageManager } from '../lib/package-manager';

test('from a package-lock.json', () => {
  const packageManager = PackageManager.fromLockFile('/path/to/package-lock.json');
  expect(packageManager).toEqual(PackageManager.NPM);

  expect(packageManager.runBinCommand('my-bin')).toBe('npx --no-install my-bin');
});

test('from a yarn.lock', () => {
  const packageManager = PackageManager.fromLockFile('/path/to/yarn.lock');
  expect(packageManager).toEqual(PackageManager.YARN);

  expect(packageManager.runBinCommand('my-bin')).toBe('yarn run my-bin');
});

test('from a pnpm-lock.yaml', () => {
  const packageManager = PackageManager.fromLockFile('/path/to/pnpm-lock.yaml');
  expect(packageManager).toEqual(PackageManager.PNPM);

  expect(packageManager.runBinCommand('my-bin')).toBe('pnpm exec -- my-bin');
});

test('defaults to NPM', () => {
  const packageManager = PackageManager.fromLockFile('/path/to/other.lock');
  expect(packageManager).toEqual(PackageManager.NPM);
});

test('Windows', () => {
  const osPlatformMock = jest.spyOn(os, 'platform').mockReturnValue('win32');

  const packageManager = PackageManager.NPM;
  expect(packageManager.runBinCommand('my-bin')).toEqual('npx.cmd --no-install my-bin');

  osPlatformMock.mockRestore();
});
