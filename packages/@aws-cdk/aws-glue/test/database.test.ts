import { deepEqual, throws } from 'assert';
import { expect } from '@aws-cdk/assert-internal';
import '@aws-cdk/assert-internal/jest';
import { Stack } from '@aws-cdk/core';
import * as glue from '../lib';

test('default database does not create a bucket', () => {
  const stack = new Stack();

  new glue.Database(stack, 'Database', {
    databaseName: 'test_database',
  });

  expect(stack).toMatch({
    Resources: {
      DatabaseB269D8BB: {
        Type: 'AWS::Glue::Database',
        Properties: {
          CatalogId: {
            Ref: 'AWS::AccountId',
          },
          DatabaseInput: {
            Name: 'test_database',
          },
        },
      },
    },
  });
});

test('explicit locationURI', () => {
  const stack = new Stack();

  new glue.Database(stack, 'Database', {
    databaseName: 'test_database',
    locationUri: 's3://my-uri/',
  });

  expect(stack).toMatch({
    Resources: {
      DatabaseB269D8BB: {
        Type: 'AWS::Glue::Database',
        Properties: {
          CatalogId: {
            Ref: 'AWS::AccountId',
          },
          DatabaseInput: {
            LocationUri: 's3://my-uri/',
            Name: 'test_database',
          },
        },
      },
    },
  });
});

test('fromDatabase', () => {
  // GIVEN
  const stack = new Stack();

  // WHEN
  const database = glue.Database.fromDatabaseArn(stack, 'import', 'arn:aws:glue:us-east-1:123456789012:database/db1');

  // THEN
  deepEqual(database.databaseArn, 'arn:aws:glue:us-east-1:123456789012:database/db1');
  deepEqual(database.databaseName, 'db1');
  deepEqual(stack.resolve(database.catalogArn), {
    'Fn::Join': ['',
      ['arn:', { Ref: 'AWS::Partition' }, ':glue:', { Ref: 'AWS::Region' }, ':', { Ref: 'AWS::AccountId' }, ':catalog']],
  });
  deepEqual(stack.resolve(database.catalogId), { Ref: 'AWS::AccountId' });
});

test('locationUri length must be >= 1', () => {
  const stack = new Stack();
  throws(() =>
    new glue.Database(stack, 'Database', {
      databaseName: 'test_database',
      locationUri: '',
    }),
  );
});

test('locationUri length must be <= 1024', () => {
  const stack = new Stack();
  throws(() =>
    new glue.Database(stack, 'Database', {
      databaseName: 'test_database',
      locationUri: 'a'.repeat(1025),
    }),
  );
});
