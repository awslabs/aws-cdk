import { expect, haveOutput, haveResource, SynthUtils } from '@aws-cdk/assert';
import * as autoscaling from '@aws-cdk/aws-autoscaling';
import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as lbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as cdk from '@aws-cdk/core';
import { Test } from 'nodeunit';
import * as codedeploy from '../../lib';

/* eslint-disable quote-props */

export = {
  'CodeDeploy Server Deployment Group': {
    'can be created by explicitly passing an Application'(test: Test) {
      const stack = new cdk.Stack();

      const application = new codedeploy.ServerApplication(stack, 'MyApp');
      new codedeploy.ServerDeploymentGroup(stack, 'MyDG', {
        application,
      });

      expect(stack).to(haveResource('AWS::CodeDeploy::DeploymentGroup', {
        'ApplicationName': {
          'Ref': 'MyApp3CE31C26',
        },
      }));

      test.done();
    },

    'creating an application with physical name if needed'(test: Test) {
      const stack = new cdk.Stack(undefined, undefined, { env: { account: '12345', region: 'us-test-1' } });
      const stack2 = new cdk.Stack(undefined, undefined, { env: { account: '12346', region: 'us-test-2' } });
      const serverDeploymentGroup = new codedeploy.ServerDeploymentGroup(stack, 'MyDG', {
        deploymentGroupName: cdk.PhysicalName.GENERATE_IF_NEEDED,
      });

      new cdk.CfnOutput(stack2, 'Output', {
        value: serverDeploymentGroup.application.applicationName,
      });

      expect(stack2).to(haveOutput({
        outputName: 'Output',
        outputValue: 'defaultmydgapplication78dba0bb0c7580b32033',
      }));

      test.done();
    },

    'can be imported'(test: Test) {
      const stack = new cdk.Stack();

      const application = codedeploy.ServerApplication.fromServerApplicationName(stack, 'MyApp', 'MyApp');
      const deploymentGroup = codedeploy.ServerDeploymentGroup.fromServerDeploymentGroupAttributes(stack, 'MyDG', {
        application,
        deploymentGroupName: 'MyDG',
      });

      test.notEqual(deploymentGroup, undefined);

      test.done();
    },

    'uses good linux install agent script'(test: Test) {
      const stack = new cdk.Stack();

      const asg = new autoscaling.AutoScalingGroup(stack, 'ASG', {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.STANDARD3, ec2.InstanceSize.SMALL),
        machineImage: new ec2.AmazonLinuxImage(),
        vpc: new ec2.Vpc(stack, 'VPC'),
      });

      new codedeploy.ServerDeploymentGroup(stack, 'DeploymentGroup', {
        autoScalingGroups: [asg],
        installAgent: true,
      });

      expect(stack).to(haveResource('AWS::AutoScaling::LaunchConfiguration', {
        'UserData': {
          'Fn::Base64': {
            'Fn::Join': [
              '',
              [
                '#!/bin/bash\nset +e\nPKG_CMD=`which yum 2>/dev/null`\nset -e\nif [ -z "$PKG_CMD" ]; then\nPKG_CMD=apt-get\nelse\nPKG_CMD=yum\nfi\n$PKG_CMD update -y\nset +e\n$PKG_CMD install -y ruby2.0\nRUBY2_INSTALL=$?\nset -e\nif [ $RUBY2_INSTALL -ne 0 ]; then\n$PKG_CMD install -y ruby\nfi\nAWS_CLI_PACKAGE_NAME=awscli\nif [ "$PKG_CMD" = "yum" ]; then\nAWS_CLI_PACKAGE_NAME=aws-cli\nfi\n$PKG_CMD install -y $AWS_CLI_PACKAGE_NAME\nTMP_DIR=`mktemp -d`\ncd $TMP_DIR\naws s3 cp s3://aws-codedeploy-',
                {
                  'Ref': 'AWS::Region',
                },
                '/latest/install . --region ',
                {
                  'Ref': 'AWS::Region',
                },
                '\nchmod +x ./install\n./install auto\nrm -fr $TMP_DIR',
              ],
            ],
          },
        },
      }));

      test.done();
    },

    'uses good windows install agent script'(test: Test) {
      const stack = new cdk.Stack();

      const asg = new autoscaling.AutoScalingGroup(stack, 'ASG', {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.STANDARD3, ec2.InstanceSize.SMALL),
        machineImage: new ec2.WindowsImage(ec2.WindowsVersion.WINDOWS_SERVER_2019_ENGLISH_FULL_BASE, {}),
        vpc: new ec2.Vpc(stack, 'VPC'),
      });

      new codedeploy.ServerDeploymentGroup(stack, 'DeploymentGroup', {
        autoScalingGroups: [asg],
        installAgent: true,
      });

      expect(stack).to(haveResource('AWS::AutoScaling::LaunchConfiguration', {
        'UserData': {
          'Fn::Base64': {
            'Fn::Join': [
              '',
              [
                '<powershell>Set-Variable -Name TEMPDIR -Value (New-TemporaryFile).DirectoryName\naws s3 cp s3://aws-codedeploy-',
                {
                  'Ref': 'AWS::Region',
                },
                '/latest/codedeploy-agent.msi $TEMPDIR\\codedeploy-agent.msi\ncd $TEMPDIR\n.\\codedeploy-agent.msi /quiet /l c:\\temp\\host-agent-install-log.txt</powershell>',
              ],
            ],
          },
        },
      }));

      test.done();
    },

    'created with ASGs contains the ASG names'(test: Test) {
      const stack = new cdk.Stack();

      const asg = new autoscaling.AutoScalingGroup(stack, 'ASG', {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.STANDARD3, ec2.InstanceSize.SMALL),
        machineImage: new ec2.AmazonLinuxImage(),
        vpc: new ec2.Vpc(stack, 'VPC'),
      });

      new codedeploy.ServerDeploymentGroup(stack, 'DeploymentGroup', {
        autoScalingGroups: [asg],
      });

      expect(stack).to(haveResource('AWS::CodeDeploy::DeploymentGroup', {
        'AutoScalingGroups': [
          {
            'Ref': 'ASG46ED3070',
          },
        ],
      }));

      test.done();
    },

    'created without ASGs but adding them later contains the ASG names'(test: Test) {
      const stack = new cdk.Stack();

      const asg = new autoscaling.AutoScalingGroup(stack, 'ASG', {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.STANDARD3, ec2.InstanceSize.SMALL),
        machineImage: new ec2.AmazonLinuxImage(),
        vpc: new ec2.Vpc(stack, 'VPC'),
      });

      const deploymentGroup = new codedeploy.ServerDeploymentGroup(stack, 'DeploymentGroup');
      deploymentGroup.addAutoScalingGroup(asg);

      expect(stack).to(haveResource('AWS::CodeDeploy::DeploymentGroup', {
        'AutoScalingGroups': [
          {
            'Ref': 'ASG46ED3070',
          },
        ],
      }));

      test.done();
    },

    'can be created with an ALB Target Group as the load balancer'(test: Test) {
      const stack = new cdk.Stack();

      const alb = new lbv2.ApplicationLoadBalancer(stack, 'ALB', {
        vpc: new ec2.Vpc(stack, 'VPC'),
      });
      const listener = alb.addListener('Listener', { protocol: lbv2.ApplicationProtocol.HTTP });
      const targetGroup = listener.addTargets('Fleet', { protocol: lbv2.ApplicationProtocol.HTTP });

      new codedeploy.ServerDeploymentGroup(stack, 'DeploymentGroup', {
        loadBalancer: codedeploy.LoadBalancer.application(targetGroup),
      });

      expect(stack).to(haveResource('AWS::CodeDeploy::DeploymentGroup', {
        'LoadBalancerInfo': {
          'TargetGroupInfoList': [
            {
              'Name': {
                'Fn::GetAtt': [
                  'ALBListenerFleetGroup008CEEE4',
                  'TargetGroupName',
                ],
              },
            },
          ],
        },
        'DeploymentStyle': {
          'DeploymentOption': 'WITH_TRAFFIC_CONTROL',
        },
      }));

      test.done();
    },

    'can be created with an NLB Target Group as the load balancer'(test: Test) {
      const stack = new cdk.Stack();

      const nlb = new lbv2.NetworkLoadBalancer(stack, 'NLB', {
        vpc: new ec2.Vpc(stack, 'VPC'),
      });
      const listener = nlb.addListener('Listener', { port: 80 });
      const targetGroup = listener.addTargets('Fleet', { port: 80 });

      new codedeploy.ServerDeploymentGroup(stack, 'DeploymentGroup', {
        loadBalancer: codedeploy.LoadBalancer.network(targetGroup),
      });

      expect(stack).to(haveResource('AWS::CodeDeploy::DeploymentGroup', {
        'LoadBalancerInfo': {
          'TargetGroupInfoList': [
            {
              'Name': {
                'Fn::GetAtt': [
                  'NLBListenerFleetGroupB882EC86',
                  'TargetGroupName',
                ],
              },
            },
          ],
        },
        'DeploymentStyle': {
          'DeploymentOption': 'WITH_TRAFFIC_CONTROL',
        },
      }));

      test.done();
    },

    'can be created with a single EC2 instance tag set with a single or no value'(test: Test) {
      const stack = new cdk.Stack();

      new codedeploy.ServerDeploymentGroup(stack, 'DeploymentGroup', {
        ec2InstanceTags: new codedeploy.InstanceTagSet(
          {
            'some-key': ['some-value'],
            'other-key': [],
          },
        ),
      });

      expect(stack).to(haveResource('AWS::CodeDeploy::DeploymentGroup', {
        'Ec2TagSet': {
          'Ec2TagSetList': [
            {
              'Ec2TagGroup': [
                {
                  'Key': 'some-key',
                  'Value': 'some-value',
                  'Type': 'KEY_AND_VALUE',
                },
                {
                  'Key': 'other-key',
                  'Type': 'KEY_ONLY',
                },
              ],
            },
          ],
        },
      }));

      test.done();
    },

    'can be created with two on-premise instance tag sets with multiple values or without a key'(test: Test) {
      const stack = new cdk.Stack();

      new codedeploy.ServerDeploymentGroup(stack, 'DeploymentGroup', {
        onPremiseInstanceTags: new codedeploy.InstanceTagSet(
          {
            'some-key': ['some-value', 'another-value'],
          },
          {
            '': ['keyless-value'],
          },
        ),
      });

      expect(stack).to(haveResource('AWS::CodeDeploy::DeploymentGroup', {
        'OnPremisesTagSet': {
          'OnPremisesTagSetList': [
            {
              'OnPremisesTagGroup': [
                {
                  'Key': 'some-key',
                  'Value': 'some-value',
                  'Type': 'KEY_AND_VALUE',
                },
                {
                  'Key': 'some-key',
                  'Value': 'another-value',
                  'Type': 'KEY_AND_VALUE',
                },
              ],
            },
            {
              'OnPremisesTagGroup': [
                {
                  'Value': 'keyless-value',
                  'Type': 'VALUE_ONLY',
                },
              ],
            },
          ],
        },
      }));

      test.done();
    },

    'cannot be created with an instance tag set containing a keyless, valueless filter'(test: Test) {
      const stack = new cdk.Stack();

      test.throws(() => {
        new codedeploy.ServerDeploymentGroup(stack, 'DeploymentGroup', {
          onPremiseInstanceTags: new codedeploy.InstanceTagSet({
            '': [],
          }),
        });
      });

      test.done();
    },

    'cannot be created with an instance tag set containing 4 instance tag groups'(test: Test) {
      const stack = new cdk.Stack();

      test.throws(() => {
        new codedeploy.ServerDeploymentGroup(stack, 'DeploymentGroup', {
          onPremiseInstanceTags: new codedeploy.InstanceTagSet({}, {}, {}, {}),
        });
      }, /3/);

      test.done();
    },

    'can have alarms added to it after being created'(test: Test) {
      const stack = new cdk.Stack();

      const alarm = new cloudwatch.Alarm(stack, 'Alarm1', {
        metric: new cloudwatch.Metric({
          metricName: 'Errors',
          namespace: 'my.namespace',
        }),
        threshold: 1,
        evaluationPeriods: 1,
      });

      const deploymentGroup = new codedeploy.ServerDeploymentGroup(stack, 'DeploymentGroup');
      deploymentGroup.addAlarm(alarm);

      expect(stack).to(haveResource('AWS::CodeDeploy::DeploymentGroup', {
        'AlarmConfiguration': {
          'Alarms': [
            {
              'Name': {
                'Ref': 'Alarm1F9009D71',
              },
            },
          ],
          'Enabled': true,
        },
      }));

      test.done();
    },

    'only automatically rolls back failed deployments by default'(test: Test) {
      const stack = new cdk.Stack();

      new codedeploy.ServerDeploymentGroup(stack, 'DeploymentGroup');

      expect(stack).to(haveResource('AWS::CodeDeploy::DeploymentGroup', {
        'AutoRollbackConfiguration': {
          'Enabled': true,
          'Events': [
            'DEPLOYMENT_FAILURE',
          ],
        },
      }));

      test.done();
    },

    'rolls back alarmed deployments if at least one alarm has been added'(test: Test) {
      const stack = new cdk.Stack();

      const alarm = new cloudwatch.Alarm(stack, 'Alarm1', {
        metric: new cloudwatch.Metric({
          metricName: 'Errors',
          namespace: 'my.namespace',
        }),
        threshold: 1,
        evaluationPeriods: 1,
      });

      const deploymentGroup = new codedeploy.ServerDeploymentGroup(stack, 'DeploymentGroup', {
        autoRollback: {
          failedDeployment: false,
        },
      });
      deploymentGroup.addAlarm(alarm);

      expect(stack).to(haveResource('AWS::CodeDeploy::DeploymentGroup', {
        'AutoRollbackConfiguration': {
          'Enabled': true,
          'Events': [
            'DEPLOYMENT_STOP_ON_ALARM',
          ],
        },
      }));

      test.done();
    },

    'setting to roll back on alarms without providing any results in an exception'(test: Test) {
      const stack = new cdk.Stack();

      new codedeploy.ServerDeploymentGroup(stack, 'DeploymentGroup', {
        autoRollback: {
          deploymentInAlarm: true,
        },
      });

      test.throws(() => SynthUtils.toCloudFormation(stack), /deploymentInAlarm/);
      test.done();
    },
  },
};
