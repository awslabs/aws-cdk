import '@aws-cdk/assert-internal/jest';
import { ResourcePart } from '@aws-cdk/assert-internal';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import { Duration, Stack } from '@aws-cdk/core';
import { AuthorizationType, IdentitySource, RequestAuthorizer, RestApi, TokenAuthorizer } from '../../lib';

describe('lambda authorizer', () => {
  test('default token authorizer', () => {
    const stack = new Stack();

    const func = new lambda.Function(stack, 'myfunction', {
      handler: 'handler',
      code: lambda.Code.fromInline('foo'),
      runtime: lambda.Runtime.NODEJS_10_X,
    });

    const auth = new TokenAuthorizer(stack, 'myauthorizer', {
      handler: func,
    });

    const restApi = new RestApi(stack, 'myrestapi');
    restApi.root.addMethod('ANY', undefined, {
      authorizer: auth,
      authorizationType: AuthorizationType.CUSTOM,
    });

    expect(stack).toHaveResource('AWS::ApiGateway::Authorizer', {
      Type: 'TOKEN',
      RestApiId: stack.resolve(restApi.restApiId),
      IdentitySource: 'method.request.header.Authorization',
      AuthorizerUri: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              Ref: 'AWS::Partition',
            },
            ':apigateway:',
            {
              Ref: 'AWS::Region',
            },
            ':lambda:path/2015-03-31/functions/',
            {
              'Fn::GetAtt': ['myfunction9B95E948', 'Arn'],
            },
            '/invocations',
          ],
        ],
      },
    });

    expect(stack).toHaveResource('AWS::Lambda::Permission', {
      Action: 'lambda:InvokeFunction',
      Principal: 'apigateway.amazonaws.com',
    });

    expect(auth.authorizerArn.endsWith(`/authorizers/${auth.authorizerId}`)).toBeTruthy();
  });

  test('default request authorizer', () => {
    const stack = new Stack();

    const func = new lambda.Function(stack, 'myfunction', {
      handler: 'handler',
      code: lambda.Code.fromInline('foo'),
      runtime: lambda.Runtime.NODEJS_12_X,
    });

    const auth = new RequestAuthorizer(stack, 'myauthorizer', {
      handler: func,
      resultsCacheTtl: Duration.seconds(0),
      identitySources: [],
    });

    const restApi = new RestApi(stack, 'myrestapi');
    restApi.root.addMethod('ANY', undefined, {
      authorizer: auth,
      authorizationType: AuthorizationType.CUSTOM,
    });

    expect(stack).toHaveResource('AWS::ApiGateway::Authorizer', {
      Type: 'REQUEST',
      RestApiId: stack.resolve(restApi.restApiId),
      AuthorizerUri: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              Ref: 'AWS::Partition',
            },
            ':apigateway:',
            {
              Ref: 'AWS::Region',
            },
            ':lambda:path/2015-03-31/functions/',
            {
              'Fn::GetAtt': ['myfunction9B95E948', 'Arn'],
            },
            '/invocations',
          ],
        ],
      },
    });

    expect(stack).toHaveResource('AWS::Lambda::Permission', {
      Action: 'lambda:InvokeFunction',
      Principal: 'apigateway.amazonaws.com',
    });

    expect(auth.authorizerArn.endsWith(`/authorizers/${auth.authorizerId}`)).toBeTruthy();
  });

  test('invalid request authorizer config', () => {
    const stack = new Stack();

    const func = new lambda.Function(stack, 'myfunction', {
      handler: 'handler',
      code: lambda.Code.fromInline('foo'),
      runtime: lambda.Runtime.NODEJS_12_X,
    });

    expect(() => new RequestAuthorizer(stack, 'myauthorizer', {
      handler: func,
      resultsCacheTtl: Duration.seconds(1),
      identitySources: [],
    })).toThrow('At least one Identity Source is required for a REQUEST-based Lambda authorizer if caching is enabled.');
  });

  test('token authorizer with all parameters specified', () => {
    const stack = new Stack();

    const func = new lambda.Function(stack, 'myfunction', {
      handler: 'handler',
      code: lambda.Code.fromInline('foo'),
      runtime: lambda.Runtime.NODEJS_10_X,
    });

    const auth = new TokenAuthorizer(stack, 'myauthorizer', {
      handler: func,
      identitySource: 'method.request.header.whoami',
      validationRegex: 'a-hacker',
      authorizerName: 'myauthorizer',
      resultsCacheTtl: Duration.minutes(1),
    });

    const restApi = new RestApi(stack, 'myrestapi');
    restApi.root.addMethod('ANY', undefined, {
      authorizer: auth,
      authorizationType: AuthorizationType.CUSTOM,
    });

    expect(stack).toHaveResource('AWS::ApiGateway::Authorizer', {
      Type: 'TOKEN',
      RestApiId: stack.resolve(restApi.restApiId),
      IdentitySource: 'method.request.header.whoami',
      IdentityValidationExpression: 'a-hacker',
      Name: 'myauthorizer',
      AuthorizerResultTtlInSeconds: 60,
      AuthorizerUri: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              Ref: 'AWS::Partition',
            },
            ':apigateway:',
            {
              Ref: 'AWS::Region',
            },
            ':lambda:path/2015-03-31/functions/',
            {
              'Fn::GetAtt': ['myfunction9B95E948', 'Arn'],
            },
            '/invocations',
          ],
        ],
      },
    });
  });

  test('request authorizer with all parameters specified', () => {
    const stack = new Stack();

    const func = new lambda.Function(stack, 'myfunction', {
      handler: 'handler',
      code: lambda.Code.fromInline('foo'),
      runtime: lambda.Runtime.NODEJS_12_X,
    });

    const auth = new RequestAuthorizer(stack, 'myauthorizer', {
      handler: func,
      identitySources: [IdentitySource.header('whoami')],
      authorizerName: 'myauthorizer',
      resultsCacheTtl: Duration.minutes(1),
    });

    const restApi = new RestApi(stack, 'myrestapi');
    restApi.root.addMethod('ANY', undefined, {
      authorizer: auth,
      authorizationType: AuthorizationType.CUSTOM,
    });

    expect(stack).toHaveResource('AWS::ApiGateway::Authorizer', {
      Type: 'REQUEST',
      RestApiId: stack.resolve(restApi.restApiId),
      IdentitySource: 'method.request.header.whoami',
      Name: 'myauthorizer',
      AuthorizerResultTtlInSeconds: 60,
      AuthorizerUri: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              Ref: 'AWS::Partition',
            },
            ':apigateway:',
            {
              Ref: 'AWS::Region',
            },
            ':lambda:path/2015-03-31/functions/',
            {
              'Fn::GetAtt': ['myfunction9B95E948', 'Arn'],
            },
            '/invocations',
          ],
        ],
      },
    });
  });

  test('token authorizer with assume role', () => {
    const stack = new Stack();

    const func = new lambda.Function(stack, 'myfunction', {
      handler: 'handler',
      code: lambda.Code.fromInline('foo'),
      runtime: lambda.Runtime.NODEJS_10_X,
    });

    const role = new iam.Role(stack, 'authorizerassumerole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      roleName: 'authorizerassumerole',
    });

    const auth = new TokenAuthorizer(stack, 'myauthorizer', {
      handler: func,
      assumeRole: role,
    });

    const restApi = new RestApi(stack, 'myrestapi');
    restApi.root.addMethod('ANY', undefined, {
      authorizer: auth,
      authorizationType: AuthorizationType.CUSTOM,
    });

    expect(stack).toHaveResource('AWS::ApiGateway::Authorizer', {
      Type: 'TOKEN',
      RestApiId: stack.resolve(restApi.restApiId),
      AuthorizerUri: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              Ref: 'AWS::Partition',
            },
            ':apigateway:',
            {
              Ref: 'AWS::Region',
            },
            ':lambda:path/2015-03-31/functions/',
            {
              'Fn::GetAtt': ['myfunction9B95E948', 'Arn'],
            },
            '/invocations',
          ],
        ],
      },
    });

    expect(stack).toHaveResource('AWS::IAM::Role');

    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      Roles: [
        stack.resolve(role.roleName),
      ],
      PolicyDocument: {
        Statement: [
          {
            Resource: stack.resolve(func.functionArn),
            Action: 'lambda:InvokeFunction',
            Effect: 'Allow',
          },
        ],
      },
    }, ResourcePart.Properties);

    expect(stack).not.toHaveResource('AWS::Lambda::Permission');
  });

  test('request authorizer with assume role', () => {
    const stack = new Stack();

    const func = new lambda.Function(stack, 'myfunction', {
      handler: 'handler',
      code: lambda.Code.fromInline('foo'),
      runtime: lambda.Runtime.NODEJS_12_X,
    });

    const role = new iam.Role(stack, 'authorizerassumerole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      roleName: 'authorizerassumerole',
    });

    const auth = new RequestAuthorizer(stack, 'myauthorizer', {
      handler: func,
      assumeRole: role,
      resultsCacheTtl: Duration.seconds(0),
      identitySources: [],
    });

    const restApi = new RestApi(stack, 'myrestapi');
    restApi.root.addMethod('ANY', undefined, {
      authorizer: auth,
      authorizationType: AuthorizationType.CUSTOM,
    });

    expect(stack).toHaveResource('AWS::ApiGateway::Authorizer', {
      Type: 'REQUEST',
      RestApiId: stack.resolve(restApi.restApiId),
      AuthorizerUri: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              Ref: 'AWS::Partition',
            },
            ':apigateway:',
            {
              Ref: 'AWS::Region',
            },
            ':lambda:path/2015-03-31/functions/',
            {
              'Fn::GetAtt': ['myfunction9B95E948', 'Arn'],
            },
            '/invocations',
          ],
        ],
      },
    });

    expect(stack).toHaveResource('AWS::IAM::Role');

    expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
      Roles: [
        stack.resolve(role.roleName),
      ],
      PolicyDocument: {
        Statement: [
          {
            Resource: stack.resolve(func.functionArn),
            Action: 'lambda:InvokeFunction',
            Effect: 'Allow',
          },
        ],
      },
    }, ResourcePart.Properties);

    expect(stack).not.toHaveResource('AWS::Lambda::Permission');
  });

  test('token authorizer throws when not attached to a rest api', () => {
    const stack = new Stack();
    const func = new lambda.Function(stack, 'myfunction', {
      handler: 'handler',
      code: lambda.Code.fromInline('foo'),
      runtime: lambda.Runtime.NODEJS_12_X,
    });
    const auth = new TokenAuthorizer(stack, 'myauthorizer', {
      handler: func,
    });

    expect(() => stack.resolve(auth.authorizerArn)).toThrow(/must be attached to a RestApi/);
  });

  test('request authorizer throws when not attached to a rest api', () => {
    const stack = new Stack();
    const func = new lambda.Function(stack, 'myfunction', {
      handler: 'handler',
      code: lambda.Code.fromInline('foo'),
      runtime: lambda.Runtime.NODEJS_12_X,
    });
    const auth = new RequestAuthorizer(stack, 'myauthorizer', {
      handler: func,
      identitySources: [IdentitySource.header('myheader')],
    });

    expect(() => stack.resolve(auth.authorizerArn)).toThrow(/must be attached to a RestApi/);
  });
});
