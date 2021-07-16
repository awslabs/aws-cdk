import '@aws-cdk/assert-internal/jest';
import * as path from 'path';
import { ABSENT, ResourcePart } from '@aws-cdk/assert-internal';
import * as ecr from '@aws-cdk/aws-ecr';
import * as cdk from '@aws-cdk/core';
import * as cxapi from '@aws-cdk/cx-api';
import { testFutureBehavior } from 'cdk-build-tools/lib/feature-flag';
import * as lambda from '../lib';

/* eslint-disable dot-notation */

describe('code', () => {
  describe('lambda.Code.fromInline', () => {
    test('fails if used with unsupported runtimes', () => {
      expect(() => defineFunction(lambda.Code.fromInline('boom'), lambda.Runtime.GO_1_X)).toThrow(/Inline source not allowed for go1\.x/);
      expect(() => defineFunction(lambda.Code.fromInline('boom'), lambda.Runtime.JAVA_8)).toThrow(/Inline source not allowed for java8/);
    });
    test('fails if larger than 4096 bytes', () => {
      expect(() => defineFunction(lambda.Code.fromInline(generateRandomString(4097)), lambda.Runtime.NODEJS_10_X))
        .toThrow(/Lambda source is too large, must be <= 4096 but is 4097/);
    });
  });
  describe('lambda.Code.fromAsset', () => {
    test('fails if a non-zip asset is used', () => {
      // GIVEN
      const fileAsset = lambda.Code.fromAsset(path.join(__dirname, 'my-lambda-handler', 'index.py'));

      // THEN
      expect(() => defineFunction(fileAsset)).toThrow(/Asset must be a \.zip file or a directory/);
    });

    test('only one Asset object gets created even if multiple functions use the same AssetCode', () => {
      // GIVEN
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'MyStack');
      const directoryAsset = lambda.Code.fromAsset(path.join(__dirname, 'my-lambda-handler'));

      // WHEN
      new lambda.Function(stack, 'Func1', {
        handler: 'foom',
        runtime: lambda.Runtime.NODEJS_10_X,
        code: directoryAsset,
      });

      new lambda.Function(stack, 'Func2', {
        handler: 'foom',
        runtime: lambda.Runtime.NODEJS_10_X,
        code: directoryAsset,
      });

      // THEN
      const assembly = app.synth();
      const synthesized = assembly.stacks[0];

      // Func1 has an asset, Func2 does not
      expect(synthesized.assets.length).toEqual(1);
    });

    test('adds code asset metadata', () => {
      // GIVEN
      const stack = new cdk.Stack();
      stack.node.setContext(cxapi.ASSET_RESOURCE_METADATA_ENABLED_CONTEXT, true);

      const location = path.join(__dirname, 'my-lambda-handler');

      // WHEN
      new lambda.Function(stack, 'Func1', {
        code: lambda.Code.fromAsset(location),
        runtime: lambda.Runtime.NODEJS_10_X,
        handler: 'foom',
      });

      // THEN
      expect(stack).toHaveResource('AWS::Lambda::Function', {
        Metadata: {
          [cxapi.ASSET_RESOURCE_METADATA_PATH_KEY]: 'asset.9678c34eca93259d11f2d714177347afd66c50116e1e08996eff893d3ca81232',
          [cxapi.ASSET_RESOURCE_METADATA_PROPERTY_KEY]: 'Code',
        },
      }, ResourcePart.CompleteDefinition);
    });

    test('fails if asset is bound with a second stack', () => {
      // GIVEN
      const asset = lambda.Code.fromAsset(path.join(__dirname, 'my-lambda-handler'));

      const app = new cdk.App();
      const stack1 = new cdk.Stack(app, 'Stack1');
      new lambda.Function(stack1, 'Func', {
        code: asset,
        runtime: lambda.Runtime.NODEJS_10_X,
        handler: 'foom',
      });

      const stack2 = new cdk.Stack(app, 'Stack2');
      expect(() => new lambda.Function(stack2, 'Func', {
        code: asset,
        runtime: lambda.Runtime.NODEJS_10_X,
        handler: 'foom',
      })).toThrow(/already associated/);
    });
  });

  describe('lambda.Code.fromCfnParameters', () => {
    test("automatically creates the Bucket and Key parameters when it's used in a Function", () => {
      const stack = new cdk.Stack();
      const code = new lambda.CfnParametersCode();
      new lambda.Function(stack, 'Function', {
        code,
        runtime: lambda.Runtime.NODEJS_10_X,
        handler: 'index.handler',
      });

      expect(stack).toHaveResourceLike('AWS::Lambda::Function', {
        Code: {
          S3Bucket: {
            Ref: 'FunctionLambdaSourceBucketNameParameter9E9E108F',
          },
          S3Key: {
            Ref: 'FunctionLambdaSourceObjectKeyParameter1C7AED11',
          },
        },
      });

      expect(stack.resolve(code.bucketNameParam)).toEqual('FunctionLambdaSourceBucketNameParameter9E9E108F');
      expect(stack.resolve(code.objectKeyParam)).toEqual('FunctionLambdaSourceObjectKeyParameter1C7AED11');
    });

    test('does not allow accessing the Parameter properties before being used in a Function', () => {
      const code = new lambda.CfnParametersCode();

      expect(() => code.bucketNameParam).toThrow(/bucketNameParam/);

      expect(() => code.objectKeyParam).toThrow(/objectKeyParam/);
    });

    test('allows passing custom Parameters when creating it', () => {
      const stack = new cdk.Stack();
      const bucketNameParam = new cdk.CfnParameter(stack, 'BucketNameParam', {
        type: 'String',
      });
      const bucketKeyParam = new cdk.CfnParameter(stack, 'ObjectKeyParam', {
        type: 'String',
      });

      const code = lambda.Code.fromCfnParameters({
        bucketNameParam,
        objectKeyParam: bucketKeyParam,
      });

      expect(stack.resolve(code.bucketNameParam)).toEqual('BucketNameParam');
      expect(stack.resolve(code.objectKeyParam)).toEqual('ObjectKeyParam');

      new lambda.Function(stack, 'Function', {
        code,
        runtime: lambda.Runtime.NODEJS_10_X,
        handler: 'index.handler',
      });

      expect(stack).toHaveResourceLike('AWS::Lambda::Function', {
        Code: {
          S3Bucket: {
            Ref: 'BucketNameParam',
          },
          S3Key: {
            Ref: 'ObjectKeyParam',
          },
        },
      });
    });

    test('can assign parameters', () => {
      // given
      const stack = new cdk.Stack();
      const code = new lambda.CfnParametersCode({
        bucketNameParam: new cdk.CfnParameter(stack, 'BucketNameParam', {
          type: 'String',
        }),
        objectKeyParam: new cdk.CfnParameter(stack, 'ObjectKeyParam', {
          type: 'String',
        }),
      });

      // when
      const overrides = stack.resolve(code.assign({
        bucketName: 'SomeBucketName',
        objectKey: 'SomeObjectKey',
      }));

      // then
      expect(overrides['BucketNameParam']).toEqual('SomeBucketName');
      expect(overrides['ObjectKeyParam']).toEqual('SomeObjectKey');
    });
  });

  describe('lambda.Code.fromEcr', () => {
    test('repository uri is correctly identified', () => {
      // given
      const stack = new cdk.Stack();
      const repo = new ecr.Repository(stack, 'Repo');

      // when
      new lambda.Function(stack, 'Fn', {
        code: lambda.Code.fromEcrImage(repo),
        handler: lambda.Handler.FROM_IMAGE,
        runtime: lambda.Runtime.FROM_IMAGE,
      });

      // then
      expect(stack).toHaveResource('AWS::Lambda::Function', {
        Code: {
          ImageUri: stack.resolve(repo.repositoryUriForTag('latest')),
        },
        ImageConfig: ABSENT,
      });
    });

    test('props are correctly resolved', () => {
      // given
      const stack = new cdk.Stack();
      const repo = new ecr.Repository(stack, 'Repo');

      // when
      new lambda.Function(stack, 'Fn', {
        code: lambda.Code.fromEcrImage(repo, {
          cmd: ['cmd', 'param1'],
          entrypoint: ['entrypoint', 'param2'],
          tag: 'mytag',
        }),
        handler: lambda.Handler.FROM_IMAGE,
        runtime: lambda.Runtime.FROM_IMAGE,
      });

      // then
      expect(stack).toHaveResource('AWS::Lambda::Function', {
        Code: {
          ImageUri: stack.resolve(repo.repositoryUriForTag('mytag')),
        },
        ImageConfig: {
          Command: ['cmd', 'param1'],
          EntryPoint: ['entrypoint', 'param2'],
        },
      });
    });

    test('permission grants', () => {
      // given
      const stack = new cdk.Stack();
      const repo = new ecr.Repository(stack, 'Repo');

      // when
      new lambda.Function(stack, 'Fn', {
        code: lambda.Code.fromEcrImage(repo),
        handler: lambda.Handler.FROM_IMAGE,
        runtime: lambda.Runtime.FROM_IMAGE,
      });

      // then
      expect(stack).toHaveResourceLike('AWS::ECR::Repository', {
        RepositoryPolicyText: {
          Statement: [
            {
              Action: [
                'ecr:BatchCheckLayerAvailability',
                'ecr:GetDownloadUrlForLayer',
                'ecr:BatchGetImage',
              ],
              Effect: 'Allow',
              Principal: {
                Service: 'lambda.amazonaws.com',
              },
            },
          ],
        },
      });
    });
  });

  describe('lambda.Code.fromImageAsset', () => {
    const flags = { [cxapi.DOCKER_IGNORE_SUPPORT]: true };
    testFutureBehavior('repository uri is correctly identified', flags, cdk.App, (app) => {
      // given
      const stack = new cdk.Stack(app);

      // when
      new lambda.Function(stack, 'Fn', {
        code: lambda.Code.fromAssetImage(path.join(__dirname, 'docker-lambda-handler')),
        handler: lambda.Handler.FROM_IMAGE,
        runtime: lambda.Runtime.FROM_IMAGE,
      });

      // then
      expect(stack).toHaveResource('AWS::Lambda::Function', {
        Code: {
          ImageUri: {
            'Fn::Join': ['', [
              { Ref: 'AWS::AccountId' },
              '.dkr.ecr.',
              { Ref: 'AWS::Region' },
              '.',
              { Ref: 'AWS::URLSuffix' },
              '/aws-cdk/assets:f0fe8a410cb4b860a25f6f3e09237abf69cd38ab59f9ef2441597c75f598c634',
            ]],
          },
        },
        ImageConfig: ABSENT,
      });
    });

    test('props are correctly resolved', () => {
      // given
      const stack = new cdk.Stack();

      // when
      new lambda.Function(stack, 'Fn', {
        code: lambda.Code.fromAssetImage(path.join(__dirname, 'docker-lambda-handler'), {
          cmd: ['cmd', 'param1'],
          entrypoint: ['entrypoint', 'param2'],
        }),
        handler: lambda.Handler.FROM_IMAGE,
        runtime: lambda.Runtime.FROM_IMAGE,
      });

      // then
      expect(stack).toHaveResource('AWS::Lambda::Function', {
        ImageConfig: {
          Command: ['cmd', 'param1'],
          EntryPoint: ['entrypoint', 'param2'],
        },
      });
    });
  });

  describe('lambda.Code.fromDockerBuild', () => {
    let fromBuildMock: jest.SpyInstance<cdk.DockerImage>;
    let cpMock: jest.Mock<any, any>;

    beforeEach(() => {
      cpMock = jest.fn().mockReturnValue(path.join(__dirname, 'docker-build-lambda'));
      fromBuildMock = jest.spyOn(cdk.DockerImage, 'fromBuild').mockImplementation(() => ({
        cp: cpMock,
        image: 'tag',
        run: jest.fn(),
        toJSON: jest.fn(),
      }));
    });

    afterEach(() => {
      fromBuildMock.mockRestore();
    });

    test('can use the result of a Docker build as an asset', () => {
      // given
      const stack = new cdk.Stack();
      stack.node.setContext(cxapi.ASSET_RESOURCE_METADATA_ENABLED_CONTEXT, true);

      // when
      new lambda.Function(stack, 'Fn', {
        code: lambda.Code.fromDockerBuild(path.join(__dirname, 'docker-build-lambda')),
        handler: 'index.handler',
        runtime: lambda.Runtime.NODEJS_12_X,
      });

      // then
      expect(stack).toHaveResource('AWS::Lambda::Function', {
        Metadata: {
          [cxapi.ASSET_RESOURCE_METADATA_PATH_KEY]: 'asset.fbafdbb9ae8d1bae0def415b791a93c486d18ebc63270c748abecc3ac0ab9533',
          [cxapi.ASSET_RESOURCE_METADATA_PROPERTY_KEY]: 'Code',
        },
      }, ResourcePart.CompleteDefinition);

      expect(fromBuildMock).toHaveBeenCalledWith(path.join(__dirname, 'docker-build-lambda'), {});
      expect(cpMock).toHaveBeenCalledWith('/asset/.', undefined);
    });

    test('fromDockerBuild appends /. to an image path not ending with a /', () => {
      // given
      const stack = new cdk.Stack();

      // when
      new lambda.Function(stack, 'Fn', {
        code: lambda.Code.fromDockerBuild(path.join(__dirname, 'docker-build-lambda'), {
          imagePath: '/my/image/path',
        }),
        handler: 'index.handler',
        runtime: lambda.Runtime.NODEJS_12_X,
      });

      // then
      expect(cpMock).toHaveBeenCalledWith('/my/image/path/.', undefined);
    });

    test('fromDockerBuild appends . to an image path ending with a /', () => {
      // given
      const stack = new cdk.Stack();

      // when
      new lambda.Function(stack, 'Fn', {
        code: lambda.Code.fromDockerBuild(path.join(__dirname, 'docker-build-lambda'), {
          imagePath: '/my/image/path/',
        }),
        handler: 'index.handler',
        runtime: lambda.Runtime.NODEJS_12_X,
      });

      // then
      expect(cpMock).toHaveBeenCalledWith('/my/image/path/.', undefined);
    });
  });
});

function defineFunction(code: lambda.Code, runtime: lambda.Runtime = lambda.Runtime.NODEJS_10_X) {
  const stack = new cdk.Stack();
  return new lambda.Function(stack, 'Func', {
    handler: 'foom',
    code,
    runtime,
  });
}

function generateRandomString(bytes: number) {
  let s = '';
  for (let i = 0; i < bytes; ++i) {
    s += String.fromCharCode(Math.round(Math.random() * 256));
  }
  return s;
}
