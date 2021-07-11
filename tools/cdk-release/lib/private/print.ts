import * as util from 'util';
import { ReleaseOptions } from '../types';

export function debug(opts: ReleaseOptions, message: string): void {
  if (opts.verbose) {
    // eslint-disable-next-line no-console
    console.log(`[cdk-release] ${message}`);
  }
}

export function debugObject(opts: ReleaseOptions, message: string, object: any): void {
  if (opts.verbose) {
    // eslint-disable-next-line no-console
    console.log(`[cdk-release] ${message}:\n`, object);
  }
}

export function notify(opts: ReleaseOptions, msg: string, args: any[]) {
  if (!opts.silent) {
    // eslint-disable-next-line no-console
    console.info('✔ ' + util.format(msg, ...args));
  }
}
