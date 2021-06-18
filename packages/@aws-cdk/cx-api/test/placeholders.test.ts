import { EnvironmentPlaceholders, EnvironmentPlaceholderValues, IEnvironmentPlaceholderProvider } from '../lib';

test('complex placeholder substitution', async () => {
  const replacer: IEnvironmentPlaceholderProvider = {
    accountId: () => Promise.resolve('current_account'),
    region: () => Promise.resolve('current_region'),
    partition: () => Promise.resolve('current_partition'),
  };

  expect(await EnvironmentPlaceholders.replaceAsync({
    destinations: {
      theDestination: {
        assumeRoleArn: 'arn:${AWS::Partition}:role-${AWS::AccountId}',
        bucketName: 'some_bucket-${AWS::AccountId}-${AWS::Region}',
        objectKey: 'some_key-${AWS::AccountId}-${AWS::Region}',
      },
    },
  }, replacer)).toEqual({
    destinations: {
      theDestination: {
        assumeRoleArn: 'arn:current_partition:role-current_account',
        bucketName: 'some_bucket-current_account-current_region',
        objectKey: 'some_key-current_account-current_region',
      },
    },
  });
});

test('sync placeholder substitution', () => {
  const replacer: EnvironmentPlaceholderValues = {
    accountId: 'current_account',
    region: 'current_region',
    partition: 'current_partition',
  };

  expect(EnvironmentPlaceholders.replace({
    destinations: {
      theDestination: {
        assumeRoleArn: 'arn:${AWS::Partition}:role-${AWS::AccountId}',
        bucketName: 'some_bucket-${AWS::AccountId}-${AWS::Region}',
        objectKey: 'some_key-${AWS::AccountId}-${AWS::Region}',
      },
    },
  }, replacer)).toEqual({
    destinations: {
      theDestination: {
        assumeRoleArn: 'arn:current_partition:role-current_account',
        bucketName: 'some_bucket-current_account-current_region',
        objectKey: 'some_key-current_account-current_region',
      },
    },
  });
});
