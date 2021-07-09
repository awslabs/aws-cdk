import { ABSENT, expect, haveResourceLike } from '@aws-cdk/assert-internal';
import * as cdk from '@aws-cdk/core';
import { Test } from 'nodeunit';

import * as appmesh from '../lib';

export = {
  'When creating a GatewayRoute': {
    'should have expected defaults'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      const mesh = new appmesh.Mesh(stack, 'mesh', {
        meshName: 'test-mesh',
      });

      const virtualGateway = new appmesh.VirtualGateway(stack, 'gateway-1', {
        listeners: [appmesh.VirtualGatewayListener.http()],
        mesh: mesh,
      });

      const virtualService = new appmesh.VirtualService(stack, 'vs-1', {
        virtualServiceProvider: appmesh.VirtualServiceProvider.none(mesh),
        virtualServiceName: 'target.local',
      });

      // Add an HTTP Route
      virtualGateway.addGatewayRoute('gateway-http-route', {
        routeSpec: appmesh.GatewayRouteSpec.http({
          routeTarget: virtualService,
        }),
        gatewayRouteName: 'gateway-http-route',
      });

      virtualGateway.addGatewayRoute('gateway-http2-route', {
        routeSpec: appmesh.GatewayRouteSpec.http2({
          routeTarget: virtualService,
        }),
        gatewayRouteName: 'gateway-http2-route',
      });

      virtualGateway.addGatewayRoute('gateway-grpc-route', {
        routeSpec: appmesh.GatewayRouteSpec.grpc({
          routeTarget: virtualService,
          match: {
            serviceName: virtualService.virtualServiceName,
          },
        }),
        gatewayRouteName: 'gateway-grpc-route',
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::AppMesh::GatewayRoute', {
        GatewayRouteName: 'gateway-http-route',
        MeshOwner: ABSENT,
        Spec: {
          HttpRoute: {
            Action: {
              Target: {
                VirtualService: {
                  VirtualServiceName: {
                    'Fn::GetAtt': ['vs1732C2645', 'VirtualServiceName'],
                  },
                },
              },
            },
            Match: {
              Prefix: '/',
            },
          },
        },
      }));
      expect(stack).to(haveResourceLike('AWS::AppMesh::GatewayRoute', {
        GatewayRouteName: 'gateway-http2-route',
        Spec: {
          Http2Route: {
            Action: {
              Target: {
                VirtualService: {
                  VirtualServiceName: {
                    'Fn::GetAtt': ['vs1732C2645', 'VirtualServiceName'],
                  },
                },
              },
            },
            Match: {
              Prefix: '/',
            },
          },
        },
      }));
      expect(stack).to(haveResourceLike('AWS::AppMesh::GatewayRoute', {
        GatewayRouteName: 'gateway-grpc-route',
        Spec: {
          GrpcRoute: {
            Action: {
              Target: {
                VirtualService: {
                  VirtualServiceName: {
                    'Fn::GetAtt': ['vs1732C2645', 'VirtualServiceName'],
                  },
                },
              },
            },
            Match: {
              ServiceName: {
                'Fn::GetAtt': ['vs1732C2645', 'VirtualServiceName'],
              },
            },
          },
        },
      }));
      test.done();
    },

    'should throw an exception if you start an http prefix match not with a /'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      const mesh = new appmesh.Mesh(stack, 'mesh', {
        meshName: 'test-mesh',
      });

      const virtualService = new appmesh.VirtualService(stack, 'testVirtualService', {
        virtualServiceProvider: appmesh.VirtualServiceProvider.none(mesh),
      });
      test.throws(() => appmesh.GatewayRouteSpec.http({
        routeTarget: virtualService,
        match: {
          prefixPath: 'wrong',
        },
      }).bind(stack),
      /Prefix Path must start with \'\/\', got: wrong/);
      test.done();
    },

    'with shared service mesh': {
      'Mesh Owner is the AWS account ID of the account that shared the mesh with your account'(test:Test) {
        // GIVEN
        const app = new cdk.App();
        const meshEnv = { account: '1234567899', region: 'us-west-2' };
        const gatewayRouteEnv = { account: '9987654321', region: 'us-west-2' };

        // Creating stack in Account 9987654321
        const stack = new cdk.Stack(app, 'mySharedStack', { env: gatewayRouteEnv });
        // Mesh is in Account 1234567899
        const sharedMesh = appmesh.Mesh.fromMeshArn(stack, 'shared-mesh',
          `arn:aws:appmesh:${meshEnv.region}:${meshEnv.account}:mesh/shared-mesh`);
        const virtualGateway = new appmesh.VirtualGateway(stack, 'gateway-1', {
          listeners: [appmesh.VirtualGatewayListener.http()],
          mesh: sharedMesh,
        });
        const virtualService = new appmesh.VirtualService(stack, 'vs-1', {
          virtualServiceProvider: appmesh.VirtualServiceProvider.none(sharedMesh),
          virtualServiceName: 'target.local',
        });

        // WHEN
        new appmesh.GatewayRoute(stack, 'test-node', {
          routeSpec: appmesh.GatewayRouteSpec.http({
            routeTarget: virtualService,
          }),
          virtualGateway: virtualGateway,
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::AppMesh::GatewayRoute', {
          MeshOwner: meshEnv.account,
        }));

        test.done();
      },
    },
  },

  'Can import Gateway Routes using an ARN'(test: Test) {
    const app = new cdk.App();
    // GIVEN
    const stack = new cdk.Stack(app, 'Imports', {
      env: { account: '123456789012', region: 'us-east-1' },
    });
    const meshName = 'test-mesh';
    const virtualGatewayName = 'test-gateway';
    const gatewayRouteName = 'test-gateway-route';
    const arn = `arn:aws:appmesh:us-east-1:123456789012:mesh/${meshName}/virtualGateway/${virtualGatewayName}/gatewayRoute/${gatewayRouteName}`;

    // WHEN
    const gatewayRoute = appmesh.GatewayRoute.fromGatewayRouteArn(stack, 'importedGatewayRoute', arn);
    // THEN
    test.equal(gatewayRoute.gatewayRouteName, gatewayRouteName);
    test.equal(gatewayRoute.virtualGateway.virtualGatewayName, virtualGatewayName);
    test.equal(gatewayRoute.virtualGateway.mesh.meshName, meshName);
    test.done();
  },
  'Can import Gateway Routes using attributes'(test: Test) {
    const app = new cdk.App();
    // GIVEN
    const stack = new cdk.Stack(app, 'Imports', {
      env: { account: '123456789012', region: 'us-east-1' },
    });
    const meshName = 'test-mesh';
    const virtualGatewayName = 'test-gateway';
    const gatewayRouteName = 'test-gateway-route';

    // WHEN
    const mesh = appmesh.Mesh.fromMeshName(stack, 'Mesh', meshName);
    const gateway = mesh.addVirtualGateway('VirtualGateway', {
      virtualGatewayName: virtualGatewayName,
    });
    const gatewayRoute = appmesh.GatewayRoute.fromGatewayRouteAttributes(stack, 'importedGatewayRoute', {
      gatewayRouteName: gatewayRouteName,
      virtualGateway: gateway,
    });
    // THEN
    test.equal(gatewayRoute.gatewayRouteName, gatewayRouteName);
    test.equal(gatewayRoute.virtualGateway.mesh.meshName, meshName);
    test.done();
  },
};
