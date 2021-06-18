import { expect as cdkExpect, haveResource } from '@aws-cdk/assert-internal';
import * as cdk from '@aws-cdk/core';
import { ClusterParameterGroup } from '../lib';

test('create a cluster parameter group', () => {
  // GIVEN
  const stack = new cdk.Stack();

  // WHEN
  new ClusterParameterGroup(stack, 'Params', {
    description: 'desc',
    parameters: {
      param: 'value',
    },
  });

  // THEN
  cdkExpect(stack).to(haveResource('AWS::Redshift::ClusterParameterGroup', {
    Description: 'desc',
    ParameterGroupFamily: 'redshift-1.0',
    Parameters: [
      {
        ParameterName: 'param',
        ParameterValue: 'value',
      },
    ],
  }));
});