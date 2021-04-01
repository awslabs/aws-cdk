import * as ec2 from '@aws-cdk/aws-ec2';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as ga from '@aws-cdk/aws-globalaccelerator';
import { App, Stack } from '@aws-cdk/core';
import * as constructs from 'constructs';
import * as endpoints from '../lib';

class GaStack extends Stack {
  constructor(scope: constructs.Construct, id: string) {
    super(scope, id);

    const vpc = new ec2.Vpc(this, 'VPC', { maxAzs: 3, natGateways: 1 });
    const accelerator = new ga.Accelerator(this, 'Accelerator');
    const listener = new ga.Listener(this, 'Listener', {
      accelerator,
      portRanges: [
        {
          fromPort: 80,
          toPort: 80,
        },
      ],
    });
    const alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', { vpc, internetFacing: true });
    const nlb = new elbv2.NetworkLoadBalancer(this, 'NLB', { vpc, internetFacing: true });
    const eip = new ec2.CfnEIP(this, 'ElasticIpAddress');
    const instances = new Array<ec2.Instance>();

    for ( let i = 0; i < 2; i++) {
      instances.push(new ec2.Instance(this, `Instance${i}`, {
        vpc,
        machineImage: new ec2.AmazonLinuxImage(),
        instanceType: new ec2.InstanceType('t3.small'),
      }));
    }

    const group = new ga.EndpointGroup(this, 'Group', {
      listener,
      endpoints: [
        new endpoints.ApplicationLoadBalancerEndpoint(alb),
        new endpoints.NetworkLoadBalancerEndpoint(nlb),
        new endpoints.CfnEipEndpoint(eip),
        new endpoints.InstanceEndpoint(instances[0]),
        new endpoints.InstanceEndpoint(instances[1]),
      ],
    });

    alb.connections.allowFrom(group.connectionsPeer('Peer', vpc), ec2.Port.tcp(443));
  }
}

const app = new App();
new GaStack(app, 'integ-globalaccelerator');
