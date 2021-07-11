import * as os from 'os';
import * as path from 'path';

interface PackageManagerProps {
  readonly lockFile: string;
  readonly installCommand: string[];
  readonly runCommand: string[];
  readonly argsSeparator?: string
}

/**
 * A node package manager
 */
export class PackageManager {
  public static NPM = new PackageManager({
    lockFile: 'package-lock.json',
    installCommand: ['npm', 'ci'],
    runCommand: ['npx', '--no-install'],
  });

  public static YARN = new PackageManager({
    lockFile: 'yarn.lock',
    installCommand: ['yarn', 'install'],
    runCommand: ['yarn', 'run'],
  });

  public static PNPM = new PackageManager({
    lockFile: 'pnpm-lock.yaml',
    installCommand: ['pnpm', 'install'],
    runCommand: ['pnpm', 'exec'],
    argsSeparator: '--',
  });

  public static fromLockFile(lockFilePath: string): PackageManager {
    const lockFile = path.basename(lockFilePath);

    switch (lockFile) {
      case PackageManager.NPM.lockFile:
        return PackageManager.NPM;
      case PackageManager.YARN.lockFile:
        return PackageManager.YARN;
      case PackageManager.PNPM.lockFile:
        return PackageManager.PNPM;
      default:
        return PackageManager.NPM;
    }
  }

  public readonly lockFile: string;
  public readonly installCommand: string[];
  public readonly runCommand: string[];
  public readonly argsSeparator?: string;

  constructor(props: PackageManagerProps) {
    this.lockFile = props.lockFile;
    this.installCommand = props.installCommand;
    this.runCommand = props.runCommand;
    this.argsSeparator = props.argsSeparator;
  }

  public runBinCommand(bin: string): string {
    const [runCommand, ...runArgs] = this.runCommand;
    return [
      os.platform() === 'win32' ? `${runCommand}.cmd` : runCommand,
      ...runArgs,
      ...(this.argsSeparator ? [this.argsSeparator] : []),
      bin,
    ].join(' ');
  }
}
