import '@aws-cdk/assert-internal/jest';
import { HttpApi, HttpMethod, HttpRoute, HttpRouteKey, VpcLink } from '@aws-cdk/aws-apigatewayv2';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as servicediscovery from '@aws-cdk/aws-servicediscovery';
import { Stack } from '@aws-cdk/core';
import { HttpServiceDiscoveryIntegration } from '../../lib';

describe('HttpServiceDiscoveryIntegration', () => {
  test('default', () => {
    // GIVEN
    const stack = new Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const vpcLink = new VpcLink(stack, 'VpcLink', { vpc });
    const namespace = new servicediscovery.PrivateDnsNamespace(stack, 'Namespace', {
      name: 'foobar.com',
      vpc,
    });
    const service = namespace.createService('Service');

    // WHEN
    const api = new HttpApi(stack, 'HttpApi');
    new HttpRoute(stack, 'HttpProxyPrivateRoute', {
      httpApi: api,
      integration: new HttpServiceDiscoveryIntegration({
        vpcLink,
        service,
      }),
      routeKey: HttpRouteKey.with('/pets'),
    });

    // THEN
    expect(stack).toHaveResource('AWS::ApiGatewayV2::Integration', {
      IntegrationType: 'HTTP_PROXY',
      ConnectionId: {
        Ref: 'VpcLink42ED6FF0',
      },
      ConnectionType: 'VPC_LINK',
      IntegrationMethod: 'ANY',
      IntegrationUri: {
        'Fn::GetAtt': [
          'NamespaceServiceCABDF534',
          'Arn',
        ],
      },
      PayloadFormatVersion: '1.0',
    });
  });

  test('method option is correctly recognized', () => {
    // GIVEN
    const stack = new Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const vpcLink = new VpcLink(stack, 'VpcLink', { vpc });
    const namespace = new servicediscovery.PrivateDnsNamespace(stack, 'Namespace', {
      name: 'foobar.com',
      vpc,
    });
    const service = namespace.createService('Service');

    // WHEN
    const api = new HttpApi(stack, 'HttpApi');
    new HttpRoute(stack, 'HttpProxyPrivateRoute', {
      httpApi: api,
      integration: new HttpServiceDiscoveryIntegration({
        vpcLink,
        service,
        method: HttpMethod.PATCH,
      }),
      routeKey: HttpRouteKey.with('/pets'),
    });

    // THEN
    expect(stack).toHaveResource('AWS::ApiGatewayV2::Integration', {
      IntegrationMethod: 'PATCH',
    });
  });

  test('fails if vpcLink is not specified', () => {
    const stack = new Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const namespace = new servicediscovery.PrivateDnsNamespace(stack, 'Namespace', {
      name: 'foobar.com',
      vpc,
    });
    const service = namespace.createService('Service');
    const api = new HttpApi(stack, 'HttpApi');

    expect(() => new HttpRoute(stack, 'HttpProxyPrivateRoute', {
      httpApi: api,
      integration: new HttpServiceDiscoveryIntegration({
        service,
        method: HttpMethod.PATCH,
      }),
      routeKey: HttpRouteKey.with('/pets'),
    })).toThrow(/vpcLink property is mandatory/);
  });

  test('tlsConfig option is correctly recognized', () => {
    // GIVEN
    const stack = new Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const vpcLink = new VpcLink(stack, 'VpcLink', { vpc });
    const namespace = new servicediscovery.PrivateDnsNamespace(stack, 'Namespace', {
      name: 'foobar.com',
      vpc,
    });
    const service = namespace.createService('Service');

    // WHEN
    const api = new HttpApi(stack, 'HttpApi');
    new HttpRoute(stack, 'HttpProxyPrivateRoute', {
      httpApi: api,
      integration: new HttpServiceDiscoveryIntegration({
        vpcLink,
        service,
        secureServerName: 'name-to-verify',
      }),
      routeKey: HttpRouteKey.with('/pets'),
    });

    // THEN
    expect(stack).toHaveResource('AWS::ApiGatewayV2::Integration', {
      TlsConfig: {
        ServerNameToVerify: 'name-to-verify',
      },
    });
  });
});
