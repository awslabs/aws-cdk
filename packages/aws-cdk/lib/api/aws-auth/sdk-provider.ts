import * as cxapi from '@aws-cdk/cx-api';
import * as AWS from 'aws-sdk';
import { ConfigurationOptions } from 'aws-sdk/lib/config';
import * as fs from 'fs-extra';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import { debug } from '../../logging';
import { cached } from '../../util/functions';
import { CredentialPlugins } from '../aws-auth/credential-plugins';
import { Mode } from '../aws-auth/credentials';
import { AwsCliCompatible } from './awscli-compatible';
import { ISDK, SDK } from './sdk';

/**
 * Options for the default SDK provider
 */
export interface SdkProviderOptions {
  /**
   * Profile to read from ~/.aws
   *
   * @default - No profile
   */
  readonly profile?: string;

  /**
   * Whether we should check for EC2 credentials
   *
   * @default - Autodetect
   */
  readonly ec2creds?: boolean;

  /**
   * Whether we should check for container credentials
   *
   * @default - Autodetect
   */
  readonly containerCreds?: boolean;

  /**
   * HTTP options for SDK
   */
  readonly httpOptions?: SdkHttpOptions;

  /**
   * Custom endpoints for API calls
   *
   * @default - None. Standard AWS endpoints are built from the region you
   * have configured
   */
  readonly localstackEndpoint?: string;
}

/**
 * Options for individual SDKs
 */
export interface SdkHttpOptions {
  /**
   * Proxy address to use
   *
   * @default No proxy
   */
  readonly proxyAddress?: string;

  /**
   * A path to a certificate bundle that contains a cert to be trusted.
   *
   * @default No certificate bundle
   */
  readonly caBundlePath?: string;

  /**
   * The custom user agent to use.
   *
   * @default - <package-name>/<package-version>
   */
  readonly userAgent?: string;
}

const CACHED_ACCOUNT = Symbol('cached_account');
const CACHED_DEFAULT_CREDENTIALS = Symbol('cached_default_credentials');

/**
 * Creates instances of the AWS SDK appropriate for a given account/region
 *
 * If an environment is given and the current credentials are NOT for the indicated
 * account, will also search the set of credential plugin providers.
 *
 * If no environment is given, the default credentials will always be used.
 */
export class SdkProvider {
  /**
   * Create a new SdkProvider which gets its defaults in a way that haves like the AWS CLI does
   *
   * The AWS SDK for JS behaves slightly differently from the AWS CLI in a number of ways; see the
   * class `AwsCliCompatible` for the details.
   */
  public static async withAwsCliCompatibleDefaults(options: SdkProviderOptions = {}) {
    const sdkOptions = parseHttpOptions(options.httpOptions ?? {});
    const localstackEndpoint = options.localstackEndpoint;

    const chain = await AwsCliCompatible.credentialChain(options.profile, options.ec2creds, options.containerCreds, sdkOptions.httpOptions);
    const region = await AwsCliCompatible.region(options.profile);

    return new SdkProvider(chain, region, sdkOptions, localstackEndpoint);
  }

  private readonly plugins = new CredentialPlugins();

  public constructor(
    private readonly defaultChain: AWS.CredentialProviderChain,
    /**
     * Default region
     */
    public readonly defaultRegion: string,
    private readonly sdkOptions: ConfigurationOptions = {},
    private readonly localstackEndpoint?: string) {
  }

  /**
   * Return an SDK which can do operations in the given environment
   *
   * The `environment` parameter is resolved first (see `resolveEnvironment()`).
   */
  public async forEnvironment(environment: cxapi.Environment, mode: Mode): Promise<ISDK> {
    const env = await this.resolveEnvironment(environment);
    const creds = await this.obtainCredentials(env.account, mode);
    return new SDK(creds, env.region, this.sdkOptions, this.localstackEndpoint);
  }

  /**
   * Return an SDK which uses assumed role credentials
   *
   * The base credentials used to retrieve the assumed role credentials will be the
   * current credentials (no plugin lookup will be done!).
   *
   * If `region` is undefined, the default value will be used.
   */
  public async withAssumedRole(roleArn: string, externalId: string | undefined, region: string | undefined) {
    debug(`Assuming role '${roleArn}'`);
    region = region ?? this.defaultRegion;

    const creds = new AWS.ChainableTemporaryCredentials({
      params: {
        RoleArn: roleArn,
        ...externalId ? { ExternalId: externalId } : {},
        RoleSessionName: `aws-cdk-${os.userInfo().username}`,
      },
      stsConfig: {
        region,
        ...this.sdkOptions,
      },
      masterCredentials: await this.defaultCredentials(),
    });

    return new SDK(creds, region, this.sdkOptions);
  }

  /**
   * Resolve the environment for a stack
   *
   * Replaces the magic values `UNKNOWN_REGION` and `UNKNOWN_ACCOUNT`
   * with the defaults for the current SDK configuration (`~/.aws/config` or
   * otherwise).
   *
   * It is an error if `UNKNOWN_ACCOUNT` is used but the user hasn't configured
   * any SDK credentials.
   */
  public async resolveEnvironment(env: cxapi.Environment): Promise<cxapi.Environment> {
    const region = env.region !== cxapi.UNKNOWN_REGION ? env.region : this.defaultRegion;
    const account = env.account !== cxapi.UNKNOWN_ACCOUNT ? env.account : (await this.defaultAccount())?.accountId;

    if (!account) {
      throw new Error('Unable to resolve AWS account to use. It must be either configured when you define your CDK or through the environment');
    }

    return  {
      region,
      account,
      name: cxapi.EnvironmentUtils.format(account, region),
    };
  }

