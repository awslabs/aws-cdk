import * as path from 'path';
import { toPosixPath } from '../../lib/private/fs';

test('translate path.sep', () => {
  expect(toPosixPath(`a${path.sep}b${path.sep}c`)).toEqual('a/b/c');
});

test('windows path to posix path', () => {
  const winPath = path.win32.join('a', 'b', 'c');
  expect(toPosixPath(winPath, path.win32.sep)).toEqual('a/b/c');
});