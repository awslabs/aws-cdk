import { arrayWith } from '@aws-cdk/assert-internal';
import '@aws-cdk/assert-internal/jest';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecr from '@aws-cdk/aws-ecr';
import * as iam from '@aws-cdk/aws-iam';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import * as cdk from '@aws-cdk/core';
import * as cdkp from '../lib';

let app: cdk.App;
let stack: cdk.Stack;

beforeEach(() => {
  app = new cdk.App();
  stack = new cdk.Stack(app, 'Stack', {
    env: { account: '0123456789012', region: 'eu-west-1' },
  });
});

describe('ExternalDockerCredential', () => {

  let secret: secretsmanager.ISecret;

  beforeEach(() => {
    secret = new secretsmanager.Secret(stack, 'Secret');
  });

  test('dockerHub defaults registry domain', () => {
    const creds = cdkp.DockerCredential.dockerHub(secret);

    expect(Object.keys(creds._renderCdkAssetsConfig())).toEqual(['index.docker.io']);
  });

  test('minimal example only renders secret', () => {
    const creds = cdkp.DockerCredential.customRegistry('example.com', secret);

    const config = creds._renderCdkAssetsConfig();
    expect(stack.resolve(config)).toEqual({
      'example.com': {
        secretsManagerSecretId: { Ref: 'SecretA720EF05' },
      },
    });
  });

  test('maximmum example includes all expected properties', () => {
    const roleArn = 'arn:aws:iam::0123456789012:role/MyRole';
    const creds = cdkp.DockerCredential.customRegistry('example.com', secret, {
      secretUsernameField: 'login',
      secretPasswordField: 'pass',
      assumeRole: iam.Role.fromRoleArn(stack, 'Role', roleArn),
    });

    const config = creds._renderCdkAssetsConfig();
    expect(stack.resolve(config)).toEqual({
      'example.com': {
        secretsManagerSecretId: { Ref: 'SecretA720EF05' },
        secretsUsernameField: 'login',
        secretsPasswordField: 'pass',
        assumeRoleArn: roleArn,
      },
    });
  });

  describe('grantRead', () => {

    test('grants read access to the secret', () => {
      const creds = cdkp.DockerCredential.customRegistry('example.com', secret);

      const user = new iam.User(stack, 'User');
      creds.grantRead(user, cdkp.DockerCredentialUsage.ASSET_PUBLISHING);

      expect(stack).toHaveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Action: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
              Effect: 'Allow',
              Resource: { Ref: 'SecretA720EF05' },
            },
          ],
          Version: '2012-10-17',
        },
        Users: [{ Ref: 'User00B015A1' }],
      });
    });

    test('grants read access to the secret to the assumeRole if provided', () => {
      const assumeRole = iam.Role.fromRoleArn(stack, 'Role', 'arn:aws:iam::0123456789012:role/MyRole');
      const creds = cdkp.DockerCredential.customRegistry('example.com', secret, { assumeRole });

      const user = new iam.User(stack, 'User');
      creds.grantRead(user, cdkp.DockerCredentialUsage.ASSET_PUBLISHING);

      expect(stack).toHaveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [{
            Action: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
            Effect: 'Allow',
            Resource: { Ref: 'SecretA720EF05' },
          }],
          Version: '2012-10-17',
        },
        Roles: ['MyRole'],
      });
      expect(stack).toHaveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [{
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Resource: 'arn:aws:iam::0123456789012:role/MyRole',
          }],
          Version: '2012-10-17',
        },
        Users: [{ Ref: 'User00B015A1' }],
      });
    });

    test('does not grant any access if the usage does not match', () => {
      const assumeRole = iam.Role.fromRoleArn(stack, 'Role', 'arn:aws:iam::0123456789012:role/MyRole');
      const creds = cdkp.DockerCredential.customRegistry('example.com', secret, {
        assumeRole,
        usages: [cdkp.DockerCredentialUsage.ASSET_PUBLISHING],
      });

      const user = new iam.User(stack, 'User');
      creds.grantRead(user, cdkp.DockerCredentialUsage.SELF_UPDATE);

      expect(stack).not.toHaveResource('AWS::IAM::Policy');
    });

  });

});

