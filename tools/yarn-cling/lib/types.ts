export interface PackageJson {
  name: string;
  version: string;

  /**
   * Dependency name to version range
   */
  dependencies?: Record<string, string>;
}

export interface YarnLock {
  type: string;
  /**
   * Dependency range (pkg@^1.2.0) to resolved package
   */
  object: Record<string, ResolvedYarnPackage>;
}

export interface ResolvedYarnPackage {
  version: string;
  resolved: string;
  integrity: string;

  /**
   * Dependency name to version range
   */
  dependencies: Record<string, string>;
}

export interface PackageLock extends PackageLockEntry {
  name: string;
  lockfileVersion: number;
  requires: boolean;
}

export interface PackageLockEntry {
  version: string;
  /**
   * Package name to resolved package
   */
  dependencies?: Record<string, PackageLockPackage>;
}

export interface PackageLockPackage extends PackageLockEntry {
  resolved?: string;
  integrity?: string;

  /**
   * Package name to version number
   *
   * Must be in 'dependencies' at this level or higher.
   */
  requires?: Record<string, string>;

  bundled?: boolean;
  dev?: boolean;
  optional?: boolean;
}