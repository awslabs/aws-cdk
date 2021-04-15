import * as crypto from 'crypto';
import * as os from 'os';
import * as path from 'path';
import * as cxapi from '@aws-cdk/cx-api';
import { Construct } from 'constructs';
import * as fs from 'fs-extra';
import * as minimatch from 'minimatch';
import { FileSystem, FingerprintOptions } from '../fs/index';
import { Names } from '../names';
import { Cache } from '../private/cache';
import { Stack } from '../stack';
import { Stage } from '../stage';
import { BundlingOptions, BundlingOutput } from './bundling';
import { AssetHashType, AssetOptions, FileAssetPackaging } from './file-asset';

// v2 - keep this import as a separate section to reduce merge conflict when forward merging with the v2 branch.
// eslint-disable-next-line
import { Construct as CoreConstruct } from '../construct-compat';

const ARCHIVE_EXTENSIONS = ['.zip', '.jar'];

/**
 * A previously staged asset
 */
interface StagedAsset {
  /**
   * The path where we wrote this asset previously
   */
  readonly stagedPath: string;

  /**
   * The hash we used previously
   */
  readonly assetHash: string;

  /**
   * The packaging of the asset
   */
  readonly packaging: FileAssetPackaging,

  /**
   * Whether this asset is an archive
   */
  readonly isArchive: boolean;
}

/**
 * Initialization properties for `AssetStaging`.
 */
export interface AssetStagingProps extends FingerprintOptions, AssetOptions {
  /**
   * The source file or directory to copy from.
   */
  readonly sourcePath: string;
}

/**
 * Stages a file or directory from a location on the file system into a staging
 * directory.
 *
 * This is controlled by the context key 'aws:cdk:asset-staging' and enabled
 * by the CLI by default in order to ensure that when the CDK app exists, all
 * assets are available for deployment. Otherwise, if an app references assets
 * in temporary locations, those will not be available when it exists (see
 * https://github.com/aws/aws-cdk/issues/1716).
 *
 * The `stagedPath` property is a stringified token that represents the location
 * of the file or directory after staging. It will be resolved only during the
 * "prepare" stage and may be either the original path or the staged path
 * depending on the context setting.
 *
 * The file/directory are staged based on their content hash (fingerprint). This
 * means that only if content was changed, copy will happen.
 */
export class AssetStaging extends CoreConstruct {
  /**
   * The directory inside the bundling container into which the asset sources will be mounted.
   * @experimental
   */
  public static readonly BUNDLING_INPUT_DIR = '/asset-input';

  /**
   * The directory inside the bundling container into which the bundled output should be written.
   * @experimental
   */
  public static readonly BUNDLING_OUTPUT_DIR = '/asset-output';

  /**
   * Clears the asset hash cache
   */
  public static clearAssetHashCache() {
    this.assetCache.clear();
  }

  /**
   * Cache of asset hashes based on asset configuration to avoid repeated file
   * system and bundling operations.
   */
  private static assetCache = new Cache<StagedAsset>();

  /**
   * Absolute path to the asset data.
   *
   * If asset staging is disabled, this will just be the source path or
   * a temporary directory used for bundling.
   *
   * If asset staging is enabled it will be the staged path.
   *
   * IMPORTANT: If you are going to call `addFileAsset()`, use
   * `relativeStagedPath()` instead.
   *
   * @deprecated - Use `absoluteStagedPath` instead.
   */
  public readonly stagedPath: string;

  /**
   * Absolute path to the asset data.
   *
   * If asset staging is disabled, this will just be the source path or
   * a temporary directory used for bundling.
   *
   * If asset staging is enabled it will be the staged path.
   *
   * IMPORTANT: If you are going to call `addFileAsset()`, use
   * `relativeStagedPath()` instead.
   */
  public readonly absoluteStagedPath: string;

  /**
   * The absolute path of the asset as it was referenced by the user.
   */
  public readonly sourcePath: string;

  /**
   * A cryptographic hash of the asset.
   */
  public readonly assetHash: string;

  /**
   * How this asset should be packaged.
   */
  public readonly packaging: FileAssetPackaging;

  /**
   * Whether this asset is an archive (zip or jar).
   */
  public readonly isArchive: boolean;

