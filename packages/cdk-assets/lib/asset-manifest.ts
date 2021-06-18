import * as fs from 'fs';
import * as path from 'path';
import {
  AssetManifest as AssetManifestSchema, DockerImageDestination, DockerImageSource,
  FileDestination, FileSource, Manifest,
} from '@aws-cdk/cloud-assembly-schema';

/**
 * A manifest of assets
 */
export class AssetManifest {
  /**
   * The default name of the asset manifest in a cdk.out directory
   */
  public static readonly DEFAULT_FILENAME = 'assets.json';

  /**
   * Load an asset manifest from the given file
   */
  public static fromFile(fileName: string) {
    try {
      const obj = Manifest.loadAssetManifest(fileName);
      return new AssetManifest(path.dirname(fileName), obj);
    } catch (e) {
      throw new Error(`Canot read asset manifest '${fileName}': ${e.message}`);
    }
  }

  /**
   * Load an asset manifest from the given file or directory
   *
   * If the argument given is a directoy, the default asset file name will be used.
   */
  public static fromPath(filePath: string) {
    let st;
    try {
      st = fs.statSync(filePath);
    } catch (e) {
      throw new Error(`Cannot read asset manifest at '${filePath}': ${e.message}`);
    }
    if (st.isDirectory()) {
      return AssetManifest.fromFile(path.join(filePath, AssetManifest.DEFAULT_FILENAME));
    }
    return AssetManifest.fromFile(filePath);
  }

  /**
   * The directory where the manifest was found
   */
  public readonly directory: string;

  constructor(directory: string, private readonly manifest: AssetManifestSchema) {
    this.directory = directory;
  }

  /**
   * Select a subset of assets and destinations from this manifest.
   *
   * Only assets with at least 1 selected destination are retained.
   *
   * If selection is not given, everything is returned.
   */
  public select(selection?: DestinationPattern[]): AssetManifest {
    if (selection === undefined) { return this; }

    const ret: AssetManifestSchema & Required<Pick<AssetManifestSchema, AssetType>>
     = { version: this.manifest.version, dockerImages: {}, files: {} };

    for (const assetType of ASSET_TYPES) {
      for (const [assetId, asset] of Object.entries(this.manifest[assetType] || {})) {
        const filteredDestinations = filterDict(
          asset.destinations,
          (_, destId) => selection.some(sel => sel.matches(new DestinationIdentifier(assetId, destId))));

        if (Object.keys(filteredDestinations).length > 0) {
          ret[assetType][assetId] = {
            ...asset,
            destinations: filteredDestinations,
          };
        }
      }
    }

    return new AssetManifest(this.directory, ret);
  }

  /**
   * Describe the asset manifest as a list of strings
   */
  public list() {
    return [
      ...describeAssets('file', this.manifest.files || {}),
      ...describeAssets('docker-image', this.manifest.dockerImages || {}),
    ];

    function describeAssets(type: string, assets: Record<string, { source: any, destinations: Record<string, any> }>) {
      const ret = new Array<string>();
      for (const [assetId, asset] of Object.entries(assets || {})) {
        ret.push(`${assetId} ${type} ${JSON.stringify(asset.source)}`);

        const destStrings = Object.entries(asset.destinations).map(([destId, dest]) => ` ${assetId}:${destId} ${JSON.stringify(dest)}`);
        ret.push(...prefixTreeChars(destStrings, '  '));
      }
      return ret;
    }
  }

  /**
   * List of assets, splat out to destinations
   */
  public get entries(): IManifestEntry[] {
    return [
      ...makeEntries(this.manifest.files || {}, FileManifestEntry),
      ...makeEntries(this.manifest.dockerImages || {}, DockerImageManifestEntry),
    ];

    function makeEntries<A, B, C>(
        assets: Record<string, { source: A, destinations: Record<string, B> }>,
        ctor: new (id: DestinationIdentifier, source: A, destination: B) => C): C[] {
      const ret = new Array<C>();
      for (const [assetId, asset] of Object.entries(assets)) {
        for (const [destId, destination] of Object.entries(asset.destinations)) {
          ret.push(new ctor(new DestinationIdentifier(assetId, destId), asset.source, destination));
        }
      }
      return ret;
    }
  }
}

type AssetType = 'files' | 'dockerImages';