describe('EcrDockerCredential', () => {

  let repo: ecr.IRepository;

  beforeEach(() => {
    repo = ecr.Repository.fromRepositoryArn(stack, 'Repo', 'arn:aws:ecr:eu-west-1:0123456789012:repository/Repo');
  });

  test('minimal example only renders ecrRepository', () => {
    const creds = cdkp.DockerCredential.ecr([repo]);

    const config = creds._renderCdkAssetsConfig();

    expect(stack.resolve(Object.keys(config))).toEqual([{
      'Fn::Select': [
        0, {
          'Fn::Split': ['/', {
            'Fn::Join': ['', ['0123456789012.dkr.ecr.eu-west-1.', { Ref: 'AWS::URLSuffix' }, '/Repo']],
          }],
        },
      ],
    }]);
    expect(Object.values(config)).toEqual([{
      ecrRepository: true,
    }]);
  });

  test('maximum example renders all fields', () => {
    const roleArn = 'arn:aws:iam::0123456789012:role/MyRole';
    const creds = cdkp.DockerCredential.ecr([repo], {
      assumeRole: iam.Role.fromRoleArn(stack, 'Role', roleArn),
      usages: [cdkp.DockerCredentialUsage.SYNTH],
    });

    const config = creds._renderCdkAssetsConfig();

    expect(stack.resolve(Object.keys(config))).toEqual([{
      'Fn::Select': [
        0, {
          'Fn::Split': ['/', {
            'Fn::Join': ['', ['0123456789012.dkr.ecr.eu-west-1.', { Ref: 'AWS::URLSuffix' }, '/Repo']],
          }],
        },
      ],
    }]);
    expect(Object.values(config)).toEqual([{
      assumeRoleArn: roleArn,
      ecrRepository: true,
    }]);
  });

  describe('grantRead', () => {

    test('grants pull access to the repo', () => {
      const creds = cdkp.DockerCredential.ecr([repo]);

      const user = new iam.User(stack, 'User');
      creds.grantRead(user, cdkp.DockerCredentialUsage.ASSET_PUBLISHING);

      expect(stack).toHaveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [{
            Action: [
              'ecr:BatchCheckLayerAvailability',
              'ecr:GetDownloadUrlForLayer',
              'ecr:BatchGetImage',
            ],
            Effect: 'Allow',
            Resource: 'arn:aws:ecr:eu-west-1:0123456789012:repository/Repo',
          },
          {
            Action: 'ecr:GetAuthorizationToken',
            Effect: 'Allow',
            Resource: '*',
          }],
          Version: '2012-10-17',
        },
        Users: [{ Ref: 'User00B015A1' }],
      });
    });

    test('grants pull access to the assumed role', () => {
      const assumeRole = iam.Role.fromRoleArn(stack, 'Role', 'arn:aws:iam::0123456789012:role/MyRole');
      const creds = cdkp.DockerCredential.ecr([repo], { assumeRole });

      const user = new iam.User(stack, 'User');
      creds.grantRead(user, cdkp.DockerCredentialUsage.ASSET_PUBLISHING);

      expect(stack).toHaveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [{
            Action: [
              'ecr:BatchCheckLayerAvailability',
              'ecr:GetDownloadUrlForLayer',
              'ecr:BatchGetImage',
            ],
            Effect: 'Allow',
            Resource: 'arn:aws:ecr:eu-west-1:0123456789012:repository/Repo',
          },
          {
            Action: 'ecr:GetAuthorizationToken',
            Effect: 'Allow',
            Resource: '*',
          }],
          Version: '2012-10-17',
        },
        Roles: ['MyRole'],
      });
      expect(stack).toHaveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [{
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Resource: 'arn:aws:iam::0123456789012:role/MyRole',
          }],
          Version: '2012-10-17',
        },
        Users: [{ Ref: 'User00B015A1' }],
      });
    });

    test('grants pull access to multiple repos if provided', () => {
      const repo2 = ecr.Repository.fromRepositoryArn(stack, 'Repo2', 'arn:aws:ecr:eu-west-1:0123456789012:repository/Repo2');
      const creds = cdkp.DockerCredential.ecr([repo, repo2]);

      const user = new iam.User(stack, 'User');
      creds.grantRead(user, cdkp.DockerCredentialUsage.ASSET_PUBLISHING);

      expect(stack).toHaveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: arrayWith({
            Action: [
              'ecr:BatchCheckLayerAvailability',
              'ecr:GetDownloadUrlForLayer',
              'ecr:BatchGetImage',
            ],
            Effect: 'Allow',
            Resource: 'arn:aws:ecr:eu-west-1:0123456789012:repository/Repo',
          },
          {
            Action: [
              'ecr:BatchCheckLayerAvailability',
              'ecr:GetDownloadUrlForLayer',
              'ecr:BatchGetImage',
            ],
            Effect: 'Allow',
            Resource: 'arn:aws:ecr:eu-west-1:0123456789012:repository/Repo2',
          },
          {
            Action: 'ecr:GetAuthorizationToken',
            Effect: 'Allow',
            Resource: '*',
          }),
          Version: '2012-10-17',
        },
        Users: [{ Ref: 'User00B015A1' }],
      });
    });

    test('does not grant any access if the usage does not match', () => {
      const creds = cdkp.DockerCredential.ecr([repo], { usages: [cdkp.DockerCredentialUsage.SYNTH] });

      const user = new iam.User(stack, 'User');
      creds.grantRead(user, cdkp.DockerCredentialUsage.ASSET_PUBLISHING);

      expect(stack).not.toHaveResource('AWS::IAM::Policy');
    });

  });

});