  private readonly fingerprintOptions: FingerprintOptions;

  private readonly hashType: AssetHashType;
  private readonly assetOutdir: string;

  /**
   * A custom source fingerprint given by the user
   *
   * Will not be used literally, always hashed later on.
   */
  private customSourceFingerprint?: string;

  private readonly cacheKey: string;

  private readonly sourceStats: fs.Stats;

  constructor(scope: Construct, id: string, props: AssetStagingProps) {
    super(scope, id);

    this.sourcePath = path.resolve(props.sourcePath);
    this.fingerprintOptions = props;

    if (!fs.existsSync(this.sourcePath)) {
      throw new Error(`Cannot find asset at ${this.sourcePath}`);
    }

    this.sourceStats = fs.statSync(this.sourcePath);

    const outdir = Stage.of(this)?.assetOutdir;
    if (!outdir) {
      throw new Error('unable to determine cloud assembly asset output directory. Assets must be defined indirectly within a "Stage" or an "App" scope');
    }
    this.assetOutdir = outdir;

    // Determine the hash type based on the props as props.assetHashType is
    // optional from a caller perspective.
    this.customSourceFingerprint = props.assetHash;
    this.hashType = determineHashType(props.assetHashType, this.customSourceFingerprint);

    // Decide what we're going to do, without actually doing it yet
    let stageThisAsset: () => StagedAsset;
    let skip = false;
    if (props.bundling) {
      // Check if we actually have to bundle for this stack
      const bundlingStacks: string[] = this.node.tryGetContext(cxapi.BUNDLING_STACKS) ?? ['*'];
      skip = !bundlingStacks.find(pattern => minimatch(Stack.of(this).stackName, pattern));
      const bundling = props.bundling;
      stageThisAsset = () => this.stageByBundling(bundling, skip);
    } else {
      stageThisAsset = () => this.stageByCopying();
    }

    // Calculate a cache key from the props. This way we can check if we already
    // staged this asset and reuse the result (e.g. the same asset with the same
    // configuration is used in multiple stacks). In this case we can completely
    // skip file system and bundling operations.
    //
    // The output directory and whether this asset is skipped or not should also be
    // part of the cache key to make sure we don't accidentally return the wrong
    // staged asset from the cache.
    this.cacheKey = calculateCacheKey({
      outdir: this.assetOutdir,
      sourcePath: path.resolve(props.sourcePath),
      bundling: props.bundling,
      assetHashType: this.hashType,
      customFingerprint: this.customSourceFingerprint,
      extraHash: props.extraHash,
      exclude: props.exclude,
      ignoreMode: props.ignoreMode,
      skip,
    });

    const staged = AssetStaging.assetCache.obtain(this.cacheKey, stageThisAsset);
    this.stagedPath = staged.stagedPath;
    this.absoluteStagedPath = staged.stagedPath;
    this.assetHash = staged.assetHash;
    this.packaging = staged.packaging;
    this.isArchive = staged.isArchive;
  }

  /**
   * A cryptographic hash of the asset.
   *
   * @deprecated see `assetHash`.
   */
  public get sourceHash(): string {
    return this.assetHash;
  }

  /**
   * Return the path to the staged asset, relative to the Cloud Assembly (manifest) directory of the given stack
   *
   * Only returns a relative path if the asset was staged, returns an absolute path if
   * it was not staged.
   *
   * A bundled asset might end up in the outDir and still not count as
   * "staged"; if asset staging is disabled we're technically expected to
   * reference source directories, but we don't have a source directory for the
   * bundled outputs (as the bundle output is written to a temporary
   * directory). Nevertheless, we will still return an absolute path.
   *
   * A non-obvious directory layout may look like this:
   *
   * ```
   *   CLOUD ASSEMBLY ROOT
   *     +-- asset.12345abcdef/
   *     +-- assembly-Stage
   *           +-- MyStack.template.json
   *           +-- MyStack.assets.json <- will contain { "path": "../asset.12345abcdef" }
   * ```
   */
  public relativeStagedPath(stack: Stack) {
    const asmManifestDir = Stage.of(stack)?.outdir;
    if (!asmManifestDir) { return this.stagedPath; }

    const isOutsideAssetDir = path.relative(this.assetOutdir, this.stagedPath).startsWith('..');
    if (isOutsideAssetDir || this.stagingDisabled) {
      return this.stagedPath;
    }

    return path.relative(asmManifestDir, this.stagedPath);
  }

