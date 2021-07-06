import * as os from 'os';

/**
 * AWS SDK operations required by Asset Publishing
 */
export interface IAws {
  discoverPartition(): Promise<string>;
  discoverDefaultRegion(): Promise<string>;
  discoverCurrentAccount(): Promise<Account>;

  s3Client(options: ClientOptions): Promise<AWS.S3>;
  ecrClient(options: ClientOptions): Promise<AWS.ECR>;
  secretsManagerClient(options: ClientOptions): Promise<AWS.SecretsManager>;
}

export interface ClientOptions {
  region?: string;
  assumeRoleArn?: string;
  assumeRoleExternalId?: string;
}

/**
 * An AWS account
 *
 * An AWS account always exists in only one partition. Usually we don't care about
 * the partition, but when we need to form ARNs we do.
 */
export interface Account {
  /**
   * The account number
   */
  readonly accountId: string;

  /**
   * The partition ('aws' or 'aws-cn' or otherwise)
   */
  readonly partition: string;
}

/**
 * AWS client using the AWS SDK for JS with no special configuration
 */
export class DefaultAwsClient implements IAws {
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

  public async secretsManagerClient(options: ClientOptions) {
    return new this.AWS.SecretsManager(await this.awsOptions(options));
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
        throw new Error(`Unrecognized reponse from STS: '${JSON.stringify(response)}'`);
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
      customUserAgent: 'cdk-assets',
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
    return new this.AWS.ChainableTemporaryCredentials({
      params: {
        RoleArn: roleArn,
        ExternalId: externalId,
        RoleSessionName: `cdk-assets-${safeUsername()}`,
      },
      stsConfig: {
        region,
        customUserAgent: 'cdk-assets',
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

