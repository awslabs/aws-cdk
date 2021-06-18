import * as path from 'path';
import '@aws-cdk/assert-internal/jest';
import { expect as expectStack } from '@aws-cdk/assert-internal';
import { App, Stack } from '@aws-cdk/core';
import { Function, FunctionCode } from '../lib';

describe('CloudFront Function', () => {
  test('minimal example', () => {
    const app = new App();
    const stack = new Stack(app, 'Stack', {
      env: { account: '123456789012', region: 'testregion' },
    });
    new Function(stack, 'CF2', {
      code: FunctionCode.fromInline('code'),
    });

    expectStack(stack).toMatch({
      Resources: {
        CF2D7241DD7: {
          Type: 'AWS::CloudFront::Function',
          Properties: {
            Name: 'testregionStackCF2CE3F783F',
            AutoPublish: true,
            FunctionCode: 'code',
            FunctionConfig: {
              Comment: 'testregionStackCF2CE3F783F',
              Runtime: 'cloudfront-js-1.0',
            },
          },
        },
      },
    });
  });

  test('minimal example in environment agnostic stack', () => {
    const app = new App();
    const stack = new Stack(app, 'Stack');
    new Function(stack, 'CF2', {
      code: FunctionCode.fromInline('code'),
    });

    expectStack(stack).toMatch({
      Resources: {
        CF2D7241DD7: {
          Type: 'AWS::CloudFront::Function',
          Properties: {
            Name: {
              'Fn::Join': [
                '',
                [
                  {
                    Ref: 'AWS::Region',
                  },
                  'StackCF2CE3F783F',
                ],
              ],
            },
            AutoPublish: true,
            FunctionCode: 'code',
            FunctionConfig: {
              Comment: {
                'Fn::Join': [
                  '',
                  [
                    {
                      Ref: 'AWS::Region',
                    },
                    'StackCF2CE3F783F',
                  ],
                ],
              },
              Runtime: 'cloudfront-js-1.0',
            },
          },
        },
      },
    });
  });

  test('maximum example', () => {
    const app = new App();
    const stack = new Stack(app, 'Stack', {
      env: { account: '123456789012', region: 'testregion' },
    });
    new Function(stack, 'CF2', {
      code: FunctionCode.fromInline('code'),
      comment: 'My super comment',
      functionName: 'FunctionName',
    });

    expectStack(stack).toMatch({
      Resources: {
        CF2D7241DD7: {
          Type: 'AWS::CloudFront::Function',
          Properties: {
            Name: 'FunctionName',
            AutoPublish: true,
            FunctionCode: 'code',
            FunctionConfig: {
              Comment: 'My super comment',
              Runtime: 'cloudfront-js-1.0',
            },
          },
        },
      },
    });
  });

  test('code from external file', () => {
    const app = new App();
    const stack = new Stack(app, 'Stack', {
      env: { account: '123456789012', region: 'testregion' },
    });
    new Function(stack, 'CF2', {
      code: FunctionCode.fromFile({ filePath: path.join(__dirname, 'function-code.js') }),
    });

    expectStack(stack).toMatch({
      Resources: {
        CF2D7241DD7: {
          Type: 'AWS::CloudFront::Function',
          Properties: {
            Name: 'testregionStackCF2CE3F783F',
            AutoPublish: true,
            FunctionCode: 'function handler(event) {\n  return event.request;\n}',
            FunctionConfig: {
              Comment: 'testregionStackCF2CE3F783F',
              Runtime: 'cloudfront-js-1.0',
            },
          },
        },
      },
    });
  });
});