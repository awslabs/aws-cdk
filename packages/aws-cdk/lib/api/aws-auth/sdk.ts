import * as AWS from 'aws-sdk';
import { ConfigurationOptions } from 'aws-sdk/lib/config';
import { debug } from '../../logging';
import { cached } from '../../util/functions';
import { AccountAccessKeyCache } from './account-cache';
import { Account } from './sdk-provider';

/** @experimental */
export interface ISDK {
  /**
   * The region this SDK has been instantiated for
   *
   * (As distinct from the `defaultRegion()` on SdkProvider which
   * represents the region configured in the default config).
   */
  readonly currentRegion: string;

  /**
   * The Account this SDK has been instantiated for
   *
   * (As distinct from the `defaultAccount()` on SdkProvider which
   * represents the account available by using default credentials).
   */
  currentAccount(): Promise<Account>;

  cloudFormation(): AWS.CloudFormation;
  ec2(): AWS.EC2;
  ssm(): AWS.SSM;
  s3(): AWS.S3;
  route53(): AWS.Route53;
  ecr(): AWS.ECR;
}

/**
 * Base functionality of SDK without credential fetching
 */
export class SDK implements ISDK {
  private static readonly accountCache = new AccountAccessKeyCache();

  public readonly currentRegion: string;

  private readonly config: ConfigurationOptions;

  private readonly localstackEndpoint?: string;

  /**
   * Default retry options for SDK clients
   *
   * Biggest bottleneck is CloudFormation, with a 1tps call rate. We want to be
   * a little more tenacious than the defaults, and with a little more breathing
   * room between calls (defaults are {retries=3, base=100}).
   *
   * I've left this running in a tight loop for an hour and the throttle errors
   * haven't escaped the retry mechanism.
   */
  private readonly retryOptions = { maxRetries: 6, retryDelayOptions: { base: 300 }};

  // tslint:disable-next-line: max-line-length
  constructor(private readonly credentials: AWS.Credentials, region: string, httpOptions: ConfigurationOptions = {}, localstackEndpoint?: string) {
    this.config = {
      ...httpOptions,
      ...this.retryOptions,
      credentials,
      region,
    };
    this.currentRegion = region;
    this.localstackEndpoint = localstackEndpoint;
  }

  public cloudFormation(): AWS.CloudFormation {
    return new AWS.CloudFormation({
      ...this.config,
      endpoint: this.localstackEndpoint,
    });
  }

  public ec2(): AWS.EC2 {
    return new AWS.EC2({
      ...this.config,
      endpoint: this.localstackEndpoint,
    });
  }

  public ssm(): AWS.SSM {
    return new AWS.SSM({
      ...this.config,
      endpoint: this.localstackEndpoint,
    });
  }

  public s3(): AWS.S3 {
    return new AWS.S3({
      ...this.config,
      endpoint: this.localstackEndpoint,
    });
  }

  public route53(): AWS.Route53 {
    return new AWS.Route53({
      ...this.config,
      endpoint: this.localstackEndpoint,
    });
  }

  public ecr(): AWS.ECR {
    return new AWS.ECR({
      ...this.config,
      endpoint: this.localstackEndpoint,
    });
  }

  public async currentAccount(): Promise<Account> {
    return cached(this, CURRENT_ACCOUNT_KEY, () => SDK.accountCache.fetch(this.credentials.accessKeyId, async () => {
      // if we don't have one, resolve from STS and store in cache.
      debug('Looking up default account ID from STS');
      const result = await new AWS.STS(this.config).getCallerIdentity().promise();
      const accountId = result.Account;
      const partition = result.Arn!.split(':')[1];
      if (!accountId) {
        throw new Error('STS didn\'t return an account ID');
      }
      debug('Default account ID:', accountId);
      return { accountId, partition };
    }));
  }
}

const CURRENT_ACCOUNT_KEY = Symbol('current_account_key');
