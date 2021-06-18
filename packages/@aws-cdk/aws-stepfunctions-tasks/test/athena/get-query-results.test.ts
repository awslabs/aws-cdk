import * as cdk from '@aws-cdk/core';
import { AthenaGetQueryResults } from '../../lib/athena/get-query-results';

describe('Get Query Results', () => {
  test('default settings', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const task = new AthenaGetQueryResults(stack, 'Query', {
      queryExecutionId: '2da557a1-7283-4c3d-8af9-058348f0bb02',
    });

    // THEN
    expect(stack.resolve(task.toStateJson())).toEqual({
      Type: 'Task',
      Resource: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              Ref: 'AWS::Partition',
            },
            ':states:::athena:getQueryResults',
          ],
        ],
      },
      End: true,
      Parameters: {
        QueryExecutionId: '2da557a1-7283-4c3d-8af9-058348f0bb02',
      },
    });
  });
});