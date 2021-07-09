import * as fs from 'fs';
import { ReleaseOptions } from '../types';

export function writeFile(args: ReleaseOptions, filePath: string, content: string): void {
  if (args.dryRun) {
    return;
  }
  fs.writeFileSync(filePath, content, 'utf8');
}
