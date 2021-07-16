import { expect, haveResource, haveResourceLike, SynthUtils } from '@aws-cdk/assert-internal';
import { Certificate } from '@aws-cdk/aws-certificatemanager';
import { InstanceType, Vpc } from '@aws-cdk/aws-ec2';
import { AwsLogDriver, Cluster, ContainerImage, Ec2TaskDefinition, PropagatedTagSource, Protocol } from '@aws-cdk/aws-ecs';
import { ApplicationProtocol, SslPolicy } from '@aws-cdk/aws-elasticloadbalancingv2';
import { CompositePrincipal, Role, ServicePrincipal } from '@aws-cdk/aws-iam';
import { PublicHostedZone } from '@aws-cdk/aws-route53';
import { NamespaceType } from '@aws-cdk/aws-servicediscovery';
import { Duration, Stack } from '@aws-cdk/core';
import { Test } from 'nodeunit';
import { ApplicationMultipleTargetGroupsEc2Service, NetworkMultipleTargetGroupsEc2Service } from '../../lib';

export = {
  'When Application Load Balancer': {
    'test ECS ALB construct with default settings'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const cluster = new Cluster(stack, 'Cluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new InstanceType('t2.micro') });

      // WHEN
      new ApplicationMultipleTargetGroupsEc2Service(stack, 'Service', {
        cluster,
        memoryLimitMiB: 1024,
        taskImageOptions: {
          image: ContainerImage.fromRegistry('test'),
        },
      });

      // THEN - stack contains a load balancer, a service, and a target group.
      expect(stack).to(haveResource('AWS::ElasticLoadBalancingV2::LoadBalancer'));

      expect(stack).to(haveResource('AWS::ECS::Service', {
        DesiredCount: 1,
        LaunchType: 'EC2',
      }));

      expect(stack).to(haveResourceLike('AWS::ECS::TaskDefinition', {
        ContainerDefinitions: [
          {
            Image: 'test',
            LogConfiguration: {
              LogDriver: 'awslogs',
              Options: {
                'awslogs-group': {
                  Ref: 'ServiceTaskDefwebLogGroup2A898F61',
                },
                'awslogs-stream-prefix': 'Service',
                'awslogs-region': {
                  Ref: 'AWS::Region',
                },
              },
            },
            Memory: 1024,
            Name: 'web',
            PortMappings: [
              {
                ContainerPort: 80,
                HostPort: 0,
                Protocol: 'tcp',
              },
            ],
          },
        ],
        NetworkMode: 'bridge',
        RequiresCompatibilities: [
          'EC2',
        ],
      }));

      test.done();
    },

    'test ECS ALB construct with all settings'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const cluster = new Cluster(stack, 'Cluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new InstanceType('t2.micro') });
      const zone = new PublicHostedZone(stack, 'HostedZone', { zoneName: 'example.com' });

      // WHEN
      new ApplicationMultipleTargetGroupsEc2Service(stack, 'Service', {
        cluster,
        memoryLimitMiB: 1024,
        taskImageOptions: {
          image: ContainerImage.fromRegistry('test'),
          containerName: 'myContainer',
          containerPorts: [80, 90],
          enableLogging: false,
          environment: {
            TEST_ENVIRONMENT_VARIABLE1: 'test environment variable 1 value',
            TEST_ENVIRONMENT_VARIABLE2: 'test environment variable 2 value',
          },
          logDriver: new AwsLogDriver({
            streamPrefix: 'TestStream',
          }),
          family: 'Ec2TaskDef',
          executionRole: new Role(stack, 'ExecutionRole', {
            path: '/',
            assumedBy: new CompositePrincipal(
              new ServicePrincipal('ecs.amazonaws.com'),
              new ServicePrincipal('ecs-tasks.amazonaws.com'),
            ),
          }),
          taskRole: new Role(stack, 'TaskRole', {
            assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
          }),
          dockerLabels: { label1: 'labelValue1', label2: 'labelValue2' },
        },
        cpu: 256,
        desiredCount: 3,
        enableECSManagedTags: true,
        healthCheckGracePeriod: Duration.millis(2000),
        loadBalancers: [
          {
            name: 'lb',
            domainName: 'api.example.com',
            domainZone: zone,
            publicLoadBalancer: false,
            listeners: [
              {
                name: 'listener',
                protocol: ApplicationProtocol.HTTPS,
                certificate: Certificate.fromCertificateArn(stack, 'Cert', 'helloworld'),
                sslPolicy: SslPolicy.TLS12_EXT,
              },
            ],
          },
        ],
        propagateTags: PropagatedTagSource.SERVICE,
        memoryReservationMiB: 1024,
        serviceName: 'myService',
        targetGroups: [
          {
            containerPort: 80,
            listener: 'listener',
          },
          {
            containerPort: 90,
            listener: 'listener',
            pathPattern: 'a/b/c',
            priority: 10,
            protocol: Protocol.TCP,
          },
        ],
      });

      // THEN
      expect(stack).to(haveResource('AWS::ECS::Service', {
        DesiredCount: 3,
        LaunchType: 'EC2',
        EnableECSManagedTags: true,
        HealthCheckGracePeriodSeconds: 2,
        LoadBalancers: [
          {
            ContainerName: 'myContainer',
            ContainerPort: 80,
            TargetGroupArn: {
              Ref: 'ServicelblistenerECSTargetGroupmyContainer80GroupAD83584A',
            },
          },
          {
            ContainerName: 'myContainer',
            ContainerPort: 90,
            TargetGroupArn: {
              Ref: 'ServicelblistenerECSTargetGroupmyContainer90GroupF5A6D3A0',
            },
          },
        ],
        PropagateTags: 'SERVICE',
        ServiceName: 'myService',
      }));

      expect(stack).to(haveResourceLike('AWS::ECS::TaskDefinition', {
        ContainerDefinitions: [
          {
            Cpu: 256,
            Environment: [
              {
                Name: 'TEST_ENVIRONMENT_VARIABLE1',
                Value: 'test environment variable 1 value',
              },
              {
                Name: 'TEST_ENVIRONMENT_VARIABLE2',
                Value: 'test environment variable 2 value',
              },
            ],
            Essential: true,
            Image: 'test',
            LogConfiguration: {
              LogDriver: 'awslogs',
              Options: {
                'awslogs-group': {
                  Ref: 'ServiceTaskDefmyContainerLogGroup0A87368B',
                },
                'awslogs-stream-prefix': 'TestStream',
                'awslogs-region': {
                  Ref: 'AWS::Region',
                },
              },
            },
            Memory: 1024,
            MemoryReservation: 1024,
            Name: 'myContainer',
            PortMappings: [
              {
                ContainerPort: 80,
                HostPort: 0,
                Protocol: 'tcp',
              },
              {
                ContainerPort: 90,
                HostPort: 0,
                Protocol: 'tcp',
              },
            ],
            DockerLabels: {
              label1: 'labelValue1',
              label2: 'labelValue2',
            },
          },
        ],
        ExecutionRoleArn: {
          'Fn::GetAtt': [
            'ExecutionRole605A040B',
            'Arn',
          ],
        },
        Family: 'ServiceTaskDef79D79521',
        NetworkMode: 'bridge',
        RequiresCompatibilities: [
          'EC2',
        ],
        TaskRoleArn: {
          'Fn::GetAtt': [
            'TaskRole30FC0FBB',
            'Arn',
          ],
        },
      }));

      expect(stack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::Listener', {
        Port: 443,
        Protocol: 'HTTPS',
        Certificates: [{
          CertificateArn: 'helloworld',
        }],
        SslPolicy: SslPolicy.TLS12_EXT,
      }));

      test.done();
    },

    'set vpc instead of cluster'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');

      // WHEN
      new ApplicationMultipleTargetGroupsEc2Service(stack, 'Service', {
        vpc,
        memoryLimitMiB: 1024,
        taskImageOptions: {
          image: ContainerImage.fromRegistry('test'),
        },
      });

      // THEN - stack does not contain a LaunchConfiguration
      expect(stack, true).notTo(haveResource('AWS::AutoScaling::LaunchConfiguration'));

      test.throws(() => expect(stack));

      test.done();
    },

    'able to pass pre-defined task definition'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const cluster = new Cluster(stack, 'Cluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new InstanceType('t2.micro') });

      const taskDefinition = new Ec2TaskDefinition(stack, 'Ec2TaskDef');
      const container = taskDefinition.addContainer('web', {
        image: ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });
      container.addPortMappings({
        containerPort: 80,
      });

      // WHEN
      new ApplicationMultipleTargetGroupsEc2Service(stack, 'Service', {
        cluster,
        taskDefinition,
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::ECS::TaskDefinition', {
        ContainerDefinitions: [
          {
            Essential: true,
            Image: 'amazon/amazon-ecs-sample',
            Memory: 512,
            Name: 'web',
            PortMappings: [
              {
                ContainerPort: 80,
                HostPort: 0,
                Protocol: 'tcp',
              },
            ],
          },
        ],
        Family: 'Ec2TaskDef',
        NetworkMode: 'bridge',
        RequiresCompatibilities: [
          'EC2',
        ],
      }));

      test.done();
    },

    'able to output correct load balancer DNS and URLs for each protocol type'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const cluster = new Cluster(stack, 'Cluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new InstanceType('t2.micro') });
      const zone = new PublicHostedZone(stack, 'HostedZone', { zoneName: 'example.com' });

      // WHEN
      new ApplicationMultipleTargetGroupsEc2Service(stack, 'Service', {
        cluster,
        memoryLimitMiB: 1024,
        taskImageOptions: {
          image: ContainerImage.fromRegistry('test'),
        },
        loadBalancers: [
          {
            name: 'lb1',
            domainName: 'api.example.com',
            domainZone: zone,
            listeners: [
              {
                name: 'listener1',
                protocol: ApplicationProtocol.HTTPS,
                certificate: Certificate.fromCertificateArn(stack, 'Cert', 'helloworld'),
              },
              {
                name: 'listener2',
                protocol: ApplicationProtocol.HTTP,
              },
            ],
          },
          {
            name: 'lb3',
            listeners: [
              {
                name: 'listener3',
                protocol: ApplicationProtocol.HTTP,
              },
            ],
          },
        ],
        targetGroups: [
          {
            containerPort: 80,
            listener: 'listener1',
          },
          {
            containerPort: 90,
            listener: 'listener2',
          },
          {
            containerPort: 70,
            listener: 'listener3',
          },
        ],
      });

      // THEN
      const template = SynthUtils.synthesize(stack).template.Outputs;
      test.deepEqual(template, {
        ServiceLoadBalancerDNSlb175E78BFE: {
          Value: {
            'Fn::GetAtt': [
              'Servicelb152C7F4F9',
              'DNSName',
            ],
          },
        },
        ServiceServiceURLlb1https5C0C4079: {
          Value: {
            'Fn::Join': [
              '',
              [
                'https://',
                {
                  Ref: 'ServiceDNSlb12BA1FAD3',
                },
              ],
            ],
          },
        },
        ServiceServiceURLlb1http65F0546A: {
          Value: {
            'Fn::Join': [
              '',
              [
                'http://',
                {
                  Ref: 'ServiceDNSlb12BA1FAD3',
                },
              ],
            ],
          },
        },
        ServiceLoadBalancerDNSlb32F273F27: {
          Value: {
            'Fn::GetAtt': [
              'Servicelb3A583D5E7',
              'DNSName',
            ],
          },
        },
        ServiceServiceURLlb3http40F9CADC: {
          Value: {
            'Fn::Join': [
              '',
              [
                'http://',
                {
                  'Fn::GetAtt': [
                    'Servicelb3A583D5E7',
                    'DNSName',
                  ],
                },
              ],
            ],
          },
        },
      });

      test.done();
    },

    'errors if no essential container in pre-defined task definition'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const cluster = new Cluster(stack, 'Cluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new InstanceType('t2.micro') });

      const taskDefinition = new Ec2TaskDefinition(stack, 'Ec2TaskDef');

      // THEN
      test.throws(() => {
        new ApplicationMultipleTargetGroupsEc2Service(stack, 'Service', {
          cluster,
          taskDefinition,
        });
      }, /At least one essential container must be specified/);

      test.done();
    },

    'set default load balancer, listener, target group correctly'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const zone = new PublicHostedZone(stack, 'HostedZone', { zoneName: 'example.com' });

      // WHEN
      const ecsService = new ApplicationMultipleTargetGroupsEc2Service(stack, 'Service', {
        vpc,
        memoryLimitMiB: 1024,
        taskImageOptions: {
          image: ContainerImage.fromRegistry('test'),
        },
        loadBalancers: [
          {
            name: 'lb1',
            listeners: [
              {
                name: 'listener1',
              },
            ],
          },
          {
            name: 'lb2',
            domainName: 'api.example.com',
            domainZone: zone,
            listeners: [
              {
                name: 'listener2',
              },
              {
                name: 'listener3',
                protocol: ApplicationProtocol.HTTPS,
                certificate: Certificate.fromCertificateArn(stack, 'Cert', 'helloworld'),
              },
            ],
          },
        ],
        targetGroups: [
          {
            containerPort: 80,
          },
          {
            containerPort: 90,
          },
        ],
      });

      // THEN
      test.equal(ecsService.loadBalancer.node.id, 'lb1');
      test.equal(ecsService.listener.node.id, 'listener1');
      test.equal(ecsService.targetGroup.node.id, 'ECSTargetGroupweb80Group');

      test.done();
    },

    'setting vpc and cluster throws error'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const cluster = new Cluster(stack, 'Cluster', { vpc });

      // WHEN
      test.throws(() => new ApplicationMultipleTargetGroupsEc2Service(stack, 'Service', {
        cluster,
        vpc,
        taskImageOptions: {
          image: ContainerImage.fromRegistry('/aws/aws-example-app'),
        },
      }), /You can only specify either vpc or cluster. Alternatively, you can leave both blank/);

      test.done();
    },

    'creates AWS Cloud Map service for Private DNS namespace'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'MyVpc', {});
      const cluster = new Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new InstanceType('t2.micro') });

      // WHEN
      cluster.addDefaultCloudMapNamespace({
        name: 'foo.com',
        type: NamespaceType.DNS_PRIVATE,
      });

      new ApplicationMultipleTargetGroupsEc2Service(stack, 'Service', {
        cluster,
        taskImageOptions: {
          image: ContainerImage.fromRegistry('hello'),
        },
        cloudMapOptions: {
          name: 'myApp',
        },
        memoryLimitMiB: 512,
      });

      // THEN
      expect(stack).to(haveResource('AWS::ECS::Service', {
        ServiceRegistries: [
          {
            ContainerName: 'web',
            ContainerPort: 80,
            RegistryArn: {
              'Fn::GetAtt': [
                'ServiceCloudmapServiceDE76B29D',
                'Arn',
              ],
            },
          },
        ],
      }));

      expect(stack).to(haveResource('AWS::ServiceDiscovery::Service', {
        DnsConfig: {
          DnsRecords: [
            {
              TTL: 60,
              Type: 'SRV',
            },
          ],
          NamespaceId: {
            'Fn::GetAtt': [
              'EcsClusterDefaultServiceDiscoveryNamespaceB0971B2F',
              'Id',
            ],
          },
          RoutingPolicy: 'MULTIVALUE',
        },
        HealthCheckCustomConfig: {
          FailureThreshold: 1,
        },
        Name: 'myApp',
        NamespaceId: {
          'Fn::GetAtt': [
            'EcsClusterDefaultServiceDiscoveryNamespaceB0971B2F',
            'Id',
          ],
        },
      }));

      test.done();
    },

    'errors when setting both taskDefinition and taskImageOptions'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const cluster = new Cluster(stack, 'Cluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new InstanceType('t2.micro') });

      const taskDefinition = new Ec2TaskDefinition(stack, 'Ec2TaskDef');
      taskDefinition.addContainer('test', {
        image: ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      // THEN
      test.throws(() => {
        new ApplicationMultipleTargetGroupsEc2Service(stack, 'Service', {
          cluster,
          taskImageOptions: {
            image: ContainerImage.fromRegistry('test'),
          },
          taskDefinition,
        });
      }, /You must specify only one of TaskDefinition or TaskImageOptions./);

      test.done();
    },

    'errors when setting neither taskDefinition nor taskImageOptions'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const cluster = new Cluster(stack, 'Cluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new InstanceType('t2.micro') });

      // THEN
      test.throws(() => {
        new ApplicationMultipleTargetGroupsEc2Service(stack, 'Service', {
          cluster,
        });
      }, /You must specify one of: taskDefinition or image/);

      test.done();
    },

    'errors when setting domainName but not domainZone'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const cluster = new Cluster(stack, 'Cluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new InstanceType('t2.micro') });

      // THEN
      test.throws(() => {
        new ApplicationMultipleTargetGroupsEc2Service(stack, 'Service', {
          cluster,
          taskImageOptions: {
            image: ContainerImage.fromRegistry('test'),
          },
          loadBalancers: [
            {
              name: 'lb1',
              domainName: 'api.example.com',
              listeners: [
                {
                  name: 'listener1',
                },
              ],
            },
          ],
        });
      }, /A Route53 hosted domain zone name is required to configure the specified domain name/);

      test.done();
    },

    'errors when loadBalancers is empty'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const cluster = new Cluster(stack, 'Cluster', { vpc });

      // THEN
      test.throws(() => {
        new ApplicationMultipleTargetGroupsEc2Service(stack, 'Service', {
          cluster,
          taskImageOptions: {
            image: ContainerImage.fromRegistry('test'),
          },
          loadBalancers: [],
        });
      }, /At least one load balancer must be specified/);

      test.done();
    },

    'errors when targetGroups is empty'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const cluster = new Cluster(stack, 'Cluster', { vpc });

      // THEN
      test.throws(() => {
        new ApplicationMultipleTargetGroupsEc2Service(stack, 'Service', {
          cluster,
          taskImageOptions: {
            image: ContainerImage.fromRegistry('test'),
          },
          targetGroups: [],
        });
      }, /At least one target group should be specified/);

      test.done();
    },

    'errors when no listener specified'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const cluster = new Cluster(stack, 'Cluster', { vpc });

      // THEN
      test.throws(() => {
        new ApplicationMultipleTargetGroupsEc2Service(stack, 'Service', {
          cluster,
          taskImageOptions: {
            image: ContainerImage.fromRegistry('test'),
          },
          loadBalancers: [
            {
              name: 'lb',
              listeners: [],
            },
          ],
        });
      }, /At least one listener must be specified/);

      test.done();
    },

    'errors when setting both HTTP protocol and certificate'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const cluster = new Cluster(stack, 'Cluster', { vpc });

      // THEN
      test.throws(() => {
        new ApplicationMultipleTargetGroupsEc2Service(stack, 'Service', {
          cluster,
          taskImageOptions: {
            image: ContainerImage.fromRegistry('test'),
          },
          loadBalancers: [
            {
              name: 'lb',
              listeners: [
                {
                  name: 'listener',
                  protocol: ApplicationProtocol.HTTP,
                  certificate: Certificate.fromCertificateArn(stack, 'Cert', 'helloworld'),
                },
              ],
            },
          ],
        });
      }, /The HTTPS protocol must be used when a certificate is given/);

      test.done();
    },

    'errors when setting HTTPS protocol but not domain name'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const cluster = new Cluster(stack, 'Cluster', { vpc });

      // THEN
      test.throws(() => {
        new ApplicationMultipleTargetGroupsEc2Service(stack, 'Service', {
          cluster,
          taskImageOptions: {
            image: ContainerImage.fromRegistry('test'),
          },
          loadBalancers: [
            {
              name: 'lb',
              listeners: [
                {
                  name: 'listener',
                  protocol: ApplicationProtocol.HTTPS,
                },
              ],
            },
          ],
        });
      }, /A domain name and zone is required when using the HTTPS protocol/);

      test.done();
    },

    'errors when listener is not defined but used in creating target groups'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const cluster = new Cluster(stack, 'Cluster', { vpc });

      // THEN
      test.throws(() => {
        new ApplicationMultipleTargetGroupsEc2Service(stack, 'Service', {
          cluster,
          taskImageOptions: {
            image: ContainerImage.fromRegistry('test'),
          },
          loadBalancers: [
            {
              name: 'lb',
              listeners: [
                {
                  name: 'listener1',
                },
              ],
            },
          ],
          targetGroups: [
            {
              containerPort: 80,
              listener: 'listener2',
            },
          ],
        });
      }, /Listener listener2 is not defined. Did you define listener with name listener2?/);

      test.done();
    },

    'errors if desiredTaskCount is 0'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const cluster = new Cluster(stack, 'Cluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new InstanceType('t2.micro') });

      // THEN
      test.throws(() =>
        new ApplicationMultipleTargetGroupsEc2Service(stack, 'Service', {
          cluster,
          memoryLimitMiB: 1024,
          taskImageOptions: {
            image: ContainerImage.fromRegistry('test'),
          },
          desiredCount: 0,
        })
      , /You must specify a desiredCount greater than 0/);

      test.done();
    },
  },

  'When Network Load Balancer': {
    'test ECS NLB construct with default settings'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const cluster = new Cluster(stack, 'Cluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new InstanceType('t2.micro') });

      // WHEN
      new NetworkMultipleTargetGroupsEc2Service(stack, 'Service', {
        cluster,
        memoryLimitMiB: 256,
        taskImageOptions: {
          image: ContainerImage.fromRegistry('test'),
        },
      });

      // THEN - stack contains a load balancer and a service
      expect(stack).to(haveResource('AWS::ElasticLoadBalancingV2::LoadBalancer'));

      expect(stack).to(haveResource('AWS::ECS::Service', {
        DesiredCount: 1,
        LaunchType: 'EC2',
      }));

      expect(stack).to(haveResourceLike('AWS::ECS::TaskDefinition', {
        ContainerDefinitions: [
          {
            Essential: true,
            Image: 'test',
            LogConfiguration: {
              LogDriver: 'awslogs',
              Options: {
                'awslogs-group': {
                  Ref: 'ServiceTaskDefwebLogGroup2A898F61',
                },
                'awslogs-stream-prefix': 'Service',
                'awslogs-region': {
                  Ref: 'AWS::Region',
                },
              },
            },
            Memory: 256,
            Name: 'web',
            PortMappings: [
              {
                ContainerPort: 80,
                HostPort: 0,
                Protocol: 'tcp',
              },
            ],
          },
        ],
        ExecutionRoleArn: {
          'Fn::GetAtt': [
            'ServiceTaskDefExecutionRole919F7BE3',
            'Arn',
          ],
        },
        Family: 'ServiceTaskDef79D79521',
        NetworkMode: 'bridge',
        RequiresCompatibilities: [
          'EC2',
        ],
        TaskRoleArn: {
          'Fn::GetAtt': [
            'ServiceTaskDefTaskRole0CFE2F57',
            'Arn',
          ],
        },
      }));

      test.done();
    },

    'test ECS NLB construct with all settings'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const cluster = new Cluster(stack, 'Cluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new InstanceType('t2.micro') });
      const zone = new PublicHostedZone(stack, 'HostedZone', { zoneName: 'example.com' });

      // WHEN
      new NetworkMultipleTargetGroupsEc2Service(stack, 'Service', {
        cluster,
        memoryLimitMiB: 256,
        taskImageOptions: {
          image: ContainerImage.fromRegistry('test'),
          containerName: 'myContainer',
          containerPorts: [80, 90],
          enableLogging: false,
          environment: {
            TEST_ENVIRONMENT_VARIABLE1: 'test environment variable 1 value',
            TEST_ENVIRONMENT_VARIABLE2: 'test environment variable 2 value',
          },
          logDriver: new AwsLogDriver({
            streamPrefix: 'TestStream',
          }),
          family: 'Ec2TaskDef',
          executionRole: new Role(stack, 'ExecutionRole', {
            path: '/',
            assumedBy: new CompositePrincipal(
              new ServicePrincipal('ecs.amazonaws.com'),
              new ServicePrincipal('ecs-tasks.amazonaws.com'),
            ),
          }),
          taskRole: new Role(stack, 'TaskRole', {
            assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
          }),
          dockerLabels: { label1: 'labelValue1', label2: 'labelValue2' },
        },
        cpu: 256,
        desiredCount: 3,
        enableECSManagedTags: true,
        healthCheckGracePeriod: Duration.millis(2000),
        loadBalancers: [
          {
            name: 'lb1',
            domainName: 'api.example.com',
            domainZone: zone,
            publicLoadBalancer: false,
            listeners: [
              {
                name: 'listener1',
              },
            ],
          },
          {
            name: 'lb2',
            listeners: [
              {
                name: 'listener2',
                port: 81,
              },
            ],
          },
        ],
        propagateTags: PropagatedTagSource.SERVICE,
        memoryReservationMiB: 256,
        serviceName: 'myService',
        targetGroups: [
          {
            containerPort: 80,
            listener: 'listener1',
          },
          {
            containerPort: 90,
            listener: 'listener2',
          },
        ],
      });

      // THEN
      expect(stack).to(haveResource('AWS::ECS::Service', {
        DesiredCount: 3,
        EnableECSManagedTags: true,
        HealthCheckGracePeriodSeconds: 2,
        LaunchType: 'EC2',
        LoadBalancers: [
          {
            ContainerName: 'myContainer',
            ContainerPort: 80,
            TargetGroupArn: {
              Ref: 'Servicelb1listener1ECSTargetGroupmyContainer80Group43098F8B',
            },
          },
          {
            ContainerName: 'myContainer',
            ContainerPort: 90,
            TargetGroupArn: {
              Ref: 'Servicelb2listener2ECSTargetGroupmyContainer90GroupDEB417E4',
            },
          },
        ],
        PropagateTags: 'SERVICE',
        SchedulingStrategy: 'REPLICA',
        ServiceName: 'myService',
      }));

      expect(stack).to(haveResourceLike('AWS::ECS::TaskDefinition', {
        ContainerDefinitions: [
          {
            Cpu: 256,
            Environment: [
              {
                Name: 'TEST_ENVIRONMENT_VARIABLE1',
                Value: 'test environment variable 1 value',
              },
              {
                Name: 'TEST_ENVIRONMENT_VARIABLE2',
                Value: 'test environment variable 2 value',
              },
            ],
            Essential: true,
            Image: 'test',
            LogConfiguration: {
              LogDriver: 'awslogs',
              Options: {
                'awslogs-group': {
                  Ref: 'ServiceTaskDefmyContainerLogGroup0A87368B',
                },
                'awslogs-stream-prefix': 'TestStream',
                'awslogs-region': {
                  Ref: 'AWS::Region',
                },
              },
            },
            Memory: 256,
            MemoryReservation: 256,
            Name: 'myContainer',
            PortMappings: [
              {
                ContainerPort: 80,
                HostPort: 0,
                Protocol: 'tcp',
              },
              {
                ContainerPort: 90,
                HostPort: 0,
                Protocol: 'tcp',
              },
            ],
            DockerLabels: {
              label1: 'labelValue1',
              label2: 'labelValue2',
            },
          },
        ],
        ExecutionRoleArn: {
          'Fn::GetAtt': [
            'ExecutionRole605A040B',
            'Arn',
          ],
        },
        Family: 'ServiceTaskDef79D79521',
        NetworkMode: 'bridge',
        RequiresCompatibilities: [
          'EC2',
        ],
        TaskRoleArn: {
          'Fn::GetAtt': [
            'TaskRole30FC0FBB',
            'Arn',
          ],
        },
      }));

      test.done();
    },

    'set vpc instead of cluster'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');

      // WHEN
      new NetworkMultipleTargetGroupsEc2Service(stack, 'Service', {
        vpc,
        memoryLimitMiB: 256,
        taskImageOptions: {
          image: ContainerImage.fromRegistry('test'),
        },
      });

      // THEN - stack does not contain a LaunchConfiguration
      expect(stack, true).notTo(haveResource('AWS::AutoScaling::LaunchConfiguration'));

      test.throws(() => expect(stack));

      test.done();
    },

    'able to pass pre-defined task definition'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const cluster = new Cluster(stack, 'Cluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new InstanceType('t2.micro') });

      const taskDefinition = new Ec2TaskDefinition(stack, 'Ec2TaskDef');
      const container = taskDefinition.addContainer('web', {
        image: ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });
      container.addPortMappings({
        containerPort: 80,
      });

      // WHEN
      new NetworkMultipleTargetGroupsEc2Service(stack, 'Service', {
        cluster,
        taskDefinition,
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::ECS::TaskDefinition', {
        ContainerDefinitions: [
          {
            Essential: true,
            Image: 'amazon/amazon-ecs-sample',
            Memory: 512,
            Name: 'web',
            PortMappings: [
              {
                ContainerPort: 80,
                HostPort: 0,
                Protocol: 'tcp',
              },
            ],
          },
        ],
        Family: 'Ec2TaskDef',
        NetworkMode: 'bridge',
        RequiresCompatibilities: [
          'EC2',
        ],
      }));

      test.done();
    },

    'errors if no essential container in pre-defined task definition'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const cluster = new Cluster(stack, 'Cluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new InstanceType('t2.micro') });

      const taskDefinition = new Ec2TaskDefinition(stack, 'Ec2TaskDef');

      // THEN
      test.throws(() => {
        new NetworkMultipleTargetGroupsEc2Service(stack, 'Service', {
          cluster,
          taskDefinition,
        });
      }, /At least one essential container must be specified/);

      test.done();
    },

    'set default load balancer, listener, target group correctly'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const zone = new PublicHostedZone(stack, 'HostedZone', { zoneName: 'example.com' });

      // WHEN
      const ecsService = new NetworkMultipleTargetGroupsEc2Service(stack, 'Service', {
        vpc,
        memoryLimitMiB: 1024,
        taskImageOptions: {
          image: ContainerImage.fromRegistry('test'),
        },
        loadBalancers: [
          {
            name: 'lb1',
            listeners: [
              {
                name: 'listener1',
              },
            ],
          },
          {
            name: 'lb2',
            domainName: 'api.example.com',
            domainZone: zone,
            listeners: [
              {
                name: 'listener2',
              },
              {
                name: 'listener3',
              },
            ],
          },
        ],
        targetGroups: [
          {
            containerPort: 80,
          },
          {
            containerPort: 90,
          },
        ],
      });

      // THEN
      test.equal(ecsService.loadBalancer.node.id, 'lb1');
      test.equal(ecsService.listener.node.id, 'listener1');
      test.equal(ecsService.targetGroup.node.id, 'ECSTargetGroupweb80Group');

      test.done();
    },

    'setting vpc and cluster throws error'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const cluster = new Cluster(stack, 'Cluster', { vpc });

      // WHEN
      test.throws(() => new NetworkMultipleTargetGroupsEc2Service(stack, 'Service', {
        cluster,
        vpc,
        taskImageOptions: {
          image: ContainerImage.fromRegistry('/aws/aws-example-app'),
        },
      }), /You can only specify either vpc or cluster. Alternatively, you can leave both blank/);

      test.done();
    },

    'creates AWS Cloud Map service for Private DNS namespace'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'MyVpc', {});
      const cluster = new Cluster(stack, 'EcsCluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new InstanceType('t2.micro') });

      // WHEN
      cluster.addDefaultCloudMapNamespace({
        name: 'foo.com',
        type: NamespaceType.DNS_PRIVATE,
      });

      new NetworkMultipleTargetGroupsEc2Service(stack, 'Service', {
        cluster,
        taskImageOptions: {
          image: ContainerImage.fromRegistry('hello'),
        },
        cloudMapOptions: {
          name: 'myApp',
        },
        memoryLimitMiB: 512,
      });

      // THEN
      expect(stack).to(haveResource('AWS::ECS::Service', {
        ServiceRegistries: [
          {
            ContainerName: 'web',
            ContainerPort: 80,
            RegistryArn: {
              'Fn::GetAtt': [
                'ServiceCloudmapServiceDE76B29D',
                'Arn',
              ],
            },
          },
        ],
      }));

      expect(stack).to(haveResource('AWS::ServiceDiscovery::Service', {
        DnsConfig: {
          DnsRecords: [
            {
              TTL: 60,
              Type: 'SRV',
            },
          ],
          NamespaceId: {
            'Fn::GetAtt': [
              'EcsClusterDefaultServiceDiscoveryNamespaceB0971B2F',
              'Id',
            ],
          },
          RoutingPolicy: 'MULTIVALUE',
        },
        HealthCheckCustomConfig: {
          FailureThreshold: 1,
        },
        Name: 'myApp',
        NamespaceId: {
          'Fn::GetAtt': [
            'EcsClusterDefaultServiceDiscoveryNamespaceB0971B2F',
            'Id',
          ],
        },
      }));

      test.done();
    },

    'errors when setting both taskDefinition and taskImageOptions'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const cluster = new Cluster(stack, 'Cluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new InstanceType('t2.micro') });

      const taskDefinition = new Ec2TaskDefinition(stack, 'Ec2TaskDef');
      taskDefinition.addContainer('test', {
        image: ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        memoryLimitMiB: 512,
      });

      // THEN
      test.throws(() => {
        new NetworkMultipleTargetGroupsEc2Service(stack, 'Service', {
          cluster,
          taskImageOptions: {
            image: ContainerImage.fromRegistry('test'),
          },
          taskDefinition,
        });
      }, /You must specify only one of TaskDefinition or TaskImageOptions./);

      test.done();
    },

    'errors when setting neither taskDefinition nor taskImageOptions'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const cluster = new Cluster(stack, 'Cluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new InstanceType('t2.micro') });

      // THEN
      test.throws(() => {
        new NetworkMultipleTargetGroupsEc2Service(stack, 'Service', {
          cluster,
        });
      }, /You must specify one of: taskDefinition or image/);

      test.done();
    },

    'errors when setting domainName but not domainZone'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const cluster = new Cluster(stack, 'Cluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new InstanceType('t2.micro') });

      // THEN
      test.throws(() => {
        new NetworkMultipleTargetGroupsEc2Service(stack, 'Service', {
          cluster,
          taskImageOptions: {
            image: ContainerImage.fromRegistry('test'),
          },
          loadBalancers: [
            {
              name: 'lb1',
              domainName: 'api.example.com',
              listeners: [{
                name: 'listener1',
              }],
            },
          ],
        });
      }, /A Route53 hosted domain zone name is required to configure the specified domain name/);

      test.done();
    },

    'errors when loadBalancers is empty'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const cluster = new Cluster(stack, 'Cluster', { vpc });

      // THEN
      test.throws(() => {
        new NetworkMultipleTargetGroupsEc2Service(stack, 'Service', {
          cluster,
          taskImageOptions: {
            image: ContainerImage.fromRegistry('test'),
          },
          loadBalancers: [],
        });
      }, /At least one load balancer must be specified/);

      test.done();
    },

    'errors when targetGroups is empty'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const cluster = new Cluster(stack, 'Cluster', { vpc });

      // THEN
      test.throws(() => {
        new NetworkMultipleTargetGroupsEc2Service(stack, 'Service', {
          cluster,
          taskImageOptions: {
            image: ContainerImage.fromRegistry('test'),
          },
          targetGroups: [],
        });
      }, /At least one target group should be specified/);

      test.done();
    },

    'errors when no listener specified'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const cluster = new Cluster(stack, 'Cluster', { vpc });

      // THEN
      test.throws(() => {
        new NetworkMultipleTargetGroupsEc2Service(stack, 'Service', {
          cluster,
          taskImageOptions: {
            image: ContainerImage.fromRegistry('test'),
          },
          loadBalancers: [
            {
              name: 'lb',
              listeners: [],
            },
          ],
        });
      }, /At least one listener must be specified/);

      test.done();
    },

    'errors when listener is not defined but used in creating target groups'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const cluster = new Cluster(stack, 'Cluster', { vpc });

      // THEN
      test.throws(() => {
        new NetworkMultipleTargetGroupsEc2Service(stack, 'Service', {
          cluster,
          taskImageOptions: {
            image: ContainerImage.fromRegistry('test'),
          },
          loadBalancers: [
            {
              name: 'lb',
              listeners: [
                {
                  name: 'listener1',
                },
              ],
            },
          ],
          targetGroups: [
            {
              containerPort: 80,
              listener: 'listener2',
            },
          ],
        });
      }, /Listener listener2 is not defined. Did you define listener with name listener2?/);

      test.done();
    },

    'errors if desiredTaskCount is 0'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');
      const cluster = new Cluster(stack, 'Cluster', { vpc });
      cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new InstanceType('t2.micro') });

      // THEN
      test.throws(() =>
        new NetworkMultipleTargetGroupsEc2Service(stack, 'Service', {
          cluster,
          memoryLimitMiB: 1024,
          taskImageOptions: {
            image: ContainerImage.fromRegistry('test'),
          },
          desiredCount: 0,
        })
      , /You must specify a desiredCount greater than 0/);

      test.done();
    },
  },
};
