import * as ecr from '@aws-cdk/aws-ecr';
import * as assets from "@aws-cdk/aws-ecr-assets";
import * as cdk from '@aws-cdk/core';
import { Model } from './model';

/**
 * The configuration for creating a container image.
 */
export interface ContainerImageConfig {
  /**
   * The image name. Images in Amazon ECR repositories can be specified by either using the full registry/repository:tag or
   * registry/repository@digest.
   *
   * For example, 012345678910.dkr.ecr.<region-name>.amazonaws.com/<repository-name>:latest or
   * 012345678910.dkr.ecr.<region-name>.amazonaws.com/<repository-name>@sha256:94afd1f2e64d908bc90dbca0035a5b567EXAMPLE.
   */
  readonly imageName: string;
}

/**
 * Constructs for types of container images
 */
export abstract class ContainerImage {
  /**
   * Reference an image in an ECR repository
   */
  public static fromEcrRepository(repository: ecr.IRepository, tag: string = 'latest'): ContainerImage {
    return new EcrImage(repository, tag);
  }

  /**
   * Reference an image that's constructed directly from sources on disk
   *
   * @param scope The scope within which to create the image asset
   * @param id The id to assign to the image asset
   * @param props The properties of a Docker image asset
   */
  public static fromAsset(scope: cdk.Construct, id: string, props: assets.DockerImageAssetProps): ContainerImage {
    return new AssetImage(scope, id, props);
  }

  /**
   * Called when the image is used by a Model
   */
  public abstract bind(scope: cdk.Construct, model: Model): ContainerImageConfig;
}

class EcrImage extends ContainerImage {
  constructor(private readonly repository: ecr.IRepository, private readonly tag: string) {
    super();
  }

  public bind(_scope: cdk.Construct, model: Model): ContainerImageConfig {
    this.repository.grantPull(model);

    return {
      imageName: this.repository.repositoryUriForTag(this.tag)
    };
  }
}

class AssetImage extends ContainerImage {
  private readonly asset: assets.DockerImageAsset;

  constructor(readonly scope: cdk.Construct, readonly id: string, readonly props: assets.DockerImageAssetProps) {
    super();
    this.asset = new assets.DockerImageAsset(scope, id, props);
  }

  public bind(_scope: cdk.Construct, model: Model): ContainerImageConfig {
    this.asset.repository.grantPull(model);

    return {
      imageName: this.asset.imageUri,
    };
  }
}