  /**
   * The account we'd auth into if we used default credentials.
   *
   * Default credentials are the set of ambiently configured credentials using
   * one of the environment variables, or ~/.aws/credentials, or the *one*
   * profile that was passed into the CLI.
   *
   * Might return undefined if there are no default/ambient credentials
   * available (in which case the user should better hope they have
   * credential plugins configured).
   *
   * Uses a cache to avoid STS calls if we don't need 'em.
   */
  public defaultAccount(): Promise<Account | undefined> {
    return cached(this, CACHED_ACCOUNT, async () => {
      try {
        const creds = await this.defaultCredentials();

        const accessKeyId = creds.accessKeyId;
        if (!accessKeyId) {
          throw new Error('Unable to resolve AWS credentials (setup with "aws configure")');
        }

        return new SDK(creds, this.defaultRegion, this.sdkOptions).currentAccount();
      } catch (e) {
        debug('Unable to determine the default AWS account:', e);
        return undefined;
      }
    });
  }

  /**
   * Get credentials for the given account ID in the given mode
   *
   * Use the current credentials if the destination account matches the current credentials' account.
   * Otherwise try all credential plugins.
   */
  protected async obtainCredentials(accountId: string, mode: Mode): Promise<AWS.Credentials> {
    // First try 'current' credentials
    const defaultAccountId = (await this.defaultAccount())?.accountId;
    if (defaultAccountId === accountId) {
      return this.defaultCredentials();
    }

    // Then try the plugins
    const pluginCreds = await this.plugins.fetchCredentialsFor(accountId, mode);
    if (pluginCreds) {
      return pluginCreds;
    }

    // No luck, format a useful error message
    const error = [`Need to perform AWS calls for account ${accountId}`];
    error.push(defaultAccountId ? `but the current credentials are for ${defaultAccountId}` : 'but no credentials have been configured');
    if (this.plugins.availablePluginNames.length > 0) {
      error.push(`and none of these plugins found any: ${this.plugins.availablePluginNames.join(', ')}`);
    }

    throw new Error(`${error.join(', ')}.`);
  }

  /**
   * Resolve the default chain to the first set of credentials that is available
   */
  private defaultCredentials(): Promise<AWS.Credentials> {
    return cached(this, CACHED_DEFAULT_CREDENTIALS, () => {
      debug('Resolving default credentials');
      return this.defaultChain.resolvePromise();
    });
  }
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
 * Get HTTP options for the SDK
 *
 * Read from user input or environment variables.
 *
 * Returns a complete `ConfigurationOptions` object because that's where
 * `customUserAgent` lives, but `httpOptions` is the most important attribute.
 */
function parseHttpOptions(options: SdkHttpOptions) {
  const config: ConfigurationOptions = {};
  config.httpOptions = {};

  let userAgent = options.userAgent;
  if (userAgent == null) {
    // Find the package.json from the main toolkit
    const pkg = JSON.parse(readIfPossible(path.join(__dirname, '..', '..', '..', 'package.json')) ?? '{}');
    userAgent = `${pkg.name}/${pkg.version}`;
  }
  config.customUserAgent = userAgent;

  const proxyAddress = options.proxyAddress || httpsProxyFromEnvironment();
  const caBundlePath = options.caBundlePath || caBundlePathFromEnvironment();

  if (proxyAddress && caBundlePath) {
    throw new Error(`At the moment, cannot specify Proxy (${proxyAddress}) and CA Bundle (${caBundlePath}) at the same time. See https://github.com/aws/aws-cdk/issues/5804`);
    // Maybe it's possible after all, but I've been staring at
    // https://github.com/TooTallNate/node-proxy-agent/blob/master/index.js#L79
    // a while now trying to figure out what to pass in so that the underlying Agent
    // object will get the 'ca' argument. It's not trivial and I don't want to risk it.
  }

  if (proxyAddress) { // Ignore empty string on purpose
    // https://aws.amazon.com/blogs/developer/using-the-aws-sdk-for-javascript-from-behind-a-proxy/
    debug('Using proxy server: %s', proxyAddress);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ProxyAgent: any = require('proxy-agent');
    config.httpOptions.agent = new ProxyAgent(proxyAddress);
  }
  if (caBundlePath) {
    debug('Using CA bundle path: %s', caBundlePath);
    config.httpOptions.agent = new https.Agent({
      ca: readIfPossible(caBundlePath),
    });
  }

  return config;
}

/**
 * Find and return the configured HTTPS proxy address
 */
function httpsProxyFromEnvironment(): string | undefined {
  if (process.env.https_proxy) {
    return process.env.https_proxy;
  }
  if (process.env.HTTPS_PROXY) {
    return process.env.HTTPS_PROXY;
  }
  return undefined;
}

/**
 * Find and return a CA certificate bundle path to be passed into the SDK.
 */
function caBundlePathFromEnvironment(): string | undefined {
  if (process.env.aws_ca_bundle) {
    return process.env.aws_ca_bundle;
  }
  if (process.env.AWS_CA_BUNDLE) {
    return process.env.AWS_CA_BUNDLE;
  }
  return undefined;
}

/**
 * Read a file if it exists, or return undefined
 *
 * Not async because it is used in the constructor
 */
function readIfPossible(filename: string): string | undefined {
  try {
    if (!fs.pathExistsSync(filename)) { return undefined; }
    return fs.readFileSync(filename, { encoding: 'utf-8' });
  } catch (e) {
    debug(e);
    return undefined;
  }
}