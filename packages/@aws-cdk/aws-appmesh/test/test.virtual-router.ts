import { ABSENT, expect, haveResourceLike } from '@aws-cdk/assert-internal';
import * as cdk from '@aws-cdk/core';
import { Test } from 'nodeunit';

import * as appmesh from '../lib';

export = {
  'When creating a VirtualRouter': {
    'should have appropriate defaults'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const mesh = new appmesh.Mesh(stack, 'mesh', {
        meshName: 'test-mesh',
      });
      // WHEN
      mesh.addVirtualRouter('http-router-listener');

      expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualRouter', {
        VirtualRouterName: 'meshhttprouterlistenerF57BCB2F',
        Spec: {
          Listeners: [
            {
              PortMapping: {
                Port: 8080,
                Protocol: appmesh.Protocol.HTTP,
              },
            },
          ],
        },
      }));
      test.done();
    },
    'should have protocol variant listeners'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const mesh = new appmesh.Mesh(stack, 'mesh', {
        meshName: 'test-mesh',
      });
      // WHEN
      mesh.addVirtualRouter('http-router-listener', {
        listeners: [
          appmesh.VirtualRouterListener.http(),
        ],
        virtualRouterName: 'http-router-listener',
      });

      mesh.addVirtualRouter('http2-router-listener', {
        listeners: [
          appmesh.VirtualRouterListener.http2(),
        ],
        virtualRouterName: 'http2-router-listener',
      });

      mesh.addVirtualRouter('grpc-router-listener', {
        listeners: [
          appmesh.VirtualRouterListener.grpc(),
        ],
        virtualRouterName: 'grpc-router-listener',
      });

      mesh.addVirtualRouter('tcp-router-listener', {
        listeners: [
          appmesh.VirtualRouterListener.tcp(),
        ],
        virtualRouterName: 'tcp-router-listener',
      });

      // THEN
      const expectedPorts = [appmesh.Protocol.HTTP, appmesh.Protocol.HTTP2, appmesh.Protocol.GRPC, appmesh.Protocol.TCP];
      expectedPorts.forEach(protocol => {
        expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualRouter', {
          VirtualRouterName: `${protocol}-router-listener`,
          Spec: {
            Listeners: [
              {
                PortMapping: {
                  Port: 8080,
                  Protocol: protocol,
                },
              },
            ],
          },
          MeshOwner: ABSENT,
        }));
      });

      test.done();
    },

    'with shared service mesh': {
      'Mesh Owner is the AWS account ID of the account that shared the mesh with your account'(test:Test) {
        // GIVEN
        const app = new cdk.App();
        const meshEnv = { account: '1234567899', region: 'us-west-2' };
        const virtualRouterEnv = { account: '9987654321', region: 'us-west-2' };

        // Creating stack in Account B
        const stack = new cdk.Stack(app, 'mySharedStack', { env: virtualRouterEnv });
        // Mesh is in Account A
        const sharedMesh = appmesh.Mesh.fromMeshArn(stack, 'shared-mesh',
          `arn:aws:appmesh:${meshEnv.region}:${meshEnv.account}:mesh/shared-mesh`);

        // WHEN
        new appmesh.VirtualRouter(stack, 'test-node', {
          mesh: sharedMesh,
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualRouter', {
          MeshOwner: meshEnv.account,
        }));

        test.done();
      },
    },
  },

  'When adding route to existing VirtualRouter': {
    'should create route resource'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      const mesh = new appmesh.Mesh(stack, 'mesh', {
        meshName: 'test-mesh',
      });

      const router = mesh.addVirtualRouter('router');

      const service1 = new appmesh.VirtualService(stack, 'service-1', {
        virtualServiceName: 'service1.domain.local',
        virtualServiceProvider: appmesh.VirtualServiceProvider.none(mesh),
      });

      const node = mesh.addVirtualNode('test-node', {
        serviceDiscovery: appmesh.ServiceDiscovery.dns('test'),
        listeners: [appmesh.VirtualNodeListener.http({
          port: 8080,
        })],
        backends: [appmesh.Backend.virtualService(service1)],
      });

      router.addRoute('route-1', {
        routeSpec: appmesh.RouteSpec.http({
          weightedTargets: [
            {
              virtualNode: node,
              weight: 50,
            },
          ],
          match: {
            prefixPath: '/',
          },
        }),
      });

      // THEN
      expect(stack).to(
        haveResourceLike('AWS::AppMesh::Route', {
          RouteName: 'route-1',
          Spec: {
            HttpRoute: {
              Action: {
                WeightedTargets: [
                  {
                    VirtualNode: {
                      'Fn::GetAtt': ['meshtestnodeF93946D4', 'VirtualNodeName'],
                    },
                    Weight: 50,
                  },
                ],
              },
              Match: {
                Prefix: '/',
              },
            },
          },
          VirtualRouterName: {
            'Fn::GetAtt': ['meshrouter81B8087E', 'VirtualRouterName'],
          },
        }),
      );

      test.done();
    },
  },
  'When adding routes to a VirtualRouter with existing routes': {
    'should add routes and not overwrite'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      const mesh = new appmesh.Mesh(stack, 'mesh', {
        meshName: 'test-mesh',
      });

      const router = mesh.addVirtualRouter('router');

      const service1 = new appmesh.VirtualService(stack, 'service-1', {
        virtualServiceName: 'service1.domain.local',
        virtualServiceProvider: appmesh.VirtualServiceProvider.none(mesh),
      });
      const service2 = new appmesh.VirtualService(stack, 'service-2', {
        virtualServiceName: 'service2.domain.local',
        virtualServiceProvider: appmesh.VirtualServiceProvider.none(mesh),
      });

      const node = mesh.addVirtualNode('test-node', {
        serviceDiscovery: appmesh.ServiceDiscovery.dns('test'),
        listeners: [appmesh.VirtualNodeListener.http({
          port: 8080,
        })],
        backends: [appmesh.Backend.virtualService(service1)],
      });
      const node2 = mesh.addVirtualNode('test-node2', {
        serviceDiscovery: appmesh.ServiceDiscovery.dns('test'),
        listeners: [appmesh.VirtualNodeListener.http({
          port: 8080,
        })],
        backends: [appmesh.Backend.virtualService(service2)],
      });
      const node3 = mesh.addVirtualNode('test-node3', {
        serviceDiscovery: appmesh.ServiceDiscovery.dns('test'),
        listeners: [appmesh.VirtualNodeListener.http({
          port: 8080,
        })],
        backends: [appmesh.Backend.virtualService(service1)],
      });

      router.addRoute('route-1', {
        routeSpec: appmesh.RouteSpec.http({
          weightedTargets: [
            {
              virtualNode: node,
              weight: 50,
            },
          ],
          match: {
            prefixPath: '/',
          },
        }),
      });

      router.addRoute('route-2', {
        routeSpec: appmesh.RouteSpec.http({
          weightedTargets: [
            {
              virtualNode: node2,
              weight: 30,
            },
          ],
          match: {
            prefixPath: '/path2',
          },
        }),
      });

      router.addRoute('route-3', {
        routeSpec: appmesh.RouteSpec.http({
          weightedTargets: [
            {
              virtualNode: node3,
              weight: 20,
            },
          ],
          match: {
            prefixPath: '/path3',
          },
        }),
      });

      // THEN
      expect(stack).to(
        haveResourceLike('AWS::AppMesh::Route', {
          RouteName: 'route-1',
          Spec: {
            HttpRoute: {
              Action: {
                WeightedTargets: [
                  {
                    VirtualNode: {
                      'Fn::GetAtt': ['meshtestnodeF93946D4', 'VirtualNodeName'],
                    },
                    Weight: 50,
                  },
                ],
              },
              Match: {
                Prefix: '/',
              },
            },
          },
        }),
      );
      expect(stack).to(
        haveResourceLike('AWS::AppMesh::Route', {
          RouteName: 'route-2',
          Spec: {
            HttpRoute: {
              Action: {
                WeightedTargets: [
                  {
                    VirtualNode: {
                      'Fn::GetAtt': ['meshtestnode20C58B1B2', 'VirtualNodeName'],
                    },
                    Weight: 30,
                  },
                ],
              },
              Match: {
                Prefix: '/path2',
              },
            },
          },
        }),
      );
      expect(stack).to(
        haveResourceLike('AWS::AppMesh::Route', {
          RouteName: 'route-3',
          Spec: {
            HttpRoute: {
              Action: {
                WeightedTargets: [
                  {
                    VirtualNode: {
                      'Fn::GetAtt': ['meshtestnode316EEA2D7', 'VirtualNodeName'],
                    },
                    Weight: 20,
                  },
                ],
              },
              Match: {
                Prefix: '/path3',
              },
            },
          },
        }),
      );

      test.done();
    },
  },
  'When adding a TCP route to existing VirtualRouter': {
    'should create route resource'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      const mesh = new appmesh.Mesh(stack, 'mesh', {
        meshName: 'test-mesh',
      });

      const router = mesh.addVirtualRouter('router');

      const service1 = new appmesh.VirtualService(stack, 'service-1', {
        virtualServiceName: 'service1.domain.local',
        virtualServiceProvider: appmesh.VirtualServiceProvider.none(mesh),
      });

      const node = mesh.addVirtualNode('test-node', {
        serviceDiscovery: appmesh.ServiceDiscovery.dns('test'),
        listeners: [appmesh.VirtualNodeListener.http({
          port: 8080,
        })],
        backends: [appmesh.Backend.virtualService(service1)],
      });

      router.addRoute('route-tcp-1', {
        routeSpec: appmesh.RouteSpec.tcp({
          weightedTargets: [
            {
              virtualNode: node,
              weight: 50,
            },
          ],
        }),
      });

      // THEN
      expect(stack).to(
        haveResourceLike('AWS::AppMesh::Route', {
          RouteName: 'route-tcp-1',
          Spec: {
            TcpRoute: {
              Action: {
                WeightedTargets: [
                  {
                    VirtualNode: {
                      'Fn::GetAtt': ['meshtestnodeF93946D4', 'VirtualNodeName'],
                    },
                    Weight: 50,
                  },
                ],
              },
            },
          },
          VirtualRouterName: {
            'Fn::GetAtt': ['meshrouter81B8087E', 'VirtualRouterName'],
          },
        }),
      );

      test.done();
    },
  },

  'Can import Virtual Routers using an ARN'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    const meshName = 'testMesh';
    const virtualRouterName = 'virtual-router';
    const arn = `arn:aws:appmesh:us-east-1:123456789012:mesh/${meshName}/virtualRouter/${virtualRouterName}`;

    // WHEN
    const virtualRouter = appmesh.VirtualRouter.fromVirtualRouterArn(
      stack, 'importedVirtualRouter', arn);
    // THEN
    test.equal(virtualRouter.mesh.meshName, meshName);
    test.equal(virtualRouter.virtualRouterName, virtualRouterName);

    test.done();
  },
  'Can import Virtual Routers using attributes'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    const meshName = 'testMesh';
    const virtualRouterName = 'virtual-router';

    // WHEN
    const virtualRouter1 = appmesh.VirtualRouter.fromVirtualRouterAttributes(stack, 'importVirtualRouter', {
      mesh: appmesh.Mesh.fromMeshName(stack, 'Mesh', meshName),
      virtualRouterName: virtualRouterName,
    });

    // THEN
    test.equal(virtualRouter1.mesh.meshName, meshName);
    test.equal(virtualRouter1.virtualRouterName, virtualRouterName);

    test.done();
  },
};