describe('dockerCredentialsInstallCommands', () => {
  const secretArn = 'arn:aws:secretsmanager:eu-west-1:0123456789012:secret:mySecret-012345';
  let secret: secretsmanager.ISecret;

  beforeEach(() => {
    secret = secretsmanager.Secret.fromSecretCompleteArn(stack, 'Secret', secretArn);
  });

  test('returns a blank array for empty inputs', () => {
    expect(cdkp.dockerCredentialsInstallCommands(cdkp.DockerCredentialUsage.SYNTH)).toEqual([]);
    expect(cdkp.dockerCredentialsInstallCommands(cdkp.DockerCredentialUsage.SYNTH, [])).toEqual([]);
  });

  test('returns only credentials relevant to the current usage', () => {
    const synthCreds = cdkp.DockerCredential.customRegistry('synth.example.com', secret, {
      usages: [cdkp.DockerCredentialUsage.SYNTH],
    });
    const selfUpdateCreds = cdkp.DockerCredential.customRegistry('selfupdate.example.com', secret, {
      usages: [cdkp.DockerCredentialUsage.SELF_UPDATE],
    });
    const assetPublishingCreds = cdkp.DockerCredential.customRegistry('assetpublishing.example.com', secret, {
      usages: [cdkp.DockerCredentialUsage.ASSET_PUBLISHING],
    });

    const commands = cdkp.dockerCredentialsInstallCommands(cdkp.DockerCredentialUsage.SYNTH,
      [synthCreds, selfUpdateCreds, assetPublishingCreds]).join('|');

    expect(commands.includes('synth')).toBeTruthy();
    expect(commands.includes('selfupdate')).toBeFalsy();
    expect(commands.includes('assetpublishing')).toBeFalsy();
  });

  test('defaults to Linux-style commands', () => {
    const creds = cdkp.DockerCredential.dockerHub(secret);

    const defaultCommands = cdkp.dockerCredentialsInstallCommands(cdkp.DockerCredentialUsage.SYNTH, [creds]);
    const linuxCommands = cdkp.dockerCredentialsInstallCommands(cdkp.DockerCredentialUsage.SYNTH, [creds], ec2.OperatingSystemType.LINUX);

    expect(defaultCommands).toEqual(linuxCommands);
  });

  test('Linux commands', () => {
    const creds = cdkp.DockerCredential.customRegistry('example.com', secret);
    const expectedCredsFile = JSON.stringify({
      version: '1.0',
      domainCredentials: {
        'example.com': { secretsManagerSecretId: secretArn },
      },
    });

    const commands = cdkp.dockerCredentialsInstallCommands(cdkp.DockerCredentialUsage.SYNTH, [creds], ec2.OperatingSystemType.LINUX);

    expect(commands).toEqual([
      'mkdir $HOME/.cdk',
      `echo '${expectedCredsFile}' > $HOME/.cdk/cdk-docker-creds.json`,
    ]);
  });

  test('Windows commands', () => {
    const creds = cdkp.DockerCredential.customRegistry('example.com', secret);
    const expectedCredsFile = JSON.stringify({
      version: '1.0',
      domainCredentials: {
        'example.com': { secretsManagerSecretId: secretArn },
      },
    });

    const commands = cdkp.dockerCredentialsInstallCommands(cdkp.DockerCredentialUsage.SYNTH, [creds], ec2.OperatingSystemType.WINDOWS);

    expect(commands).toEqual([
      'mkdir %USERPROFILE%\\.cdk',
      `echo '${expectedCredsFile}' > %USERPROFILE%\\.cdk\\cdk-docker-creds.json`,
    ]);
  });
});
