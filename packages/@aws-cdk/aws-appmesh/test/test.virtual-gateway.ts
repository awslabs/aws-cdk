import { ABSENT, expect, haveResourceLike } from '@aws-cdk/assert-internal';
import * as acm from '@aws-cdk/aws-certificatemanager';
import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import { Test } from 'nodeunit';
import * as appmesh from '../lib';

export = {
  'When creating a VirtualGateway': {
    'should have expected defaults'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      const mesh = new appmesh.Mesh(stack, 'mesh', {
        meshName: 'test-mesh',
      });

      new appmesh.VirtualGateway(stack, 'testGateway', {
        mesh: mesh,
      });

      new appmesh.VirtualGateway(stack, 'httpGateway', {
        mesh: mesh,
        listeners: [appmesh.VirtualGatewayListener.http({
          port: 443,
          healthCheck: appmesh.HealthCheck.http({
            interval: cdk.Duration.seconds(10),
          }),
        })],
      });

      new appmesh.VirtualGateway(stack, 'http2Gateway', {
        mesh: mesh,
        listeners: [appmesh.VirtualGatewayListener.http2({
          port: 443,
          healthCheck: appmesh.HealthCheck.http2({ interval: cdk.Duration.seconds(10) }),
        })],
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualGateway', {
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
        VirtualGatewayName: 'testGateway',
      }));

      expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualGateway', {
        Spec: {
          Listeners: [
            {
              HealthCheck: {
                HealthyThreshold: 2,
                IntervalMillis: 10000,
                Port: 443,
                Protocol: appmesh.Protocol.HTTP,
                TimeoutMillis: 2000,
                UnhealthyThreshold: 2,
                Path: '/',
              },
              PortMapping: {
                Port: 443,
                Protocol: appmesh.Protocol.HTTP,
              },
            },
          ],
        },
        VirtualGatewayName: 'httpGateway',
        MeshOwner: ABSENT,
      }));

      expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualGateway', {
        Spec: {
          Listeners: [
            {
              HealthCheck: {
                HealthyThreshold: 2,
                IntervalMillis: 10000,
                Port: 443,
                Protocol: appmesh.Protocol.HTTP2,
                TimeoutMillis: 2000,
                UnhealthyThreshold: 2,
                Path: '/',
              },
              PortMapping: {
                Port: 443,
                Protocol: appmesh.Protocol.HTTP2,
              },
            },
          ],
        },
        VirtualGatewayName: 'http2Gateway',
      }));
      test.done();
    },

    'should have expected features'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      const mesh = new appmesh.Mesh(stack, 'mesh', {
        meshName: 'test-mesh',
      });

      new appmesh.VirtualGateway(stack, 'testGateway', {
        virtualGatewayName: 'test-gateway',
        listeners: [appmesh.VirtualGatewayListener.grpc({
          port: 80,
          healthCheck: appmesh.HealthCheck.grpc(),
        })],
        mesh: mesh,
        accessLog: appmesh.AccessLog.fromFilePath('/dev/stdout'),
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualGateway', {
        Spec: {
          Listeners: [
            {
              HealthCheck: {
                HealthyThreshold: 2,
                IntervalMillis: 5000,
                Port: 80,
                Protocol: appmesh.Protocol.GRPC,
                TimeoutMillis: 2000,
                UnhealthyThreshold: 2,
              },
              PortMapping: {
                Port: 80,
                Protocol: appmesh.Protocol.GRPC,
              },
            },
          ],
          Logging: {
            AccessLog: {
              File: {
                Path: '/dev/stdout',
              },
            },
          },
        },
        VirtualGatewayName: 'test-gateway',
      }));
      test.done();
    },

    'with an http listener with a TLS certificate from ACM'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      const mesh = new appmesh.Mesh(stack, 'mesh', {
        meshName: 'test-mesh',
      });

      const cert = new acm.Certificate(stack, 'cert', {
        domainName: '',
      });

      new appmesh.VirtualGateway(stack, 'testGateway', {
        virtualGatewayName: 'test-gateway',
        mesh: mesh,
        listeners: [appmesh.VirtualGatewayListener.http({
          port: 8080,
          tls: {
            mode: appmesh.TlsMode.STRICT,
            certificate: appmesh.TlsCertificate.acm(cert),
          },
        })],
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualGateway', {
        Spec: {
          Listeners: [
            {
              TLS: {
                Mode: appmesh.TlsMode.STRICT,
                Certificate: {
                  ACM: {
                    CertificateArn: {
                      Ref: 'cert56CA94EB',
                    },
                  },
                },
              },
            },
          ],
        },
      }));

      test.done();
    },

    'with an grpc listener with a TLS certificate from file'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      const mesh = new appmesh.Mesh(stack, 'mesh', {
        meshName: 'test-mesh',
      });

      new appmesh.VirtualGateway(stack, 'testGateway', {
        virtualGatewayName: 'test-gateway',
        mesh: mesh,
        listeners: [appmesh.VirtualGatewayListener.grpc({
          port: 8080,
          tls: {
            mode: appmesh.TlsMode.STRICT,
            certificate: appmesh.TlsCertificate.file('path/to/certChain', 'path/to/privateKey'),
          },
        })],
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualGateway', {
        Spec: {
          Listeners: [
            {
              TLS: {
                Mode: appmesh.TlsMode.STRICT,
                Certificate: {
                  File: {
                    CertificateChain: 'path/to/certChain',
                    PrivateKey: 'path/to/privateKey',
                  },
                },
              },
            },
          ],
        },
      }));

      test.done();
    },

    'with an http2 listener with a TLS certificate from SDS'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const mesh = new appmesh.Mesh(stack, 'mesh', {
        meshName: 'test-mesh',
      });

      // WHEN
      new appmesh.VirtualGateway(stack, 'testGateway', {
        virtualGatewayName: 'test-gateway',
        mesh: mesh,
        listeners: [appmesh.VirtualGatewayListener.http2({
          port: 8080,
          tls: {
            mode: appmesh.TlsMode.STRICT,
            certificate: appmesh.TlsCertificate.sds('secret_certificate'),
          },
        })],
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualGateway', {
        Spec: {
          Listeners: [
            {
              TLS: {
                Mode: appmesh.TlsMode.STRICT,
                Certificate: {
                  SDS: {
                    SecretName: 'secret_certificate',
                  },
                },
              },
            },
          ],
        },
      }));

      test.done();
    },

    'with an grpc listener with a TLS validation from file': {
      'the listener should include the TLS configuration'(test:Test) {
        // GIVEN
        const stack = new cdk.Stack();
        const mesh = new appmesh.Mesh(stack, 'mesh', {
          meshName: 'test-mesh',
        });

        // WHEN
        new appmesh.VirtualGateway(stack, 'testGateway', {
          virtualGatewayName: 'test-gateway',
          mesh: mesh,
          listeners: [appmesh.VirtualGatewayListener.grpc({
            port: 8080,
            tls: {
              mode: appmesh.TlsMode.STRICT,
              certificate: appmesh.TlsCertificate.file('path/to/certChain', 'path/to/privateKey'),
              mutualTlsValidation: {
                trust: appmesh.TlsValidationTrust.file('path/to/certChain'),
              },
            },
          })],
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualGateway', {
          Spec: {
            Listeners: [
              {
                TLS: {
                  Mode: appmesh.TlsMode.STRICT,
                  Certificate: {
                    File: {
                      CertificateChain: 'path/to/certChain',
                      PrivateKey: 'path/to/privateKey',
                    },
                  },
                  Validation: {
                    Trust: {
                      File: {
                        CertificateChain: 'path/to/certChain',
                      },
                    },
                  },
                },
              },
            ],
          },
        }));

        test.done();
      },
    },

    'with an http2 listener with a TLS validation from SDS': {
      'the listener should include the TLS configuration'(test:Test) {
        // GIVEN
        const stack = new cdk.Stack();
        const mesh = new appmesh.Mesh(stack, 'mesh', {
          meshName: 'test-mesh',
        });

        // WHEN
        new appmesh.VirtualGateway(stack, 'testGateway', {
          virtualGatewayName: 'test-gateway',
          mesh: mesh,
          listeners: [appmesh.VirtualGatewayListener.http2({
            port: 8080,
            tls: {
              mode: appmesh.TlsMode.STRICT,
              certificate: appmesh.TlsCertificate.sds('secret_certificate'),
              mutualTlsValidation: {
                subjectAlternativeNames: appmesh.SubjectAlternativeNames.matchingExactly('mesh-endpoint.apps.local'),
                trust: appmesh.TlsValidationTrust.sds('secret_validation'),
              },
            },
          })],
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualGateway', {
          Spec: {
            Listeners: [
              {
                TLS: {
                  Mode: appmesh.TlsMode.STRICT,
                  Certificate: {
                    SDS: {
                      SecretName: 'secret_certificate',
                    },
                  },
                  Validation: {
                    SubjectAlternativeNames: {
                      Match: {
                        Exact: ['mesh-endpoint.apps.local'],
                      },
                    },
                  },
                },
              },
            ],
          },
        }));

        test.done();
      },
    },

    'with an grpc listener with the TLS mode permissive'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      const mesh = new appmesh.Mesh(stack, 'mesh', {
        meshName: 'test-mesh',
      });

      new appmesh.VirtualGateway(stack, 'testGateway', {
        virtualGatewayName: 'test-gateway',
        mesh: mesh,
        listeners: [appmesh.VirtualGatewayListener.grpc({
          port: 8080,
          tls: {
            mode: appmesh.TlsMode.PERMISSIVE,
            certificate: appmesh.TlsCertificate.file('path/to/certChain', 'path/to/privateKey'),
          },
        })],
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualGateway', {
        Spec: {
          Listeners: [
            {
              TLS: {
                Mode: appmesh.TlsMode.PERMISSIVE,
                Certificate: {
                  File: {
                    CertificateChain: 'path/to/certChain',
                    PrivateKey: 'path/to/privateKey',
                  },
                },
              },
            },
          ],
        },
      }));

      test.done();
    },

    'with shared service mesh': {
      'Mesh Owner is the AWS account ID of the account that shared the mesh with your account'(test:Test) {
        // GIVEN
        const app = new cdk.App();
        const meshEnv = { account: '1234567899', region: 'us-west-2' };
        const virtualGatewayEnv = { account: '9987654321', region: 'us-west-2' };

        // Creating stack in Account 9987654321
        const stack = new cdk.Stack(app, 'mySharedStack', { env: virtualGatewayEnv });
        // Mesh is in Account 1234567899
        const sharedMesh = appmesh.Mesh.fromMeshArn(stack, 'shared-mesh',
          `arn:aws:appmesh:${meshEnv.region}:${meshEnv.account}:mesh/shared-mesh`);

        // WHEN
        new appmesh.VirtualGateway(stack, 'test-node', {
          mesh: sharedMesh,
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualGateway', {
          MeshOwner: meshEnv.account,
        }));

        test.done();
      },
    },
  },

  'When adding a gateway route to existing VirtualGateway ': {
    'should create gateway route resource'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      const mesh = new appmesh.Mesh(stack, 'mesh', {
        meshName: 'test-mesh',
      });

      const virtualGateway = new appmesh.VirtualGateway(stack, 'testGateway', {
        virtualGatewayName: 'test-gateway',
        mesh: mesh,
      });

      const virtualService = new appmesh.VirtualService(stack, 'virtualService', {
        virtualServiceProvider: appmesh.VirtualServiceProvider.none(mesh),
      });

      virtualGateway.addGatewayRoute('testGatewayRoute', {
        gatewayRouteName: 'test-gateway-route',
        routeSpec: appmesh.GatewayRouteSpec.http({
          routeTarget: virtualService,
        }),
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::AppMesh::GatewayRoute', {
        GatewayRouteName: 'test-gateway-route',
        Spec: {
          HttpRoute: {
            Action: {
              Target: {
                VirtualService: {
                  VirtualServiceName: {
                    'Fn::GetAtt': ['virtualService03A04B87', 'VirtualServiceName'],
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
      test.done();
    },
  },

  'When adding gateway routes to a VirtualGateway with existing gateway routes': {
    'should add gateway routes and not overwite'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      const mesh = new appmesh.Mesh(stack, 'mesh', {
        meshName: 'test-mesh',
      });

      const virtualService = new appmesh.VirtualService(stack, 'virtualService', {
        virtualServiceProvider: appmesh.VirtualServiceProvider.none(mesh),
      });

      const virtualGateway = mesh.addVirtualGateway('gateway');
      virtualGateway.addGatewayRoute('testGatewayRoute', {
        gatewayRouteName: 'test-gateway-route',
        routeSpec: appmesh.GatewayRouteSpec.http({
          routeTarget: virtualService,
        }),
      });
      virtualGateway.addGatewayRoute('testGatewayRoute2', {
        gatewayRouteName: 'test-gateway-route-2',
        routeSpec: appmesh.GatewayRouteSpec.http({
          routeTarget: virtualService,
        }),
      });
      // THEN
      expect(stack).to(haveResourceLike('AWS::AppMesh::GatewayRoute', {
        GatewayRouteName: 'test-gateway-route',
      }));
      expect(stack).to(haveResourceLike('AWS::AppMesh::GatewayRoute', {
        GatewayRouteName: 'test-gateway-route-2',
      }));
      test.done();
    },
  },

  'When creating a VirtualGateway with backend defaults': {
    'should add backend defaults to the VirtualGateway'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      const mesh = new appmesh.Mesh(stack, 'mesh', {
        meshName: 'test-mesh',
      });

      new appmesh.VirtualGateway(stack, 'virtual-gateway', {
        virtualGatewayName: 'virtual-gateway',
        mesh: mesh,
        backendDefaults: {
          tlsClientPolicy: {
            validation: {
              trust: appmesh.TlsValidationTrust.file('path-to-certificate'),
            },
          },
        },
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualGateway', {
        VirtualGatewayName: 'virtual-gateway',
        Spec: {
          BackendDefaults: {
            ClientPolicy: {
              TLS: {
                Validation: {
                  Trust: {
                    File: {
                      CertificateChain: 'path-to-certificate',
                    },
                  },
                },
              },
            },
          },
        },
      }));

      test.done();
    },

    "with client's TLS certificate from SDS": {
      'should add a backend default to the resource with TLS certificate'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();
        const mesh = new appmesh.Mesh(stack, 'mesh', {
          meshName: 'test-mesh',
        });

        // WHEN
        new appmesh.VirtualGateway(stack, 'virtual-gateway', {
          virtualGatewayName: 'virtual-gateway',
          mesh: mesh,
          backendDefaults: {
            tlsClientPolicy: {
              mutualTlsCertificate: appmesh.TlsCertificate.sds( 'secret_certificate'),
              validation: {
                subjectAlternativeNames: appmesh.SubjectAlternativeNames.matchingExactly('mesh-endpoint.apps.local'),
                trust: appmesh.TlsValidationTrust.sds('secret_validation'),
              },
            },
          },
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualGateway', {
          VirtualGatewayName: 'virtual-gateway',
          Spec: {
            BackendDefaults: {
              ClientPolicy: {
                TLS: {
                  Certificate: {
                    SDS: {
                      SecretName: 'secret_certificate',
                    },
                  },
                  Validation: {
                    SubjectAlternativeNames: {
                      Match: {
                        Exact: ['mesh-endpoint.apps.local'],
                      },
                    },
                    Trust: {
                      SDS: {
                        SecretName: 'secret_validation',
                      },
                    },
                  },
                },
              },
            },
          },
        }));

        test.done();
      },
    },
  },

  'Can add an http connection pool to listener'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const mesh = new appmesh.Mesh(stack, 'mesh', {
      meshName: 'test-mesh',
    });

    new appmesh.VirtualGateway(stack, 'virtual-gateway', {
      virtualGatewayName: 'virtual-gateway',
      mesh: mesh,
      listeners: [
        appmesh.VirtualGatewayListener.http({
          port: 80,
          connectionPool: {
            maxConnections: 100,
            maxPendingRequests: 10,
          },
        }),
      ],
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualGateway', {
      VirtualGatewayName: 'virtual-gateway',
      Spec: {
        Listeners: [
          {
            ConnectionPool: {
              HTTP: {
                MaxConnections: 100,
                MaxPendingRequests: 10,
              },
            },
          },
        ],
      },
    }));

    test.done();
  },

  'Can add an grpc connection pool to listener'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const mesh = new appmesh.Mesh(stack, 'mesh', {
      meshName: 'test-mesh',
    });

    new appmesh.VirtualGateway(stack, 'virtual-gateway', {
      virtualGatewayName: 'virtual-gateway',
      mesh: mesh,
      listeners: [
        appmesh.VirtualGatewayListener.grpc({
          port: 80,
          connectionPool: {
            maxRequests: 10,
          },
        }),
      ],
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualGateway', {
      VirtualGatewayName: 'virtual-gateway',
      Spec: {
        Listeners: [
          {
            ConnectionPool: {
              GRPC: {
                MaxRequests: 10,
              },
            },
          },
        ],
      },
    }));

    test.done();
  },

  'Can add an http2 connection pool to listener'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const mesh = new appmesh.Mesh(stack, 'mesh', {
      meshName: 'test-mesh',
    });

    new appmesh.VirtualGateway(stack, 'virtual-gateway', {
      virtualGatewayName: 'virtual-gateway',
      mesh: mesh,
      listeners: [
        appmesh.VirtualGatewayListener.http2({
          port: 80,
          connectionPool: {
            maxRequests: 10,
          },
        }),
      ],
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualGateway', {
      VirtualGatewayName: 'virtual-gateway',
      Spec: {
        Listeners: [
          {
            ConnectionPool: {
              HTTP2: {
                MaxRequests: 10,
              },
            },
          },
        ],
      },
    }));

    test.done();
  },

  'Can import VirtualGateways using an ARN'(test: Test) {
    const app = new cdk.App();
    // GIVEN
    const stack = new cdk.Stack(app, 'Imports', {
      env: { account: '123456789012', region: 'us-east-1' },
    });
    const meshName = 'testMesh';
    const virtualGatewayName = 'test-gateway';
    const arn = `arn:aws:appmesh:us-east-1:123456789012:mesh/${meshName}/virtualGateway/${virtualGatewayName}`;

    // WHEN
    const virtualGateway = appmesh.VirtualGateway.fromVirtualGatewayArn(
      stack, 'importedGateway', arn);
    // THEN
    test.equal(virtualGateway.mesh.meshName, meshName);
    test.equal(virtualGateway.virtualGatewayName, virtualGatewayName);
    test.done();
  },

  'Can import VirtualGateways using attributes'(test: Test) {
    const app = new cdk.App();
    // GIVEN
    const stack = new cdk.Stack(app, 'Imports', {
      env: { account: '123456789012', region: 'us-east-1' },
    });
    const meshName = 'testMesh';
    const virtualGatewayName = 'test-gateway';

    // WHEN
    const virtualGateway = appmesh.VirtualGateway.fromVirtualGatewayAttributes(stack, 'importedGateway', {
      mesh: appmesh.Mesh.fromMeshName(stack, 'Mesh', meshName),
      virtualGatewayName: virtualGatewayName,
    });
    // THEN
    test.equal(virtualGateway.mesh.meshName, meshName);
    test.equal(virtualGateway.virtualGatewayName, virtualGatewayName);

    test.done();
  },

  'Can grant an identity StreamAggregatedResources for a given VirtualGateway'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const mesh = new appmesh.Mesh(stack, 'mesh', {
      meshName: 'test-mesh',
    });
    const gateway = new appmesh.VirtualGateway(stack, 'testGateway', {
      mesh: mesh,
    });

    // WHEN
    const user = new iam.User(stack, 'test');
    gateway.grantStreamAggregatedResources(user);

    // THEN
    expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'appmesh:StreamAggregatedResources',
            Effect: 'Allow',
            Resource: {
              Ref: 'testGatewayF09EC349',
            },
          },
        ],
      },
    }));

    test.done();
  },
};