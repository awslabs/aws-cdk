import { ABSENT, arrayWith, expect, haveResource, haveResourceLike, objectLike } from '@aws-cdk/assert';
import { Certificate } from '@aws-cdk/aws-certificatemanager';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import { ApplicationLoadBalancer, ApplicationProtocol, NetworkLoadBalancer } from '@aws-cdk/aws-elasticloadbalancingv2';
import { PublicHostedZone } from '@aws-cdk/aws-route53';
import * as cloudmap from '@aws-cdk/aws-servicediscovery';
import * as cdk from '@aws-cdk/core';
import * as cxapi from '@aws-cdk/cx-api';
import { Test } from 'nodeunit';
import * as ecsPatterns from '../../lib';

export = {
  'test ECS loadbalanced construct'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });

    // WHEN
    new ecsPatterns.ApplicationLoadBalancedEc2Service(stack, 'Service', {
      cluster,
      memoryLimitMiB: 1024,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('test'),
        environment: {
          TEST_ENVIRONMENT_VARIABLE1: 'test environment variable 1 value',
          TEST_ENVIRONMENT_VARIABLE2: 'test environment variable 2 value',
        },
      },
      desiredCount: 2,
    });

    // THEN - stack contains a load balancer and a service
    expect(stack).to(haveResource('AWS::ElasticLoadBalancingV2::LoadBalancer'));

    expect(stack).to(haveResource('AWS::ECS::Service', {
      DesiredCount: 2,
      LaunchType: 'EC2',
    }));

    expect(stack).to(haveResourceLike('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        {
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
          Memory: 1024,
        },
      ],
    }));

    test.done();
  },

  'ApplicationLoadBalancedEc2Service desiredCount can be undefined when feature flag is set'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    stack.node.setContext(cxapi.ECS_REMOVE_DEFAULT_DESIRED_COUNT, true);

    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });

    // WHEN
    new ecsPatterns.ApplicationLoadBalancedEc2Service(stack, 'Service', {
      cluster,
      memoryLimitMiB: 1024,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('test'),
      },
    });

    expect(stack).to(haveResource('AWS::ECS::Service', {
      DesiredCount: ABSENT,
    }));

    test.done();
  },

  'ApplicationLoadBalancedFargateService desiredCount can be undefined when feature flag is set'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    stack.node.setContext(cxapi.ECS_REMOVE_DEFAULT_DESIRED_COUNT, true);

    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });

    // WHEN
    new ecsPatterns.ApplicationLoadBalancedFargateService(stack, 'Service', {
      cluster,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('test'),
      },
    });

    expect(stack).to(haveResource('AWS::ECS::Service', {
      DesiredCount: ABSENT,
    }));

    test.done();
  },

  'NetworkLoadBalancedEc2Service desiredCount can be undefined when feature flag is set'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    stack.node.setContext(cxapi.ECS_REMOVE_DEFAULT_DESIRED_COUNT, true);

    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });

    // WHEN
    new ecsPatterns.NetworkLoadBalancedEc2Service(stack, 'Service', {
      cluster,
      memoryLimitMiB: 1024,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('test'),
      },
    });

    expect(stack).to(haveResource('AWS::ECS::Service', {
      DesiredCount: ABSENT,
    }));

    test.done();
  },

  'NetworkLoadBalancedFargateService desiredCount can be undefined when feature flag is set'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    stack.node.setContext(cxapi.ECS_REMOVE_DEFAULT_DESIRED_COUNT, true);

    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });

    // WHEN
    new ecsPatterns.NetworkLoadBalancedFargateService(stack, 'Service', {
      cluster,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('test'),
      },
    });

    expect(stack).to(haveResource('AWS::ECS::Service', {
      DesiredCount: ABSENT,
    }));

    test.done();
  },

  'set vpc instead of cluster'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new ecsPatterns.ApplicationLoadBalancedEc2Service(stack, 'Service', {
      vpc,
      memoryLimitMiB: 1024,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('test'),
        environment: {
          TEST_ENVIRONMENT_VARIABLE1: 'test environment variable 1 value',
          TEST_ENVIRONMENT_VARIABLE2: 'test environment variable 2 value',
        },
      },
      desiredCount: 2,
    });

    // THEN - stack does not contain a LaunchConfiguration
    expect(stack, true).notTo(haveResource('AWS::AutoScaling::LaunchConfiguration'));

    test.throws(() => expect(stack));

    test.done();
  },

  'setting vpc and cluster throws error'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });

    // WHEN
    test.throws(() => new ecsPatterns.NetworkLoadBalancedEc2Service(stack, 'Service', {
      cluster,
      vpc,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('/aws/aws-example-app'),
      },
    }));

    test.done();
  },

  'test ECS loadbalanced construct with memoryReservationMiB'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });

    // WHEN
    new ecsPatterns.ApplicationLoadBalancedEc2Service(stack, 'Service', {
      cluster,
      memoryReservationMiB: 1024,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('test'),
      },
    });

    // THEN - stack contains a load balancer and a service
    expect(stack).to(haveResource('AWS::ElasticLoadBalancingV2::LoadBalancer'));

    expect(stack).to(haveResourceLike('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        {
          MemoryReservation: 1024,
        },
      ],
    }));

    test.done();
  },

  'creates AWS Cloud Map service for Private DNS namespace with application load balanced ec2 service'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'MyVpc', {});
    const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });

    // WHEN
    cluster.addDefaultCloudMapNamespace({
      name: 'foo.com',
      type: cloudmap.NamespaceType.DNS_PRIVATE,
    });

    new ecsPatterns.ApplicationLoadBalancedEc2Service(stack, 'Service', {
      cluster,
      taskImageOptions: {
        containerPort: 8000,
        image: ecs.ContainerImage.fromRegistry('hello'),
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
          ContainerPort: 8000,
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

  'creates AWS Cloud Map service for Private DNS namespace with network load balanced fargate service'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'MyVpc', {});
    const cluster = new ecs.Cluster(stack, 'EcsCluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });

    // WHEN
    cluster.addDefaultCloudMapNamespace({
      name: 'foo.com',
      type: cloudmap.NamespaceType.DNS_PRIVATE,
    });

    new ecsPatterns.NetworkLoadBalancedFargateService(stack, 'Service', {
      cluster,
      taskImageOptions: {
        containerPort: 8000,
        image: ecs.ContainerImage.fromRegistry('hello'),
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
            Type: 'A',
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

  'test Fargate loadbalanced construct'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });

    // WHEN
    new ecsPatterns.ApplicationLoadBalancedFargateService(stack, 'Service', {
      cluster,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('test'),
        environment: {
          TEST_ENVIRONMENT_VARIABLE1: 'test environment variable 1 value',
          TEST_ENVIRONMENT_VARIABLE2: 'test environment variable 2 value',
        },
      },
      desiredCount: 2,
    });

    // THEN - stack contains a load balancer and a service
    expect(stack).to(haveResource('AWS::ElasticLoadBalancingV2::LoadBalancer'));
    expect(stack).to(haveResourceLike('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        {
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
          LogConfiguration: {
            LogDriver: 'awslogs',
            Options: {
              'awslogs-group': { Ref: 'ServiceTaskDefwebLogGroup2A898F61' },
              'awslogs-stream-prefix': 'Service',
              'awslogs-region': { Ref: 'AWS::Region' },
            },
          },
        },
      ],
    }));

    expect(stack).to(haveResource('AWS::ECS::Service', {
      DesiredCount: 2,
      LaunchType: 'FARGATE',
    }));

    expect(stack).to(haveResource('AWS::ElasticLoadBalancingV2::Listener', {
      Port: 80,
      Protocol: 'HTTP',
    }));

    test.done();
  },

  'test Fargate loadbalanced construct opting out of log driver creation'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });

    // WHEN
    new ecsPatterns.ApplicationLoadBalancedFargateService(stack, 'Service', {
      cluster,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('test'),
        enableLogging: false,
        environment: {
          TEST_ENVIRONMENT_VARIABLE1: 'test environment variable 1 value',
          TEST_ENVIRONMENT_VARIABLE2: 'test environment variable 2 value',
        },
      },
      desiredCount: 2,
    });

    // THEN - stack contains a load balancer and a service
    expect(stack).notTo(haveResource('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        {
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
          LogConfiguration: {
            LogDriver: 'awslogs',
            Options: {
              'awslogs-group': { Ref: 'ServiceTaskDefwebLogGroup2A898F61' },
              'awslogs-stream-prefix': 'Service',
              'awslogs-region': { Ref: 'AWS::Region' },
            },
          },
        },
      ],
    }));

    test.done();
  },

  'test Fargate loadbalanced construct with TLS'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
    const zone = new PublicHostedZone(stack, 'HostedZone', { zoneName: 'example.com' });

    // WHEN
    new ecsPatterns.ApplicationLoadBalancedFargateService(stack, 'Service', {
      cluster,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('test'),
      },
      domainName: 'api.example.com',
      domainZone: zone,
      certificate: Certificate.fromCertificateArn(stack, 'Cert', 'helloworld'),
    });

    // THEN - stack contains a load balancer and a service
    expect(stack).to(haveResource('AWS::ElasticLoadBalancingV2::LoadBalancer'));

    expect(stack).to(haveResource('AWS::ElasticLoadBalancingV2::Listener', {
      Port: 443,
      Protocol: 'HTTPS',
      Certificates: [{
        CertificateArn: 'helloworld',
      }],
    }));

    expect(stack).to(haveResource('AWS::ElasticLoadBalancingV2::TargetGroup', {
      Port: 80,
      Protocol: 'HTTP',
      TargetType: 'ip',
      VpcId: {
        Ref: 'VPCB9E5F0B4',
      },
    }));

    expect(stack).to(haveResource('AWS::ECS::Service', {
      DesiredCount: 1,
      LaunchType: 'FARGATE',
    }));

    expect(stack).to(haveResource('AWS::Route53::RecordSet', {
      Name: 'api.example.com.',
      HostedZoneId: {
        Ref: 'HostedZoneDB99F866',
      },
      Type: 'A',
      AliasTarget: {
        HostedZoneId: { 'Fn::GetAtt': ['ServiceLBE9A1ADBC', 'CanonicalHostedZoneID'] },
        DNSName: { 'Fn::Join': ['', ['dualstack.', { 'Fn::GetAtt': ['ServiceLBE9A1ADBC', 'DNSName'] }]] },
      },
    }));

    test.done();
  },

  'test Fargateloadbalanced construct with TLS and default certificate'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
    const zone = new PublicHostedZone(stack, 'HostedZone', { zoneName: 'example.com' });

    // WHEN
    new ecsPatterns.ApplicationLoadBalancedFargateService(stack, 'Service', {
      cluster,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('test'),
      },
      domainName: 'api.example.com',
      domainZone: zone,
      protocol: ApplicationProtocol.HTTPS,
    });

    // THEN - stack contains a load balancer, a service, and a certificate
    expect(stack).to(haveResource('AWS::CertificateManager::Certificate', {
      DomainName: 'api.example.com',
      DomainValidationOptions: [
        {
          DomainName: 'api.example.com',
          HostedZoneId: {
            Ref: 'HostedZoneDB99F866',
          },
        },
      ],
      ValidationMethod: 'DNS',
    }));

    expect(stack).to(haveResource('AWS::ElasticLoadBalancingV2::LoadBalancer'));

    expect(stack).to(haveResource('AWS::ElasticLoadBalancingV2::Listener', {
      Port: 443,
      Protocol: 'HTTPS',
      Certificates: [{
        CertificateArn: {
          Ref: 'ServiceCertificateA7C65FE6',
        },
      }],
    }));

    expect(stack).to(haveResource('AWS::ECS::Service', {
      DesiredCount: 1,
      LaunchType: 'FARGATE',
    }));

    expect(stack).to(haveResource('AWS::Route53::RecordSet', {
      Name: 'api.example.com.',
      HostedZoneId: {
        Ref: 'HostedZoneDB99F866',
      },
      Type: 'A',
      AliasTarget: {
        HostedZoneId: { 'Fn::GetAtt': ['ServiceLBE9A1ADBC', 'CanonicalHostedZoneID'] },
        DNSName: { 'Fn::Join': ['', ['dualstack.', { 'Fn::GetAtt': ['ServiceLBE9A1ADBC', 'DNSName'] }]] },
      },
    }));

    test.done();
  },

  'errors when setting domainName but not domainZone'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });

    // THEN
    test.throws(() => {
      new ecsPatterns.ApplicationLoadBalancedFargateService(stack, 'Service', {
        cluster,
        taskImageOptions: {
          image: ecs.ContainerImage.fromRegistry('test'),
        },
        domainName: 'api.example.com',
      });
    });

    test.done();
  },

  'errors when setting both HTTP protocol and certificate'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });

    // THEN
    test.throws(() => {
      new ecsPatterns.ApplicationLoadBalancedFargateService(stack, 'Service', {
        cluster,
        taskImageOptions: {
          image: ecs.ContainerImage.fromRegistry('test'),
        },
        protocol: ApplicationProtocol.HTTP,
        certificate: Certificate.fromCertificateArn(stack, 'Cert', 'helloworld'),
      });
    });

    test.done();
  },

  'errors when setting both HTTP protocol and redirectHTTP'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });

    // THEN
    test.throws(() => {
      new ecsPatterns.ApplicationLoadBalancedFargateService(stack, 'Service', {
        cluster,
        taskImageOptions: {
          image: ecs.ContainerImage.fromRegistry('test'),
        },
        protocol: ApplicationProtocol.HTTP,
        redirectHTTP: true,
      });
    });

    test.done();
  },

  'does not throw errors when not setting HTTPS protocol but certificate for redirectHTTP'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
    const zone = new PublicHostedZone(stack, 'HostedZone', { zoneName: 'example.com' });

    // THEN
    new ecsPatterns.ApplicationLoadBalancedFargateService(stack, 'Service', {
      cluster,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('test'),
      },
      domainName: 'api.example.com',
      domainZone: zone,
      redirectHTTP: true,
      certificate: Certificate.fromCertificateArn(stack, 'Cert', 'helloworld'),
    });

    test.done();
  },

  'errors when setting HTTPS protocol but not domain name'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });

    // THEN
    test.throws(() => {
      new ecsPatterns.ApplicationLoadBalancedFargateService(stack, 'Service', {
        cluster,
        taskImageOptions: {
          image: ecs.ContainerImage.fromRegistry('test'),
        },
        protocol: ApplicationProtocol.HTTPS,
      });
    });

    test.done();
  },

  'test Fargate loadbalanced construct with optional log driver input'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });

    // WHEN
    new ecsPatterns.ApplicationLoadBalancedFargateService(stack, 'Service', {
      cluster,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('test'),
        enableLogging: false,
        environment: {
          TEST_ENVIRONMENT_VARIABLE1: 'test environment variable 1 value',
          TEST_ENVIRONMENT_VARIABLE2: 'test environment variable 2 value',
        },
        logDriver: new ecs.AwsLogDriver({
          streamPrefix: 'TestStream',
        }),
      },
      desiredCount: 2,
    });

    // THEN - stack contains a load balancer and a service
    expect(stack).to(haveResourceLike('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        {
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
          LogConfiguration: {
            LogDriver: 'awslogs',
            Options: {
              'awslogs-group': { Ref: 'ServiceTaskDefwebLogGroup2A898F61' },
              'awslogs-stream-prefix': 'TestStream',
              'awslogs-region': { Ref: 'AWS::Region' },
            },
          },
        },
      ],
    }));

    test.done();
  },

  'test Fargate loadbalanced construct with logging enabled'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });

    // WHEN
    new ecsPatterns.ApplicationLoadBalancedFargateService(stack, 'Service', {
      cluster,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('test'),
        enableLogging: true,
        environment: {
          TEST_ENVIRONMENT_VARIABLE1: 'test environment variable 1 value',
          TEST_ENVIRONMENT_VARIABLE2: 'test environment variable 2 value',
        },
      },
      desiredCount: 2,
    });

    // THEN - stack contains a load balancer and a service
    expect(stack).to(haveResourceLike('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        {
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
          LogConfiguration: {
            LogDriver: 'awslogs',
            Options: {
              'awslogs-group': { Ref: 'ServiceTaskDefwebLogGroup2A898F61' },
              'awslogs-stream-prefix': 'Service',
              'awslogs-region': { Ref: 'AWS::Region' },
            },
          },
        },
      ],
    }));

    test.done();
  },

  'test Fargate loadbalanced construct with both image and taskDefinition provided'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });

    const taskDefinition = new ecs.Ec2TaskDefinition(stack, 'Ec2TaskDef');
    taskDefinition.addContainer('web', {
      image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
      memoryLimitMiB: 512,
    });

    // WHEN
    test.throws(() => new ecsPatterns.ApplicationLoadBalancedFargateService(stack, 'Service', {
      cluster,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('test'),
        enableLogging: true,
        environment: {
          TEST_ENVIRONMENT_VARIABLE1: 'test environment variable 1 value',
          TEST_ENVIRONMENT_VARIABLE2: 'test environment variable 2 value',
        },
      },
      desiredCount: 2,
      taskDefinition,
    }));

    test.done();
  },

  'test Fargate application loadbalanced construct with taskDefinition provided'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });

    const taskDefinition = new ecs.FargateTaskDefinition(stack, 'FargateTaskDef');
    const container = taskDefinition.addContainer('passedTaskDef', {
      image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
      memoryLimitMiB: 512,
    });
    container.addPortMappings({
      containerPort: 80,
    });

    // WHEN
    new ecsPatterns.ApplicationLoadBalancedFargateService(stack, 'Service', {
      cluster,
      taskDefinition,
      desiredCount: 2,
      memoryLimitMiB: 1024,
    });

    expect(stack).to(haveResourceLike('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        {
          Image: 'amazon/amazon-ecs-sample',
          Memory: 512,
          Name: 'passedTaskDef',
          PortMappings: [
            {
              ContainerPort: 80,
              Protocol: 'tcp',
            },
          ],
        },
      ],
    }));

    test.done();
  },

  'ALB - throws if desiredTaskCount is 0'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });

    // THEN
    test.throws(() =>
      new ecsPatterns.ApplicationLoadBalancedEc2Service(stack, 'Service', {
        cluster,
        memoryLimitMiB: 1024,
        taskImageOptions: {
          image: ecs.ContainerImage.fromRegistry('test'),
        },
        desiredCount: 0,
      })
    , /You must specify a desiredCount greater than 0/);

    test.done();
  },

  'NLB - throws if desiredTaskCount is 0'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });

    // THEN
    test.throws(() =>
      new ecsPatterns.NetworkLoadBalancedEc2Service(stack, 'Service', {
        cluster,
        memoryLimitMiB: 1024,
        taskImageOptions: {
          image: ecs.ContainerImage.fromRegistry('test'),
        },
        desiredCount: 0,
      })
    , /You must specify a desiredCount greater than 0/);

    test.done();
  },
  'ALBFargate - having *HealthyPercent properties'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });

    // WHEN
    new ecsPatterns.ApplicationLoadBalancedFargateService(stack, 'ALB123Service', {
      cluster,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
      },
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::ECS::Service', {
      DeploymentConfiguration: {
        MinimumHealthyPercent: 100,
        MaximumPercent: 200,
      },
    }));

    test.done();
  },

  'NLBFargate - having *HealthyPercent properties'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });

    // WHEN
    new ecsPatterns.NetworkLoadBalancedFargateService(stack, 'Service', {
      cluster,
      memoryLimitMiB: 1024,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
      },
      desiredCount: 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::ECS::Service', {
      DeploymentConfiguration: {
        MinimumHealthyPercent: 100,
        MaximumPercent: 200,
      },
    }));

    test.done();
  },

  'ALB - having *HealthyPercent properties'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });

    // WHEN
    new ecsPatterns.ApplicationLoadBalancedEc2Service(stack, 'Service', {
      cluster,
      memoryLimitMiB: 1024,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
      },
      desiredCount: 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::ECS::Service', {
      DeploymentConfiguration: {
        MinimumHealthyPercent: 100,
        MaximumPercent: 200,
      },
    }));

    test.done();
  },

  'NLB - having *HealthyPercent properties'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });

    // WHEN
    new ecsPatterns.NetworkLoadBalancedEc2Service(stack, 'Service', {
      cluster,
      memoryLimitMiB: 1024,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
      },
      desiredCount: 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::ECS::Service', {
      DeploymentConfiguration: {
        MinimumHealthyPercent: 100,
        MaximumPercent: 200,
      },
    }));

    test.done();
  },

  'ALB - having deployment controller'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });

    // WHEN
    new ecsPatterns.ApplicationLoadBalancedEc2Service(stack, 'Service', {
      cluster,
      memoryLimitMiB: 1024,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
      },
      deploymentController: {
        type: ecs.DeploymentControllerType.CODE_DEPLOY,
      },
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::ECS::Service', {
      DeploymentController: {
        Type: 'CODE_DEPLOY',
      },
    }));

    test.done();
  },

  'NLB - having  deployment controller'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });

    // WHEN
    new ecsPatterns.NetworkLoadBalancedEc2Service(stack, 'Service', {
      cluster,
      memoryLimitMiB: 1024,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
      },
      deploymentController: {
        type: ecs.DeploymentControllerType.CODE_DEPLOY,
      },
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::ECS::Service', {
      DeploymentController: {
        Type: 'CODE_DEPLOY',
      },
    }));

    test.done();
  },

  'ALB with circuit breaker'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });

    // WHEN
    new ecsPatterns.ApplicationLoadBalancedEc2Service(stack, 'Service', {
      cluster,
      memoryLimitMiB: 1024,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
      },
      circuitBreaker: { rollback: true },
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::ECS::Service', {
      DeploymentConfiguration: {
        DeploymentCircuitBreaker: {
          Enable: true,
          Rollback: true,
        },
      },
      DeploymentController: {
        Type: 'ECS',
      },
    }));

    test.done();
  },

  'NLB with circuit breaker'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });

    // WHEN
    new ecsPatterns.NetworkLoadBalancedEc2Service(stack, 'Service', {
      cluster,
      memoryLimitMiB: 1024,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
      },
      circuitBreaker: { rollback: true },
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::ECS::Service', {
      DeploymentConfiguration: {
        DeploymentCircuitBreaker: {
          Enable: true,
          Rollback: true,
        },
      },
      DeploymentController: {
        Type: 'ECS',
      },
    }));

    test.done();
  },

  'NetworkLoadbalancedEC2Service accepts previously created load balancer'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Vpc');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc, clusterName: 'MyCluster' });
    cluster.addCapacity('Capacity', { instanceType: new ec2.InstanceType('t2.micro') });
    const nlb = new NetworkLoadBalancer(stack, 'NLB', { vpc });
    const taskDef = new ecs.Ec2TaskDefinition(stack, 'TaskDef');
    const container = taskDef.addContainer('Container', {
      image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
      memoryLimitMiB: 1024,
    });
    container.addPortMappings({ containerPort: 80 });

    // WHEN
    new ecsPatterns.NetworkLoadBalancedEc2Service(stack, 'Service', {
      cluster,
      loadBalancer: nlb,
      taskDefinition: taskDef,
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::ECS::Service', {
      LaunchType: 'EC2',
    }));
    expect(stack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      Type: 'network',
    }));
    test.done();
  },

  'NetworkLoadBalancedEC2Service accepts imported load balancer'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const nlbArn = 'arn:aws:elasticloadbalancing:us-west-2:123456789012:loadbalancer/app/my-load-balancer/50dc6c495c0c9188';
    const vpc = new ec2.Vpc(stack, 'Vpc');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc, clusterName: 'MyCluster' });
    cluster.addCapacity('Capacity', { instanceType: new ec2.InstanceType('t2.micro') });
    const nlb = NetworkLoadBalancer.fromNetworkLoadBalancerAttributes(stack, 'NLB', {
      loadBalancerArn: nlbArn,
      vpc,
    });
    const taskDef = new ecs.Ec2TaskDefinition(stack, 'TaskDef');
    const container = taskDef.addContainer('Container', {
      image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
      memoryLimitMiB: 1024,
    });
    container.addPortMappings({
      containerPort: 80,
    });

    // WHEN
    new ecsPatterns.NetworkLoadBalancedEc2Service(stack, 'Service', {
      cluster,
      loadBalancer: nlb,
      desiredCount: 1,
      taskDefinition: taskDef,
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::ECS::Service', {
      LaunchType: 'EC2',
      LoadBalancers: [{ ContainerName: 'Container', ContainerPort: 80 }],
    }));
    expect(stack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::TargetGroup'));
    expect(stack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::Listener', {
      LoadBalancerArn: nlb.loadBalancerArn,
      Port: 80,
    }));
    test.done();
  },

  'ApplicationLoadBalancedEC2Service accepts previously created load balancer'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Vpc');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc, clusterName: 'MyCluster' });
    cluster.addCapacity('Capacity', { instanceType: new ec2.InstanceType('t2.micro') });
    const sg = new ec2.SecurityGroup(stack, 'SG', { vpc });
    const alb = new ApplicationLoadBalancer(stack, 'NLB', {
      vpc,
      securityGroup: sg,
    });
    const taskDef = new ecs.Ec2TaskDefinition(stack, 'TaskDef');
    const container = taskDef.addContainer('Container', {
      image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
      memoryLimitMiB: 1024,
    });
    container.addPortMappings({ containerPort: 80 });

    // WHEN
    new ecsPatterns.ApplicationLoadBalancedEc2Service(stack, 'Service', {
      cluster,
      loadBalancer: alb,
      taskDefinition: taskDef,
    });

    // THEN
    expect(stack).to(haveResourceLike('AWS::ECS::Service', {
      LaunchType: 'EC2',
    }));
    expect(stack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      Type: 'application',
    }));
    test.done();
  },

  'ApplicationLoadBalancedEC2Service accepts imported load balancer'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const albArn = 'arn:aws:elasticloadbalancing:us-west-2:123456789012:loadbalancer/app/my-load-balancer/50dc6c495c0c9188';
    const vpc = new ec2.Vpc(stack, 'Vpc');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc, clusterName: 'MyCluster' });
    cluster.addCapacity('Capacity', { instanceType: new ec2.InstanceType('t2.micro') });
    const sg = new ec2.SecurityGroup(stack, 'SG', { vpc });
    const alb = ApplicationLoadBalancer.fromApplicationLoadBalancerAttributes(stack, 'ALB', {
      loadBalancerArn: albArn,
      vpc,
      securityGroupId: sg.securityGroupId,
      loadBalancerDnsName: 'MyName',
    });
    const taskDef = new ecs.Ec2TaskDefinition(stack, 'TaskDef');
    const container = taskDef.addContainer('Container', {
      image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
      memoryLimitMiB: 1024,
    });
    container.addPortMappings({
      containerPort: 80,
    });
    // WHEN
    new ecsPatterns.ApplicationLoadBalancedEc2Service(stack, 'Service', {
      cluster,
      loadBalancer: alb,
      taskDefinition: taskDef,
    });
    // THEN
    expect(stack).to(haveResourceLike('AWS::ECS::Service', {
      LaunchType: 'EC2',
      LoadBalancers: [{ ContainerName: 'Container', ContainerPort: 80 }],
    }));
    expect(stack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::TargetGroup'));
    expect(stack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::Listener', {
      LoadBalancerArn: alb.loadBalancerArn,
      Port: 80,
    }));

    test.done();
  },

  'test ECS loadbalanced construct default/open security group'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });

    // WHEN
    new ecsPatterns.ApplicationLoadBalancedEc2Service(stack, 'Service', {
      cluster,
      memoryReservationMiB: 1024,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('test'),
      },
    });

    // THEN - Stack contains no ingress security group rules
    expect(stack).to(haveResourceLike('AWS::EC2::SecurityGroup', {
      SecurityGroupIngress: [{
        CidrIp: '0.0.0.0/0',
        FromPort: 80,
        IpProtocol: 'tcp',
        ToPort: 80,
      }],
    }));

    test.done();
  },

  'test ECS loadbalanced construct closed security group'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', { instanceType: new ec2.InstanceType('t2.micro') });
    const zone = new PublicHostedZone(stack, 'HostedZone', { zoneName: 'example.com' });

    // WHEN
    new ecsPatterns.ApplicationLoadBalancedEc2Service(stack, 'Service', {
      cluster,
      memoryReservationMiB: 1024,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('test'),
      },
      domainName: 'api.example.com',
      domainZone: zone,
      certificate: Certificate.fromCertificateArn(stack, 'Cert', 'helloworld'),
      openListener: false,
      redirectHTTP: true,
    });

    // THEN - Stack contains no ingress security group rules
    expect(stack).notTo(haveResourceLike('AWS::EC2::SecurityGroup', {
      SecurityGroupIngress: arrayWith(objectLike({})),
    }));

    test.done();
  },
};
