import { MatchStyle } from '@aws-cdk/assert-internal';
import '@aws-cdk/assert-internal/jest';
import { Metric } from '@aws-cdk/aws-cloudwatch';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as cdk from '@aws-cdk/core';
import * as constructs from 'constructs';
import * as elbv2 from '../../lib';
import { FakeSelfRegisteringTarget } from '../helpers';

describe('tests', () => {
  test('Listener guesses protocol from port', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LB', { vpc });

    // WHEN
    lb.addListener('Listener', {
      port: 443,
      certificateArns: ['bla'],
      defaultTargetGroups: [new elbv2.ApplicationTargetGroup(stack, 'Group', { vpc, port: 80 })],
    });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::Listener', {
      Protocol: 'HTTPS',
    });
  });

  test('Listener guesses port from protocol', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LB', { vpc });

    // WHEN
    lb.addListener('Listener', {
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultTargetGroups: [new elbv2.ApplicationTargetGroup(stack, 'Group', { vpc, port: 80 })],
    });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::Listener', {
      Port: 80,
    });
  });

  test('Listener default to open - IPv4', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');
    const loadBalancer = new elbv2.ApplicationLoadBalancer(stack, 'LB', { vpc });

    // WHEN
    loadBalancer.addListener('MyListener', {
      port: 80,
      defaultTargetGroups: [new elbv2.ApplicationTargetGroup(stack, 'Group', { vpc, port: 80 })],
    });

    // THEN
    expect(stack).toHaveResource('AWS::EC2::SecurityGroup', {
      SecurityGroupIngress: [
        {
          Description: 'Allow from anyone on port 80',
          CidrIp: '0.0.0.0/0',
          FromPort: 80,
          IpProtocol: 'tcp',
          ToPort: 80,
        },
      ],
    });
  });

  test('Listener default to open - IPv4 and IPv6 (dual stack)', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');
    const loadBalancer = new elbv2.ApplicationLoadBalancer(stack, 'LB', { vpc, ipAddressType: elbv2.IpAddressType.DUAL_STACK });

    // WHEN
    loadBalancer.addListener('MyListener', {
      port: 80,
      defaultTargetGroups: [new elbv2.ApplicationTargetGroup(stack, 'Group', { vpc, port: 80 })],
    });

    // THEN
    expect(stack).toHaveResource('AWS::EC2::SecurityGroup', {
      SecurityGroupIngress: [
        {
          Description: 'Allow from anyone on port 80',
          CidrIp: '0.0.0.0/0',
          FromPort: 80,
          IpProtocol: 'tcp',
          ToPort: 80,
        },
        {
          Description: 'Allow from anyone on port 80',
          CidrIpv6: '::/0',
          FromPort: 80,
          IpProtocol: 'tcp',
          ToPort: 80,
        },
      ],
    });
  });

  test('HTTPS listener requires certificate', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LB', { vpc });

    // WHEN
    lb.addListener('Listener', {
      port: 443,
      defaultTargetGroups: [new elbv2.ApplicationTargetGroup(stack, 'Group', { vpc, port: 80 })],
    });

    // THEN
    const errors = cdk.ConstructNode.validate(stack.node);
    expect(errors.map(e => e.message)).toEqual(['HTTPS Listener needs at least one certificate (call addCertificates)']);
  });

  test('HTTPS listener can add certificate after construction', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LB', { vpc });

    // WHEN
    const listener = lb.addListener('Listener', {
      port: 443,
      defaultTargetGroups: [new elbv2.ApplicationTargetGroup(stack, 'Group', { vpc, port: 80 })],
    });

    listener.addCertificateArns('Arns', ['cert']);

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::Listener', {
      Certificates: [
        { CertificateArn: 'cert' },
      ],
    });
  });

  test('HTTPS listener can add more than two certificates', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LB', { vpc });

    // WHEN
    const listener = lb.addListener('Listener', {
      port: 443,
      defaultTargetGroups: [
        new elbv2.ApplicationTargetGroup(stack, 'Group', { vpc, port: 80 }),
      ],
      certificates: [
        elbv2.ListenerCertificate.fromArn('cert1'),
        elbv2.ListenerCertificate.fromArn('cert2'),
        elbv2.ListenerCertificate.fromArn('cert3'),
      ],
    });

    expect(listener.node.tryFindChild('DefaultCertificates1')).toBeDefined();
    expect(listener.node.tryFindChild('DefaultCertificates2')).toBeDefined();
    expect(listener.node.tryFindChild('DefaultCertificates3')).not.toBeDefined();

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::Listener', {
      Certificates: [{ CertificateArn: 'cert1' }],
    });

    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::ListenerCertificate', {
      Certificates: [{ CertificateArn: 'cert2' }],
    });

    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::ListenerCertificate', {
      Certificates: [{ CertificateArn: 'cert3' }],
    });
  });

  test('Can configure targetType on TargetGroups', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');

    // WHEN
    new elbv2.ApplicationTargetGroup(stack, 'TargetGroup', {
      vpc,
      port: 80,
      targetType: elbv2.TargetType.IP,
    });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::TargetGroup', {
      TargetType: 'ip',
    });
  });

  test('Can configure name on TargetGroups', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');

    // WHEN
    new elbv2.ApplicationTargetGroup(stack, 'TargetGroup', {
      vpc,
      port: 80,
      targetGroupName: 'foo',
    });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::TargetGroup', {
      Name: 'foo',
    });
  });

  test('Can add target groups with and without conditions', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LB', { vpc });
    const listener = lb.addListener('Listener', { port: 80 });
    const group = new elbv2.ApplicationTargetGroup(stack, 'TargetGroup', { vpc, port: 80 });

    // WHEN
    listener.addTargetGroups('Default', {
      targetGroups: [group],
    });
    listener.addTargetGroups('WithPath', {
      priority: 10,
      pathPattern: '/hello',
      targetGroups: [group],
    });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::Listener', {
      DefaultActions: [
        {
          TargetGroupArn: { Ref: 'TargetGroup3D7CD9B8' },
          Type: 'forward',
        },
      ],
    });
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::ListenerRule', {
      Priority: 10,
      Conditions: [
        {
          Field: 'path-pattern',
          Values: ['/hello'],
        },
      ],
      Actions: [
        {
          TargetGroupArn: { Ref: 'TargetGroup3D7CD9B8' },
          Type: 'forward',
        },
      ],
    });
  });

  test('Can implicitly create target groups with and without conditions', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LB', { vpc });
    const listener = lb.addListener('Listener', { port: 80 });

    // WHEN
    listener.addTargets('Targets', {
      port: 80,
      targets: [new elbv2.InstanceTarget('i-12345')],
    });
    listener.addTargets('WithPath', {
      priority: 10,
      pathPattern: '/hello',
      port: 80,
      targets: [new elbv2.InstanceTarget('i-5678')],
    });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::Listener', {
      DefaultActions: [
        {
          TargetGroupArn: { Ref: 'LBListenerTargetsGroup76EF81E8' },
          Type: 'forward',
        },
      ],
    });
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::TargetGroup', {
      VpcId: { Ref: 'Stack8A423254' },
      Port: 80,
      Protocol: 'HTTP',
      Targets: [
        { Id: 'i-12345' },
      ],
    });
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::ListenerRule', {
      Actions: [
        {
          TargetGroupArn: { Ref: 'LBListenerWithPathGroupE889F9E5' },
          Type: 'forward',
        },
      ],
    });
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::TargetGroup', {
      VpcId: { Ref: 'Stack8A423254' },
      Port: 80,
      Protocol: 'HTTP',
      Targets: [
        { Id: 'i-5678' },
      ],
    });
  });

  test('Add certificate to constructed listener', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LB', { vpc });
    const listener = lb.addListener('Listener', { port: 443 });

    // WHEN
    listener.addCertificateArns('Arns', ['cert']);
    listener.addTargets('Targets', { port: 8080, targets: [new elbv2.IpTarget('1.2.3.4')] });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::Listener', {
      Certificates: [
        { CertificateArn: 'cert' },
      ],
    });
  });

  test('Add certificate to imported listener', () => {
    // GIVEN
    const stack2 = new cdk.Stack();
    const listener2 = elbv2.ApplicationListener.fromApplicationListenerAttributes(stack2, 'Listener', {
      listenerArn: 'listener-arn',
      defaultPort: 443,
      securityGroupId: 'security-group-id',
    });

    // WHEN
    listener2.addCertificateArns('Arns', ['cert']);

    // THEN
    expect(stack2).toHaveResource('AWS::ElasticLoadBalancingV2::ListenerCertificate', {
      Certificates: [
        { CertificateArn: 'cert' },
      ],
    });
  });

  test('Enable alb stickiness for targets', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LB', { vpc });
    const listener = lb.addListener('Listener', { port: 80 });

    // WHEN
    const group = listener.addTargets('Group', {
      port: 80,
      targets: [new FakeSelfRegisteringTarget(stack, 'Target', vpc)],
    });
    group.enableCookieStickiness(cdk.Duration.hours(1));

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::TargetGroup', {
      TargetGroupAttributes: [
        {
          Key: 'stickiness.enabled',
          Value: 'true',
        },
        {
          Key: 'stickiness.type',
          Value: 'lb_cookie',
        },
        {
          Key: 'stickiness.lb_cookie.duration_seconds',
          Value: '3600',
        },
      ],
    });
  });

  test('Enable app stickiness for targets', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LB', { vpc });
    const listener = lb.addListener('Listener', { port: 80 });

    // WHEN
    const group = listener.addTargets('Group', {
      port: 80,
      targets: [new FakeSelfRegisteringTarget(stack, 'Target', vpc)],
    });
    group.enableCookieStickiness(cdk.Duration.hours(1), 'MyDeliciousCookie');

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::TargetGroup', {
      TargetGroupAttributes: [
        {
          Key: 'stickiness.enabled',
          Value: 'true',
        },
        {
          Key: 'stickiness.type',
          Value: 'app_cookie',
        },
        {
          Key: 'stickiness.app_cookie.cookie_name',
          Value: 'MyDeliciousCookie',
        },
        {
          Key: 'stickiness.app_cookie.duration_seconds',
          Value: '3600',
        },
      ],
    });
  });

  test('Enable health check for targets', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LB', { vpc });
    const listener = lb.addListener('Listener', { port: 80 });

    // WHEN
    const group = listener.addTargets('Group', {
      port: 80,
      targets: [new FakeSelfRegisteringTarget(stack, 'Target', vpc)],
    });
    group.configureHealthCheck({
      unhealthyThresholdCount: 3,
      timeout: cdk.Duration.hours(1),
      interval: cdk.Duration.seconds(30),
      path: '/test',
    });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::TargetGroup', {
      UnhealthyThresholdCount: 3,
      HealthCheckIntervalSeconds: 30,
      HealthCheckPath: '/test',
      HealthCheckTimeoutSeconds: 3600,
    });
  });

  test('validation error if invalid health check protocol', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LB', { vpc });
    const listener = lb.addListener('Listener', { port: 80 });

    // WHEN
    const group = listener.addTargets('Group', {
      port: 80,
      targets: [new FakeSelfRegisteringTarget(stack, 'Target', vpc)],
    });

    group.configureHealthCheck({
      unhealthyThresholdCount: 3,
      timeout: cdk.Duration.hours(1),
      interval: cdk.Duration.seconds(30),
      path: '/test',
      protocol: elbv2.Protocol.TCP,
    });

    // THEN
    const validationErrors: string[] = (group as any).validate();
    expect(validationErrors).toEqual(["Health check protocol 'TCP' is not supported. Must be one of [HTTP, HTTPS]"]);
  });

  test('adding targets passes in provided protocol version', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LB', { vpc });
    const listener = lb.addListener('Listener', { port: 443, certificateArns: ['arn:someCert'] });

    // WHEN
    listener.addTargets('Group', {
      port: 443,
      protocolVersion: elbv2.ApplicationProtocolVersion.GRPC,
      targets: [new FakeSelfRegisteringTarget(stack, 'Target', vpc)],
    });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::TargetGroup', {
      ProtocolVersion: 'GRPC',
    });
  });

  test('Can call addTargetGroups on imported listener', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const listener = elbv2.ApplicationListener.fromApplicationListenerAttributes(stack, 'Listener', {
      listenerArn: 'ieks',
      securityGroupId: 'sg-12345',
    });
    const group = new elbv2.ApplicationTargetGroup(stack, 'TargetGroup', { vpc, port: 80 });

    // WHEN
    listener.addTargetGroups('Gruuup', {
      priority: 30,
      hostHeader: 'example.com',
      targetGroups: [group],
    });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::ListenerRule', {
      ListenerArn: 'ieks',
      Priority: 30,
      Actions: [
        {
          TargetGroupArn: { Ref: 'TargetGroup3D7CD9B8' },
          Type: 'forward',
        },
      ],
    });
  });

  test('Can call addTargetGroups on imported listener with conditions prop', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const listener = elbv2.ApplicationListener.fromApplicationListenerAttributes(stack, 'Listener', {
      listenerArn: 'ieks',
      securityGroupId: 'sg-12345',
    });
    const group = new elbv2.ApplicationTargetGroup(stack, 'TargetGroup', { vpc, port: 80 });

    // WHEN
    listener.addTargetGroups('Gruuup', {
      priority: 30,
      conditions: [elbv2.ListenerCondition.hostHeaders(['example.com'])],
      targetGroups: [group],
    });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::ListenerRule', {
      ListenerArn: 'ieks',
      Priority: 30,
      Actions: [
        {
          TargetGroupArn: { Ref: 'TargetGroup3D7CD9B8' },
          Type: 'forward',
        },
      ],
    });
  });

  test('Can depend on eventual listener via TargetGroup', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const loadBalancer = new elbv2.ApplicationLoadBalancer(stack, 'LoadBalancer', { vpc });
    const group = new elbv2.ApplicationTargetGroup(stack, 'TargetGroup', { vpc, port: 80 });

    // WHEN
    new ResourceWithLBDependency(stack, 'SomeResource', group);

    loadBalancer.addListener('Listener', {
      port: 80,
      defaultTargetGroups: [group],
    });

    // THEN
    expect(stack).toMatchTemplate({
      Resources: {
        SomeResource: {
          Type: 'Test::Resource',
          DependsOn: ['LoadBalancerListenerE1A099B9'],
        },
      },
    }, MatchStyle.SUPERSET);
  });

  test('Exercise metrics', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LB', { vpc });
    const group = new elbv2.ApplicationTargetGroup(stack, 'TargetGroup', { vpc, port: 80 });
    lb.addListener('SomeListener', {
      port: 80,
      defaultTargetGroups: [group],
    });

    // WHEN
    const metrics = new Array<Metric>();
    metrics.push(group.metricHttpCodeTarget(elbv2.HttpCodeTarget.TARGET_3XX_COUNT));
    metrics.push(group.metricIpv6RequestCount());
    metrics.push(group.metricUnhealthyHostCount());
    metrics.push(group.metricUnhealthyHostCount());
    metrics.push(group.metricRequestCount());
    metrics.push(group.metricTargetConnectionErrorCount());
    metrics.push(group.metricTargetResponseTime());
    metrics.push(group.metricTargetTLSNegotiationErrorCount());

    for (const metric of metrics) {
      expect(metric.namespace).toEqual('AWS/ApplicationELB');
      const loadBalancerArn = { Ref: 'LBSomeListenerCA01F1A0' };

      expect(stack.resolve(metric.dimensions)).toEqual({
        TargetGroup: { 'Fn::GetAtt': ['TargetGroup3D7CD9B8', 'TargetGroupFullName'] },
        LoadBalancer: {
          'Fn::Join':
            ['',
              [{ 'Fn::Select': [1, { 'Fn::Split': ['/', loadBalancerArn] }] },
                '/',
                { 'Fn::Select': [2, { 'Fn::Split': ['/', loadBalancerArn] }] },
                '/',
                { 'Fn::Select': [3, { 'Fn::Split': ['/', loadBalancerArn] }] }]],
        },
      });
    }
  });

  test('Can add dependency on ListenerRule via TargetGroup', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const loadBalancer = new elbv2.ApplicationLoadBalancer(stack, 'LoadBalancer', { vpc });
    const group1 = new elbv2.ApplicationTargetGroup(stack, 'TargetGroup1', { vpc, port: 80 });
    const group2 = new elbv2.ApplicationTargetGroup(stack, 'TargetGroup2', { vpc, port: 80 });
    const listener = loadBalancer.addListener('Listener', {
      port: 80,
      defaultTargetGroups: [group1],
    });

    // WHEN
    new ResourceWithLBDependency(stack, 'SomeResource', group2);

    listener.addTargetGroups('SecondGroup', {
      pathPattern: '/bla',
      priority: 10,
      targetGroups: [group2],
    });

    // THEN
    expect(stack).toMatchTemplate({
      Resources: {
        SomeResource: {
          Type: 'Test::Resource',
          DependsOn: ['LoadBalancerListenerSecondGroupRuleF5FDC196'],
        },
      },
    }, MatchStyle.SUPERSET);
  });

  test('Can add fixed responses', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LoadBalancer', {
      vpc,
    });
    const listener = lb.addListener('Listener', {
      port: 80,
    });

    // WHEN
    listener.addFixedResponse('Default', {
      contentType: elbv2.ContentType.TEXT_PLAIN,
      messageBody: 'Not Found',
      statusCode: '404',
    });
    listener.addFixedResponse('Hello', {
      priority: 10,
      pathPattern: '/hello',
      statusCode: '503',
    });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::Listener', {
      DefaultActions: [
        {
          FixedResponseConfig: {
            ContentType: 'text/plain',
            MessageBody: 'Not Found',
            StatusCode: '404',
          },
          Type: 'fixed-response',
        },
      ],
    });

    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::ListenerRule', {
      Actions: [
        {
          FixedResponseConfig: {
            StatusCode: '503',
          },
          Type: 'fixed-response',
        },
      ],
    });
  });

  test('Can add redirect responses', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LoadBalancer', {
      vpc,
    });
    const listener = lb.addListener('Listener', {
      port: 80,
    });

    // WHEN
    listener.addRedirectResponse('Default', {
      statusCode: 'HTTP_301',
      port: '443',
      protocol: 'HTTPS',
    });
    listener.addRedirectResponse('Hello', {
      priority: 10,
      pathPattern: '/hello',
      path: '/new/#{path}',
      statusCode: 'HTTP_302',
    });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::Listener', {
      DefaultActions: [
        {
          RedirectConfig: {
            Port: '443',
            Protocol: 'HTTPS',
            StatusCode: 'HTTP_301',
          },
          Type: 'redirect',
        },
      ],
    });

    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::ListenerRule', {
      Actions: [
        {
          RedirectConfig: {
            Path: '/new/#{path}',
            StatusCode: 'HTTP_302',
          },
          Type: 'redirect',
        },
      ],
    });
  });

  test('Can add simple redirect responses', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LoadBalancer', {
      vpc,
    });

    // WHEN
    lb.addRedirect();

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::Listener', {
      Port: 80,
      Protocol: 'HTTP',
      DefaultActions: [
        {
          RedirectConfig: {
            Port: '443',
            Protocol: 'HTTPS',
            StatusCode: 'HTTP_301',
          },
          Type: 'redirect',
        },
      ],
    });
  });

  test('Can supress default ingress rules on a simple redirect response', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');

    const loadBalancer = new elbv2.ApplicationLoadBalancer(stack, 'LB', {
      vpc,
    });

    // WHEN
    loadBalancer.addRedirect({ open: false });

    // THEN
    expect(stack).not.toHaveResourceLike('AWS::EC2::SecurityGroup', {
      SecurityGroupIngress: [
        {
          CidrIp: '0.0.0.0/0',
          Description: 'Allow from anyone on port 80',
          IpProtocol: 'tcp',
        },
      ],
    });
  });

  test('Can add simple redirect responses with custom values', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LoadBalancer', {
      vpc,
    });

    // WHEN
    const listener = lb.addRedirect({
      sourceProtocol: elbv2.ApplicationProtocol.HTTPS,
      sourcePort: 8443,
      targetProtocol: elbv2.ApplicationProtocol.HTTP,
      targetPort: 8080,
    });
    listener.addCertificateArns('ListenerCertificateX', ['cert3']);

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::Listener', {
      Port: 8443,
      Protocol: 'HTTPS',
      DefaultActions: [
        {
          RedirectConfig: {
            Port: '8080',
            Protocol: 'HTTP',
            StatusCode: 'HTTP_301',
          },
          Type: 'redirect',
        },
      ],
    });
  });

  test('Can configure deregistration_delay for targets', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');

    // WHEN
    new elbv2.ApplicationTargetGroup(stack, 'TargetGroup', {
      vpc,
      port: 80,
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::TargetGroup', {
      TargetGroupAttributes: [
        {
          Key: 'deregistration_delay.timeout_seconds',
          Value: '30',
        },
      ],
    });
  });

  describe('Throws with bad fixed responses', () => {
    test('status code', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'VPC');
      const lb = new elbv2.ApplicationLoadBalancer(stack, 'LoadBalancer', {
        vpc,
      });
      const listener = lb.addListener('Listener', {
        port: 80,
      });

      // THEN
      expect(() => listener.addFixedResponse('Default', {
        statusCode: '301',
      })).toThrow(/`statusCode`/);
    });

    test('message body', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'VPC');
      const lb = new elbv2.ApplicationLoadBalancer(stack, 'LoadBalancer', {
        vpc,
      });
      const listener = lb.addListener('Listener', {
        port: 80,
      });

      // THEN
      expect(() => listener.addFixedResponse('Default', {
        messageBody: 'a'.repeat(1025),
        statusCode: '500',
      })).toThrow(/`messageBody`/);
    });
  });

  describe('Throws with bad redirect responses', () => {
    test('status code', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'VPC');
      const lb = new elbv2.ApplicationLoadBalancer(stack, 'LoadBalancer', {
        vpc,
      });
      const listener = lb.addListener('Listener', {
        port: 80,
      });

      // THEN
      expect(() => listener.addRedirectResponse('Default', {
        statusCode: '301',
      })).toThrow(/`statusCode`/);
    });

    test('protocol', () => {
      // GIVEN
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'VPC');
      const lb = new elbv2.ApplicationLoadBalancer(stack, 'LoadBalancer', {
        vpc,
      });
      const listener = lb.addListener('Listener', {
        port: 80,
      });

      // THEN
      expect(() => listener.addRedirectResponse('Default', {
        protocol: 'tcp',
        statusCode: 'HTTP_301',
      })).toThrow(/`protocol`/);
    });
  });

  test('Throws when specifying both target groups and fixed response', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LoadBalancer', {
      vpc,
    });
    const listener = lb.addListener('Listener', {
      port: 80,
    });

    // THEN
    expect(() => new elbv2.ApplicationListenerRule(stack, 'Rule', {
      listener,
      priority: 10,
      pathPattern: '/hello',
      targetGroups: [new elbv2.ApplicationTargetGroup(stack, 'TargetGroup', { vpc, port: 80 })],
      fixedResponse: {
        statusCode: '500',
      },
    })).toThrow(/'targetGroups,fixedResponse'.*/);
  });

  test('Throws when specifying priority 0', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LoadBalancer', {
      vpc,
    });
    const listener = lb.addListener('Listener', {
      port: 80,
    });

    // THEN
    expect(() => new elbv2.ApplicationListenerRule(stack, 'Rule', {
      listener,
      priority: 0,
      pathPattern: '/hello',
      fixedResponse: {
        statusCode: '500',
      },
    })).toThrowError('Priority must have value greater than or equal to 1');
  });

  test('Throws when specifying both target groups and redirect response', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'VPC');
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LoadBalancer', {
      vpc,
    });
    const listener = lb.addListener('Listener', {
      port: 80,
    });

    // THEN
    expect(() => new elbv2.ApplicationListenerRule(stack, 'Rule', {
      listener,
      priority: 10,
      pathPattern: '/hello',
      targetGroups: [new elbv2.ApplicationTargetGroup(stack, 'TargetGroup', { vpc, port: 80 })],
      redirectResponse: {
        statusCode: 'HTTP_301',
      },
    })).toThrow(/'targetGroups,redirectResponse'.*/);

    expect(() => new elbv2.ApplicationListenerRule(stack, 'Rule2', {
      listener,
      priority: 10,
      pathPattern: '/hello',
      targetGroups: [new elbv2.ApplicationTargetGroup(stack, 'TargetGroup2', { vpc, port: 80 })],
      fixedResponse: {
        statusCode: '500',
      },
      redirectResponse: {
        statusCode: 'HTTP_301',
      },
    })).toThrow(/'targetGroups,fixedResponse,redirectResponse'.*/);
  });

  test('Imported listener with imported security group and allowAllOutbound set to false', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const listener = elbv2.ApplicationListener.fromApplicationListenerAttributes(stack, 'Listener', {
      listenerArn: 'listener-arn',
      defaultPort: 443,
      securityGroup: ec2.SecurityGroup.fromSecurityGroupId(stack, 'SG', 'security-group-id', {
        allowAllOutbound: false,
      }),
    });

    // WHEN
    listener.connections.allowToAnyIpv4(ec2.Port.tcp(443));

    // THEN
    expect(stack).toHaveResource('AWS::EC2::SecurityGroupEgress', {
      GroupId: 'security-group-id',
    });
  });

  test('Can pass multiple certificate arns to application listener constructor', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LB', { vpc });

    // WHEN
    lb.addListener('Listener', {
      port: 443,
      certificateArns: ['cert1', 'cert2'],
      defaultTargetGroups: [new elbv2.ApplicationTargetGroup(stack, 'Group', { vpc, port: 80 })],
    });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::Listener', {
      Protocol: 'HTTPS',
    });

    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::ListenerCertificate', {
      Certificates: [{ CertificateArn: 'cert2' }],
    });
  });

  test('Can use certificate wrapper class', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LB', { vpc });

    // WHEN
    lb.addListener('Listener', {
      port: 443,
      certificates: [elbv2.ListenerCertificate.fromArn('cert1'), elbv2.ListenerCertificate.fromArn('cert2')],
      defaultTargetGroups: [new elbv2.ApplicationTargetGroup(stack, 'Group', { vpc, port: 80 })],
    });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::Listener', {
      Protocol: 'HTTPS',
    });

    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::ListenerCertificate', {
      Certificates: [{ CertificateArn: 'cert2' }],
    });
  });

  test('Can add additional certificates via addCertificateArns to application listener', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LB', { vpc });

    // WHEN
    const listener = lb.addListener('Listener', {
      port: 443,
      certificateArns: ['cert1', 'cert2'],
      defaultTargetGroups: [new elbv2.ApplicationTargetGroup(stack, 'Group', { vpc, port: 80 })],
    });

    listener.addCertificateArns('ListenerCertificateX', ['cert3']);

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::Listener', {
      Protocol: 'HTTPS',
    });

    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::ListenerCertificate', {
      Certificates: [{ CertificateArn: 'cert2' }],
    });

    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::ListenerCertificate', {
      Certificates: [{ CertificateArn: 'cert3' }],
    });
  });

  test('Can add multiple path patterns to listener rule', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LB', { vpc });

    // WHEN
    const listener = lb.addListener('Listener', {
      port: 443,
      certificateArns: ['cert1', 'cert2'],
      defaultTargetGroups: [new elbv2.ApplicationTargetGroup(stack, 'Group', { vpc, port: 80 })],
    });

    listener.addTargets('Target1', {
      priority: 10,
      pathPatterns: ['/test/path/1', '/test/path/2'],
    });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::ListenerRule', {
      Priority: 10,
      Conditions: [
        {
          Field: 'path-pattern',
          Values: ['/test/path/1', '/test/path/2'],
        },
      ],
    });
  });

  test('Cannot add pathPattern and pathPatterns to listener rule', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LB', { vpc });

    // WHEN
    const listener = lb.addListener('Listener', {
      port: 443,
      certificateArns: ['cert1', 'cert2'],
      defaultTargetGroups: [new elbv2.ApplicationTargetGroup(stack, 'Group', { vpc, port: 80 })],
    });

    // THEN
    expect(() => listener.addTargets('Target1', {
      priority: 10,
      pathPatterns: ['/test/path/1', '/test/path/2'],
      pathPattern: '/test/path/3',
    })).toThrowError('Both `pathPatterns` and `pathPattern` are specified, specify only one');
  });

  test('Add additional condition to listener rule', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LB', { vpc });
    const group1 = new elbv2.ApplicationTargetGroup(stack, 'Group1', { vpc, port: 80 });
    const group2 = new elbv2.ApplicationTargetGroup(stack, 'Group2', { vpc, port: 81, protocol: elbv2.ApplicationProtocol.HTTP });

    // WHEN
    const listener = lb.addListener('Listener', {
      port: 443,
      certificateArns: ['cert1'],
      defaultTargetGroups: [group2],
    });
    listener.addTargetGroups('TargetGroup1', {
      priority: 10,
      conditions: [
        elbv2.ListenerCondition.hostHeaders(['app.test']),
        elbv2.ListenerCondition.httpHeader('Accept', ['application/vnd.myapp.v2+json']),
      ],
      targetGroups: [group1],
    });
    listener.addTargetGroups('TargetGroup2', {
      priority: 20,
      conditions: [
        elbv2.ListenerCondition.hostHeaders(['app.test']),
      ],
      targetGroups: [group2],
    });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::ListenerRule', {
      Priority: 10,
      Conditions: [
        {
          Field: 'host-header',
          HostHeaderConfig: {
            Values: ['app.test'],
          },
        },
        {
          Field: 'http-header',
          HttpHeaderConfig: {
            HttpHeaderName: 'Accept',
            Values: ['application/vnd.myapp.v2+json'],
          },
        },
      ],
    });

    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::ListenerRule', {
      Priority: 20,
      Conditions: [
        {
          Field: 'host-header',
          HostHeaderConfig: {
            Values: ['app.test'],
          },
        },
      ],
    });
  });

  test('Add multiple additonal condition to listener rule', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LB', { vpc });
    const group1 = new elbv2.ApplicationTargetGroup(stack, 'Group1', { vpc, port: 80 });
    const group2 = new elbv2.ApplicationTargetGroup(stack, 'Group2', { vpc, port: 81, protocol: elbv2.ApplicationProtocol.HTTP });
    const group3 = new elbv2.ApplicationTargetGroup(stack, 'Group3', { vpc, port: 82, protocol: elbv2.ApplicationProtocol.HTTP });

    // WHEN
    const listener = lb.addListener('Listener', {
      port: 443,
      certificateArns: ['cert1'],
      defaultTargetGroups: [group3],
    });
    listener.addTargetGroups('TargetGroup1', {
      priority: 10,
      conditions: [
        elbv2.ListenerCondition.hostHeaders(['app.test']),
        elbv2.ListenerCondition.sourceIps(['192.0.2.0/24']),
        elbv2.ListenerCondition.queryStrings([{ key: 'version', value: '2' }, { value: 'foo*' }]),
      ],
      targetGroups: [group1],
    });
    listener.addTargetGroups('TargetGroup2', {
      priority: 20,
      conditions: [
        elbv2.ListenerCondition.hostHeaders(['app.test']),
        elbv2.ListenerCondition.httpHeader('Accept', ['application/vnd.myapp.v2+json']),
      ],
      targetGroups: [group1],
    });
    listener.addTargetGroups('TargetGroup3', {
      priority: 30,
      conditions: [
        elbv2.ListenerCondition.hostHeaders(['app.test']),
        elbv2.ListenerCondition.httpRequestMethods(['PUT', 'COPY', 'LOCK', 'MKCOL', 'MOVE', 'PROPFIND', 'PROPPATCH', 'UNLOCK']),
      ],
      targetGroups: [group2],
    });
    listener.addTargetGroups('TargetGroup4', {
      priority: 40,
      conditions: [
        elbv2.ListenerCondition.hostHeaders(['app.test']),
      ],
      targetGroups: [group3],
    });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::ListenerRule', {
      Priority: 10,
      Conditions: [
        {
          Field: 'host-header',
          HostHeaderConfig: {
            Values: ['app.test'],
          },
        },
        {
          Field: 'source-ip',
          SourceIpConfig: {
            Values: ['192.0.2.0/24'],
          },
        },
        {
          Field: 'query-string',
          QueryStringConfig: {
            Values: [
              {
                Key: 'version',
                Value: '2',
              },
              {
                Value: 'foo*',
              },
            ],
          },
        },
      ],
    });

    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::ListenerRule', {
      Priority: 20,
      Conditions: [
        {
          Field: 'host-header',
          HostHeaderConfig: {
            Values: ['app.test'],
          },
        },
        {
          Field: 'http-header',
          HttpHeaderConfig: {
            HttpHeaderName: 'Accept',
            Values: ['application/vnd.myapp.v2+json'],
          },
        },
      ],
    });

    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::ListenerRule', {
      Priority: 30,
      Conditions: [
        {
          Field: 'host-header',
          HostHeaderConfig: {
            Values: ['app.test'],
          },
        },
        {
          Field: 'http-request-method',
          HttpRequestMethodConfig: {
            Values: ['PUT', 'COPY', 'LOCK', 'MKCOL', 'MOVE', 'PROPFIND', 'PROPPATCH', 'UNLOCK'],
          },
        },
      ],
    });

    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::ListenerRule', {
      Priority: 40,
      Conditions: [
        {
          Field: 'host-header',
          HostHeaderConfig: {
            Values: ['app.test'],
          },
        },
      ],
    });
  });

  test('Can exist together legacy style conditions and modern style conditions', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LB', { vpc });
    const group1 = new elbv2.ApplicationTargetGroup(stack, 'Group1', { vpc, port: 80 });
    const group2 = new elbv2.ApplicationTargetGroup(stack, 'Group2', { vpc, port: 81, protocol: elbv2.ApplicationProtocol.HTTP });

    // WHEN
    const listener = lb.addListener('Listener', {
      port: 443,
      certificateArns: ['cert1'],
      defaultTargetGroups: [group2],
    });
    listener.addTargetGroups('TargetGroup1', {
      hostHeader: 'app.test',
      pathPattern: '/test',
      conditions: [
        elbv2.ListenerCondition.sourceIps(['192.0.2.0/24']),
      ],
      priority: 10,
      targetGroups: [group1],
    });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::ListenerRule', {
      Priority: 10,
      Conditions: [
        {
          Field: 'host-header',
          Values: ['app.test'],
        },
        {
          Field: 'path-pattern',
          Values: ['/test'],
        },
        {
          Field: 'source-ip',
          SourceIpConfig: {
            Values: ['192.0.2.0/24'],
          },
        },
      ],
    });
  });

  test('Add condition to imported application listener', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');
    const group = new elbv2.ApplicationTargetGroup(stack, 'TargetGroup', { vpc, port: 80 });
    const listener = elbv2.ApplicationListener.fromApplicationListenerAttributes(stack, 'Listener', {
      listenerArn: 'listener-arn',
      defaultPort: 443,
      securityGroupId: 'security-group-id',
    });

    // WHEN
    listener.addTargetGroups('OtherTG', {
      targetGroups: [group],
      priority: 1,
      pathPatterns: ['/path1', '/path2'],
    });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::ListenerRule', {
      Priority: 1,
      Conditions: [
        {
          Field: 'path-pattern',
          Values: ['/path1', '/path2'],
        },
      ],
    });
  });

  test('not allowed to combine action specifiers when instantiating a Rule directly', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');
    const group = new elbv2.ApplicationTargetGroup(stack, 'TargetGroup', { vpc, port: 80 });
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LB', { vpc });
    const listener = lb.addListener('Listener', { port: 80 });

    const baseProps = { listener, priority: 1, pathPatterns: ['/path1', '/path2'] };

    // WHEN
    expect(() => {
      new elbv2.ApplicationListenerRule(stack, 'Rule1', {
        ...baseProps,
        fixedResponse: { statusCode: '200' },
        action: elbv2.ListenerAction.fixedResponse(200),
      });
    }).toThrow(/specify only one/);

    expect(() => {
      new elbv2.ApplicationListenerRule(stack, 'Rule2', {
        ...baseProps,
        targetGroups: [group],
        action: elbv2.ListenerAction.fixedResponse(200),
      });
    }).toThrow(/specify only one/);
  });

  test('not allowed to specify defaultTargetGroups and defaultAction together', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'Stack');
    const group = new elbv2.ApplicationTargetGroup(stack, 'TargetGroup', { vpc, port: 80 });
    const lb = new elbv2.ApplicationLoadBalancer(stack, 'LB', { vpc });

    // WHEN
    expect(() => {
      lb.addListener('Listener1', {
        port: 80,
        defaultTargetGroups: [group],
        defaultAction: elbv2.ListenerAction.fixedResponse(200),
      });
    }).toThrow(/Specify at most one/);
  });

  describe('lookup', () => {
    test('Can look up an ApplicationListener', () => {
      // GIVEN
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'stack', {
        env: {
          account: '123456789012',
          region: 'us-west-2',
        },
      });

      // WHEN
      const listener = elbv2.ApplicationListener.fromLookup(stack, 'a', {
        loadBalancerTags: {
          some: 'tag',
        },
      });

      // THEN
      expect(stack).not.toHaveResource('AWS::ElasticLoadBalancingV2::Listener');
      expect(listener.listenerArn).toEqual('arn:aws:elasticloadbalancing:us-west-2:123456789012:listener/application/my-load-balancer/50dc6c495c0c9188/f2f7dc8efc522ab2');
      expect(listener.connections.securityGroups[0].securityGroupId).toEqual('sg-12345');
    });

    test('Can add rules to a looked-up ApplicationListener', () => {
      // GIVEN
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'stack', {
        env: {
          account: '123456789012',
          region: 'us-west-2',
        },
      });

      const listener = elbv2.ApplicationListener.fromLookup(stack, 'a', {
        loadBalancerTags: {
          some: 'tag',
        },
      });

      // WHEN
      new elbv2.ApplicationListenerRule(stack, 'rule', {
        listener,
        conditions: [
          elbv2.ListenerCondition.hostHeaders(['example.com']),
        ],
        action: elbv2.ListenerAction.fixedResponse(200),
        priority: 5,
      });

      // THEN
      expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::ListenerRule', {
        Priority: 5,
      });
    });

    test('Can add certificates to a looked-up ApplicationListener', () => {
      // GIVEN
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'stack', {
        env: {
          account: '123456789012',
          region: 'us-west-2',
        },
      });

      const listener = elbv2.ApplicationListener.fromLookup(stack, 'a', {
        loadBalancerTags: {
          some: 'tag',
        },
      });

      // WHEN
      listener.addCertificateArns('certs', [
        'arn:something',
      ]);

      // THEN
      expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::ListenerCertificate', {
        Certificates: [
          { CertificateArn: 'arn:something' },
        ],
      });
    });
  });
});

class ResourceWithLBDependency extends cdk.CfnResource {
  constructor(scope: constructs.Construct, id: string, targetGroup: elbv2.ITargetGroup) {
    super(scope, id, { type: 'Test::Resource' });
    this.node.addDependency(targetGroup.loadBalancerAttached);
  }
}
