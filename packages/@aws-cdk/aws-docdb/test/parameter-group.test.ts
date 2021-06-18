import { expect, haveResource } from '@aws-cdk/assert-internal';
import { Stack } from '@aws-cdk/core';
import { ClusterParameterGroup } from '../lib';

describe('ClusterParameterGroup', () => {
  test('check that instantiation works', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new ClusterParameterGroup(stack, 'Params', {
      family: 'hello',
      description: 'desc',
      parameters: {
        key: 'value',
      },
    });

    // THEN
    expect(stack).to(haveResource('AWS::DocDB::DBClusterParameterGroup', {
      Description: 'desc',
      Family: 'hello',
      Parameters: {
        key: 'value',
      },
    }));
  });

  test('check automatically generated descriptions', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new ClusterParameterGroup(stack, 'Params', {
      family: 'hello',
      parameters: {
        key: 'value',
      },
    });

    // THEN
    expect(stack).to(haveResource('AWS::DocDB::DBClusterParameterGroup', {
      Description: 'Cluster parameter group for hello',
      Family: 'hello',
      Parameters: {
        key: 'value',
      },
    }));
  });
});
