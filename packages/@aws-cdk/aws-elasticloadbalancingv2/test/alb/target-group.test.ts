import '@aws-cdk/assert/jest';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as cdk from '@aws-cdk/core';
import * as elbv2 from '../../lib';
import { FakeSelfRegisteringTarget } from '../helpers';

describe('tests', () => {
  test('Empty target Group without type still requires a VPC', () => {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'Stack');

    // WHEN
    new elbv2.ApplicationTargetGroup(stack, 'LB', {});

    // THEN
    expect(() => {
      app.synth();
    }).toThrow(/'vpc' is required for a non-Lambda TargetGroup/);
  });

  test('Can add self-registering target to imported TargetGroup', () => {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'Stack');
    const vpc = new ec2.Vpc(stack, 'Vpc');

    // WHEN
    const tg = elbv2.ApplicationTargetGroup.fromTargetGroupAttributes(stack, 'TG', {
      targetGroupArn: 'arn',
    });
    tg.addTarget(new FakeSelfRegisteringTarget(stack, 'Target', vpc));
  });

  test('Cannot add direct target to imported TargetGroup', () => {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'Stack');
    const tg = elbv2.ApplicationTargetGroup.fromTargetGroupAttributes(stack, 'TG', {
      targetGroupArn: 'arn',
    });

    // WHEN
    expect(() => {
      tg.addTarget(new elbv2.InstanceTarget('i-1234'));
    }).toThrow(/Cannot add a non-self registering target to an imported TargetGroup/);
  });

  test('HealthCheck fields set if provided', () => {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'Stack');
    const vpc = new ec2.Vpc(stack, 'VPC', {});
    const alb = new elbv2.ApplicationLoadBalancer(stack, 'ALB', { vpc });
    const listener = new elbv2.ApplicationListener(stack, 'Listener', {
      port: 80,
      loadBalancer: alb,
      open: false,
    });

    // WHEN
    const ipTarget = new elbv2.IpTarget('10.10.12.12');
    listener.addTargets('TargetGroup', {
      targets: [ipTarget],
      port: 80,
      healthCheck: {
        enabled: true,
        healthyHttpCodes: '255',
        interval: cdk.Duration.seconds(255),
        timeout: cdk.Duration.seconds(192),
        healthyThresholdCount: 29,
        unhealthyThresholdCount: 27,
        path: '/arbitrary',
      },
    });

    // THEN
    expect(stack).toHaveResource('AWS::ElasticLoadBalancingV2::TargetGroup', {
      HealthCheckEnabled: true,
      HealthCheckIntervalSeconds: 255,
      HealthCheckPath: '/arbitrary',
      HealthCheckTimeoutSeconds: 192,
      HealthyThresholdCount: 29,
      Matcher: {
        HttpCode: '255',
      },
      Port: 80,
      UnhealthyThresholdCount: 27,
    });
  });

  test('Load balancer duration cookie stickiness', () => {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'Stack');
    const vpc = new ec2.Vpc(stack, 'VPC', {});

    // WHEN
    new elbv2.ApplicationTargetGroup(stack, 'TargetGroup', {
      stickinessCookieDuration: cdk.Duration.minutes(5),
      vpc,
    });

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
          Value: '300',
        },
      ],
    });
  });

  test('Load balancer app cookie stickiness', () => {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'Stack');
    const vpc = new ec2.Vpc(stack, 'VPC', {});

    // WHEN
    new elbv2.ApplicationTargetGroup(stack, 'TargetGroup', {
      stickinessCookieDuration: cdk.Duration.minutes(5),
      stickinessCookieName: 'MyDeliciousCookie',
      vpc,
    });

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
          Value: '300',
        },
      ],
    });
  });

  test('Bad stickiness cookie names example', () => {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'Stack');
    const vpc = new ec2.Vpc(stack, 'VPC', {});

    // THEN
    expect(() => {
      new elbv2.ApplicationTargetGroup(stack, 'TargetGroup1', {
        stickinessCookieDuration: cdk.Duration.minutes(5),
        stickinessCookieName: 'AWSALBCookieName',
        vpc,
      });
    }).toThrow(/App cookie names that start with the following prefixes are not allowed: AWSALB, AWSALBAPP, and AWSALBTG; they're reserved for use by the load balancer./);

    expect(() => {
      new elbv2.ApplicationTargetGroup(stack, 'TargetGroup2', {
        stickinessCookieDuration: cdk.Duration.minutes(5),
        stickinessCookieName: 'AWSALBstickinessCookieName',
        vpc,
      });
    }).toThrow(/App cookie names that start with the following prefixes are not allowed: AWSALB, AWSALBAPP, and AWSALBTG; they're reserved for use by the load balancer./);

    expect(() => {
      new elbv2.ApplicationTargetGroup(stack, 'TargetGroup3', {
        stickinessCookieDuration: cdk.Duration.minutes(5),
        stickinessCookieName: 'AWSALBTGCookieName',
        vpc,
      });
    }).toThrow(/App cookie names that start with the following prefixes are not allowed: AWSALB, AWSALBAPP, and AWSALBTG; they're reserved for use by the load balancer./);
  });

  test('Empty stickiness cookie name', () => {
    // GIVEN
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'Stack');
    const vpc = new ec2.Vpc(stack, 'VPC', {});

    // THEN
    expect(() => {
      new elbv2.ApplicationTargetGroup(stack, 'TargetGroup', {
        stickinessCookieDuration: cdk.Duration.minutes(5),
        stickinessCookieName: '',
        vpc,
      });
    }).toThrow(/App cookie name cannot be an empty string./);
  });
});
