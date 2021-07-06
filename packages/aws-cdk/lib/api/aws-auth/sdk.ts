import * as AWS from 'aws-sdk';
import type { ConfigurationOptions } from 'aws-sdk/lib/config-base';
import { debug, trace } from '../../logging';
import { cached } from '../../util/functions';
import { AccountAccessKeyCache } from './account-cache';
import { Account } from './sdk-provider';

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
  elbv2(): AWS.ELBv2;
  secretsManager(): AWS.SecretsManager;
}

/**
 * Additional SDK configuration options
 */
export interface SdkOptions {
  /**
   * Additional descriptive strings that indicate where the "AssumeRole" credentials are coming from
   *
   * Will be printed in an error message to help users diagnose auth problems.
   */
  readonly assumeRoleCredentialsSourceDescription?: string;
}

/**
 * Base functionality of SDK without credential fetching
 */
export class SDK implements ISDK {
  private static readonly accountCache = new AccountAccessKeyCache();

  public readonly currentRegion: string;

  private readonly config: ConfigurationOptions;

  /**
   * Default retry options for SDK clients.
   */
  private readonly retryOptions = { maxRetries: 6, retryDelayOptions: { base: 300 } };

  /**
   * The more generous retry policy for CloudFormation, which has a 1 TPM limit on certain APIs,
   * which are abundantly used for deployment tracking, ...
   *
   * So we're allowing way more retries, but waiting a bit more.
   */
  private readonly cloudFormationRetryOptions = { maxRetries: 10, retryDelayOptions: { base: 1_000 } };

  constructor(
    private readonly _credentials: AWS.Credentials,
    region: string,
    httpOptions: ConfigurationOptions = {},
    private readonly sdkOptions: SdkOptions = {}) {

    this.config = {
      ...httpOptions,
      ...this.retryOptions,
      credentials: _credentials,
      region,
      logger: { log: (...messages) => messages.forEach(m => trace('%s', m)) },
    };
    this.currentRegion = region;
  }

  public cloudFormation(): AWS.CloudFormation {
    return this.wrapServiceErrorHandling(new AWS.CloudFormation({
      ...this.config,
      ...this.cloudFormationRetryOptions,
    }));
  }

  public ec2(): AWS.EC2 {
    return this.wrapServiceErrorHandling(new AWS.EC2(this.config));
  }

  public ssm(): AWS.SSM {
    return this.wrapServiceErrorHandling(new AWS.SSM(this.config));
  }

  public s3(): AWS.S3 {
    return this.wrapServiceErrorHandling(new AWS.S3(this.config));
  }

  public route53(): AWS.Route53 {
    return this.wrapServiceErrorHandling(new AWS.Route53(this.config));
  }

  public ecr(): AWS.ECR {
    return this.wrapServiceErrorHandling(new AWS.ECR(this.config));
  }

  public elbv2(): AWS.ELBv2 {
    return this.wrapServiceErrorHandling(new AWS.ELBv2(this.config));
  }

  public secretsManager(): AWS.SecretsManager {
    return this.wrapServiceErrorHandling(new AWS.SecretsManager(this.config));
  }

