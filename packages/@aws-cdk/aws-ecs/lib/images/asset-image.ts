import * as ecr from '@aws-cdk/aws-ecr';
import * as ecr_assets from '@aws-cdk/aws-ecr-assets';
import { ImageAsset, ImageAssetOptions } from '@aws-cdk/core';
import { ContainerDefinition } from '../container-definition';
import { ContainerImage, ContainerImageConfig } from '../container-image';
import { toSymlinkFollow } from '../private/follow';

// v2 - keep this import as a separate section to reduce merge conflict when forward merging with the v2 branch.
// eslint-disable-next-line
import { Construct as CoreConstruct } from '@aws-cdk/core';

/**
 * The properties for building an AssetImage.
 */
export interface AssetImageProps extends ecr_assets.DockerImageAssetOptions, ImageAssetOptions {
}

/**
 * An image that will be built from a local directory with a Dockerfile
 */
export class AssetImage extends ContainerImage {
  /**
   * Constructs a new instance of the AssetImage class.
   *
   * @param directory The directory containing the Dockerfile
   */
  constructor(private readonly directory: string, private readonly props: AssetImageProps = {}) {
    super();
  }

  public bind(scope: CoreConstruct, containerDefinition: ContainerDefinition): ContainerImageConfig {
    const asset = new ImageAsset(scope, 'AssetImage', {
      directory: this.directory,
      ...this.props,
      followSymlinks: this.props.followSymlinks ?? toSymlinkFollow(this.props.follow),
    });

    const assetRepo = ecr.Repository.fromRepositoryName(asset, 'AssetImageEcrRepository', asset.repositoryName);
    assetRepo.grantPull(containerDefinition.taskDefinition.obtainExecutionRole());

    return {
      imageName: asset.imageUri,
    };
  }
}
