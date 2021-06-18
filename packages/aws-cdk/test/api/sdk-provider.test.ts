import * as os from 'os';
import * as cxapi from '@aws-cdk/cx-api';
import * as AWS from 'aws-sdk';
import type { ConfigurationOptions } from 'aws-sdk/lib/config-base';
import * as promptly from 'promptly';
import * as uuid from 'uuid';
import { ISDK, Mode, SDK, SdkProvider } from '../../lib/api/aws-auth';
import * as logging from '../../lib/logging';
import { PluginHost } from '../../lib/plugin';
import * as bockfs from '../bockfs';
import { withMocked } from '../util';
import { FakeSts, RegisterRoleOptions, RegisterUserOptions } from './fake-sts';

jest.mock('promptly', () => ({
  prompt: jest.fn().mockResolvedValue('1234'),
}));

const defaultCredOptions = {
  ec2creds: false,
  containerCreds: false,
};

let uid: string;
let pluginQueried = false;

beforeEach(() => {
  // Cache busters!
  // We prefix everything with UUIDs because:
  //
  // - We have a cache from account# -> credentials
  // - We have a cache from access key -> account
  uid = `(${uuid.v4()})`;

  logging.setLogLevel(logging.LogLevel.TRACE);

  PluginHost.instance.credentialProviderSources.splice(0);
  PluginHost.instance.credentialProviderSources.push({
    isAvailable() { return Promise.resolve(true); },
    canProvideCredentials(account) { return Promise.resolve(account === uniq('99999')); },
    getProvider() {
      pluginQueried = true;
      return Promise.resolve(new AWS.Credentials({
        accessKeyId: `${uid}plugin_key`,
        secretAccessKey: 'plugin_secret',
        sessionToken: 'plugin_token',
      }));
    },
    name: 'test plugin',
  });

  // Make sure these point to nonexistant files to start, if we don't call
  // prepare() then we don't accidentally want to fall back to system config.
  process.env.AWS_CONFIG_FILE = '/dev/null';
  process.env.AWS_SHARED_CREDENTIALS_FILE = '/dev/null';
});

afterEach(() => {
  bockfs.restore();
});

function uniq(account: string) {
  return `${uid}${account}`;
}

function env(account: string) {
  return cxapi.EnvironmentUtils.make(account, 'def');
}

