import { ABSENT, expect, haveResource, haveResourceLike } from '@aws-cdk/assert';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as cdk from '@aws-cdk/core';
import { Test } from 'nodeunit';
import * as apigw from '../lib';
import { AuthorizationType, Authorizer } from '../lib';

const DUMMY_AUTHORIZER: apigw.IAuthorizer = {
  authorizerId: 'dummyauthorizer',
  authorizationType: apigw.AuthorizationType.CUSTOM,
};

export = {
  'default setup'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const api = new apigw.RestApi(stack, 'test-api', { cloudWatchRole: false, deploy: false });

    // WHEN
    new apigw.Method(stack, 'my-method', {
      httpMethod: 'POST',
      resource: api.root,
    });

    // THEN
    expect(stack).to(haveResource('AWS::ApiGateway::Method', {
      HttpMethod: 'POST',
      AuthorizationType: 'NONE',
      Integration: {
        Type: 'MOCK',
      },
    }));

    test.done();
  },

  'method options can be specified'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const api = new apigw.RestApi(stack, 'test-api', { cloudWatchRole: false, deploy: false });

    // WHEN
    new apigw.Method(stack, 'my-method', {
      httpMethod: 'POST',
      resource: api.root,
      options: {
        apiKeyRequired: true,
        operationName: 'MyOperation',
      },
    });

    // THEN
    expect(stack).to(haveResource('AWS::ApiGateway::Method', {
      ApiKeyRequired: true,
      OperationName: 'MyOperation',
    }));

    test.done();
  },

  'method options do not override auth config on OPTIONS method'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const api = new apigw.RestApi(stack, 'test-api', { cloudWatchRole: false, deploy: false });

    // WHEN
    new apigw.Method(stack, 'my-method', {
      httpMethod: 'OPTIONS',
      resource: api.root,
      options: {
        apiKeyRequired: true,
        operationName: 'MyOperation',
      },
    });

    // THEN
    expect(stack).to(haveResource('AWS::ApiGateway::Method', {
      ApiKeyRequired: false,
      OperationName: 'MyOperation',
    }));

    test.done();
  },

  '"defaultMethodOptions" do not override auth config on OPTIONS method'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const api = new apigw.RestApi(stack, 'test-api', { cloudWatchRole: false, deploy: false, defaultMethodOptions: {
      apiKeyRequired: true,
      authorizationType: AuthorizationType.IAM,
      authorizer: DUMMY_AUTHORIZER
    } });

    // WHEN
    new apigw.Method(stack, 'my-method', {
      httpMethod: 'OPTIONS',
      resource: api.root,
    });

    // THEN
    expect(stack).to(haveResource('AWS::ApiGateway::Method', {
      ApiKeyRequired: false,
      AuthorizationType: 'NONE',
      AuthorizerId: '',
    }));

    test.done();
  },

  'integration can be set via a property'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const api = new apigw.RestApi(stack, 'test-api', { cloudWatchRole: false, deploy: false });

    // WHEN
    new apigw.Method(stack, 'my-method', {
      httpMethod: 'POST',
      resource: api.root,
      integration: new apigw.AwsIntegration({ service: 's3', path: 'bucket/key' }),
    });

    // THEN
    expect(stack).to(haveResource('AWS::ApiGateway::Method', {
      Integration: {
        IntegrationHttpMethod: 'POST',
        Type: 'AWS',
        Uri: {
          'Fn::Join': [
            '',
            [
              'arn:', { Ref: 'AWS::Partition' }, ':apigateway:',
              { Ref: 'AWS::Region' }, ':s3:path/bucket/key',
            ],
          ],
        },
      },
    }));

    test.done();
  },

  'integration with a custom http method can be set via a property'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const api = new apigw.RestApi(stack, 'test-api', { cloudWatchRole: false, deploy: false });

    // WHEN
    new apigw.Method(stack, 'my-method', {
      httpMethod: 'POST',
      resource: api.root,
      integration: new apigw.AwsIntegration({ service: 's3', path: 'bucket/key', integrationHttpMethod: 'GET' }),
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::ApiGateway::Method', {
      Integration: {
        IntegrationHttpMethod: 'GET',
      },
    }));

    test.done();
  },

  'use default integration from api'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const defaultIntegration = new apigw.Integration({ type: apigw.IntegrationType.HTTP_PROXY, uri: 'https://amazon.com' });
    const api = new apigw.RestApi(stack, 'test-api', {
      cloudWatchRole: false,
      deploy: false,
      defaultIntegration,
    });

    // WHEN
    new apigw.Method(stack, 'my-method', {
      httpMethod: 'POST',
      resource: api.root,
    });

    // THEN
    expect(stack).to(haveResource('AWS::ApiGateway::Method', {
      Integration: {
        Type: 'HTTP_PROXY',
        Uri: 'https://amazon.com',
      },
    }));

    test.done();
  },

  '"methodArn" returns the ARN execute-api ARN for this method in the current stage'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const api = new apigw.RestApi(stack, 'test-api');

    // WHEN
    const method = new apigw.Method(stack, 'my-method', {
      httpMethod: 'POST',
      resource: api.root,
    });

    // THEN
    test.deepEqual(stack.resolve(method.methodArn), {
      'Fn::Join': [
        '',
        [
          'arn:',
          { Ref: 'AWS::Partition' },
          ':execute-api:',
          { Ref: 'AWS::Region' },
          ':',
          { Ref: 'AWS::AccountId' },
          ':',
          { Ref: 'testapiD6451F70' },
          '/',
          { Ref: 'testapiDeploymentStageprod5C9E92A4' },
          '/POST/',
        ],
      ],
    });

    test.done();
  },

  '"testMethodArn" returns the ARN of the "test-invoke-stage" stage (console UI)'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const api = new apigw.RestApi(stack, 'test-api');

    // WHEN
    const method = new apigw.Method(stack, 'my-method', {
      httpMethod: 'POST',
      resource: api.root,
    });

    // THEN
    test.deepEqual(stack.resolve(method.testMethodArn), {
      'Fn::Join': [
        '',
        [
          'arn:',
          { Ref: 'AWS::Partition' },
          ':execute-api:',
          { Ref: 'AWS::Region' },
          ':',
          { Ref: 'AWS::AccountId' },
          ':',
          { Ref: 'testapiD6451F70' },
          '/test-invoke-stage/POST/',
        ],
      ],
    });

    test.done();
  },

  '"methodArn" returns an arn with "*" as its stage when deploymentStage is not set'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const api = new apigw.RestApi(stack, 'test-api', { deploy: false });

    // WHEN
    const method = new apigw.Method(stack, 'my-method', { httpMethod: 'POST', resource: api.root });

    // THEN
    test.deepEqual(stack.resolve(method.methodArn), {
      'Fn::Join': [
        '',
        [
          'arn:',
          { Ref: 'AWS::Partition' },
          ':execute-api:',
          { Ref: 'AWS::Region' },
          ':',
          { Ref: 'AWS::AccountId' },
          ':',
          { Ref: 'testapiD6451F70' },
          '/*/POST/',
        ],
      ],
    });

    test.done();
  },

  '"methodArn" and "testMethodArn" replace path parameters with asterisks'(test: Test) {
    const stack = new cdk.Stack();
    const api = new apigw.RestApi(stack, 'test-api');
    const petId = api.root.addResource('pets').addResource('{petId}');
    const commentId = petId.addResource('comments').addResource('{commentId}');
    const method = commentId.addMethod('GET');

    test.deepEqual(stack.resolve(method.methodArn), {
      'Fn::Join': [
        '',
        [
          'arn:',
          { Ref: 'AWS::Partition' },
          ':execute-api:',
          { Ref: 'AWS::Region' },
          ':',
          { Ref: 'AWS::AccountId' },
          ':',
          { Ref: 'testapiD6451F70' },
          '/',
          { Ref: 'testapiDeploymentStageprod5C9E92A4' },
          '/GET/pets/*/comments/*',
        ],
      ],
    });

    test.deepEqual(stack.resolve(method.testMethodArn), {
      'Fn::Join': [
        '',
        [
          'arn:',
          { Ref: 'AWS::Partition' },
          ':execute-api:',
          { Ref: 'AWS::Region' },
          ':',
          { Ref: 'AWS::AccountId' },
          ':',
          { Ref: 'testapiD6451F70' },
          '/test-invoke-stage/GET/pets/*/comments/*',
        ],
      ],
    });

    test.done();
  },

  'integration "credentialsRole" can be used to assume a role when calling backend'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const api = new apigw.RestApi(stack, 'test-api', { deploy: false });
    const role = new iam.Role(stack, 'MyRole', { assumedBy: new iam.ServicePrincipal('foo') });

    // WHEN
    api.root.addMethod('GET', new apigw.Integration({
      type: apigw.IntegrationType.AWS_PROXY,
      options: {
        credentialsRole: role,
      },
    }));

    // THEN
    expect(stack).to(haveResourceLike('AWS::ApiGateway::Method', {
      Integration: {
        Credentials: { 'Fn::GetAtt': [ 'MyRoleF48FFE04', 'Arn' ] },
      },
    }));
    test.done();
  },

  'integration "credentialsPassthrough" can be used to passthrough user credentials to backend'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const api = new apigw.RestApi(stack, 'test-api', { deploy: false });

    // WHEN
    api.root.addMethod('GET', new apigw.Integration({
      type: apigw.IntegrationType.AWS_PROXY,
      options: {
        credentialsPassthrough: true,
      },
    }));

    // THEN
    expect(stack).to(haveResourceLike('AWS::ApiGateway::Method', {
      Integration: {
        Credentials: { 'Fn::Join': [ '', [ 'arn:', { Ref: 'AWS::Partition' }, ':iam::*:user/*' ] ] },
      },
    }));
    test.done();
  },

  'integration "credentialsRole" and "credentialsPassthrough" are mutually exclusive'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const api = new apigw.RestApi(stack, 'test-api', { deploy: false });
    const role = new iam.Role(stack, 'MyRole', { assumedBy: new iam.ServicePrincipal('foo') });

    // WHEN
    const integration = new apigw.Integration({
      type: apigw.IntegrationType.AWS_PROXY,
      options: {
        credentialsPassthrough: true,
        credentialsRole: role,
      },
    });

    // THEN
    test.throws(() => api.root.addMethod('GET', integration), /'credentialsPassthrough' and 'credentialsRole' are mutually exclusive/);
    test.done();
  },

  'integration connectionType VpcLink requires vpcLink to be set'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const api = new apigw.RestApi(stack, 'test-api', { deploy: false });

    // WHEN
    const integration = new apigw.Integration({
      type: apigw.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: 'ANY',
      options: {
        connectionType: apigw.ConnectionType.VPC_LINK,
      },
    });

    // THEN
    test.throws(() => api.root.addMethod('GET', integration), /'connectionType' of VPC_LINK requires 'vpcLink' prop to be set/);
    test.done();
  },

  'connectionType of INTERNET and vpcLink are mutually exclusive'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const api = new apigw.RestApi(stack, 'test-api', { deploy: false });
    const vpc = new ec2.Vpc(stack, 'VPC');
    const nlb = new elbv2.NetworkLoadBalancer(stack, 'NLB', {
      vpc,
    });
    const link = new apigw.VpcLink(stack, 'link', {
      targets: [nlb],
    });

    // WHEN
    const integration = new apigw.Integration({
      type: apigw.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: 'ANY',
      options: {
        connectionType: apigw.ConnectionType.INTERNET,
        vpcLink: link,
      },
    });

    // THEN
    test.throws(() => api.root.addMethod('GET', integration), /cannot set 'vpcLink' where 'connectionType' is INTERNET/);
    test.done();
  },

  'methodResponse set one or more method responses via options'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const api = new apigw.RestApi(stack, 'test-api', { deploy: false });

    // WHEN
    new apigw.Method(stack, 'method-man', {
      httpMethod: 'GET',
      resource: api.root,
      options: {
        methodResponses: [{
          statusCode: '200',
        }, {
          statusCode: '400',
          responseParameters: {
            'method.response.header.killerbees': false,
          },
        }, {
          statusCode: '500',
          responseParameters: {
            'method.response.header.errthing': true,
          },
          responseModels: {
            'application/json': apigw.Model.EMPTY_MODEL,
            'text/plain': apigw.Model.ERROR_MODEL,
          },
        },
        ],
      },
    });

    // THEN
    expect(stack).to(haveResource('AWS::ApiGateway::Method', {
      HttpMethod: 'GET',
      MethodResponses: [{
        StatusCode: '200',
      }, {
        StatusCode: '400',
        ResponseParameters: {
          'method.response.header.killerbees': false,
        },
      }, {
        StatusCode: '500',
        ResponseParameters: {
          'method.response.header.errthing': true,
        },
        ResponseModels: {
          'application/json': 'Empty',
          'text/plain': 'Error',
        },
      },
      ],
    }));

    test.done();
  },

  'multiple integration responses can be used'(test: Test) { // @see https://github.com/aws/aws-cdk/issues/1608
    // GIVEN
    const stack = new cdk.Stack();
    const api = new apigw.RestApi(stack, 'test-api', { deploy: false });

    // WHEN
    api.root.addMethod('GET', new apigw.AwsIntegration({
      service: 'foo-service',
      action: 'BarAction',
      options: {
        integrationResponses: [
          {
            statusCode: '200',
            responseTemplates: { 'application/json': JSON.stringify({ success: true }) },
          },
          {
            selectionPattern: 'Invalid',
            statusCode: '503',
            responseTemplates: { 'application/json': JSON.stringify({ success: false, message: 'Invalid Request' }) },
          },
        ],
      },
    }));

    // THEN
    expect(stack).to(haveResource('AWS::ApiGateway::Method', {
      Integration: {
        IntegrationHttpMethod: 'POST',
        IntegrationResponses: [
          {
            ResponseTemplates: { 'application/json': '{"success":true}' },
            StatusCode: '200',
          },
          {
            ResponseTemplates: { 'application/json': '{"success":false,"message":"Invalid Request"}' },
            SelectionPattern: 'Invalid',
            StatusCode: '503',
          },
        ],
        Type: 'AWS',
        Uri: { 'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':apigateway:', { Ref: 'AWS::Region' }, ':foo-service:action/BarAction']]},
      },
    }));
    test.done();
  },

  'method is always set as uppercase'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const api = new apigw.RestApi(stack, 'api');

    // WHEN
    api.root.addMethod('get');
    api.root.addMethod('PoSt');
    api.root.addMethod('PUT');

    // THEN
    expect(stack).to(haveResource('AWS::ApiGateway::Method', { HttpMethod: 'POST' }));
    expect(stack).to(haveResource('AWS::ApiGateway::Method', { HttpMethod: 'GET' }));
    expect(stack).to(haveResource('AWS::ApiGateway::Method', { HttpMethod: 'PUT' }));
    test.done();
  },

  'requestModel can be set'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const api = new apigw.RestApi(stack, 'test-api', { deploy: false });
    const model = api.addModel('test-model', {
      contentType: 'application/json',
      modelName: 'test-model',
      schema: {
        title: 'test',
        type: apigw.JsonSchemaType.OBJECT,
        properties: { message: { type: apigw.JsonSchemaType.STRING } },
      },
    });

    // WHEN
    new apigw.Method(stack, 'method-man', {
      httpMethod: 'GET',
      resource: api.root,
      options: {
        requestModels: {
          'application/json': model,
        },
      },
    });

    // THEN
    expect(stack).to(haveResource('AWS::ApiGateway::Method', {
      HttpMethod: 'GET',
      RequestModels: {
        'application/json': { Ref: stack.getLogicalId(model.node.findChild('Resource') as cdk.CfnElement) },
      },
    }));

    test.done();
  },

  'methodResponse has a mix of response modes'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const api = new apigw.RestApi(stack, 'test-api', { deploy: false });
    const htmlModel = api.addModel('my-model', {
      schema: {
        schema: apigw.JsonSchemaVersion.DRAFT4,
        title: 'test',
        type: apigw.JsonSchemaType.OBJECT,
        properties: { message: { type: apigw.JsonSchemaType.STRING } },
      },
    });

    // WHEN
    new apigw.Method(stack, 'method-man', {
      httpMethod: 'GET',
      resource: api.root,
      options: {
        methodResponses: [{
          statusCode: '200',
        }, {
          statusCode: '400',
          responseParameters: {
            'method.response.header.killerbees': false,
          },
        }, {
          statusCode: '500',
          responseParameters: {
            'method.response.header.errthing': true,
          },
          responseModels: {
            'application/json': apigw.Model.EMPTY_MODEL,
            'text/plain': apigw.Model.ERROR_MODEL,
            'text/html': htmlModel,
          },
        },
        ],
      },
    });

    // THEN
    expect(stack).to(haveResource('AWS::ApiGateway::Method', {
      HttpMethod: 'GET',
      MethodResponses: [{
        StatusCode: '200',
      }, {
        StatusCode: '400',
        ResponseParameters: {
          'method.response.header.killerbees': false,
        },
      }, {
        StatusCode: '500',
        ResponseParameters: {
          'method.response.header.errthing': true,
        },
        ResponseModels: {
          'application/json': 'Empty',
          'text/plain': 'Error',
          'text/html': { Ref: stack.getLogicalId(htmlModel.node.findChild('Resource') as cdk.CfnElement) },
        },
      },
      ],
    }));

    test.done();
  },

  'method has a request validator'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const api = new apigw.RestApi(stack, 'test-api', { deploy: false });
    const validator = api.addRequestValidator('validator', {
      validateRequestBody: true,
      validateRequestParameters: false,
    });

    // WHEN
    new apigw.Method(stack, 'method-man', {
      httpMethod: 'GET',
      resource: api.root,
      options: {
        requestValidator: validator,
      },
    });

    // THEN
    expect(stack).to(haveResource('AWS::ApiGateway::Method', {
      RequestValidatorId: { Ref: stack.getLogicalId(validator.node.findChild('Resource') as cdk.CfnElement) },
    }));
    expect(stack).to(haveResource('AWS::ApiGateway::RequestValidator', {
      RestApiId: { Ref: stack.getLogicalId(api.node.findChild('Resource') as cdk.CfnElement) },
      ValidateRequestBody: true,
      ValidateRequestParameters: false,
    }));

    test.done();
  },

  'use default requestParameters'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const api = new apigw.RestApi(stack, 'test-api', {
      cloudWatchRole: false,
      deploy: false,
      defaultMethodOptions: {
        requestParameters: {'method.request.path.proxy': true},
      },
    });

    // WHEN
    new apigw.Method(stack, 'defaultRequestParameters', {
      httpMethod: 'POST',
      resource: api.root,
      options: {
        operationName: 'defaultRequestParameters',
      },
    });

    // THEN
    expect(stack).to(haveResource('AWS::ApiGateway::Method', {
      OperationName: 'defaultRequestParameters',
      RequestParameters: {
        'method.request.path.proxy': true,
      },
    }));

    test.done();
  },

  'authorizer is bound correctly'(test: Test) {
    const stack = new cdk.Stack();

    const restApi = new apigw.RestApi(stack, 'myrestapi');
    restApi.root.addMethod('ANY', undefined, {
      authorizer: DUMMY_AUTHORIZER,
    });

    expect(stack).to(haveResource('AWS::ApiGateway::Method', {
      HttpMethod: 'ANY',
      AuthorizationType: 'CUSTOM',
      AuthorizerId: DUMMY_AUTHORIZER.authorizerId,
    }));

    test.done();
  },

  'authorizer via default method options'(test: Test) {
    const stack = new cdk.Stack();

    const func = new lambda.Function(stack, 'myfunction', {
      handler: 'handler',
      code: lambda.Code.fromInline('foo'),
      runtime: lambda.Runtime.NODEJS_10_X,
    });

    const auth = new apigw.TokenAuthorizer(stack, 'myauthorizer1', {
      authorizerName: 'myauthorizer1',
      handler: func,
    });

    const restApi = new apigw.RestApi(stack, 'myrestapi', {
      defaultMethodOptions: {
        authorizer: auth,
      },
    });
    restApi.root.addMethod('ANY');

    expect(stack).to(haveResource('AWS::ApiGateway::Authorizer', {
      Name: 'myauthorizer1',
      Type: 'TOKEN',
      RestApiId: stack.resolve(restApi.restApiId),
    }));

    test.done();
  },

  'fails when authorization type does not match the authorizer'(test: Test) {
    const stack = new cdk.Stack();

    const restApi = new apigw.RestApi(stack, 'myrestapi');

    test.throws(() => {
      restApi.root.addMethod('ANY', undefined, {
        authorizationType: apigw.AuthorizationType.IAM,
        authorizer: DUMMY_AUTHORIZER,
      });
    }, /Authorization type is set to AWS_IAM which is different from what is required by the authorizer/);

    test.done();
  },

  'fails when authorization type does not match the authorizer in default method options'(test: Test) {
    const stack = new cdk.Stack();

    const restApi = new apigw.RestApi(stack, 'myrestapi', {
      defaultMethodOptions: {
        authorizer: DUMMY_AUTHORIZER,
      },
    });

    test.throws(() => {
      restApi.root.addMethod('ANY', undefined, {
        authorizationType: apigw.AuthorizationType.NONE,
      });
    }, /Authorization type is set to NONE which is different from what is required by the authorizer/);

    test.done();
  },

  'method has Auth Scopes'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const api = new apigw.RestApi(stack, 'test-api', { cloudWatchRole: false, deploy: false });

    // WHEN
    new apigw.Method(stack, 'my-method', {
      httpMethod: 'POST',
      resource: api.root,
      options: {
        apiKeyRequired: true,
        authorizationScopes: ['AuthScope1', 'AuthScope2'],
      },
    });

    // THEN
    expect(stack).to(haveResource('AWS::ApiGateway::Method', {
      ApiKeyRequired: true,
      AuthorizationScopes: ['AuthScope1', 'AuthScope2'],
    }));

    test.done();
  },

  'use default Auth Scopes'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const api = new apigw.RestApi(stack, 'test-api', {
      cloudWatchRole: false,
      deploy: false,
      defaultMethodOptions: {
        authorizationScopes: ['DefaultAuth'],
      },
    });

    // WHEN
    new apigw.Method(stack, 'defaultAuthScopes', {
      httpMethod: 'POST',
      resource: api.root,
      options: {
        operationName: 'defaultAuthScopes',
      },
    });

    // THEN
    expect(stack).to(haveResource('AWS::ApiGateway::Method', {
      OperationName: 'defaultAuthScopes',
      AuthorizationScopes: ['DefaultAuth'],
    }));

    test.done();
  },

  'Method options Auth Scopes is picked up'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const api = new apigw.RestApi(stack, 'test-api', {
      cloudWatchRole: false,
      deploy: false,
      defaultMethodOptions: {
        authorizationScopes: ['DefaultAuth'],
      },
    });

    // WHEN
    new apigw.Method(stack, 'MethodAuthScopeUsed', {
      httpMethod: 'POST',
      resource: api.root,
      options: {
        apiKeyRequired: true,
        authorizationScopes: ['MethodAuthScope'],
      },
    });

    // THEN
    expect(stack).to(haveResource('AWS::ApiGateway::Method', {
      ApiKeyRequired: true,
      AuthorizationScopes: ['MethodAuthScope'],
    }));

    test.done();
  },

  'Auth Scopes absent'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const api = new apigw.RestApi(stack, 'test-api', {
      cloudWatchRole: false,
      deploy: false,
    });

    // WHEN
    new apigw.Method(stack, 'authScopesAbsent', {
      httpMethod: 'POST',
      resource: api.root,
      options: {
        operationName: 'authScopesAbsent',
      },
    });

    // THEN
    expect(stack).to(haveResource('AWS::ApiGateway::Method', {
      OperationName: 'authScopesAbsent',
      AuthorizationScopes: ABSENT,
    }));

    test.done();
  },

  'method has a request validator with provided properties'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const api = new apigw.RestApi(stack, 'test-api', { deploy: false });

    // WHEN
    new apigw.Method(stack, 'method-man', {
      httpMethod: 'GET',
      resource: api.root,
      options: {
        requestValidatorOptions: {
          requestValidatorName: 'test-validator',
          validateRequestBody: true,
          validateRequestParameters: false,
        },
      },
    });

    // THEN
    expect(stack).to(haveResource('AWS::ApiGateway::RequestValidator', {
      RestApiId: stack.resolve(api.restApiId),
      ValidateRequestBody: true,
      ValidateRequestParameters: false,
      Name: 'test-validator',
    }));

    test.done();
  },

  'method does not have a request validator'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const api = new apigw.RestApi(stack, 'test-api', { deploy: false });

    // WHEN
    new apigw.Method(stack, 'method-man', {
      httpMethod: 'GET',
      resource: api.root,
    });

    // THEN
    expect(stack).to(haveResource('AWS::ApiGateway::Method', {
      RequestValidatorId: ABSENT,
    }));

    test.done();
  },

  'method does not support both request validator and request validator options'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const api = new apigw.RestApi(stack, 'test-api', { deploy: false });
    const validator = api.addRequestValidator('test-validator1', {
      validateRequestBody: true,
      validateRequestParameters: false,
    });

    // WHEN
    const methodProps = {
      httpMethod: 'GET',
      resource: api.root,
      options: {
        requestValidatorOptions: {
          requestValidatorName: 'test-validator2',
          validateRequestBody: true,
          validateRequestParameters: false,
        },
        requestValidator: validator,
      },
    };

    // THEN
    test.throws(() => new apigw.Method(stack, 'method', methodProps),
      /Only one of 'requestValidator' or 'requestValidatorOptions' must be specified./);

    test.done();
  },

  '"restApi" and "api" properties return the RestApi correctly'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const api = new apigw.RestApi(stack, 'test-api');
    const method = api.root.addResource('pets').addMethod('GET');

    // THEN
    test.ok(method.restApi);
    test.ok(method.api);
    test.deepEqual(stack.resolve(method.api.restApiId), stack.resolve(method.restApi.restApiId));

    test.done();
  },

  '"restApi" throws an error on imported while "api" returns correctly'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const api = apigw.RestApi.fromRestApiAttributes(stack, 'test-api', {
      restApiId: 'test-rest-api-id',
      rootResourceId: 'test-root-resource-id',
    });
    const method = api.root.addResource('pets').addMethod('GET');

    // THEN
    test.throws(() => method.restApi, /not available on Resource not connected to an instance of RestApi/);
    test.ok(method.api);

    test.done();
  },
};
