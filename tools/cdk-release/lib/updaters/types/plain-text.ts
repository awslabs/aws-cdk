import { UpdaterModule } from '../../types';

const plainTextUpdaterModule: UpdaterModule = {
  readVersion(contents: string): string {
    return contents;
  },

  writeVersion(_contents: string, version: string): string {
    return version;
  },
};
export default plainTextUpdaterModule;
