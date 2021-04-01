# AWS::GlobalAccelerator Construct Library
<!--BEGIN STABILITY BANNER-->

---

![cfn-resources: Stable](https://img.shields.io/badge/cfn--resources-stable-success.svg?style=for-the-badge)

![cdk-constructs: Stable](https://img.shields.io/badge/cdk--constructs-stable-success.svg?style=for-the-badge)

---

<!--END STABILITY BANNER-->

## Introduction

AWS Global Accelerator (AGA) is a service that improves the availability and
performance of your applications with local or global users.

It intercepts your user's network connection at an edge location close to
them, and routes it to one of potentially multiple, redundant backends across
the more reliable and less congested AWS global network.

AGA can be used to route traffic to Application Load Balancers, Network Load
Balancers, EC2 Instances and Elastic IP Addresses.

For more information, see the [AWS Global
Accelerator Developer Guide](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/AWS_GlobalAccelerator.html).

## Example

Here's an example that sets up a Global Accelerator for two Application Load
Balancers in two different AWS Regions:

```ts
import globalaccelerator = require('@aws-cdk/aws-globalaccelerator');
import ga_endpoints = require('@aws-cdk/aws-globalaccelerator-endpoints');
import elbv2 = require('@aws-cdk/aws-elasticloadbalancingv2');

// Create an Accelerator
const accelerator = new globalaccelerator.Accelerator(stack, 'Accelerator');

// Create a Listener
const listener = accelerator.addListener('Listener', {
  portRanges: [
    { fromPort: 80 },
    { fromPort: 443 },
  ],
});

// Import the Load Balancers
const nlb1 = elbv2.NetworkLoadBalancer.fromNetworkLoadBalancerAttributes(stack, 'NLB1', {
  loadBalancerArn: 'arn:aws:elasticloadbalancing:us-west-2:111111111111:loadbalancer/app/my-load-balancer1/e16bef66805b',
});
const nlb2 = elbv2.NetworkLoadBalancer.fromNetworkLoadBalancerAttributes(stack, 'NLB2', {
  loadBalancerArn: 'arn:aws:elasticloadbalancing:ap-south-1:111111111111:loadbalancer/app/my-load-balancer2/5513dc2ea8a1',
});

// Add one EndpointGroup for each Region we are targeting
listener.addEndpointGroup('Group1', {
  endpoints: [new ga_endpoints.NetworkLoadBalancerEndpoint(nlb1)],
});
listener.addEndpointGroup('Group2', {
  // Imported load balancers automatically calculate their Region from the ARN.
  // If you are load balancing to other resources, you must also pass a `region`
  // parameter here.
  endpoints: [new ga_endpoints.NetworkLoadBalancerEndpoint(nlb2)],
});
```

## Concepts

The **Accelerator** construct defines a Global Accelerator resource.

An Accelerator includes one or more **Listeners** that accepts inbound
connections on one or more ports.

Each Listener has one or more **Endpoint Groups**, representing multiple
geographically distributed copies of your application. There is one Endpoint
Group per Region, and user traffic is routed to the closest Region by default.

An Endpoint Group consists of one or more **Endpoints**, which is where the
user traffic coming in on the Listener is ultimately sent. The Endpoint port
used is the same as the traffic came in on at the Listener, unless overridden.

## Types of Endpoints

There are 4 types of Endpoints, and they can be found in the
`@aws-cdk/aws-globalaccelerator-endpoints` package:

* Application Load Balancers
* Network Load Balancers
* EC2 Instances
* Elastic IP Addresses

### Application Load Balancers

```ts
const alb = new elbv2.ApplicationLoadBalancer(...);

listener.addEndpointGroup('Group', {
  endpoints: [
    new ga_endpoints.ApplicationLoadBalancerEndpoint(alb, {
      weight: 128,
      preserveClientIp: true,
    }),
  ],
});
```

### Network Load Balancers

```ts
const nlb = new elbv2.NetworkLoadBalancer(...);

listener.addEndpointGroup('Group', {
  endpoints: [
    new ga_endpoints.NetworkLoadBalancerEndpoint(nlb, {
      weight: 128,
    }),
  ],
});
```

### EC2 Instances

```ts
const instance = new ec2.instance(...);

listener.addEndpointGroup('Group', {
  endpoints: [
    new ga_endpoints.InstanceEndpoint(instance, {
      weight: 128,
      preserveClientIp: true,
    }),
  ],
});
```

### Elastic IP Addresses

```ts
const eip = new ec2.CfnEIP(...);

listener.addEndpointGroup('Group', {
  endpoints: [
    new ga_endpoints.CfnEipEndpoint(eip, {
      weight: 128,
    }),
  ],
});
```

## Client IP Address Preservation and Security Groups

When using the `preserveClientIp` feature, AGA creates
**Elastic Network Interfaces** (ENIs) in your AWS account, that are
associated with a Security Group AGA creates for you. You can use the
security group created by AGA as a source group in other security groups
(such as those for EC2 instances or Elastic Load Balancers), if you want to
restrict incoming traffic to the AGA security group rules.

AGA creates a specific security group called `GlobalAccelerator` for each VPC
it has an ENI in (this behavior can not be changed). CloudFormation doesn't
support referencing the security group created by AGA, but this construct
library comes with a custom resource that enables you to reference the AGA
security group.

Call `endpointGroup.connectionsPeer()` to obtain a reference to the Security Group
which you can use in connection rules. You must pass a reference to the VPC in whose
context the security group will be looked up. Example:

```ts
// ...

// Non-open ALB
const alb = new elbv2.ApplicationLoadBalancer(stack, 'ALB', { /* ... */ });

const endpointGroup = listener.addEndpointGroup('Group', {
  endpoints: [
    new ga_endpoints.ApplicationLoadBalancerEndpoint(alb, {
      preserveClientIps: true,
    })],
  ],
});

// Remember that there is only one AGA security group per VPC.
const agaSg = endpointGroup.connectionsPeer('GlobalAcceleratorSG', vpc);

// Allow connections from the AGA to the ALB
alb.connections.allowFrom(agaSg, Port.tcp(443));
```
