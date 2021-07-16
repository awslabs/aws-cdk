/// !cdk-integ pragma:ignore-assets
import * as path from 'path';
import { HttpApi, HttpMethod } from '@aws-cdk/aws-apigatewayv2';
import { LambdaProxyIntegration } from '@aws-cdk/aws-apigatewayv2-integrations';
import * as cognito from '@aws-cdk/aws-cognito';
import * as lambda from '@aws-cdk/aws-lambda';
import { App, Stack } from '@aws-cdk/core';
import { HttpUserPoolAuthorizer } from '../../lib';

/*
 * Stack verification steps:
 * * `curl -s -o /dev/null -w "%{http_code}" <url>` should return 401
 * * `curl -s -o /dev/null -w "%{http_code}" -H 'Authorization: deny' <url>` should return 403
 * * `curl -s -o /dev/null -w "%{http_code}" -H 'Authorization: allow' <url>` should return 200
 */

const app = new App();
const stack = new Stack(app, 'AuthorizerInteg');

const httpApi = new HttpApi(stack, 'MyHttpApi');

const userPool = new cognito.UserPool(stack, 'userpool');

const userPoolClient = userPool.addClient('my-client');

const authorizerName = 'UserPoolAuthorizer';

const authorizer = new HttpUserPoolAuthorizer({
  userPool,
  userPoolClient,
  authorizerName,
});

const handler = new lambda.Function(stack, 'lambda', {
  runtime: lambda.Runtime.NODEJS_12_X,
  handler: 'index.handler',
  code: lambda.AssetCode.fromAsset(path.join(__dirname, '../integ.user-pool.handler')),
});

httpApi.addRoutes({
  path: '/',
  methods: [HttpMethod.GET],
  integration: new LambdaProxyIntegration({ handler }),
  authorizer,
});
