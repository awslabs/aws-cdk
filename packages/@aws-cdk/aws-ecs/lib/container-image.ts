import * as ecr from '@aws-cdk/aws-ecr';
import { ImageAsset } from '@aws-cdk/core';
import { ContainerDefinition } from './container-definition';
import { CfnTaskDefinition } from './ecs.generated';

// v2 - keep this import as a separate section to reduce merge conflict when forward merging with the v2 branch.
// eslint-disable-next-line
import { Construct as CoreConstruct } from '@aws-cdk/core';

/**
 * Constructs for types of container images
 */
export abstract class ContainerImage {
  /**
   * Reference an image on DockerHub or another online registry
   */
  public static fromRegistry(name: string, props: RepositoryImageProps = {}) {
    return new RepositoryImage(name, props);
  }

  /**
   * Reference an image in an ECR repository
   */
  public static fromEcrRepository(repository: ecr.IRepository, tag: string = 'latest') {
    return new EcrImage(repository, tag);
  }

  /**
   * Reference an image that's constructed directly from sources on disk.
   *
   * If you already have a `DockerImageAsset` instance, you can use the
   * `ContainerImage.fromDockerImageAsset` method instead.
   *
   * @param directory The directory containing the Dockerfile
   */
  public static fromAsset(directory: string, props: AssetImageProps = {}) {
    return new AssetImage(directory, props);
  }

  /**
   * Use an existing `DockerImageAsset` for this container image.
   *
   * @param asset The `DockerImageAsset` to use for this container definition.
   *
   * @deprecated use fromImageAsset instead
   */
  public static fromDockerImageAsset(asset: DockerImageAsset): ContainerImage {
    return {
      bind(_scope: CoreConstruct, containerDefinition: ContainerDefinition): ContainerImageConfig {
        asset.repository.grantPull(containerDefinition.taskDefinition.obtainExecutionRole());
        return {
          imageName: asset.imageUri,
        };
      },
    };
  }

  /**
   * Use an existing `ImageAsset` for this container image.
   *
   * @param asset The `ImageAsset` to use for this container definition.
   */
  public static fromImageAsset(asset: ImageAsset): ContainerImage {
    return {
      bind(_scope: CoreConstruct, containerDefinition: ContainerDefinition): ContainerImageConfig {
        const assetRepo = ecr.Repository.fromRepositoryName(asset, 'AssetImageEcrRepository', asset.repositoryName);
        assetRepo.grantPull(containerDefinition.taskDefinition.obtainExecutionRole());
        return {
          imageName: asset.imageUri,
        };
      },
    };
  }

  /**
   * Called when the image is used by a ContainerDefinition
   */
  public abstract bind(scope: CoreConstruct, containerDefinition: ContainerDefinition): ContainerImageConfig;
}

/**
 * The configuration for creating a container image.
 */
export interface ContainerImageConfig {
  /**
   * Specifies the name of the container image.
   */
  readonly imageName: string;

  /**
   * Specifies the credentials used to access the image repository.
   */
  readonly repositoryCredentials?: CfnTaskDefinition.RepositoryCredentialsProperty;
}

import { DockerImageAsset } from '@aws-cdk/aws-ecr-assets';
import { AssetImage, AssetImageProps } from './images/asset-image';
import { EcrImage } from './images/ecr';
import { RepositoryImage, RepositoryImageProps } from './images/repository';
