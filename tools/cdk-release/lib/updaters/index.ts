import * as path from 'path';
import { defaultBumpFiles } from '../defaults';
import { UpdaterModule, ArgFile, Updater } from '../types';
import jsonUpdaterModule from './types/json';
import plainTextUpdaterModule from './types/plain-text';

export function resolveUpdaterObjectFromArgument(arg: ArgFile): Updater {
  arg = typeof arg === 'string' ? { filename: arg } : arg;
  let updaterModule: UpdaterModule;

  if (arg.updater) {
    updaterModule = getCustomUpdater(arg.updater);
  } else if (arg.type) {
    updaterModule = getUpdaterByType(arg.type);
  } else {
    updaterModule = getUpdaterByFilename(arg.filename);
  }

  return {
    updater: updaterModule,
    filename: arg.filename,
  };
}

function getCustomUpdater(updater: string | UpdaterModule): UpdaterModule {
  if (typeof updater === 'string') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(path.resolve(process.cwd(), updater));
  }
  if (
    typeof updater.readVersion === 'function' &&
    typeof updater.writeVersion === 'function'
  ) {
    return updater;
  }
  throw new Error('Updater must be a string path or an object with readVersion and writeVersion methods');
}

const JSON_BUMP_FILES = defaultBumpFiles;
function getUpdaterByFilename(filename: any): UpdaterModule {
  if (JSON_BUMP_FILES.includes(path.basename(filename))) {
    return getUpdaterByType('json');
  }
  throw Error(
    `Unsupported file (${filename}) provided for bumping.\n Please specify the updater \`type\` or use a custom \`updater\`.`,
  );
}

const updatersByType: { [key: string]: UpdaterModule } = {
  'json': jsonUpdaterModule,
  'plain-text': plainTextUpdaterModule,
};
function getUpdaterByType(type: string): UpdaterModule {
  const updater = updatersByType[type];
  if (!updater) {
    throw Error(`Unable to locate updater for provided type (${type}).`);
  }
  return updater;
}
