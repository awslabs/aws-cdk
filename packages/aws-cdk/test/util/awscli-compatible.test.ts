import * as AWS from 'aws-sdk';
import { AwsCliCompatible } from '../../lib/api/aws-auth/awscli-compatible';
import { withMockedClassSingleton } from '../util';

beforeEach(() => {
  // Set to paths that don't exist so the SDK doesn't accidentally load this config
  process.env.AWS_CONFIG_FILE = '/home/dummydummy/.bxt/config';
  process.env.AWS_SHARED_CREDENTIALS_FILE = '/home/dummydummy/.bxt/credentials';
  // Scrub some environment variables that might be set if we're running on CodeBuild which will interfere with the tests.
  delete process.env.AWS_REGION;
  delete process.env.AWS_DEFAULT_REGION;
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
  delete process.env.AWS_SESSION_TOKEN;
});

test('on an EC2 instance, region lookup queries IMDS', async () => {
  return withMockedClassSingleton(AWS, 'MetadataService', async (mdService) => {
    mdService.request
      // First call for a token
      .mockImplementationOnce((_1, _2, cb) => { cb(undefined as any, 'token'); })
      // Second call for the region
      .mockImplementationOnce((_1, _2, cb) => { cb(undefined as any, JSON.stringify({ region: 'some-region' })); });

    const region = await AwsCliCompatible.region({ ec2instance: true });
    expect(region).toEqual('some-region');
  });
});

test('Use web identity when available', async () => {
  // Scrub some environment variables that are maybe set for Ecs Credentials
  delete process.env.ECS_CONTAINER_METADATA_URI_V4;
  delete process.env.ECS_CONTAINER_METADATA_URI;
  delete process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI;

  // create and configure the web identity token file
  process.env.AWS_WEB_IDENTITY_TOKEN_FILE = 'some-value';
  process.env.AWS_ROLE_ARN = 'some-value';

  // create the chain
  const providers = (await AwsCliCompatible.credentialChain()).providers;

  // make sure the web identity provider is in the chain
  const webIdentify = (providers[2] as Function)();
  expect(webIdentify).toBeInstanceOf(AWS.TokenFileWebIdentityCredentials);
});