const ASSET_TYPES: AssetType[] = ['files', 'dockerImages'];

/**
 * A single asset from an asset manifest'
 */
export interface IManifestEntry {
  /**
   * The identifier of the asset
   */
  readonly id: DestinationIdentifier;

  /**
   * The type of asset
   */
  readonly type: string;

  /**
   * Type-dependent source data
   */
  readonly genericSource: unknown;

  /**
   * Type-dependent destination data
   */
  readonly genericDestination: unknown;
}

/**
 * A manifest entry for a file asset
 */
export class FileManifestEntry implements IManifestEntry {
  public readonly genericSource: unknown;
  public readonly genericDestination: unknown;
  public readonly type = 'file';

  constructor(
    /** Identifier for this asset */
    public readonly id: DestinationIdentifier,
    /** Source of the file asset */
    public readonly source: FileSource,
    /** Destination for the file asset */
    public readonly destination: FileDestination,
  ) {
    this.genericSource = source;
    this.genericDestination = destination;
  }
}

/**
 * A manifest entry for a docker image asset
 */
export class DockerImageManifestEntry implements IManifestEntry {
  public readonly genericSource: unknown;
  public readonly genericDestination: unknown;
  public readonly type = 'docker-image';

  constructor(
    /** Identifier for this asset */
    public readonly id: DestinationIdentifier,
    /** Source of the file asset */
    public readonly source: DockerImageSource,
    /** Destination for the file asset */
    public readonly destination: DockerImageDestination,
  ) {
    this.genericSource = source;
    this.genericDestination = destination;
  }
}

/**
 * Identify an asset destination in an asset manifest
 */
export class DestinationIdentifier {
  /**
   * Identifies the asset, by source.
   */
  public readonly assetId: string;

  /**
   * Identifies the destination where this asset will be published
   */
  public readonly destinationId: string;

  constructor(assetId: string, destinationId: string) {
    this.assetId = assetId;
    this.destinationId = destinationId;
  }

  /**
   * Return a string representation for this asset identifier
   */
  public toString() {
    return this.destinationId ? `${this.assetId}:${this.destinationId}` : this.assetId;
  }
}

function filterDict<A>(xs: Record<string, A>, pred: (x: A, key: string) => boolean): Record<string, A> {
  const ret: Record<string, A> = {};
  for (const [key, value] of Object.entries(xs)) {
    if (pred(value, key)) {
      ret[key] = value;
    }
  }
  return ret;
}

/**
 * A filter pattern for an destination identifier
 */
export class DestinationPattern {
  /**
   * Parse a ':'-separated string into an asset/destination identifier
   */
  public static parse(s: string) {
    if (!s) { throw new Error('Empty string is not a valid destination identifier'); }
    const parts = s.split(':').map(x => x !== '*' ? x : undefined);
    if (parts.length === 1) { return new DestinationPattern(parts[0]); }
    if (parts.length === 2) { return new DestinationPattern(parts[0] || undefined, parts[1] || undefined); }
    throw new Error(`Asset identifier must contain at most 2 ':'-separated parts, got '${s}'`);
  }

  /**
   * Identifies the asset, by source.
   */
  public readonly assetId?: string;

  /**
   * Identifies the destination where this asset will be published
   */
  public readonly destinationId?: string;

  constructor(assetId?: string, destinationId?: string) {
    this.assetId = assetId;
    this.destinationId = destinationId;
  }

  /**
   * Whether or not this pattern matches the given identifier
   */
  public matches(id: DestinationIdentifier) {
    return (this.assetId === undefined || this.assetId === id.assetId)
    && (this.destinationId === undefined || this.destinationId === id.destinationId);
  }

  /**
   * Return a string representation for this asset identifier
   */
  public toString() {
    return `${this.assetId ?? '*'}:${this.destinationId ?? '*'}`;
  }
}

/**
 * Prefix box-drawing characters to make lines look like a hanging tree
 */
function prefixTreeChars(xs: string[], prefix = '') {
  const ret = new Array<string>();
  for (let i = 0; i < xs.length; i++) {
    const isLast = i === xs.length - 1;
    const boxChar = isLast ? '└' : '├';
    ret.push(`${prefix}${boxChar}${xs[i]}`);
  }
  return ret;
}
