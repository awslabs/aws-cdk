import '@aws-cdk/assert/jest';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as ga from '@aws-cdk/aws-globalaccelerator';
import { Stack } from '@aws-cdk/core';
import * as endpoints from '../lib';

let stack: Stack;
let vpc: ec2.Vpc;
let accelerator: ga.Accelerator;
let listener: ga.Listener;
beforeEach(() => {
  stack = new Stack();
  vpc = new ec2.Vpc(stack, 'Vpc');

  accelerator = new ga.Accelerator(stack, 'Accelerator');
  listener = accelerator.addListener('Listener', {
    portRanges: [{ fromPort: 80 }],
  });
});

test('Application Load Balancer with all properties', () => {
  // WHEN
  const alb = new elbv2.ApplicationLoadBalancer(stack, 'ALB', { vpc, internetFacing: true });
  listener.addEndpointGroup('Group', {
    endpoints: [
      new endpoints.ApplicationLoadBalancerEndpoint(alb, {
        weight: 50,
        preserveClientIp: true,
      }),
    ],
  });

  // THEN
  expect(stack).toHaveResourceLike('AWS::GlobalAccelerator::EndpointGroup', {
    EndpointConfigurations: [
      {
        EndpointId: { Ref: 'ALBAEE750D2' },
        Weight: 50,
        ClientIPPreservationEnabled: true,
      },
    ],
  });
});

// Doesn't work yet because 'fromApplicationLoadBalancerAttributes' doesn't set the imported resource env
test('Get region from imported ALB', () => {
  // WHEN
  const alb = elbv2.ApplicationLoadBalancer.fromApplicationLoadBalancerAttributes(stack, 'ALB', {
    loadBalancerArn: 'arn:aws:elasticloadbalancing:us-west-2:123456789012:loadbalancer/app/my-load-balancer/50dc6c495c0c9188',
    securityGroupId: 'sg-1234',
  });
  listener.addEndpointGroup('Group', {
    endpoints: [
      new endpoints.ApplicationLoadBalancerEndpoint(alb),
    ],
  });

  // THEN
  expect(stack).toHaveResourceLike('AWS::GlobalAccelerator::EndpointGroup', {
    EndpointGroupRegion: 'us-west-2',
    EndpointConfigurations: [
      {
        EndpointId: 'arn:aws:elasticloadbalancing:us-west-2:123456789012:loadbalancer/app/my-load-balancer/50dc6c495c0c9188',
      },
    ],
  });
});

test('Network Load Balancer with all properties', () => {
  // WHEN
  const nlb = new elbv2.NetworkLoadBalancer(stack, 'NLB', { vpc, internetFacing: true });
  listener.addEndpointGroup('Group', {
    endpoints: [
      new endpoints.NetworkLoadBalancerEndpoint(nlb, {
        weight: 50,
      }),
    ],
  });

  // THEN
  expect(stack).toHaveResourceLike('AWS::GlobalAccelerator::EndpointGroup', {
    EndpointConfigurations: [
      {
        EndpointId: { Ref: 'NLB55158F82' },
        Weight: 50,
      },
    ],
  });
});

// Doesn't work yet because 'fromNetworkLoadBalancerAttributes' doesn't set the imported resource env
test('Get region from imported NLB', () => {
  // WHEN
  const nlb = elbv2.NetworkLoadBalancer.fromNetworkLoadBalancerAttributes(stack, 'NLB', {
    loadBalancerArn: 'arn:aws:elasticloadbalancing:us-west-2:123456789012:loadbalancer/app/my-load-balancer/50dc6c495c0c9188',
  });
  listener.addEndpointGroup('Group', {
    endpoints: [
      new endpoints.NetworkLoadBalancerEndpoint(nlb),
    ],
  });

  // THEN
  expect(stack).toHaveResourceLike('AWS::GlobalAccelerator::EndpointGroup', {
    EndpointGroupRegion: 'us-west-2',
    EndpointConfigurations: [
      {
        EndpointId: 'arn:aws:elasticloadbalancing:us-west-2:123456789012:loadbalancer/app/my-load-balancer/50dc6c495c0c9188',
      },
    ],
  });
});

test('CFN EIP with all properties', () => {
  // WHEN
  const eip = new ec2.CfnEIP(stack, 'ElasticIpAddress');
  listener.addEndpointGroup('Group', {
    endpoints: [
      new endpoints.CfnEipEndpoint(eip, {
        weight: 50,
      }),
    ],
  });

  // THEN
  expect(stack).toHaveResourceLike('AWS::GlobalAccelerator::EndpointGroup', {
    EndpointConfigurations: [
      {
        EndpointId: { 'Fn::GetAtt': ['ElasticIpAddress', 'AllocationId'] },
        Weight: 50,
      },
    ],
  });
});

test('EC2 Instance with all properties', () => {
  // WHEN
  const instance = new ec2.Instance(stack, 'Instance', {
    vpc,
    machineImage: new ec2.AmazonLinuxImage(),
    instanceType: new ec2.InstanceType('t3.small'),
  });
  listener.addEndpointGroup('Group', {
    endpoints: [
      new endpoints.InstanceEndpoint(instance, {
        weight: 50,
        preserveClientIp: true,
      }),
    ],
  });

  // THEN
  expect(stack).toHaveResourceLike('AWS::GlobalAccelerator::EndpointGroup', {
    EndpointConfigurations: [
      {
        EndpointId: { Ref: 'InstanceC1063A87' },
        Weight: 50,
        ClientIPPreservationEnabled: true,
      },
    ],
  });
});

test('throws if weight is not in range', () => {
  // WHEN
  const instance = new ec2.Instance(stack, 'Instance', {
    vpc,
    machineImage: new ec2.AmazonLinuxImage(),
    instanceType: new ec2.InstanceType('t3.small'),
  });

  expect(() => {
    listener.addEndpointGroup('Group', {
      endpoints: [
        new endpoints.InstanceEndpoint(instance, {
          weight: 300,
          preserveClientIp: true,
        }),
      ],
    });
  }).toThrow(/'weight' must be between 0 and 255/);
});