  /**
   * Stage the source to the target by copying
   *
   * Optionally skip if staging is disabled, in which case we pretend we did something but we don't really.
   */
  private stageByCopying(): StagedAsset {
    const assetHash = this.calculateHash(this.hashType);
    const stagedPath = this.stagingDisabled
      ? this.sourcePath
      : path.resolve(this.assetOutdir, renderAssetFilename(assetHash, path.extname(this.sourcePath)));

    if (!this.sourceStats.isDirectory() && !this.sourceStats.isFile()) {
      throw new Error(`Asset ${this.sourcePath} is expected to be either a directory or a regular file`);
    }

    this.stageAsset(this.sourcePath, stagedPath, 'copy');

    return {
      assetHash,
      stagedPath,
      packaging: this.sourceStats.isDirectory() ? FileAssetPackaging.ZIP_DIRECTORY : FileAssetPackaging.FILE,
      isArchive: this.sourceStats.isDirectory() || ARCHIVE_EXTENSIONS.includes(path.extname(this.sourcePath).toLowerCase()),
    };
  }

  /**
   * Stage the source to the target by bundling
   *
   * Optionally skip, in which case we pretend we did something but we don't really.
   */
  private stageByBundling(bundling: BundlingOptions, skip: boolean): StagedAsset {
    if (!this.sourceStats.isDirectory()) {
      throw new Error(`Asset ${this.sourcePath} is expected to be a directory when bundling`);
    }

    if (skip) {
      // We should have bundled, but didn't to save time. Still pretend to have a hash.
      // If the asset uses OUTPUT or BUNDLE, we use a CUSTOM hash to avoid fingerprinting
      // a potentially very large source directory. Other hash types are kept the same.
      let hashType = this.hashType;
      if (hashType === AssetHashType.OUTPUT || hashType === AssetHashType.BUNDLE) {
        this.customSourceFingerprint = Names.uniqueId(this);
        hashType = AssetHashType.CUSTOM;
      }
      return {
        assetHash: this.calculateHash(hashType, bundling),
        stagedPath: this.sourcePath,
        packaging: FileAssetPackaging.ZIP_DIRECTORY,
        isArchive: true,
      };
    }

    // Try to calculate assetHash beforehand (if we can)
    let assetHash = this.hashType === AssetHashType.SOURCE || this.hashType === AssetHashType.CUSTOM
      ? this.calculateHash(this.hashType, bundling)
      : undefined;

    const bundleDir = this.determineBundleDir(this.assetOutdir, assetHash);
    this.bundle(bundling, bundleDir);

    // Check bundling output content and determine if we will need to archive
    const bundlingOutputType = bundling.outputType ?? BundlingOutput.AUTO_DISCOVER;
    const bundledAsset = determineBundledAsset(bundleDir, bundlingOutputType);

    // Calculate assetHash afterwards if we still must
    assetHash = assetHash ?? this.calculateHash(this.hashType, bundling, bundledAsset.path);
    const stagedPath = path.resolve(this.assetOutdir, renderAssetFilename(assetHash, bundledAsset.extension));

    this.stageAsset(bundledAsset.path, stagedPath, 'move');
    return {
      assetHash,
      stagedPath,
      packaging: bundledAsset.packaging,
      isArchive: true, // bundling always produces an archive
    };
  }

  /**
   * Whether staging has been disabled
   */
  private get stagingDisabled() {
    return !!this.node.tryGetContext(cxapi.DISABLE_ASSET_STAGING_CONTEXT);
  }

  /**
   * Copies or moves the files from sourcePath to targetPath.
   *
   * Moving implies the source directory is temporary and can be trashed.
   *
   * Will not do anything if source and target are the same.
   */
  private stageAsset(sourcePath: string, targetPath: string, style: 'move' | 'copy') {
    // Is the work already done?
    const isAlreadyStaged = fs.existsSync(targetPath);
    if (isAlreadyStaged) {
      if (style === 'move' && sourcePath !== targetPath) {
        fs.removeSync(sourcePath);
      }
      return;
    }

    // Moving can be done quickly
    if (style == 'move') {
      fs.renameSync(sourcePath, targetPath);
      return;
    }

    // Copy file/directory to staging directory
    if (this.sourceStats.isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
    } else if (this.sourceStats.isDirectory()) {
      fs.mkdirSync(targetPath);
      FileSystem.copyDirectory(sourcePath, targetPath, this.fingerprintOptions);
    } else {
      throw new Error(`Unknown file type: ${sourcePath}`);
    }
  }

