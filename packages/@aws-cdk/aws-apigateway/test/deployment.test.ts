import * as path from 'path';
import '@aws-cdk/assert-internal/jest';
import { ResourcePart, SynthUtils } from '@aws-cdk/assert-internal';
import * as lambda from '@aws-cdk/aws-lambda';
import { CfnResource, Lazy, Stack } from '@aws-cdk/core';
import * as apigateway from '../lib';

describe('deployment', () => {
  test('minimal setup', () => {
    // GIVEN
    const stack = new Stack();
    const api = new apigateway.RestApi(stack, 'api', { deploy: false, cloudWatchRole: false });
    api.root.addMethod('GET');

    // WHEN
    new apigateway.Deployment(stack, 'deployment', { api });

    // THEN
    expect(stack).toMatchTemplate({
      Resources: {
        apiGETECF0BD67: {
          Type: 'AWS::ApiGateway::Method',
          Properties: {
            HttpMethod: 'GET',
            ResourceId: {
              'Fn::GetAtt': [
                'apiC8550315',
                'RootResourceId',
              ],
            },
            RestApiId: {
              Ref: 'apiC8550315',
            },
            AuthorizationType: 'NONE',
            Integration: {
              Type: 'MOCK',
            },
          },
        },
        apiC8550315: {
          Type: 'AWS::ApiGateway::RestApi',
          Properties: {
            Name: 'api',
          },
        },
        deployment33381975bba46c5132329b81e7befcbbba5a0e75: {
          Type: 'AWS::ApiGateway::Deployment',
          Properties: {
            RestApiId: {
              Ref: 'apiC8550315',
            },
          },
          DependsOn: [
            'apiGETECF0BD67',
          ],
        },
      },
    });
  });

  test('"retainDeployments" can be used to control the deletion policy of the resource', () => {
    // GIVEN
    const stack = new Stack();
    const api = new apigateway.RestApi(stack, 'api', { deploy: false, cloudWatchRole: false });
    api.root.addMethod('GET');

    // WHEN
    new apigateway.Deployment(stack, 'deployment', { api, retainDeployments: true });

    // THEN
    expect(stack).toMatchTemplate({
      Resources: {
        apiGETECF0BD67: {
          Type: 'AWS::ApiGateway::Method',
          Properties: {
            HttpMethod: 'GET',
            ResourceId: {
              'Fn::GetAtt': [
                'apiC8550315',
                'RootResourceId',
              ],
            },
            RestApiId: {
              Ref: 'apiC8550315',
            },
            AuthorizationType: 'NONE',
            Integration: {
              Type: 'MOCK',
            },
          },
        },
        apiC8550315: {
          Type: 'AWS::ApiGateway::RestApi',
          Properties: {
            Name: 'api',
          },
        },
        deployment33381975bba46c5132329b81e7befcbbba5a0e75: {
          Type: 'AWS::ApiGateway::Deployment',
          Properties: {
            RestApiId: {
              Ref: 'apiC8550315',
            },
          },
          DeletionPolicy: 'Retain',
          UpdateReplacePolicy: 'Retain',
          DependsOn: [
            'apiGETECF0BD67',
          ],
        },
      },
    });
  });

  test('"description" can be set on the deployment', () => {
    // GIVEN
    const stack = new Stack();
    const api = new apigateway.RestApi(stack, 'api', { deploy: false, cloudWatchRole: false });
    api.root.addMethod('GET');

    // WHEN
    new apigateway.Deployment(stack, 'deployment', { api, description: 'this is my deployment' });

    // THEN
    expect(stack).toHaveResource('AWS::ApiGateway::Deployment', {
      Description: 'this is my deployment',
    });
  });

  test('logical ID of the deployment resource is salted', () => {
    // GIVEN
    const stack = new Stack();
    const api = new apigateway.RestApi(stack, 'api', { deploy: false, cloudWatchRole: false });
    const deployment = new apigateway.Deployment(stack, 'deployment', { api });
    api.root.addMethod('GET');

    const resources = synthesize().Resources;
    expect(resources.deployment33381975bba46c5132329b81e7befcbbba5a0e75).toBeDefined();

    // adding some salt
    deployment.addToLogicalId({ foo: 123 }); // add some data to the logical ID

    // the logical ID changed
    const template = synthesize();
    expect(template.Resources.deployment33381975bba46c5132329b81e7befcbbba5a0e75).toBeUndefined();
    expect(template.Resources.deployment333819758aa4cdb9d204502b959c4903f4d5d29f).toBeDefined();

    // tokens supported, and are resolved upon synthesis
    const value = 'hello hello';
    deployment.addToLogicalId({ foo: Lazy.string({ produce: () => value }) });

    const template2 = synthesize();
    expect(template2.Resources.deployment333819758d91bed959c6bd6268ba84f6d33e888e).toBeDefined();

    function synthesize() {
      return SynthUtils.synthesize(stack).template;
    }
  });

  test('"addDependency" can be used to add a resource as a dependency', () => {
    // GIVEN
    const stack = new Stack();
    const api = new apigateway.RestApi(stack, 'api', { deploy: false, cloudWatchRole: false });
    const deployment = new apigateway.Deployment(stack, 'deployment', { api });
    api.root.addMethod('GET');

    const dep = new CfnResource(stack, 'MyResource', { type: 'foo' });

    // WHEN
    deployment.node.addDependency(dep);

    expect(stack).toHaveResource('AWS::ApiGateway::Deployment', {
      DependsOn: [
        'apiGETECF0BD67',
        'MyResource',
      ],
    }, ResourcePart.CompleteDefinition);
  });

  test('integration change invalidates deployment', () => {
    // GIVEN
    const stack1 = new Stack();
    const stack2 = new Stack();
    const handler1 = new lambda.Function(stack1, 'handler1', {
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda')),
      runtime: lambda.Runtime.NODEJS_10_X,
      handler: 'index.handler',
    });
    const handler2 = new lambda.Function(stack2, 'handler2', {
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda')),
      runtime: lambda.Runtime.NODEJS_10_X,
      handler: 'index.handler',
    });

    // WHEN
    const api1 = new apigateway.RestApi(stack1, 'myapi', {
      defaultIntegration: new apigateway.LambdaIntegration(handler1),
    });
    const api2 = new apigateway.RestApi(stack2, 'myapi', {
      defaultIntegration: new apigateway.LambdaIntegration(handler2),
    });
    api1.root.addMethod('GET');
    api2.root.addMethod('GET');

    // THEN
    expect(stack1).toHaveResource('AWS::ApiGateway::Stage', {
      DeploymentId: { Ref: 'myapiDeploymentB7EF8EB74c5295c27fa87ff13f4d04e13f67662d' },
    });
    expect(stack2).toHaveResource('AWS::ApiGateway::Stage', {
      DeploymentId: { Ref: 'myapiDeploymentB7EF8EB7b50d305057ba109c118e4aafd4509355' },
    });
  });

  test('deployment resource depends on all restapi methods defined', () => {
    const stack = new Stack();
    const restapi = new apigateway.RestApi(stack, 'myapi', {
      deploy: false,
    });
    restapi.root.addMethod('GET');

    const deployment = new apigateway.Deployment(stack, 'mydeployment', {
      api: restapi,
    });
    const stage = new apigateway.Stage(stack, 'mystage', {
      deployment,
    });
    restapi.deploymentStage = stage;

    restapi.root.addMethod('POST');
    const resource = restapi.root.addResource('myresource');
    resource.addMethod('GET');

    expect(stack).toHaveResource('AWS::ApiGateway::Deployment', {
      DependsOn: [
        'myapiGET9B7CD29E',
        'myapimyresourceGET732851A5',
        'myapiPOST23417BD2',
      ],
    }, ResourcePart.CompleteDefinition);
  });
});
