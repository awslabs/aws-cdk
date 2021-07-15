import * as path from 'path';
import { parse as parseUrl } from 'url';
import * as cxapi from '@aws-cdk/cx-api';
import { AssetManifestReader, DockerImageManifestEntry, FileManifestEntry } from '../private/asset-manifest';
import { isAssetManifest } from '../private/cloud-assembly-internals';
import { AssetType } from './asset-type';

/**
 * Properties for a `StackDeployment`
 */
export interface StackDeploymentProps {
  /**
   * Artifact ID for this stack
   */
  readonly stackArtifactId: string;

  /**
   * Construct path for this stack
   */
  readonly constructPath: string;

  /**
   * Name for this stack
   */
  readonly stackName: string;

  /**
   * Region where the stack should be deployed
   *
   * @default - Pipeline region
   */
  readonly region?: string;

  /**
   * Account where the stack should be deployed
   *
   * @default - Pipeline account
   */
  readonly account?: string;

  /**
   * Role to assume before deploying this stack
   *
   * @default - Don't assume any role
   */
  readonly assumeRoleArn?: string;

  /**
   * Execution role to pass to CloudFormation
   *
   * @default - No execution role
   */
  readonly executionRoleArn?: string;

  /**
   * Tags to apply to the stack
   *
   * @default - No tags
   */
  readonly tags?: Record<string, string>;

  /**
   * Template path on disk to cloud assembly (cdk.out)
   */
  readonly absoluteTemplatePath: string;

  /**
   * Assets referenced by this stack
   *
   * @default - No assets
   */
  readonly assets?: StackAsset[];

  /**
   * The S3 URL which points to the template asset location in the publishing
   * bucket.
   *
   * @default - Stack template is not published
   */
  readonly templateS3Uri?: string;
}

/**
 * Deployment of a single Stack
 *
 * You don't need to instantiate this class -- it will
 * be automatically instantiated as necessary when you
 * add a `Stage` to a pipeline.
 */
export class StackDeployment {
  /**
   * Build a `StackDeployment` from a Stack Artifact in a Cloud Assembly.
   */
  public static fromArtifact(stackArtifact: cxapi.CloudFormationStackArtifact): StackDeployment {
    const artRegion = stackArtifact.environment.region;
    const region = artRegion === cxapi.UNKNOWN_REGION ? undefined : artRegion;
    const artAccount = stackArtifact.environment.account;
    const account = artAccount === cxapi.UNKNOWN_ACCOUNT ? undefined : artAccount;

    return new StackDeployment({
      account,
      region,
      tags: stackArtifact.tags,
      stackArtifactId: stackArtifact.id,
      constructPath: stackArtifact.hierarchicalId,
      stackName: stackArtifact.stackName,
      absoluteTemplatePath: path.join(stackArtifact.assembly.directory, stackArtifact.templateFile),
      assumeRoleArn: stackArtifact.assumeRoleArn,
      executionRoleArn: stackArtifact.cloudFormationExecutionRoleArn,
      assets: extractStackAssets(stackArtifact),
      templateS3Uri: stackArtifact.stackTemplateAssetObjectUrl,
    });
  }

  /**
   * Artifact ID for this stack
   */
  public readonly stackArtifactId: string;

  /**
   * Construct path for this stack
   */
  public readonly constructPath: string;

  /**
   * Name for this stack
   */
  public readonly stackName: string;

  /**
   * Region where the stack should be deployed
   *
   * @default - Pipeline region
   */
  public readonly region?: string;

  /**
   * Account where the stack should be deployed
   *
   * @default - Pipeline account
   */
  public readonly account?: string;

  /**
   * Role to assume before deploying this stack
   *
   * @default - Don't assume any role
   */
  public readonly assumeRoleArn?: string;

  /**
   * Execution role to pass to CloudFormation
   *
   * @default - No execution role
   */
  public readonly executionRoleArn?: string;

  /**
   * Tags to apply to the stack
   */
  public readonly tags: Record<string, string>;

  /**
   * Assets referenced by this stack
   */
  public readonly assets: StackAsset[];