describe('with intercepted network calls', () => {
  // Most tests will use intercepted network calls, except one test that tests
  // that the right HTTP `Agent` is used.

  let fakeSts: FakeSts;
  beforeEach(() => {
    fakeSts = new FakeSts();
    fakeSts.begin();

    // Make sure the KeyID returned by the plugin is recognized
    fakeSts.registerUser(uniq('99999'), uniq('plugin_key'));
  });

  afterEach(() => {
    fakeSts.restore();
  });

  // Set of tests where the CDK will not trigger assume-role
  // (the INI file might still do assume-role)
  describe('when CDK does not AssumeRole', () => {
    test('uses default credentials by default', async () => {
      // WHEN
      prepareCreds({
        fakeSts,
        credentials: {
          default: { aws_access_key_id: 'access', $account: '11111', $fakeStsOptions: { partition: 'aws-here' } },
        },
        config: {
          default: { region: 'eu-bla-5' },
        },
      });
      const provider = await providerFromProfile(undefined);

      // THEN
      expect(provider.defaultRegion).toEqual('eu-bla-5');
      await expect(provider.defaultAccount()).resolves.toEqual({ accountId: uniq('11111'), partition: 'aws-here' });

      // Ask for a different region
      const sdk = await provider.forEnvironment({ ...env(uniq('11111')), region: 'rgn' }, Mode.ForReading);
      expect(sdkConfig(sdk).credentials!.accessKeyId).toEqual(uniq('access'));
      expect(sdk.currentRegion).toEqual('rgn');
    });

    test('throws if profile credentials are not for the right account', async () => {
      // WHEN
      prepareCreds({
        fakeSts,
        config: {
          'profile boo': { aws_access_key_id: 'access', $account: '11111' },
        },
      });
      const provider = await providerFromProfile('boo');

      await expect(provider.forEnvironment(env(uniq('some_account_#')), Mode.ForReading)).rejects.toThrow('Need to perform AWS calls');
    });

    test('use profile acct/region if agnostic env requested', async () => {
      // WHEN
      prepareCreds({
        fakeSts,
        credentials: {
          default: { aws_access_key_id: 'access', $account: '11111' },
        },
        config: {
          default: { region: 'eu-bla-5' },
        },
      });
      const provider = await providerFromProfile(undefined);

      // THEN
      const sdk = await provider.forEnvironment(cxapi.EnvironmentUtils.make(cxapi.UNKNOWN_ACCOUNT, cxapi.UNKNOWN_REGION), Mode.ForReading);
      expect(sdkConfig(sdk).credentials!.accessKeyId).toEqual(uniq('access'));
      expect((await sdk.currentAccount()).accountId).toEqual(uniq('11111'));
      expect(sdk.currentRegion).toEqual('eu-bla-5');
    });

    test('passing profile skips EnvironmentCredentials', async () => {
      // GIVEN
      prepareCreds({
        fakeSts,
        credentials: {
          foo: { aws_access_key_id: 'access', $account: '11111' },
        },
      });
      const provider = await providerFromProfile('foo');

      const environmentCredentialsPrototype = (new AWS.EnvironmentCredentials('AWS')).constructor.prototype;

      await withMocked(environmentCredentialsPrototype, 'refresh', async (refresh) => {
        refresh.mockImplementation((callback: (err?: Error) => void) => callback(new Error('This function should not have been called')));

        // WHEN
        expect((await provider.defaultAccount())?.accountId).toEqual(uniq('11111'));

        expect(refresh).not.toHaveBeenCalled();
      });
    });

    test('supports profile spread over config_file and credentials_file', async () => {
      // WHEN
      prepareCreds({
        fakeSts,
        credentials: {
          foo: { aws_access_key_id: 'fooccess', $account: '22222' },
        },
        config: {
          'default': { region: 'eu-bla-5' },
          'profile foo': { region: 'eu-west-1' },
        },
      });
      const provider = await SdkProvider.withAwsCliCompatibleDefaults({ ...defaultCredOptions, profile: 'foo' });

      // THEN
      expect(provider.defaultRegion).toEqual('eu-west-1');
      await expect(provider.defaultAccount()).resolves.toEqual({ accountId: uniq('22222'), partition: 'aws' });

      const sdk = await provider.forEnvironment(env(uniq('22222')), Mode.ForReading);
      expect(sdkConfig(sdk).credentials!.accessKeyId).toEqual(uniq('fooccess'));
    });

    test('supports profile only in config_file', async () => {
      // WHEN
      prepareCreds({
        fakeSts,
        config: {
          'default': { region: 'eu-bla-5' },
          'profile foo': { aws_access_key_id: 'fooccess', $account: '22222' },
        },
      });
      const provider = await providerFromProfile('foo');

      // THEN
      expect(provider.defaultRegion).toEqual('eu-bla-5'); // Fall back to default config
      await expect(provider.defaultAccount()).resolves.toEqual({ accountId: uniq('22222'), partition: 'aws' });

      const sdk = await provider.forEnvironment(env(uniq('22222')), Mode.ForReading);
      expect(sdkConfig(sdk).credentials!.accessKeyId).toEqual(uniq('fooccess'));
    });

    test('can assume-role configured in config', async () => {
      // GIVEN
      prepareCreds({
        fakeSts,
        credentials: {
          assumer: { aws_access_key_id: 'assumer', $account: '11111' },
        },
        config: {
          'default': { region: 'eu-bla-5' },
          'profile assumer': { region: 'us-east-2' },
          'profile assumable': {
            role_arn: 'arn:aws:iam::66666:role/Assumable',
            source_profile: 'assumer',
            $account: '66666',
            $fakeStsOptions: { allowedAccounts: ['11111'] },
          },
        },
      });
      const provider = await providerFromProfile('assumable');

      // WHEN
      const sdk = await provider.forEnvironment(env(uniq('66666')), Mode.ForReading);

      // THEN
      expect((await sdk.currentAccount()).accountId).toEqual(uniq('66666'));
    });

    test('can assume role even if [default] profile is missing', async () => {
      // GIVEN
      prepareCreds({
        fakeSts,
        credentials: {
          assumer: { aws_access_key_id: 'assumer', $account: '22222' },
          assumable: { role_arn: 'arn:aws:iam::12356789012:role/Assumable', source_profile: 'assumer', $account: '22222' },
        },
        config: {
          'profile assumable': { region: 'eu-bla-5' },
        },
      });

      // WHEN
      const provider = await providerFromProfile('assumable');

      // THEN
      expect((await provider.defaultAccount())?.accountId).toEqual(uniq('22222'));
    });

    test('mfa_serial in profile will ask user for token', async () => {
      // GIVEN
      prepareCreds({
        fakeSts,
        credentials: {
          assumer: { aws_access_key_id: 'assumer', $account: '66666' },
        },
        config: {
          'default': { region: 'eu-bla-5' },
          'profile assumer': { region: 'us-east-2' },
          'profile mfa-role': {
            role_arn: 'arn:aws:iam::66666:role/Assumable',
            source_profile: 'assumer',
            mfa_serial: 'arn:aws:iam::account:mfa/user',
            $account: '66666',
          },
        },
      });
      const provider = await providerFromProfile('mfa-role');

      const promptlyMockCalls = (promptly.prompt as jest.Mock).mock.calls.length;

      // THEN
      const sdk = await provider.forEnvironment(env(uniq('66666')), Mode.ForReading);
      expect((await sdk.currentAccount()).accountId).toEqual(uniq('66666'));
      expect(fakeSts.assumedRoles[0]).toEqual(expect.objectContaining({
        roleArn: 'arn:aws:iam::66666:role/Assumable',
        serialNumber: 'arn:aws:iam::account:mfa/user',
        tokenCode: '1234',
      }));

      // Mock response was set to fail to make sure we don't call STS
      // Make sure the MFA mock was called during this test
      expect((promptly.prompt as jest.Mock).mock.calls.length).toBe(promptlyMockCalls + 1);
    });
  });

  // For DefaultSynthesis we will do an assume-role after having gotten base credentials
  describe('when CDK AssumeRoles', () => {
    beforeEach(() => {
      // All these tests share that 'arn:aws:role' is a role into account 88888 which can be assumed from 11111
      fakeSts.registerRole(uniq('88888'), 'arn:aws:role', { allowedAccounts: [uniq('11111')] });
    });

    test('error we get from assuming a role is useful', async () => {
      // GIVEN
      prepareCreds({
        fakeSts,
        config: {
          default: { aws_access_key_id: 'foo' },
        },
      });
      const provider = await providerFromProfile(undefined);

      // WHEN
      const promise = provider.forEnvironment(env(uniq('88888')), Mode.ForReading, {
        assumeRoleArn: 'doesnotexist.role.arn',
      });

      // THEN - error message contains both a helpful hint and the underlying AssumeRole message
      await expect(promise).rejects.toThrow('(re)-bootstrap the environment');
      await expect(promise).rejects.toThrow('doesnotexist.role.arn');
    });

    test('assuming a role sanitizes the username into the session name', async () => {
      // GIVEN
      prepareCreds({
        fakeSts,
        config: {
          default: { aws_access_key_id: 'foo', $account: '11111' },
        },
      });

      await withMocked(os, 'userInfo', async (userInfo) => {
        userInfo.mockReturnValue({ username: 'skål', uid: 1, gid: 1, homedir: '/here', shell: '/bin/sh' });

        // WHEN
        const provider = await providerFromProfile(undefined);

        const sdk = await provider.forEnvironment(env(uniq('88888')), Mode.ForReading, { assumeRoleArn: 'arn:aws:role' }) as SDK;
        await sdk.currentAccount();

        // THEN
        expect(fakeSts.assumedRoles[0]).toEqual(expect.objectContaining({
          roleSessionName: 'aws-cdk-sk@l',
        }));
      });
    });

    test('even if current credentials are for the wrong account, we will still use them to AssumeRole', async () => {
      // GIVEN
      prepareCreds({
        fakeSts,
        config: {
          default: { aws_access_key_id: 'foo', $account: '11111' },
        },
      });
      const provider = await providerFromProfile(undefined);

      // WHEN
      const sdk = await provider.forEnvironment(env(uniq('88888')), Mode.ForReading, { assumeRoleArn: 'arn:aws:role' }) as SDK;

      // THEN
      expect((await sdk.currentAccount()).accountId).toEqual(uniq('88888'));
    });

    test('if AssumeRole fails but current credentials are for the right account, we will still use them', async () => {
      // GIVEN
      prepareCreds({
        fakeSts,
        config: {
          default: { aws_access_key_id: 'foo', $account: '88888' },
        },
      });
      const provider = await providerFromProfile(undefined);

      // WHEN - assumeRole fails because the role can only be assumed from account 11111
      const sdk = await provider.forEnvironment(env(uniq('88888')), Mode.ForReading, { assumeRoleArn: 'arn:aws:role' }) as SDK;

      // THEN
      expect((await sdk.currentAccount()).accountId).toEqual(uniq('88888'));
    });
  });

  describe('Plugins', () => {
    test('does not use plugins if current credentials are for expected account', async () => {
      prepareCreds({
        fakeSts,
        config: {
          default: { aws_access_key_id: 'foo', $account: '11111' },
        },
      });
      const provider = await providerFromProfile(undefined);
      await provider.forEnvironment(env(uniq('11111')), Mode.ForReading);
      expect(pluginQueried).toEqual(false);
    });

    test('uses plugin for account 99999', async () => {
      const provider = await providerFromProfile(undefined);
      await provider.forEnvironment(env(uniq('99999')), Mode.ForReading);
      expect(pluginQueried).toEqual(true);
    });

    test('can assume role with credentials from plugin', async () => {
      fakeSts.registerRole(uniq('99999'), 'arn:aws:iam::99999:role/Assumable');

      const provider = await providerFromProfile(undefined);
      await provider.forEnvironment(env(uniq('99999')), Mode.ForReading, {
        assumeRoleArn: 'arn:aws:iam::99999:role/Assumable',
      });

      expect(fakeSts.assumedRoles[0]).toEqual(expect.objectContaining({
        roleArn: 'arn:aws:iam::99999:role/Assumable',
      }));
      expect(pluginQueried).toEqual(true);
    });

    test('even if AssumeRole fails but current credentials are from a plugin, we will still use them', async () => {
      const provider = await providerFromProfile(undefined);
      const sdk = await provider.forEnvironment(env(uniq('99999')), Mode.ForReading, { assumeRoleArn: 'does:not:exist' });

      // THEN
      expect((await sdk.currentAccount()).accountId).toEqual(uniq('99999'));
    });

    test('plugins are still queried even if current credentials are expired (or otherwise invalid)', async () => {
      // GIVEN
      process.env.AWS_ACCESS_KEY_ID = `${uid}akid`;
      process.env.AWS_SECRET_ACCESS_KEY = 'sekrit';
      const provider = await providerFromProfile(undefined);

      // WHEN
      await provider.forEnvironment(env(uniq('99999')), Mode.ForReading);

      // THEN
      expect(pluginQueried).toEqual(true);
    });
  });

  describe('support for credential_source', () => {
    test('can assume role with ecs credentials', async () => {
      return withMocked(AWS.ECSCredentials.prototype, 'needsRefresh', async (needsRefresh) => {
        // GIVEN
        prepareCreds({
          config: {
            'profile ecs': { role_arn: 'arn:aws:iam::12356789012:role/Assumable', credential_source: 'EcsContainer', $account: '22222' },
          },
        });
        const provider = await providerFromProfile('ecs');

        // WHEN
        await provider.defaultAccount();

        // THEN
        expect(needsRefresh).toHaveBeenCalled();
      });
    });

    test('can assume role with ec2 credentials', async () => {
      return withMocked(AWS.EC2MetadataCredentials.prototype, 'needsRefresh', async (needsRefresh) => {
        // GIVEN
        prepareCreds({
          config: {
            'profile ecs': { role_arn: 'arn:aws:iam::12356789012:role/Assumable', credential_source: 'Ec2InstanceMetadata', $account: '22222' },
          },
        });
        const provider = await providerFromProfile('ecs');

        // WHEN
        await provider.defaultAccount();

        // THEN
        expect(needsRefresh).toHaveBeenCalled();
      });
    });

    test('can assume role with env credentials', async () => {
      return withMocked(AWS.EnvironmentCredentials.prototype, 'needsRefresh', async (needsRefresh) => {
        // GIVEN
        prepareCreds({
          config: {
            'profile ecs': { role_arn: 'arn:aws:iam::12356789012:role/Assumable', credential_source: 'Environment', $account: '22222' },
          },
        });
        const provider = await providerFromProfile('ecs');

        // WHEN
        await provider.defaultAccount();

        // THEN
        expect(needsRefresh).toHaveBeenCalled();
      });
    });

    test('assume fails with unsupported credential_source', async () => {
      // GIVEN
      prepareCreds({
        config: {
          'profile ecs': { role_arn: 'arn:aws:iam::12356789012:role/Assumable', credential_source: 'unsupported', $account: '22222' },
        },
      });
      const provider = await providerFromProfile('ecs');

      // WHEN
      const account = await provider.defaultAccount();

      // THEN
      expect(account?.accountId).toEqual(undefined);
    });
  });

  test('defaultAccount returns undefined if STS call fails', async () => {
    // GIVEN
    process.env.AWS_ACCESS_KEY_ID = `${uid}akid`;
    process.env.AWS_SECRET_ACCESS_KEY = 'sekrit';

    // WHEN
    const provider = await providerFromProfile(undefined);

    // THEN
    await expect(provider.defaultAccount()).resolves.toBe(undefined);
  });
});

