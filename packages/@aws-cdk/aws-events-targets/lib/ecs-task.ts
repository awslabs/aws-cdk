import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as events from '@aws-cdk/aws-events';
import { ContainerOverride } from '@aws-cdk/aws-events-targets';
import * as iam from '@aws-cdk/aws-iam';
import { singletonEventRole } from './util';

/**
 * Properties to define an ECS Event Task
 */
export interface EcsTaskProps {
  /**
   * Cluster where service will be deployed
   */
  readonly cluster: ecs.ICluster;

  /**
   * Version of Fargate platform
   */
  readonly fargatePlatformVersion: ecs.FargatePlatformVersion;

  /**
   * Task Definition of the task that should be started
   */
  readonly taskDefinition: ecs.TaskDefinition;

  /**
   * How many tasks should be started when this event is triggered
   *
   * @default 1
   */
  readonly taskCount?: number;

  /**
   * Container setting overrides
   *
   * Key is the name of the container to override, value is the
   * values you want to override.
   */
  readonly containerOverrides?: ContainerOverride[];

  /**
   * In what subnets to place the task's ENIs
   *
   * (Only applicable in case the TaskDefinition is configured for AwsVpc networking)
   *
   * @default Private subnets
   */
  readonly subnetSelection?: ec2.SubnetSelection;

  /**
   * Existing security group to use for the task's ENIs
   *
   * (Only applicable in case the TaskDefinition is configured for AwsVpc networking)
   *
   * @default A new security group is created
   */
  readonly securityGroup?: ec2.ISecurityGroup;
}

/**
 * Start a task on an ECS cluster
 */
export class EcsTask implements events.IRuleTarget {
  public readonly securityGroup?: ec2.ISecurityGroup;
  public readonly fargatePlatformVersion?: ecs.FargatePlatformVersion;
  private readonly cluster: ecs.ICluster;
  private readonly taskDefinition: ecs.TaskDefinition;
  private readonly taskCount: number;

  constructor(private readonly props: EcsTaskProps) {
    this.cluster = props.cluster;
    this.taskDefinition = props.taskDefinition;
    this.taskCount = props.taskCount !== undefined ? props.taskCount : 1;
    this.fargatePlatformVersion =
      props.fargatePlatformVersion !== undefined
        ? props.fargatePlatformVersion
        : ecs.FargatePlatformVersion.LATEST;

    if (this.taskDefinition.networkMode === ecs.NetworkMode.AWS_VPC) {
      const securityGroup =
        props.securityGroup ||
        (this.taskDefinition.node.tryFindChild(
          'SecurityGroup'
        ) as ec2.ISecurityGroup);
      this.securityGroup =
        securityGroup ||
        new ec2.SecurityGroup(this.taskDefinition, 'SecurityGroup', {
          vpc: this.props.cluster.vpc
        });
    }
  }

  /**
   * Allows using tasks as target of CloudWatch events
   */
  public bind(_rule: events.IRule, _id?: string): events.RuleTargetConfig {
    const policyStatements = [
      new iam.PolicyStatement({
        actions: ['ecs:RunTask'],
        resources: [this.taskDefinition.taskDefinitionArn],
        conditions: {
          ArnEquals: { 'ecs:cluster': this.cluster.clusterArn }
        }
      })
    ];

    // If it so happens that a Task Execution Role was created for the TaskDefinition,
    // then the CloudWatch Events Role must have permissions to pass it (otherwise it doesn't).
    if (this.taskDefinition.executionRole !== undefined) {
      policyStatements.push(
        new iam.PolicyStatement({
          actions: ['iam:PassRole'],
          resources: [this.taskDefinition.executionRole.roleArn]
        })
      );
    }

    // For Fargate task we need permission to pass the task role.
    if (this.taskDefinition.isFargateCompatible) {
      policyStatements.push(
        new iam.PolicyStatement({
          actions: ['iam:PassRole'],
          resources: [this.taskDefinition.taskRole.roleArn]
        })
      );
    }

    const arn = this.cluster.clusterArn;
    const role = singletonEventRole(this.taskDefinition, policyStatements);
    const containerOverrides =
      this.props.containerOverrides &&
      this.props.containerOverrides.map(({ containerName, ...overrides }) => ({
        name: containerName,
        ...overrides
      }));
    const input = { containerOverrides };
    const taskCount = this.taskCount;
    const taskDefinitionArn = this.taskDefinition.taskDefinitionArn;

    const subnetSelection = this.props.subnetSelection || {
      subnetType: ec2.SubnetType.PRIVATE
    };
    const assignPublicIp =
      subnetSelection.subnetType === ec2.SubnetType.PUBLIC
        ? 'ENABLED'
        : 'DISABLED';

    const baseEcsParameters = { taskCount, taskDefinitionArn };

    const ecsParameters: events.CfnRule.EcsParametersProperty =
      this.taskDefinition.networkMode === ecs.NetworkMode.AWS_VPC
        ? {
            ...baseEcsParameters,
            launchType: this.taskDefinition.isEc2Compatible ? 'EC2' : 'FARGATE',
            platformVersion: this.fargatePlatformVersion,
            networkConfiguration: {
              awsVpcConfiguration: {
                subnets: this.props.cluster.vpc.selectSubnets(subnetSelection)
                  .subnetIds,
                assignPublicIp,
                securityGroups: this.securityGroup && [
                  this.securityGroup.securityGroupId
                ]
              }
            }
          }
        : baseEcsParameters;

    return {
      id: '',
      arn,
      role,
      ecsParameters,
      input: events.RuleTargetInput.fromObject(input),
      targetResource: this.taskDefinition
    };
  }
}
