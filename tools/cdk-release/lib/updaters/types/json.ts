import { UpdaterModule } from '../../types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const detectIndent = require('detect-indent');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const detectNewline = require('detect-newline');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const stringifyPackage = require('stringify-package');

class JsonUpdaterModule implements UpdaterModule {
  public readVersion(contents: string): string {
    return JSON.parse(contents).version;
  };

  public writeVersion(contents: string, version: string): string {
    const json = JSON.parse(contents);
    const indent = detectIndent(contents).indent;
    const newline = detectNewline(contents);
    json.version = version;
    return stringifyPackage(json, indent, newline);
  };

  public isPrivate(contents: string): string | boolean | null | undefined {
    return JSON.parse(contents).private;
  };
}
const jsonUpdaterModule = new JsonUpdaterModule();
export default jsonUpdaterModule;
