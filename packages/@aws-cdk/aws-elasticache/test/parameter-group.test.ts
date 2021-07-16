import { expect as cdkExpect, haveResource } from '@aws-cdk/assert-internal';
import * as cdk from '@aws-cdk/core';
import { CacheParameterGroupFamily, ParameterGroup } from '../lib';

test('create a cache parameter group', () => {
  // GIVEN
  const stack = new cdk.Stack();

  // WHEN
  new ParameterGroup(stack, 'Params', {
    description: 'desc',
    cacheParameterGroupFamily: CacheParameterGroupFamily.REDIS_5_0,
    properties: {
      param: 'value',
    },
  });

  // THEN
  cdkExpect(stack).to(
    haveResource('AWS::ElastiCache::ParameterGroup', {
      Description: 'desc',
      CacheParameterGroupFamily: 'redis5.0',
      Properties: {
        param: 'value',
      },
    }),
  );
});

test('import cache parameter group', () => {
  // GIVEN
  const stack = new cdk.Stack();

  // WHEN
  const pg = ParameterGroup.fromParameterGroupName(stack, 'Params', 'group-name');

  // THEN
  expect(pg.parameterGroupName).toBe('group-name');
});
