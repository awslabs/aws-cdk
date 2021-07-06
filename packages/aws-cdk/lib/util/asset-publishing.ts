import * as cxapi from '@aws-cdk/cx-api';
import * as AWS from 'aws-sdk';
import * as cdk_assets from 'cdk-assets';
import { ISDK, Mode, SdkProvider } from '../api';
import { debug, error, print } from '../logging';

/**
 * Use cdk-assets to publish all assets in the given manifest.
 */
export async function publishAssets(manifest: cdk_assets.AssetManifest, sdk: SdkProvider, targetEnv: cxapi.Environment) {
  // This shouldn't really happen (it's a programming error), but we don't have
  // the types here to guide us. Do an runtime validation to be super super sure.
  if (targetEnv.account === undefined || targetEnv.account === cxapi.UNKNOWN_ACCOUNT
    || targetEnv.region === undefined || targetEnv.account === cxapi.UNKNOWN_REGION) {
    throw new Error(`Asset publishing requires resolved account and region, got ${JSON.stringify(targetEnv)}`);
  }

  const publisher = new cdk_assets.AssetPublishing(manifest, {
    aws: new PublishingAws(sdk, targetEnv),
    progressListener: new PublishingProgressListener(),
    throwOnError: false,
  });
  await publisher.publish();
  if (publisher.hasFailures) {
    throw new Error('Failed to publish one or more assets. See the error messages above for more information.');
  }
}

class PublishingAws implements cdk_assets.IAws {
  constructor(
    /**
     * The base SDK to work with
     */
    private readonly aws: SdkProvider,

    /**
     * Environment where the stack we're deploying is going
     */
    private readonly targetEnv: cxapi.Environment) {
  }

  public async discoverPartition(): Promise<string> {
    return (await this.aws.baseCredentialsPartition(this.targetEnv, Mode.ForWriting)) ?? 'aws';
  }

  public async discoverDefaultRegion(): Promise<string> {
    return this.targetEnv.region;
  }

  public async discoverCurrentAccount(): Promise<cdk_assets.Account> {
    return (await this.sdk({})).currentAccount();
  }

  public async s3Client(options: cdk_assets.ClientOptions): Promise<AWS.S3> {
    return (await this.sdk(options)).s3();
  }

  public async ecrClient(options: cdk_assets.ClientOptions): Promise<AWS.ECR> {
    return (await this.sdk(options)).ecr();
  }

  public async secretsManagerClient(options: cdk_assets.ClientOptions): Promise<AWS.SecretsManager> {
    return (await this.sdk(options)).secretsManager();
  }

  /**
   * Get an SDK appropriate for the given client options
   */
  private sdk(options: cdk_assets.ClientOptions): Promise<ISDK> {
    const env = {
      ...this.targetEnv,
      region: options.region ?? this.targetEnv.region, // Default: same region as the stack
    };

    return this.aws.forEnvironment(env, Mode.ForWriting, {
      assumeRoleArn: options.assumeRoleArn,
      assumeRoleExternalId: options.assumeRoleExternalId,
    });
  }
}

const EVENT_TO_LOGGER: Record<cdk_assets.EventType, (x: string) => void> = {
  build: debug,
  cached: debug,
  check: debug,
  debug,
  fail: error,
  found: debug,
  start: print,
  success: print,
  upload: debug,
};

class PublishingProgressListener implements cdk_assets.IPublishProgressListener {
  public onPublishEvent(type: cdk_assets.EventType, event: cdk_assets.IPublishProgress): void {
    EVENT_TO_LOGGER[type](`[${event.percentComplete}%] ${type}: ${event.message}`);
  }
}