  /**
   * Determine the directory where we're going to write the bundling output
   *
   * This is the target directory where we're going to write the staged output
   * files if we can (if the hash is fully known), or a temporary directory
   * otherwise.
   */
  private determineBundleDir(outdir: string, sourceHash?: string) {
    if (sourceHash) {
      return path.resolve(outdir, renderAssetFilename(sourceHash));
    }

    // When the asset hash isn't known in advance, bundler outputs to an
    // intermediate directory named after the asset's cache key
    return path.resolve(outdir, `bundling-temp-${this.cacheKey}`);
  }

  /**
   * Bundles an asset to the given directory
   *
   * If the given directory already exists, assume that everything's already
   * in order and don't do anything.
   *
   * @param options Bundling options
   * @param bundleDir Where to create the bundle directory
   * @returns The fully resolved bundle output directory.
   */
  private bundle(options: BundlingOptions, bundleDir: string) {
    if (fs.existsSync(bundleDir)) { return; }

    fs.ensureDirSync(bundleDir);
    // Chmod the bundleDir to full access.
    fs.chmodSync(bundleDir, 0o777);

    let user: string;
    if (options.user) {
      user = options.user;
    } else { // Default to current user
      const userInfo = os.userInfo();
      user = userInfo.uid !== -1 // uid is -1 on Windows
        ? `${userInfo.uid}:${userInfo.gid}`
        : '1000:1000';
    }

    // Always mount input and output dir
    const volumes = [
      {
        hostPath: this.sourcePath,
        containerPath: AssetStaging.BUNDLING_INPUT_DIR,
      },
      {
        hostPath: bundleDir,
        containerPath: AssetStaging.BUNDLING_OUTPUT_DIR,
      },
      ...options.volumes ?? [],
    ];

    let localBundling: boolean | undefined;
    try {
      process.stderr.write(`Bundling asset ${this.node.path}...\n`);

      localBundling = options.local?.tryBundle(bundleDir, options);
      if (!localBundling) {
        options.image.run({
          command: options.command,
          user,
          volumes,
          environment: options.environment,
          workingDirectory: options.workingDirectory ?? AssetStaging.BUNDLING_INPUT_DIR,
        });
      }
    } catch (err) {
      // When bundling fails, keep the bundle output for diagnosability, but
      // rename it out of the way so that the next run doesn't assume it has a
      // valid bundleDir.
      const bundleErrorDir = bundleDir + '-error';
      if (fs.existsSync(bundleErrorDir)) {
        // Remove the last bundleErrorDir.
        fs.removeSync(bundleErrorDir);
      }

      fs.renameSync(bundleDir, bundleErrorDir);
      throw new Error(`Failed to bundle asset ${this.node.path}, bundle output is located at ${bundleErrorDir}: ${err}`);
    }

    if (FileSystem.isEmpty(bundleDir)) {
      const outputDir = localBundling ? bundleDir : AssetStaging.BUNDLING_OUTPUT_DIR;
      throw new Error(`Bundling did not produce any output. Check that content is written to ${outputDir}.`);
    }
  }

  private calculateHash(hashType: AssetHashType, bundling?: BundlingOptions, outputDir?: string): string {
    // When bundling a CUSTOM or SOURCE asset hash type, we want the hash to include
    // the bundling configuration. We handle CUSTOM and bundled SOURCE hash types
    // as a special case to preserve existing user asset hashes in all other cases.
    if (hashType == AssetHashType.CUSTOM || (hashType == AssetHashType.SOURCE && bundling)) {
      const hash = crypto.createHash('sha256');

      // if asset hash is provided by user, use it, otherwise fingerprint the source.
      hash.update(this.customSourceFingerprint ?? FileSystem.fingerprint(this.sourcePath, this.fingerprintOptions));

      // If we're bundling an asset, include the bundling configuration in the hash
      if (bundling) {
        hash.update(JSON.stringify(bundling));
      }

      return hash.digest('hex');
    }

    switch (hashType) {
      case AssetHashType.SOURCE:
        return FileSystem.fingerprint(this.sourcePath, this.fingerprintOptions);
      case AssetHashType.BUNDLE:
      case AssetHashType.OUTPUT:
        if (!outputDir) {
          throw new Error(`Cannot use \`${hashType}\` hash type when \`bundling\` is not specified.`);
        }
        return FileSystem.fingerprint(outputDir, this.fingerprintOptions);
      default:
        throw new Error('Unknown asset hash type.');
    }
  }
}

