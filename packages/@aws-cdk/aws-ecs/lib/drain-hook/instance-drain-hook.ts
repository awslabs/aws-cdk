import * as fs from 'fs';
import * as path from 'path';
import * as autoscaling from '@aws-cdk/aws-autoscaling';
import * as hooks from '@aws-cdk/aws-autoscaling-hooktargets';
import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import * as lambda from '@aws-cdk/aws-lambda';
import * as cdk from '@aws-cdk/core';
import { Construct } from 'constructs';
import { ICluster } from '../cluster';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct as CoreConstruct } from '@aws-cdk/core';

// Reference for the source in this package:
//
// https://github.com/aws-samples/ecs-refarch-cloudformation/blob/master/infrastructure/lifecyclehook.yaml

/**
 * Properties for instance draining hook
 */
export interface InstanceDrainHookProps {
  /**
   * The AutoScalingGroup to install the instance draining hook for
   */
  autoScalingGroup: autoscaling.IAutoScalingGroup;

  /**
   * The cluster on which tasks have been scheduled
   */
  cluster: ICluster;

  /**
   * How many seconds to give tasks to drain before the instance is terminated anyway
   *
   * Must be between 0 and 15 minutes.
   *
   * @default Duration.minutes(15)
   */
  drainTime?: cdk.Duration;

  /**
   * The InstanceDrainHook creates an SNS topic for the lifecycle hook of the ASG. If provided, then this
   * key will be used to encrypt the contents of that SNS Topic.
   * See [SNS Data Encryption](https://docs.aws.amazon.com/sns/latest/dg/sns-data-encryption.html) for more information.
   *
   * @default The SNS Topic will not be encrypted.
   */
  topicEncryptionKey?: kms.IKey;
}

/**
 * A hook to drain instances from ECS traffic before they're terminated
 */
export class InstanceDrainHook extends CoreConstruct {
  /**
   * Constructs a new instance of the InstanceDrainHook class.
   */
  constructor(scope: Construct, id: string, props: InstanceDrainHookProps) {
    super(scope, id);

    const drainTime = props.drainTime || cdk.Duration.minutes(5);

    // Invoke Lambda via SNS Topic
    const fn = new lambda.Function(this, 'Function', {
      code: lambda.Code.fromInline(fs.readFileSync(path.join(__dirname, 'lambda-source', 'index.py'), { encoding: 'utf-8' })),
      handler: 'index.lambda_handler',
      runtime: lambda.Runtime.PYTHON_3_6,
      // Timeout: some extra margin for additional API calls made by the Lambda,
      // up to a maximum of 15 minutes.
      timeout: cdk.Duration.seconds(Math.min(drainTime.toSeconds() + 10, 900)),
      environment: {
        CLUSTER: props.cluster.clusterName,
      },
    });

    // Hook everything up: ASG -> Topic, Topic -> Lambda
    props.autoScalingGroup.addLifecycleHook('DrainHook', {
      lifecycleTransition: autoscaling.LifecycleTransition.INSTANCE_TERMINATING,
      defaultResult: autoscaling.DefaultResult.CONTINUE,
      notificationTarget: new hooks.FunctionHook(fn, props.topicEncryptionKey),
      heartbeatTimeout: drainTime,
    });

    // Describe actions cannot be restricted and restrict the CompleteLifecycleAction to the ASG arn
    // https://docs.aws.amazon.com/autoscaling/ec2/userguide/control-access-using-iam.html
    fn.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'ec2:DescribeInstances',
        'ec2:DescribeInstanceAttribute',
        'ec2:DescribeInstanceStatus',
        'ec2:DescribeHosts',
      ],
      resources: ['*'],
    }));

    // Restrict to the ASG
    fn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['autoscaling:CompleteLifecycleAction'],
      resources: [props.autoScalingGroup.autoScalingGroupArn],
    }));

    fn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ecs:DescribeContainerInstances', 'ecs:DescribeTasks'],
      resources: ['*'],
      conditions: {
        ArnEquals: { 'ecs:cluster': props.cluster.clusterArn },
      },
    }));

    // Restrict to the ECS Cluster
    fn.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'ecs:ListContainerInstances',
        'ecs:SubmitContainerStateChange',
        'ecs:SubmitTaskStateChange',
      ],
      resources: [props.cluster.clusterArn],
    }));

    // Restrict the container-instance operations to the ECS Cluster
    fn.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'ecs:UpdateContainerInstancesState',
        'ecs:ListTasks',
      ],
      conditions: {
        ArnEquals: { 'ecs:cluster': props.cluster.clusterArn },
      },
      resources: ['*'],
    }));
  }
}
