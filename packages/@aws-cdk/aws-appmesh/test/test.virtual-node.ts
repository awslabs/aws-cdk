import { ABSENT, expect, haveResourceLike } from '@aws-cdk/assert-internal';
import * as acmpca from '@aws-cdk/aws-acmpca';
import * as acm from '@aws-cdk/aws-certificatemanager';
import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import { Test } from 'nodeunit';
import * as appmesh from '../lib';

export = {
  'When an existing VirtualNode': {
    'with existing backends, adds new backend': {
      'should add resource with service backends'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();

        // WHEN
        const mesh = new appmesh.Mesh(stack, 'mesh', {
          meshName: 'test-mesh',
        });

        const service1 = new appmesh.VirtualService(stack, 'service-1', {
          virtualServiceName: 'service1.domain.local',
          virtualServiceProvider: appmesh.VirtualServiceProvider.none(mesh),
        });
        const service2 = new appmesh.VirtualService(stack, 'service-2', {
          virtualServiceName: 'service2.domain.local',
          virtualServiceProvider: appmesh.VirtualServiceProvider.none(mesh),
        });

        const node = new appmesh.VirtualNode(stack, 'test-node', {
          mesh,
          serviceDiscovery: appmesh.ServiceDiscovery.dns('test'),
          backends: [appmesh.Backend.virtualService(service1)],
        });

        node.addBackend(appmesh.Backend.virtualService(service2));

        // THEN
        expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualNode', {
          Spec: {
            Backends: [
              {
                VirtualService: {
                  VirtualServiceName: {
                    'Fn::GetAtt': ['service1A48078CF', 'VirtualServiceName'],
                  },
                },
              },
              {
                VirtualService: {
                  VirtualServiceName: {
                    'Fn::GetAtt': ['service27C65CF7D', 'VirtualServiceName'],
                  },
                },
              },
            ],
          },
          MeshOwner: ABSENT,
        }));

        test.done();
      },
    },

    'when a single portmapping is added': {
      'should add the portmapping to the resource'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();

        // WHEN
        const mesh = new appmesh.Mesh(stack, 'mesh', {
          meshName: 'test-mesh',
        });

        const node = mesh.addVirtualNode('test-node', {
          serviceDiscovery: appmesh.ServiceDiscovery.dns('test'),
        });

        node.addListener(appmesh.VirtualNodeListener.tcp({
          port: 8081,
        }));

        // THEN
        expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualNode', {
          Spec: {
            Listeners: [
              {
                PortMapping: {
                  Port: 8081,
                  Protocol: 'tcp',
                },
              },
            ],
          },
        }));

        test.done();
      },
    },

    'when a listener is added with timeout': {
      'should add the listener timeout to the resource'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();

        // WHEN
        const mesh = new appmesh.Mesh(stack, 'mesh', {
          meshName: 'test-mesh',
        });

        new appmesh.VirtualNode(stack, 'test-node', {
          mesh,
          serviceDiscovery: appmesh.ServiceDiscovery.dns('test'),
          listeners: [appmesh.VirtualNodeListener.grpc({
            port: 80,
            timeout: {
              idle: cdk.Duration.seconds(10),
              perRequest: cdk.Duration.seconds(10),
            },
          })],
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualNode', {
          Spec: {
            Listeners: [
              {
                PortMapping: {
                  Port: 80,
                  Protocol: 'grpc',
                },
                Timeout: {
                  GRPC: {
                    Idle: {
                      Unit: 'ms',
                      Value: 10000,
                    },
                    PerRequest: {
                      Unit: 'ms',
                      Value: 10000,
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

    'when a listener is added with healthcheck ': {
      'should add a default listener healthcheck to the resource'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();

        // WHEN
        const mesh = new appmesh.Mesh(stack, 'mesh', {
          meshName: 'test-mesh',
        });

        new appmesh.VirtualNode(stack, 'test-node', {
          mesh,
          serviceDiscovery: appmesh.ServiceDiscovery.dns('test'),
          listeners: [appmesh.VirtualNodeListener.http2({
            port: 80,
            healthCheck: appmesh.HealthCheck.http2(),
            timeout: { idle: cdk.Duration.seconds(10) },
          })],
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualNode', {
          Spec: {
            Listeners: [
              {
                HealthCheck: {
                  HealthyThreshold: 2,
                  IntervalMillis: 5000,
                  Port: 80,
                  Protocol: 'http2',
                  TimeoutMillis: 2000,
                  UnhealthyThreshold: 2,
                },
                PortMapping: {
                  Port: 80,
                  Protocol: 'http2',
                },
                Timeout: {
                  HTTP2: {
                    Idle: {
                      Unit: 'ms',
                      Value: 10000,
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

    'when a listener is added with healthcheck with user defined props': {
      'should add a listener healthcheck to the resource'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();

        // WHEN
        const mesh = new appmesh.Mesh(stack, 'mesh', {
          meshName: 'test-mesh',
        });

        const node = new appmesh.VirtualNode(stack, 'test-node', {
          mesh,
          serviceDiscovery: appmesh.ServiceDiscovery.dns('test'),
        });

        node.addListener(appmesh.VirtualNodeListener.tcp({
          port: 80,
          healthCheck: appmesh.HealthCheck.tcp({
            timeout: cdk.Duration.seconds(3),
          }),
          timeout: { idle: cdk.Duration.seconds(10) },
        }));

        // THEN
        expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualNode', {
          Spec: {
            Listeners: [
              {
                HealthCheck: {
                  HealthyThreshold: 2,
                  IntervalMillis: 5000,
                  Port: 80,
                  Protocol: 'tcp',
                  TimeoutMillis: 3000,
                  UnhealthyThreshold: 2,
                },
                PortMapping: {
                  Port: 80,
                  Protocol: 'tcp',
                },
                Timeout: {
                  TCP: {
                    Idle: {
                      Unit: 'ms',
                      Value: 10000,
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

    'when a listener is added with outlier detection with user defined props': {
      'should add a listener outlier detection to the resource'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();

        // WHEN
        const mesh = new appmesh.Mesh(stack, 'mesh', {
          meshName: 'test-mesh',
        });

        const node = new appmesh.VirtualNode(stack, 'test-node', {
          mesh,
          serviceDiscovery: appmesh.ServiceDiscovery.dns('test'),
        });

        node.addListener(appmesh.VirtualNodeListener.tcp({
          port: 80,
          outlierDetection: {
            baseEjectionDuration: cdk.Duration.seconds(10),
            interval: cdk.Duration.seconds(30),
            maxEjectionPercent: 50,
            maxServerErrors: 5,
          },
        }));

        // THEN
        expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualNode', {
          Spec: {
            Listeners: [
              {
                OutlierDetection: {
                  BaseEjectionDuration: {
                    Unit: 'ms',
                    Value: 10000,
                  },
                  Interval: {
                    Unit: 'ms',
                    Value: 30000,
                  },
                  MaxEjectionPercent: 50,
                  MaxServerErrors: 5,
                },
                PortMapping: {
                  Port: 80,
                  Protocol: 'tcp',
                },
              },
            ],
          },
        }));

        test.done();
      },
    },

    'when a default backend is added': {
      'should add a backend default to the resource'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();

        // WHEN
        const mesh = new appmesh.Mesh(stack, 'mesh', {
          meshName: 'test-mesh',
        });

        const certificateAuthorityArn = 'arn:aws:acm-pca:us-east-1:123456789012:certificate-authority/12345678-1234-1234-1234-123456789012';

        new appmesh.VirtualNode(stack, 'test-node', {
          mesh,
          serviceDiscovery: appmesh.ServiceDiscovery.dns('test'),
          backendDefaults: {
            tlsClientPolicy: {
              ports: [8080, 8081],
              validation: {
                trust: appmesh.TlsValidationTrust.acm([acmpca.CertificateAuthority.fromCertificateAuthorityArn(stack, 'certificate', certificateAuthorityArn)]),
              },
            },
          },
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualNode', {
          Spec: {
            BackendDefaults: {
              ClientPolicy: {
                TLS: {
                  Ports: [8080, 8081],
                  Validation: {
                    Trust: {
                      ACM: {
                        CertificateAuthorityArns: [`${certificateAuthorityArn}`],
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

    "with client's TLS certificate from SDS": {
      'should add a backend default to the resource with TLS certificate'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();
        const mesh = new appmesh.Mesh(stack, 'mesh', {
          meshName: 'test-mesh',
        });

        // WHEN
        new appmesh.VirtualNode(stack, 'test-node', {
          mesh,
          serviceDiscovery: appmesh.ServiceDiscovery.dns('test'),
          backendDefaults: {
            tlsClientPolicy: {
              mutualTlsCertificate: appmesh.TlsCertificate.sds('secret_certificate'),
              ports: [8080, 8081],
              validation: {
                subjectAlternativeNames: appmesh.SubjectAlternativeNames.matchingExactly('mesh-endpoint.apps.local'),
                trust: appmesh.TlsValidationTrust.sds('secret_validation'),
              },
            },
          },
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualNode', {
          Spec: {
            BackendDefaults: {
              ClientPolicy: {
                TLS: {
                  Certificate: {
                    SDS: {
                      SecretName: 'secret_certificate',
                    },
                  },
                  Ports: [8080, 8081],
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

    'when a backend is added': {
      'should add a backend virtual service to the resource'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();

        // WHEN
        const mesh = new appmesh.Mesh(stack, 'mesh', {
          meshName: 'test-mesh',
        });

        const node = new appmesh.VirtualNode(stack, 'test-node', {
          mesh,
          serviceDiscovery: appmesh.ServiceDiscovery.dns('test'),
        });

        const service1 = new appmesh.VirtualService(stack, 'service-1', {
          virtualServiceName: 'service1.domain.local',
          virtualServiceProvider: appmesh.VirtualServiceProvider.none(mesh),
        });

        node.addBackend(appmesh.Backend.virtualService(service1, {
          tlsClientPolicy: {
            ports: [8080, 8081],
            validation: {
              trust: appmesh.TlsValidationTrust.file('path-to-certificate'),
            },
          },
        }));

        // THEN
        expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualNode', {
          Spec: {
            Backends: [
              {
                VirtualService: {
                  VirtualServiceName: {
                    'Fn::GetAtt': ['service1A48078CF', 'VirtualServiceName'],
                  },
                  ClientPolicy: {
                    TLS: {
                      Ports: [8080, 8081],
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
            ],
          },
        }));

        test.done();
      },
    },

    'when a grpc listener is added with a TLS certificate from ACM': {
      'the listener should include the TLS configuration'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();

        // WHEN
        const mesh = new appmesh.Mesh(stack, 'mesh', {
          meshName: 'test-mesh',
        });

        const cert = new acm.Certificate(stack, 'cert', {
          domainName: '',
        });

        new appmesh.VirtualNode(stack, 'test-node', {
          mesh,
          listeners: [appmesh.VirtualNodeListener.grpc({
            port: 80,
            tls: {
              mode: appmesh.TlsMode.STRICT,
              certificate: appmesh.TlsCertificate.acm(cert),
            },
          },
          )],
          serviceDiscovery: appmesh.ServiceDiscovery.dns('test'),
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualNode', {
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
    },

    'when an http listener is added with a TLS certificate from file': {
      'the listener should include the TLS configuration'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();

        // WHEN
        const mesh = new appmesh.Mesh(stack, 'mesh', {
          meshName: 'test-mesh',
        });

        new appmesh.VirtualNode(stack, 'test-node', {
          mesh,
          listeners: [appmesh.VirtualNodeListener.http({
            port: 80,
            tls: {
              mode: appmesh.TlsMode.STRICT,
              certificate: appmesh.TlsCertificate.file('path/to/certChain', 'path/to/privateKey'),
            },
          })],
          serviceDiscovery: appmesh.ServiceDiscovery.dns('test'),
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualNode', {
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
    },

    'when an http2 listener is added with a TLS certificate from SDS': {
      'the listener should include the TLS configuration'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();
        const mesh = new appmesh.Mesh(stack, 'mesh', {
          meshName: 'test-mesh',
        });

        // WHEN
        new appmesh.VirtualNode(stack, 'test-node', {
          mesh,
          listeners: [appmesh.VirtualNodeListener.http2({
            port: 80,
            tls: {
              mode: appmesh.TlsMode.STRICT,
              certificate: appmesh.TlsCertificate.sds('secret_certificate'),
            },
          })],
          serviceDiscovery: appmesh.ServiceDiscovery.dns('test'),
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualNode', {
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
    },

    'when an http listener is added with the TLS mode permissive': {
      'the listener should include the TLS configuration'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();

        // WHEN
        const mesh = new appmesh.Mesh(stack, 'mesh', {
          meshName: 'test-mesh',
        });

        new appmesh.VirtualNode(stack, 'test-node', {
          mesh,
          listeners: [appmesh.VirtualNodeListener.http({
            port: 80,
            tls: {
              mode: appmesh.TlsMode.PERMISSIVE,
              certificate: appmesh.TlsCertificate.file('path/to/certChain', 'path/to/privateKey'),
            },
          })],
          serviceDiscovery: appmesh.ServiceDiscovery.dns('test'),
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualNode', {
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
    },

    'Can add an http connection pool to listener'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      const mesh = new appmesh.Mesh(stack, 'mesh', {
        meshName: 'test-mesh',
      });

      new appmesh.VirtualNode(stack, 'test-node', {
        mesh,
        listeners: [
          appmesh.VirtualNodeListener.http({
            port: 80,
            connectionPool: {
              maxConnections: 100,
              maxPendingRequests: 10,
            },
          }),
        ],
        serviceDiscovery: appmesh.ServiceDiscovery.dns('test'),
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualNode', {
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

    'Can add an tcp connection pool to listener'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();

      // WHEN
      const mesh = new appmesh.Mesh(stack, 'mesh', {
        meshName: 'test-mesh',
      });

      new appmesh.VirtualNode(stack, 'test-node', {
        mesh,
        listeners: [
          appmesh.VirtualNodeListener.tcp({
            port: 80,
            connectionPool: {
              maxConnections: 100,
            },
          }),
        ],
        serviceDiscovery: appmesh.ServiceDiscovery.dns('test'),
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualNode', {
        Spec: {
          Listeners: [
            {
              ConnectionPool: {
                TCP: {
                  MaxConnections: 100,
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

      new appmesh.VirtualNode(stack, 'test-node', {
        mesh,
        listeners: [
          appmesh.VirtualNodeListener.grpc({
            port: 80,
            connectionPool: {
              maxRequests: 10,
            },
          }),
        ],
        serviceDiscovery: appmesh.ServiceDiscovery.dns('test'),
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualNode', {
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

      new appmesh.VirtualNode(stack, 'test-node', {
        mesh,
        listeners: [
          appmesh.VirtualNodeListener.http2({
            port: 80,
            connectionPool: {
              maxRequests: 10,
            },
          }),
        ],
        serviceDiscovery: appmesh.ServiceDiscovery.dns('test'),
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualNode', {
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
  },

  'Can import Virtual Nodes using an ARN'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    const meshName = 'testMesh';
    const virtualNodeName = 'test-node';
    const arn = `arn:aws:appmesh:us-east-1:123456789012:mesh/${meshName}/virtualNode/${virtualNodeName}`;

    // WHEN
    const virtualNode = appmesh.VirtualNode.fromVirtualNodeArn(
      stack, 'importedVirtualNode', arn);
    // THEN
    test.equal(virtualNode.mesh.meshName, meshName);
    test.equal(virtualNode.virtualNodeName, virtualNodeName);

    test.done();
  },

  'Can import Virtual Nodes using attributes'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const meshName = 'testMesh';
    const virtualNodeName = 'test-node';
    // WHEN
    const virtualNode = appmesh.VirtualNode.fromVirtualNodeAttributes(stack, 'importedVirtualNode', {
      mesh: appmesh.Mesh.fromMeshName(stack, 'Mesh', meshName),
      virtualNodeName: virtualNodeName,
    });
    // THEN
    test.equal(virtualNode.mesh.meshName, meshName);
    test.equal(virtualNode.virtualNodeName, virtualNodeName);

    test.done();
  },

  'Can grant an identity StreamAggregatedResources for a given VirtualNode'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const mesh = new appmesh.Mesh(stack, 'mesh', {
      meshName: 'test-mesh',
    });
    const node = new appmesh.VirtualNode(stack, 'test-node', {
      mesh,
      listeners: [appmesh.VirtualNodeListener.http({
        port: 80,
        tls: {
          mode: appmesh.TlsMode.PERMISSIVE,
          certificate: appmesh.TlsCertificate.file('path/to/certChain', 'path/to/privateKey'),
        },
      })],
      serviceDiscovery: appmesh.ServiceDiscovery.dns('test'),
    });

    // WHEN
    const user = new iam.User(stack, 'test');
    node.grantStreamAggregatedResources(user);

    // THEN
    expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'appmesh:StreamAggregatedResources',
            Effect: 'Allow',
            Resource: {
              Ref: 'testnode3EE2776E',
            },
          },
        ],
      },
    }));

    test.done();
  },

  'When creating a VirtualNode': {
    'with shared service mesh': {
      'Mesh Owner is the AWS account ID of the account that shared the mesh with your account'(test:Test) {
        // GIVEN
        const app = new cdk.App();
        const meshEnv = { account: '1234567899', region: 'us-west-2' };
        const virtualNodeEnv = { account: '9987654321', region: 'us-west-2' };

        // Creating stack in Account 9987654321
        const stack = new cdk.Stack(app, 'mySharedStack', { env: virtualNodeEnv });
        // Mesh is in Account 1234567899
        const sharedMesh = appmesh.Mesh.fromMeshArn(stack, 'shared-mesh',
          `arn:aws:appmesh:${meshEnv.region}:${meshEnv.account}:mesh/shared-mesh`);

        // WHEN
        new appmesh.VirtualNode(stack, 'test-node', {
          mesh: sharedMesh,
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualNode', {
          MeshOwner: meshEnv.account,
        }));

        test.done();
      },
    },

    'with DNS service discovery': {
      'should allow set response type'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();

        const mesh = new appmesh.Mesh(stack, 'mesh', {
          meshName: 'test-mesh',
        });

        // WHEN
        new appmesh.VirtualNode(stack, 'test-node', {
          mesh,
          serviceDiscovery: appmesh.ServiceDiscovery.dns('test', appmesh.DnsResponseType.LOAD_BALANCER),
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::AppMesh::VirtualNode', {
          Spec: {
            ServiceDiscovery: {
              DNS: {
                Hostname: 'test',
                ResponseType: 'LOADBALANCER',
              },
            },
          },
        }));

        test.done();
      },
    },

    'with listener and without service discovery': {
      'should throw an error'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();

        const mesh = new appmesh.Mesh(stack, 'mesh', {
          meshName: 'test-mesh',
        });

        const node = new appmesh.VirtualNode(stack, 'test-node', {
          mesh,
        });

        // WHEN + THEN
        test.throws(() => {
          new appmesh.VirtualNode(stack, 'test-node-2', {
            mesh,
            listeners: [appmesh.VirtualNodeListener.http()],
          });
        }, /Service discovery information is required for a VirtualNode with a listener/);

        test.throws(() => {
          mesh.addVirtualNode('test-node-3', {
            listeners: [appmesh.VirtualNodeListener.http()],
          });
        }, /Service discovery information is required for a VirtualNode with a listener/);

        test.throws(() => {
          node.addListener(appmesh.VirtualNodeListener.http());
        }, /Service discovery information is required for a VirtualNode with a listener/);

        test.done();
      },
    },
  },
};


