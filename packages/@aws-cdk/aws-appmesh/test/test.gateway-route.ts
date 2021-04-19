import { expect, haveResourceLike } from '@aws-cdk/assert-internal';
import * as iam from '@aws-cdk/aws-iam';
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

  'Can grant an identity all read permissions for a given GatewayRoute'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const mesh = new appmesh.Mesh(stack, 'mesh', {
      meshName: 'test-mesh',
    });
    const gateway = new appmesh.VirtualGateway(stack, 'testGateway', {
      mesh: mesh,
    });
    const myService = new appmesh.VirtualService(stack, 'vs-1', {
      virtualServiceProvider: appmesh.VirtualServiceProvider.none(mesh),
      virtualServiceName: 'target.local',
    });

    const gr = gateway.addGatewayRoute('gateway-http-route', {
      routeSpec: appmesh.GatewayRouteSpec.http({
        routeTarget: myService,
      }),
      gatewayRouteName: 'gateway-http-route',
    });

    // WHEN
    const user = new iam.User(stack, 'test');
    gr.grantRead(user);

    // THEN
    expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: [
              'appmesh:DescribeGatewayRoute',
              'appmesh:ListGatewayRoute',
            ],
            Effect: 'Allow',
            Resource: {
              Ref: 'testGatewaygatewayhttprouteD65B806A',
            },
          },
        ],
      },
    }));

    test.done();
  },

  'Can grant an identity all write permissions for a given GatewayRoute'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const mesh = new appmesh.Mesh(stack, 'mesh', {
      meshName: 'test-mesh',
    });
    const gateway = new appmesh.VirtualGateway(stack, 'testGateway', {
      mesh: mesh,
    });
    const myService = new appmesh.VirtualService(stack, 'vs-1', {
      virtualServiceProvider: appmesh.VirtualServiceProvider.none(mesh),
      virtualServiceName: 'target.local',
    });

    const gr = gateway.addGatewayRoute('gateway-http-route', {
      routeSpec: appmesh.GatewayRouteSpec.http({
        routeTarget: myService,
      }),
      gatewayRouteName: 'gateway-http-route',
    });

    // WHEN
    const user = new iam.User(stack, 'test');
    gr.grantWrite(user);

    // THEN
    expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: [
              'appmesh:CreateGatewayRoute',
              'appmesh:UpdateGatewayRoute',
              'appmesh:DeleteGatewayRoute',
              'appmesh:TagResource',
              'appmesh:UntagResource',
            ],
            Effect: 'Allow',
            Resource: {
              Ref: 'testGatewaygatewayhttprouteD65B806A',
            },
          },
        ],
      },
    }));

    test.done();
  },
};