  /**
   * Other stacks this stack depends on
   */
  public readonly stackDependencies: StackDeployment[] = [];

  /**
   * The asset that represents the CloudFormation template for this stack.
   */
  public readonly templateAsset?: StackAsset;

  /**
   * The S3 URL which points to the template asset location in the publishing
   * bucket.
   *
   * This is `undefined` if the stack template is not published. Use the
   * `DefaultStackSynthesizer` to ensure it is.
   *
   * @example https://bucket.s3.amazonaws.com/object/key
   */
  public readonly templateUrl?: string;

  /**
   * Template path on disk to CloudAssembly
   */
  public readonly absoluteTemplatePath: string;

  private constructor(props: StackDeploymentProps) {
    this.stackArtifactId = props.stackArtifactId;
    this.constructPath = props.constructPath;
    this.account = props.account;
    this.region = props.region;
    this.tags = props.tags ?? {};
    this.assumeRoleArn = props.assumeRoleArn;
    this.executionRoleArn = props.executionRoleArn;
    this.stackName = props.stackName;
    this.absoluteTemplatePath = props.absoluteTemplatePath;
    this.templateUrl = props.templateS3Uri ? s3UrlFromUri(props.templateS3Uri, props.region) : undefined;

    this.assets = new Array<StackAsset>();

    for (const asset of props.assets ?? []) {
      if (asset.isTemplate) {
        this.templateAsset = asset;
      } else {
        this.assets.push(asset);
      }
    }
  }

  /**
   * Add a dependency on another stack
   */
  public addStackDependency(stackDeployment: StackDeployment) {
    this.stackDependencies.push(stackDeployment);
  }
}

/**
 * An asset used by a Stack
 */
export interface StackAsset {
  /**
   * Absolute asset manifest path
   *
   * This needs to be made relative at a later point in time, but when this
   * information is parsed we don't know about the root cloud assembly yet.
   */
  readonly assetManifestPath: string;

  /**
   * Asset identifier
   */
  readonly assetId: string;

  /**
   * Asset selector to pass to `cdk-assets`.
   */
  readonly assetSelector: string;

  /**
   * Type of asset to publish
   */
  readonly assetType: AssetType;

  /**
   * Role ARN to assume to publish
   *
   * @default - No need to assume any role
   */
  readonly assetPublishingRoleArn?: string;

  /**
   * Does this asset represent the CloudFormation template for the stack
   *
   * @default false
   */
  readonly isTemplate: boolean;
}

function extractStackAssets(stackArtifact: cxapi.CloudFormationStackArtifact): StackAsset[] {
  const ret = new Array<StackAsset>();

  const assetManifests = stackArtifact.dependencies.filter(isAssetManifest);
  for (const manifestArtifact of assetManifests) {
    const manifest = AssetManifestReader.fromFile(manifestArtifact.file);

    for (const entry of manifest.entries) {
      let assetType: AssetType;
      let isTemplate = false;

      if (entry instanceof DockerImageManifestEntry) {
        assetType = AssetType.DOCKER_IMAGE;
      } else if (entry instanceof FileManifestEntry) {
        isTemplate = entry.source.packaging === 'file' && entry.source.path === stackArtifact.templateFile;
        assetType = AssetType.FILE;
      } else {
        throw new Error(`Unrecognized asset type: ${entry.type}`);
      }

      ret.push({
        assetManifestPath: manifestArtifact.file,
        assetId: entry.id.assetId,
        assetSelector: entry.id.toString(),
        assetType,
        assetPublishingRoleArn: entry.destination.assumeRoleArn,
        isTemplate,
      });
    }
  }

  return ret;
}

/**
 * Takes an s3://bucket/object-key uri and returns a region-aware https:// url for it
 *
 * @param uri The s3 URI
 * @param region The region (if undefined, we will return the global endpoint)
 * @see https://docs.aws.amazon.com/AmazonS3/latest/userguide/VirtualHosting.html#virtual-hosted-style-access
 */
function s3UrlFromUri(uri: string, region: string | undefined) {
  const url = parseUrl(uri);
  return `https://${url.hostname}.s3.${region ? `${region}.` : ''}amazonaws.com${url.path}`;
}