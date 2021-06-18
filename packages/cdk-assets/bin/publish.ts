import * as os from 'os';
import {
  AssetManifest, AssetPublishing, ClientOptions, DestinationPattern, EventType, IAws,
  IPublishProgress, IPublishProgressListener,
} from '../lib';
import { Account } from '../lib/aws';
import { log, LogLevel, VERSION } from './logging';

export async function publish(args: {
  path: string;
  assets?: string[];
  profile?: string;
}) {
  let manifest = AssetManifest.fromPath(args.path);
  log('verbose', `Loaded manifest from ${args.path}: ${manifest.entries.length} assets found`);

  if (args.assets && args.assets.length > 0) {
    const selection = args.assets.map(a => DestinationPattern.parse(a));
    manifest = manifest.select(selection);
    log('verbose', `Applied selection: ${manifest.entries.length} assets selected.`);
  }

  const pub = new AssetPublishing(manifest, {
    aws: new DefaultAwsClient(args.profile),
    progressListener: new ConsoleProgress(),
    throwOnError: false,
  });

  await pub.publish();

  if (pub.hasFailures) {
    for (const failure of pub.failures) {
      // eslint-disable-next-line no-console
      console.error('Failure:', failure.error.stack);
    }

    process.exitCode = 1;
  }
}

const EVENT_TO_LEVEL: Record<EventType, LogLevel> = {
  build: 'verbose',
  cached: 'verbose',
  check: 'verbose',
  debug: 'verbose',
  fail: 'error',
  found: 'verbose',
  start: 'info',
  success: 'info',
  upload: 'verbose',
};

class ConsoleProgress implements IPublishProgressListener {
  public onPublishEvent(type: EventType, event: IPublishProgress): void {
    log(EVENT_TO_LEVEL[type], `[${event.percentComplete}%] ${type}: ${event.message}`);
  }
}

/**
 * AWS client using the AWS SDK for JS with no special configuration
 */
class DefaultAwsClient implements IAws {
  private readonly AWS: typeof import('aws-sdk');
  private account?: Account;

  constructor(profile?: string) {
    // Force AWS SDK to look in ~/.aws/credentials and potentially use the configured profile.
    process.env.AWS_SDK_LOAD_CONFIG = '1';
    process.env.AWS_STS_REGIONAL_ENDPOINTS = 'regional';
    process.env.AWS_NODEJS_CONNECTION_REUSE_ENABLED = '1';
    if (profile) {
      process.env.AWS_PROFILE = profile;
    }

    // We need to set the environment before we load this library for the first time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    this.AWS = require('aws-sdk');
  }

  public async s3Client(options: ClientOptions) {
    return new this.AWS.S3(await this.awsOptions(options));
  }

  public async ecrClient(options: ClientOptions) {
    return new this.AWS.ECR(await this.awsOptions(options));
  }

  public async discoverPartition(): Promise<string> {
    return (await this.discoverCurrentAccount()).partition;
  }

  public async discoverDefaultRegion(): Promise<string> {
    return this.AWS.config.region || 'us-east-1';
  }

  public async discoverCurrentAccount(): Promise<Account> {
    if (this.account === undefined) {
      const sts = new this.AWS.STS();
      const response = await sts.getCallerIdentity().promise();
      if (!response.Account || !response.Arn) {
        log('error', `Unrecognized reponse from STS: '${JSON.stringify(response)}'`);
        throw new Error('Unrecognized reponse from STS');
      }
      this.account = {
        accountId: response.Account!,
        partition: response.Arn!.split(':')[1],
      };
    }

    return this.account;
  }

  private async awsOptions(options: ClientOptions) {
    let credentials;

    if (options.assumeRoleArn) {
      credentials = await this.assumeRole(options.region, options.assumeRoleArn, options.assumeRoleExternalId);
    }

    return {
      region: options.region,
      customUserAgent: `cdk-assets/${VERSION}`,
      credentials,
    };
  }

  /**
   * Explicit manual AssumeRole call
   *
   * Necessary since I can't seem to get the built-in support for ChainableTemporaryCredentials to work.
   *
   * It needs an explicit configuration of `masterCredentials`, we need to put
   * a `DefaultCredentialProverChain()` in there but that is not possible.
   */
  private async assumeRole(region: string | undefined, roleArn: string, externalId?: string): Promise<AWS.Credentials> {
    const msg = [
      `Assume ${roleArn}`,
      ...externalId ? [`(ExternalId ${externalId})`] : [],
    ];
    log('verbose', msg.join(' '));

    return new this.AWS.ChainableTemporaryCredentials({
      params: {
        RoleArn: roleArn,
        ExternalId: externalId,
        RoleSessionName: `cdk-assets-${safeUsername()}`,
      },
      stsConfig: {
        region,
        customUserAgent: `cdk-assets/${VERSION}`,
      },
    });
  }
}

/**
 * Return the username with characters invalid for a RoleSessionName removed
 *
 * @see https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#API_AssumeRole_RequestParameters
 */
function safeUsername() {
  return os.userInfo().username.replace(/[^\w+=,.@-]/g, '@');
}