function renderAssetFilename(assetHash: string, extension = '') {
  return `asset.${assetHash}${extension}`;
}

/**
 * Determines the hash type from user-given prop values.
 *
 * @param assetHashType Asset hash type construct prop
 * @param customSourceFingerprint Asset hash seed given in the construct props
 */
function determineHashType(assetHashType?: AssetHashType, customSourceFingerprint?: string) {
  const hashType = customSourceFingerprint
    ? (assetHashType ?? AssetHashType.CUSTOM)
    : (assetHashType ?? AssetHashType.SOURCE);

  if (customSourceFingerprint && hashType !== AssetHashType.CUSTOM) {
    throw new Error(`Cannot specify \`${assetHashType}\` for \`assetHashType\` when \`assetHash\` is specified. Use \`CUSTOM\` or leave \`undefined\`.`);
  }
  if (hashType === AssetHashType.CUSTOM && !customSourceFingerprint) {
    throw new Error('`assetHash` must be specified when `assetHashType` is set to `AssetHashType.CUSTOM`.');
  }

  return hashType;
}

/**
 * Calculates a cache key from the props. Normalize by sorting keys.
 */
function calculateCacheKey<A extends object>(props: A): string {
  return crypto.createHash('sha256')
    .update(JSON.stringify(sortObject(props)))
    .digest('hex');
}

/**
 * Recursively sort object keys
 */
function sortObject(object: { [key: string]: any }): { [key: string]: any } {
  if (typeof object !== 'object' || object instanceof Array) {
    return object;
  }
  const ret: { [key: string]: any } = {};
  for (const key of Object.keys(object).sort()) {
    ret[key] = sortObject(object[key]);
  }
  return ret;
}

/**
 * Returns the single archive file of a directory or undefined
 */
function singleArchiveFile(directory: string): string | undefined {
  if (!fs.existsSync(directory)) {
    throw new Error(`Directory ${directory} does not exist.`);
  }

  if (!fs.statSync(directory).isDirectory()) {
    throw new Error(`${directory} is not a directory.`);
  }

  const content = fs.readdirSync(directory);
  if (content.length === 1) {
    const file = path.join(directory, content[0]);
    const extension = path.extname(content[0]).toLowerCase();
    if (fs.statSync(file).isFile() && ARCHIVE_EXTENSIONS.includes(extension)) {
      return file;
    }
  }

  return undefined;
}

interface BundledAsset {
  path: string,
  packaging: FileAssetPackaging,
  extension?: string
}

/**
 * Returns the bundled asset to use based on the content of the bundle directory
 * and the type of output.
 */
function determineBundledAsset(bundleDir: string, outputType: BundlingOutput): BundledAsset {
  const archiveFile = singleArchiveFile(bundleDir);

  // auto-discover means that if there is an archive file, we take it as the
  // bundle, otherwise, we will archive here.
  if (outputType === BundlingOutput.AUTO_DISCOVER) {
    outputType = archiveFile ? BundlingOutput.ARCHIVED : BundlingOutput.NOT_ARCHIVED;
  }

  switch (outputType) {
    case BundlingOutput.NOT_ARCHIVED:
      return { path: bundleDir, packaging: FileAssetPackaging.ZIP_DIRECTORY };
    case BundlingOutput.ARCHIVED:
      if (!archiveFile) {
        throw new Error('Bundling output directory is expected to include only a single .zip or .jar file when `output` is set to `ARCHIVED`');
      }
      return { path: archiveFile, packaging: FileAssetPackaging.FILE, extension: path.extname(archiveFile) };
  }
}
