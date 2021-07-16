import * as path from 'path';
import { HttpApi, HttpMethod } from '@aws-cdk/aws-apigatewayv2';
import { LambdaProxyIntegration } from '@aws-cdk/aws-apigatewayv2-integrations';
import { User, CfnAccessKey, ManagedPolicy } from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import { App, Stack, CfnOutput } from '@aws-cdk/core';
import { HttpIamAuthorizer } from '../../lib/http/iam';

/*
 * Stack verification steps:
 * * `curl <url>` should return 403
 * * `curl -H 'Authorization: ' -H 'x-amz-date: ' -H 'Accept: application/json' <url>` should return 200
 * @see [../integ.iam.signature/README.md] to generate header values using this stack's outputs
*/

const app = new App();
const stack = new Stack(app, 'IAMAuthorizerInteg');

const httpApi = new HttpApi(stack, 'MyHttpApi');

const authorizer = new HttpIamAuthorizer();

const handler = new lambda.Function(stack, 'lambda', {
  runtime: lambda.Runtime.NODEJS_12_X,
  handler: 'index.handler',
  code: lambda.AssetCode.fromAsset(path.join(__dirname, '../integ.lambda.handler')),
});

httpApi.addRoutes({
  path: '/',
  methods: [HttpMethod.GET],
  integration: new LambdaProxyIntegration({ handler }),
  authorizer,
});

const user = new User(stack, 'test-user');

user.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonAPIGatewayInvokeFullAccess'));

const accessKey = new CfnAccessKey(stack, 'access-key', {
  userName: user.userName,
});

new CfnOutput(stack, 'api_url', { value: httpApi.url! });
new CfnOutput(stack, 'access_key', { value: accessKey.ref });
new CfnOutput(stack, 'secret_access_key', { value: accessKey.attrSecretAccessKey });