test('even when using a profile to assume another profile, STS calls goes through the proxy', async () => {
  prepareCreds({
    credentials: {
      assumer: { aws_access_key_id: 'assumer' },
    },
    config: {
      'default': { region: 'eu-bla-5' },
      'profile assumable': { role_arn: 'arn:aws:iam::66666:role/Assumable', source_profile: 'assumer', $account: '66666' },
      'profile assumer': { region: 'us-east-2' },
    },
  });

  // Messy mocking
  let called = false;
  jest.mock('proxy-agent', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    class FakeAgent extends require('https').Agent {
      public addRequest(_: any, __: any) {
        // FIXME: this error takes 6 seconds to be completely handled. It
        // might be retries in the SDK somewhere, or something about the Node
        // event loop. I've spent an hour trying to figure it out and I can't,
        // and I gave up. We'll just have to live with this until someone gets
        // inspired.
        const error = new Error('ABORTED BY TEST');
        (error as any).code = 'RequestAbortedError';
        (error as any).retryable = false;
        called = true;
        throw error;
      }
    }
    return FakeAgent;
  });

  // WHEN
  const provider = await SdkProvider.withAwsCliCompatibleDefaults({
    ...defaultCredOptions,
    profile: 'assumable',
    httpOptions: {
      proxyAddress: 'http://DOESNTMATTER/',
    },
  });

  await provider.defaultAccount();

  // THEN -- the fake proxy agent got called, we don't care about the result
  expect(called).toEqual(true);
});

