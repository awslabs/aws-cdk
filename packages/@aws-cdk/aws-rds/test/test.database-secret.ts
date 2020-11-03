import { expect, haveResource } from '@aws-cdk/assert';
import { CfnResource, Stack } from '@aws-cdk/core';
import { Test } from 'nodeunit';
import { DatabaseSecret } from '../lib';
import { DEFAULT_PASSWORD_EXCLUDE_CHARS } from '../lib/private/util';

export = {
  'create a database secret'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const dbSecret = new DatabaseSecret(stack, 'Secret', {
      username: 'admin-username',
    });

    // THEN
    expect(stack).to(haveResource('AWS::SecretsManager::Secret', {
      Description: {
        'Fn::Join': [
          '',
          [
            'Generated by the CDK for stack: ',
            {
              Ref: 'AWS::StackName',
            },
          ],
        ],
      },
      GenerateSecretString: {
        ExcludeCharacters: DEFAULT_PASSWORD_EXCLUDE_CHARS,
        GenerateStringKey: 'password',
        PasswordLength: 30,
        SecretStringTemplate: '{"username":"admin-username"}',
      },
    }));

    test.equal(getSecretLogicalId(dbSecret, stack), 'SecretA720EF05');

    test.done();
  },

  'with master secret'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const masterSecret = new DatabaseSecret(stack, 'MasterSecret', {
      username: 'master-username',
    });

    // WHEN
    new DatabaseSecret(stack, 'UserSecret', {
      username: 'user-username',
      masterSecret,
      excludeCharacters: '"@/\\',
    });

    // THEN
    expect(stack).to(haveResource('AWS::SecretsManager::Secret', {
      GenerateSecretString: {
        ExcludeCharacters: '"@/\\',
        GenerateStringKey: 'password',
        PasswordLength: 30,
        SecretStringTemplate: {
          'Fn::Join': [
            '',
            [
              '{"username":"user-username","masterarn":"',
              {
                Ref: 'MasterSecretA11BF785',
              },
              '"}',
            ],
          ],
        },
      },
    }));

    test.done();
  },

  'override logical id'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const dbSecret = new DatabaseSecret(stack, 'Secret', {
      username: 'admin',
      overrideLogicalId: true,
    });

    // THEN
    const dbSecretlogicalId = getSecretLogicalId(dbSecret, stack);
    test.equal(dbSecretlogicalId, 'Secret67c4a95c1a883c928ce8fb163b412fe3');

    // same node path but other excluded characters
    stack.node.tryRemoveChild('Secret');
    const otherSecret1 = new DatabaseSecret(stack, 'Secret', {
      username: 'admin',
      overrideLogicalId: true,
      excludeCharacters: '@!()[]',
    });
    test.notEqual(dbSecretlogicalId, getSecretLogicalId(otherSecret1, stack));

    // other node path but same excluded characters
    const otherSecret2 = new DatabaseSecret(stack, 'Secret2', {
      username: 'admin',
      overrideLogicalId: true,
    });
    test.notEqual(dbSecretlogicalId, getSecretLogicalId(otherSecret2, stack));

    test.done();
  },
};

function getSecretLogicalId(dbSecret: DatabaseSecret, stack: Stack): string {
  const cfnSecret = dbSecret.node.defaultChild as CfnResource;
  return stack.resolve(cfnSecret.logicalId);
}