  public async currentAccount(): Promise<Account> {
    // Get/refresh if necessary before we can access `accessKeyId`
    await this.forceCredentialRetrieval();

    return cached(this, CURRENT_ACCOUNT_KEY, () => SDK.accountCache.fetch(this._credentials.accessKeyId, async () => {
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

  /**
   * Return the current credentials
   *
   * Don't use -- only used to write tests around assuming roles.
   */
  public async currentCredentials(): Promise<AWS.Credentials> {
    await this.forceCredentialRetrieval();
    return this._credentials;
  }

  /**
   * Force retrieval of the current credentials
   *
   * Relevant if the current credentials are AssumeRole credentials -- do the actual
   * lookup, and translate any error into a useful error message (taking into
   * account credential provenance).
   */
  public async forceCredentialRetrieval() {
    try {
      await this._credentials.getPromise();
    } catch (e) {
      debug(`Assuming role failed: ${e.message}`);
      throw new Error([
        'Could not assume role in target account',
        ...this.sdkOptions.assumeRoleCredentialsSourceDescription
          ? [`using ${this.sdkOptions.assumeRoleCredentialsSourceDescription}`]
          : [],
        e.message,
        '. Please make sure that this role exists in the account. If it doesn\'t exist, (re)-bootstrap the environment ' +
        'with the right \'--trust\', using the latest version of the CDK CLI.',
      ].join(' '));
    }
  }

  /**
   * Return a wrapping object for the underlying service object
   *
   * Responds to failures in the underlying service calls, in two different
   * ways:
   *
   * - When errors are encountered, log the failing call and the error that
   *   it triggered (at debug level). This is necessary because the lack of
   *   stack traces in NodeJS otherwise makes it very hard to suss out where
   *   a certain AWS error occurred.
   * - The JS SDK has a funny business of wrapping any credential-based error
   *   in a super-generic (and in our case wrong) exception. If we then use a
   *   'ChainableTemporaryCredentials' and the target role doesn't exist,
   *   the error message that shows up by default is super misleading
   *   (https://github.com/aws/aws-sdk-js/issues/3272). We can fix this because
   *   the exception contains the "inner exception", so we unwrap and throw
   *   the correct error ("cannot assume role").
   *
   * The wrapping business below is slightly more complicated than you'd think
   * because we must hook into the `promise()` method of the object that's being
   * returned from the methods of the object that we wrap, so there's two
   * levels of wrapping going on, and also some exceptions to the wrapping magic.
   */
  private wrapServiceErrorHandling<A extends object>(serviceObject: A): A {
    const classObject = serviceObject.constructor.prototype;
    const self = this;

    return new Proxy(serviceObject, {
      get(obj: A, prop: string) {
        const real = (obj as any)[prop];
        // Things we don't want to intercept:
        // - Anything that's not a function.
        // - 'constructor', s3.upload() will use this to do some magic and we need the underlying constructor.
        // - Any method that's not on the service class (do not intercept 'makeRequest' and other helpers).
        if (prop === 'constructor' || !classObject.hasOwnProperty(prop) || !isFunction(real)) { return real; }

        // NOTE: This must be a function() and not an () => {
        // because I need 'this' to be dynamically bound and not statically bound.
        // If your linter complains don't listen to it!
        return function(this: any) {
          // Call the underlying function. If it returns an object with a promise()
          // method on it, wrap that 'promise' method.
          const args = [].slice.call(arguments, 0);
          const response = real.apply(this, args);

          // Don't intercept unless the return value is an object with a '.promise()' method.
          if (typeof response !== 'object' || !response) { return response; }
          if (!('promise' in response)) { return response; }

          // Return an object with the promise method replaced with a wrapper which will
          // do additional things to errors.
          return Object.assign(Object.create(response), {
            promise() {
              return response.promise().catch((e: Error & { code?: string }) => {
                e = self.makeDetailedException(e);
                debug(`Call failed: ${prop}(${JSON.stringify(args[0])}) => ${e.message} (code=${e.code})`);
                return Promise.reject(e); // Re-'throw' the new error
              });
            },
          });
        };
      },
    });
  }

  /**
   * Extract a more detailed error out of a generic error if we can
   *
   * If this is an error about Assuming Roles, add in the context showing the
   * chain of credentials we used to try to assume the role.
   */
  private makeDetailedException(e: Error): Error {
    // This is the super-generic "something's wrong" error that the JS SDK wraps other errors in.
    // https://github.com/aws/aws-sdk-js/blob/f0ac2e53457c7512883d0677013eacaad6cd8a19/lib/event_listeners.js#L84
    if (typeof e.message === 'string' && e.message.startsWith('Missing credentials in config')) {
      const original = (e as any).originalError;
      if (original) {
        // When the SDK does a 'util.copy', they lose the Error-ness of the inner error
        // (they copy the Error's properties into a plain object) so make it an Error object again.
        e = Object.assign(new Error(), original);
      }
    }

    // At this point, the error might still be a generic "ChainableTemporaryCredentials failed"
    // error which wraps the REAL error (AssumeRole failed). We're going to replace the error
    // message with one that's more likely to help users, and tell them the most probable
    // fix (bootstrapping). The underlying service call failure will be appended below.
    if (e.message === 'Could not load credentials from ChainableTemporaryCredentials') {
      e.message = [
        'Could not assume role in target account',
        ...this.sdkOptions.assumeRoleCredentialsSourceDescription
          ? [`using ${this.sdkOptions.assumeRoleCredentialsSourceDescription}`]
          : [],
        '(did you bootstrap the environment with the right \'--trust\'s?)',
      ].join(' ');
    }

    // Replace the message on this error with a concatenation of all inner error messages.
    // Must more clear what's going on that way.
    e.message = allChainedExceptionMessages(e);
    return e;
  }
}

const CURRENT_ACCOUNT_KEY = Symbol('current_account_key');

function isFunction(x: any): x is (...args: any[]) => any {
  return x && {}.toString.call(x) === '[object Function]';
}

/**
 * Return the concatenated message of all exceptions in the AWS exception chain
 */
function allChainedExceptionMessages(e: Error | undefined) {
  const ret = new Array<string>();
  while (e) {
    ret.push(e.message);
    e = (e as any).originalError;
  }
  return ret.join(': ');
}
