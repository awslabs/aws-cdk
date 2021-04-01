import { ResourcePart, arrayWith } from '@aws-cdk/assert';
import '@aws-cdk/assert/jest';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
import * as cxapi from '@aws-cdk/cx-api';
import { testFutureBehavior } from 'cdk-build-tools/lib/feature-flag';
import * as elbv2 from '../../lib';

const s3GrantWriteCtx = { [cxapi.S3_GRANT_WRITE_WITHOUT_ACL]: true };

describe('tests', () => {
  test('Trivial construction: internet facing', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');

    // WHEN
    new elbv2.NetworkLoadBalancer(stack, 'LB', {
      vpc,
      internetFacing: true,
    });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      Scheme: 'internet-facing',
      Subnets: [
        { Ref: 'StackPublicSubnet1Subnet0AD81D22' },
        { Ref: 'StackPublicSubnet2Subnet3C7D2288' },
      ],
      Type: 'network',
    });
  });

  test('Trivial construction: internal', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');

    // WHEN
    new elbv2.NetworkLoadBalancer(stack, 'LB', { vpc });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      Scheme: 'internal',
      Subnets: [
        { Ref: 'StackPrivateSubnet1Subnet47AC2BC7' },
        { Ref: 'StackPrivateSubnet2SubnetA2F8EDD8' },
      ],
      Type: 'network',
    });
  });

  test('Attributes', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');

    // WHEN
    new elbv2.NetworkLoadBalancer(stack, 'LB', {
      vpc,
      crossZoneEnabled: true,
    });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      LoadBalancerAttributes: arrayWith(
        {
          Key: 'load_balancing.cross_zone.enabled',
          Value: 'true',
        },
      ),
    });
  });

  testFutureBehavior('Access logging', s3GrantWriteCtx, cdk.App, (app) => {
    // GIVEN
    const stack = new cdk.Stack(app, undefined, { env: { region: 'us-east-1' } });
    const vpc = new ec2.Vpc(stack, 'Stack');
    const bucket = new s3.Bucket(stack, 'AccessLoggingBucket');
    const lb = new elbv2.NetworkLoadBalancer(stack, 'LB', { vpc });

    // WHEN
    lb.logAccessLogs(bucket);

    // THEN

    // verify that the LB attributes reference the bucket
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      LoadBalancerAttributes: arrayWith(
        {
          Key: 'access_logs.s3.enabled',
          Value: 'true',
        },
        {
          Key: 'access_logs.s3.bucket',
          Value: { Ref: 'AccessLoggingBucketA6D88F29' },
        },
      ),
    });

    // verify the bucket policy allows the ALB to put objects in the bucket
    expect(stack).toHaveResource('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: ['s3:PutObject', 's3:Abort*'],
            Effect: 'Allow',
            Principal: { AWS: { 'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':iam::127311923021:root']] } },
            Resource: {
              'Fn::Join': ['', [{ 'Fn::GetAtt': ['AccessLoggingBucketA6D88F29', 'Arn'] }, '/AWSLogs/',
                { Ref: 'AWS::AccountId' }, '/*']],
            },
          },
          {
            Action: 's3:PutObject',
            Condition: { StringEquals: { 's3:x-amz-acl': 'bucket-owner-full-control' } },
            Effect: 'Allow',
            Principal: { Service: 'delivery.logs.amazonaws.com' },
            Resource: {
              'Fn::Join': ['', [{ 'Fn::GetAtt': ['AccessLoggingBucketA6D88F29', 'Arn'] }, '/AWSLogs/',
                { Ref: 'AWS::AccountId' }, '/*']],
            },
          },
          {
            Action: 's3:GetBucketAcl',
            Effect: 'Allow',
            Principal: { Service: 'delivery.logs.amazonaws.com' },
            Resource: {
              'Fn::GetAtt': ['AccessLoggingBucketA6D88F29', 'Arn'],
            },
          },
        ],
      },
    });

    // verify the ALB depends on the bucket *and* the bucket policy
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      DependsOn: ['AccessLoggingBucketPolicy700D7CC6', 'AccessLoggingBucketA6D88F29'],
    }, ResourcePart.CompleteDefinition);
  });

  testFutureBehavior('access logging with prefix', s3GrantWriteCtx, cdk.App, (app) => {
    // GIVEN
    const stack = new cdk.Stack(app, undefined, { env: { region: 'us-east-1' } });
    const vpc = new ec2.Vpc(stack, 'Stack');
    const bucket = new s3.Bucket(stack, 'AccessLoggingBucket');
    const lb = new elbv2.NetworkLoadBalancer(stack, 'LB', { vpc });

    // WHEN
    lb.logAccessLogs(bucket, 'prefix-of-access-logs');

    // THEN
    // verify that the LB attributes reference the bucket
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      LoadBalancerAttributes: arrayWith(
        {
          Key: 'access_logs.s3.enabled',
          Value: 'true',
        },
        {
          Key: 'access_logs.s3.bucket',
          Value: { Ref: 'AccessLoggingBucketA6D88F29' },
        },
        {
          Key: 'access_logs.s3.prefix',
          Value: 'prefix-of-access-logs',
        },
      ),
    });

    // verify the bucket policy allows the ALB to put objects in the bucket
    expect(stack).toHaveResource('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: ['s3:PutObject', 's3:Abort*'],
            Effect: 'Allow',
            Principal: { AWS: { 'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':iam::127311923021:root']] } },
            Resource: {
              'Fn::Join': ['', [{ 'Fn::GetAtt': ['AccessLoggingBucketA6D88F29', 'Arn'] }, '/prefix-of-access-logs/AWSLogs/',
                { Ref: 'AWS::AccountId' }, '/*']],
            },
          },
          {
            Action: 's3:PutObject',
            Condition: { StringEquals: { 's3:x-amz-acl': 'bucket-owner-full-control' } },
            Effect: 'Allow',
            Principal: { Service: 'delivery.logs.amazonaws.com' },
            Resource: {
              'Fn::Join': ['', [{ 'Fn::GetAtt': ['AccessLoggingBucketA6D88F29', 'Arn'] }, '/prefix-of-access-logs/AWSLogs/',
                { Ref: 'AWS::AccountId' }, '/*']],
            },
          },
          {
            Action: 's3:GetBucketAcl',
            Effect: 'Allow',
            Principal: { Service: 'delivery.logs.amazonaws.com' },
            Resource: {
              'Fn::GetAtt': ['AccessLoggingBucketA6D88F29', 'Arn'],
            },
          },
        ],
      },
    });
  });

  test('loadBalancerName', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');

    // WHEN
    new elbv2.NetworkLoadBalancer(stack, 'ALB', {
      loadBalancerName: 'myLoadBalancer',
      vpc,
    });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      Name: 'myLoadBalancer',
    });
  });

  test('imported network load balancer with no vpc specified throws error when calling addTargets', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const nlbArn = 'arn:aws:elasticloadbalancing:us-west-2:123456789012:loadbalancer/app/my-load-balancer/50dc6c495c0c9188';
    const nlb = elbv2.NetworkLoadBalancer.fromNetworkLoadBalancerAttributes(stack, 'NLB', {
      loadBalancerArn: nlbArn,
    });
    // WHEN
    const listener = nlb.addListener('Listener', { port: 80 });
    expect(() => listener.addTargets('targetgroup', { port: 8080 })).toThrow();
  });

  test('imported network load balancer with vpc does not throw error when calling addTargets', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Vpc');
    const nlbArn = 'arn:aws:elasticloadbalancing:us-west-2:123456789012:loadbalancer/app/my-load-balancer/50dc6c495c0c9188';
    const nlb = elbv2.NetworkLoadBalancer.fromNetworkLoadBalancerAttributes(stack, 'NLB', {
      loadBalancerArn: nlbArn,
      vpc,
    });
    // WHEN
    const listener = nlb.addListener('Listener', { port: 80 });
    expect(() => listener.addTargets('targetgroup', { port: 8080 })).not.toThrow();
  });

  test('imported load balancer knows its region', () => {
    const stack = new cdk.Stack();

    // WHEN
    const albArn = 'arn:aws:elasticloadbalancing:us-west-2:123456789012:loadbalancer/app/my-load-balancer/50dc6c495c0c9188';
    const alb = elbv2.NetworkLoadBalancer.fromNetworkLoadBalancerAttributes(stack, 'ALB', {
      loadBalancerArn: albArn,
    });

    // THEN
    expect(alb.env.region).toEqual('us-west-2');
  });

  test('Trivial construction: internal with Isolated subnets only', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC', {
      subnetConfiguration: [{
        cidrMask: 20,
        name: 'Isolated',
        subnetType: ec2.SubnetType.ISOLATED,
      }],
    });

    // WHEN
    new elbv2.NetworkLoadBalancer(stack, 'LB', {
      vpc,
      internetFacing: false,
    });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      Scheme: 'internal',
      Subnets: [
        { Ref: 'VPCIsolatedSubnet1SubnetEBD00FC6' },
        { Ref: 'VPCIsolatedSubnet2Subnet4B1C8CAA' },
      ],
      Type: 'network',
    });
  });
  test('Internal with Public, Private, and Isolated subnets', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC', {
      subnetConfiguration: [{
        cidrMask: 24,
        name: 'Public',
        subnetType: ec2.SubnetType.PUBLIC,
      }, {
        cidrMask: 24,
        name: 'Private',
        subnetType: ec2.SubnetType.PRIVATE,
      }, {
        cidrMask: 28,
        name: 'Isolated',
        subnetType: ec2.SubnetType.ISOLATED,
      }],
    });

    // WHEN
    new elbv2.NetworkLoadBalancer(stack, 'LB', {
      vpc,
      internetFacing: false,
    });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      Scheme: 'internal',
      Subnets: [
        { Ref: 'VPCPrivateSubnet1Subnet8BCA10E0' },
        { Ref: 'VPCPrivateSubnet2SubnetCFCDAA7A' },
      ],
      Type: 'network',
    });
  });
  test('Internet-facing with Public, Private, and Isolated subnets', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC', {
      subnetConfiguration: [{
        cidrMask: 24,
        name: 'Public',
        subnetType: ec2.SubnetType.PUBLIC,
      }, {
        cidrMask: 24,
        name: 'Private',
        subnetType: ec2.SubnetType.PRIVATE,
      }, {
        cidrMask: 28,
        name: 'Isolated',
        subnetType: ec2.SubnetType.ISOLATED,
      }],
    });

    // WHEN
    new elbv2.NetworkLoadBalancer(stack, 'LB', {
      vpc,
      internetFacing: true,
    });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      Scheme: 'internet-facing',
      Subnets: [
        { Ref: 'VPCPublicSubnet1SubnetB4246D30' },
        { Ref: 'VPCPublicSubnet2Subnet74179F39' },
      ],
      Type: 'network',
    });
  });
  test('Internal load balancer supplying public subnets', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');

    // WHEN
    new elbv2.NetworkLoadBalancer(stack, 'LB', {
      vpc,
      internetFacing: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      Scheme: 'internal',
      Subnets: [
        { Ref: 'VPCPublicSubnet1SubnetB4246D30' },
        { Ref: 'VPCPublicSubnet2Subnet74179F39' },
      ],
      Type: 'network',
    });
  });
  test('Internal load balancer supplying isolated subnets', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC', {
      subnetConfiguration: [{
        cidrMask: 24,
        name: 'Public',
        subnetType: ec2.SubnetType.PUBLIC,
      }, {
        cidrMask: 24,
        name: 'Private',
        subnetType: ec2.SubnetType.PRIVATE,
      }, {
        cidrMask: 28,
        name: 'Isolated',
        subnetType: ec2.SubnetType.ISOLATED,
      }],
    });

    // WHEN
    new elbv2.NetworkLoadBalancer(stack, 'LB', {
      vpc,
      internetFacing: false,
      vpcSubnets: { subnetType: ec2.SubnetType.ISOLATED },
    });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      Scheme: 'internal',
      Subnets: [
        { Ref: 'VPCIsolatedSubnet1SubnetEBD00FC6' },
        { Ref: 'VPCIsolatedSubnet2Subnet4B1C8CAA' },
      ],
      Type: 'network',
    });
  });

  describe('lookup', () => {
    test('Can look up a NetworkLoadBalancer', () => {
      // GIVEN
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'stack', {
        env: {
          account: '123456789012',
          region: 'us-west-2',
        },
      });

      // WHEN
      const loadBalancer = elbv2.NetworkLoadBalancer.fromLookup(stack, 'a', {
        loadBalancerTags: {
          some: 'tag',
        },
      });

      // THEN
      expect(stack).not.toHaveResource('AWS::ElasticLoadBalancingV2::NetworkLoadBalancer');
      expect(loadBalancer.loadBalancerArn).toEqual('arn:aws:elasticloadbalancing:us-west-2:123456789012:loadbalancer/network/my-load-balancer/50dc6c495c0c9188');
      expect(loadBalancer.loadBalancerCanonicalHostedZoneId).toEqual('Z3DZXE0EXAMPLE');
      expect(loadBalancer.loadBalancerDnsName).toEqual('my-load-balancer-1234567890.us-west-2.elb.amazonaws.com');
      expect(loadBalancer.env.region).toEqual('us-west-2');
    });

    test('Can add listeners to a looked-up NetworkLoadBalancer', () => {
      // GIVEN
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'stack', {
        env: {
          account: '123456789012',
          region: 'us-west-2',
        },
      });

      const loadBalancer = elbv2.NetworkLoadBalancer.fromLookup(stack, 'a', {
        loadBalancerTags: {
          some: 'tag',
        },
      });

      const targetGroup = new elbv2.NetworkTargetGroup(stack, 'tg', {
        vpc: loadBalancer.vpc,
        port: 3000,
      });

      // WHEN
      loadBalancer.addListener('listener', {
        protocol: elbv2.Protocol.TCP_UDP,
        port: 3000,
        defaultAction: elbv2.NetworkListenerAction.forward([targetGroup]),
      });

      // THEN
      expect(stack).not.toHaveResource('AWS::ElasticLoadBalancingV2::NetworkLoadBalancer');
      expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::Listener');
    });
  });
});

