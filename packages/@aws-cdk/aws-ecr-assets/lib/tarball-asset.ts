import * as fs from 'fs';
import * as path from 'path';
import * as ecr from '@aws-cdk/aws-ecr';
import { AssetStaging, Stack, Stage } from '@aws-cdk/core';
import { Construct } from 'constructs';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line
import { IAsset } from '@aws-cdk/assets';
// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct as CoreConstruct } from '@aws-cdk/core';

/**
 * Options for TarballImageAsset
 */
export interface TarballImageAssetProps {
  /**
   * Path to the tarball.
   */
  readonly tarballFile: string;
}

/**
 * An asset that represents a Docker image.
 *
 * The image will loaded from an existing tarball and uploaded to an ECR repository.
 */
export class TarballImageAsset extends CoreConstruct implements IAsset {
  /**
   * The full URI of the image (including a tag). Use this reference to pull
   * the asset.
   */
  public imageUri: string;

  /**
   * Repository where the image is stored
   */
  public repository: ecr.IRepository;

  /**
   * A hash of the source of this asset, which is available at construction time. As this is a plain
   * string, it can be used in construct IDs in order to enforce creation of a new resource when
   * the content hash has changed.
   * @deprecated use assetHash
   */
  public readonly sourceHash: string;

  /**
   * A hash of this asset, which is available at construction time. As this is a plain string, it
   * can be used in construct IDs in order to enforce creation of a new resource when the content
   * hash has changed.
   */
  public readonly assetHash: string;

  constructor(scope: Construct, id: string, props: TarballImageAssetProps) {
    super(scope, id);

    if (!fs.existsSync(props.tarballFile)) {
      throw new Error(`Cannot find file at ${props.tarballFile}`);
    }

    const stagedTarball = new AssetStaging(this, 'Staging', { sourcePath: props.tarballFile });

    this.sourceHash = stagedTarball.assetHash;
    this.assetHash = stagedTarball.assetHash;

    const stage = Stage.of(this);
    const relativePathInOutDir = stage ? path.relative(stage.assetOutdir, stagedTarball.absoluteStagedPath) : stagedTarball.absoluteStagedPath;

    const stack = Stack.of(this);
    const location = stack.synthesizer.addDockerImageAsset({
      sourceHash: stagedTarball.assetHash,
      executable: [
        'sh',
        '-c',
        `docker load -i ${relativePathInOutDir} | sed "s/Loaded image: //g"`,
      ],
    });

    this.repository = ecr.Repository.fromRepositoryName(this, 'Repository', location.repositoryName);
    this.imageUri = location.imageUri;
  }
}

