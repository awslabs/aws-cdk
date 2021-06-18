import * as cdk from '@aws-cdk/core';
import * as ec2 from '../lib';

const app = new cdk.App();

/**
 * A load balancer that can host a VPC Endpoint Service
 */
class DummyEndpointLoadBalacer implements ec2.IVpcEndpointServiceLoadBalancer {
  /**
   * The ARN of the load balancer that hosts the VPC Endpoint Service
   */
  public readonly loadBalancerArn: string;
  constructor(arn: string) {
    this.loadBalancerArn = arn;
  }
}

class CnVpcEndpointServiceStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const nlb = new DummyEndpointLoadBalacer(
      'arn:aws-cn:elasticloadbalancing:cn-north-1:123456789012:loadbalancer/net/Test/9bn6qkf4e9jrw77a');

    const service1 = new ec2.VpcEndpointService(this, 'MyCnVpcEndpointService', {
      vpcEndpointServiceLoadBalancers: [nlb],
      acceptanceRequired: false,
    });

    new cdk.CfnOutput(this, 'MyCnVpcEndpointServiceServiceName', {
      exportName: 'ServiceName',
      value: service1.vpcEndpointServiceName,
      description: 'Give this to service consumers so they can connect via VPC Endpoint',
    });
  }
}

new CnVpcEndpointServiceStack(app, 'aws-cdk-ec2-cn-vpc-endpoint-service', {
  env: {
    account: '123456789012',
    region: 'cn-north-1',
  },
});
app.synth();