/**
 * Use object hackery to get the credentials out of the SDK object
 */
function sdkConfig(sdk: ISDK): ConfigurationOptions {
  return (sdk as any).config;
}

/**
 * Fixture for SDK auth for this test suite
 *
 * Has knowledge of the cache buster, will write proper fake config files and
 * register users and roles in FakeSts at the same time.
 */
function prepareCreds(options: PrepareCredsOptions) {
  function convertSections(sections?: Record<string, ProfileUser | ProfileRole>) {
    const ret = [];
    for (const [profile, user] of Object.entries(sections ?? {})) {
      ret.push(`[${profile}]`);

      if (isProfileRole(user)) {
        ret.push(`role_arn=${user.role_arn}`);
        if ('source_profile' in user) {
          ret.push(`source_profile=${user.source_profile}`);
        }
        if ('credential_source' in user) {
          ret.push(`credential_source=${user.credential_source}`);
        }
        if (user.mfa_serial) {
          ret.push(`mfa_serial=${user.mfa_serial}`);
        }
        options.fakeSts?.registerRole(uniq(user.$account ?? '00000'), user.role_arn, {
          ...user.$fakeStsOptions,
          allowedAccounts: user.$fakeStsOptions?.allowedAccounts?.map(uniq),
        });
      } else {
        if (user.aws_access_key_id) {
          ret.push(`aws_access_key_id=${uniq(user.aws_access_key_id)}`);
          ret.push('aws_secret_access_key=secret');
          options.fakeSts?.registerUser(uniq(user.$account ?? '00000'), uniq(user.aws_access_key_id), user.$fakeStsOptions);
        }
      }

      if (user.region) {
        ret.push(`region=${user.region}`);
      }
    }
    return ret.join('\n');
  }

  bockfs({
    '/home/me/.bxt/credentials': convertSections(options.credentials),
    '/home/me/.bxt/config': convertSections(options.config),
  });

  // Set environment variables that we want
  process.env.AWS_CONFIG_FILE = bockfs.path('/home/me/.bxt/config');
  process.env.AWS_SHARED_CREDENTIALS_FILE = bockfs.path('/home/me/.bxt/credentials');
}

interface PrepareCredsOptions {
  /**
   * Write the aws/credentials file
   */
  readonly credentials?: Record<string, ProfileUser | ProfileRole>;

  /**
   * Write the aws/config file
   */
  readonly config?: Record<string, ProfileUser | ProfileRole>;

  /**
   * If given, add users to FakeSTS
   */
  readonly fakeSts?: FakeSts;
}

interface ProfileUser {
  readonly aws_access_key_id?: string;
  readonly $account?: string;
  readonly region?: string;
  readonly $fakeStsOptions?: RegisterUserOptions;
}

type ProfileRole = {
  readonly role_arn: string;
  readonly mfa_serial?: string;
  readonly $account: string;
  readonly region?: string;
  readonly $fakeStsOptions?: RegisterRoleOptions;
} & ({ readonly source_profile: string } | { readonly credential_source: string });

function isProfileRole(x: ProfileUser | ProfileRole): x is ProfileRole {
  return 'role_arn' in x;
}

function providerFromProfile(profile: string | undefined) {
  return SdkProvider.withAwsCliCompatibleDefaults({ ...defaultCredOptions, profile });
}