import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as iam from '@aws-cdk/aws-iam';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import { getResourceArn } from '../resource-arn-suffix';
import { ContainerOverride } from './run-ecs-task-base-types';

/**
 * Basic properties for ECS Tasks
 */
export interface CommonEcsRunTaskProps {
  /**
   * The topic to run the task on
   */
  readonly cluster: ecs.ICluster;

  /**
   * Task Definition used for running tasks in the service.
   *
   * Note: this must be TaskDefinition, and not ITaskDefinition,
   * as it requires properties that are not known for imported task definitions
   */
  readonly taskDefinition: ecs.TaskDefinition;

  /**
   * Container setting overrides
   *
   * Key is the name of the container to override, value is the
   * values you want to override.
   *
   * @default - No overrides
   */
  readonly containerOverrides?: ContainerOverride[];

  /**
   * The service integration pattern indicates different ways to call RunTask in ECS.
   *
   * The valid value for Lambda is FIRE_AND_FORGET, SYNC and WAIT_FOR_TASK_TOKEN.
   *
   * @default FIRE_AND_FORGET
   */
  readonly integrationPattern?: sfn.ServiceIntegrationPattern;
}

/**
 * Construction properties for the BaseRunTaskProps
 * @deprecated No replacement
 */
export interface EcsRunTaskBaseProps extends CommonEcsRunTaskProps {
  /**
   * Additional parameters to pass to the base task
   *
   * @default - No additional parameters passed
   */
  readonly parameters?: {[key: string]: any};
}

/**
 * A StepFunctions Task to run a Task on ECS or Fargate
 * @deprecated No replacement
 */
export class EcsRunTaskBase implements ec2.IConnectable, sfn.IStepFunctionsTask {
  /**
   * Manage allowed network traffic for this service
   */
  public readonly connections: ec2.Connections = new ec2.Connections();

  private securityGroup?: ec2.ISecurityGroup;
  private networkConfiguration?: any;
  private readonly integrationPattern: sfn.ServiceIntegrationPattern;

  constructor(private readonly props: EcsRunTaskBaseProps) {
    this.integrationPattern = props.integrationPattern || sfn.ServiceIntegrationPattern.FIRE_AND_FORGET;

    const supportedPatterns = [
      sfn.ServiceIntegrationPattern.FIRE_AND_FORGET,
      sfn.ServiceIntegrationPattern.WAIT_FOR_TASK_TOKEN,
      sfn.ServiceIntegrationPattern.SYNC,
    ];

    if (!supportedPatterns.includes(this.integrationPattern)) {
      throw new Error(`Invalid Service Integration Pattern: ${this.integrationPattern} is not supported to call ECS.`);
    }

    if (this.integrationPattern === sfn.ServiceIntegrationPattern.WAIT_FOR_TASK_TOKEN
      && !sfn.FieldUtils.containsTaskToken(props.containerOverrides?.map(override => override.environment))) {
      throw new Error('Task Token is required in at least one `containerOverrides.environment` for callback. Use JsonPath.taskToken to set the token.');
    }

    for (const override of this.props.containerOverrides || []) {
      const name = override.containerDefinition.containerName;
      if (!cdk.Token.isUnresolved(name)) {
        const cont = this.props.taskDefinition.node.tryFindChild(name);
        if (!cont) {
          throw new Error(`Overrides mention container with name '${name}', but no such container in task definition`);
        }
      }
    }
  }

  public bind(task: sfn.Task): sfn.StepFunctionsTaskConfig {
    if (this.networkConfiguration !== undefined) {
      // Make sure we have a security group if we're using AWSVPC networking
      if (this.securityGroup === undefined) {
        this.securityGroup = new ec2.SecurityGroup(task, 'SecurityGroup', { vpc: this.props.cluster.vpc });
      }
      this.connections.addSecurityGroup(this.securityGroup);
    }

    return {
      resourceArn: getResourceArn('ecs', 'runTask', this.integrationPattern),
      parameters: {
        Cluster: this.props.cluster.clusterArn,
        TaskDefinition: this.props.taskDefinition.taskDefinitionArn,
        NetworkConfiguration: this.networkConfiguration,
        Overrides: renderOverrides(this.props.containerOverrides),
        ...this.props.parameters,
      },
      policyStatements: this.makePolicyStatements(task),
    };
  }

  protected configureAwsVpcNetworking(
    vpc: ec2.IVpc,
    assignPublicIp?: boolean,
    subnetSelection?: ec2.SubnetSelection,
    securityGroup?: ec2.ISecurityGroup) {

    if (subnetSelection === undefined) {
      subnetSelection = { subnetType: assignPublicIp ? ec2.SubnetType.PUBLIC : ec2.SubnetType.PRIVATE };
    }

    // If none is given here, one will be created later on during bind()
    this.securityGroup = securityGroup;

    this.networkConfiguration = {
      AwsvpcConfiguration: {
        AssignPublicIp: assignPublicIp !== undefined ? (assignPublicIp ? 'ENABLED' : 'DISABLED') : undefined,
        Subnets: vpc.selectSubnets(subnetSelection).subnetIds,
        SecurityGroups: cdk.Lazy.list({ produce: () => [this.securityGroup!.securityGroupId] }),
      },
    };
  }

  private makePolicyStatements(task: sfn.Task): iam.PolicyStatement[] {
    const stack = cdk.Stack.of(task);

    // https://docs.aws.amazon.com/step-functions/latest/dg/ecs-iam.html
    const policyStatements = [
      new iam.PolicyStatement({
        actions: ['ecs:RunTask'],
        resources: [this.props.taskDefinition.taskDefinitionArn],
      }),
      new iam.PolicyStatement({
        actions: ['ecs:StopTask', 'ecs:DescribeTasks'],
        resources: ['*'],
      }),
      new iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: cdk.Lazy.list({ produce: () => this.taskExecutionRoles().map(r => r.roleArn) }),
      }),
    ];

    if (this.integrationPattern === sfn.ServiceIntegrationPattern.SYNC) {
      policyStatements.push(new iam.PolicyStatement({
        actions: ['events:PutTargets', 'events:PutRule', 'events:DescribeRule'],
        resources: [stack.formatArn({
          service: 'events',
          resource: 'rule',
          resourceName: 'StepFunctionsGetEventsForECSTaskRule',
        })],
      }));
    }

    return policyStatements;
  }

  private taskExecutionRoles(): iam.IRole[] {
    // Need to be able to pass both Task and Execution role, apparently
    const ret = new Array<iam.IRole>();
    ret.push(this.props.taskDefinition.taskRole);
    if (this.props.taskDefinition.executionRole) {
      ret.push(this.props.taskDefinition.executionRole);
    }
    return ret;
  }
}

function renderOverrides(containerOverrides?: ContainerOverride[]) {
  if (!containerOverrides) { return undefined; }

  const ret = new Array<any>();
  for (const override of containerOverrides) {
    ret.push({
      Name: override.containerDefinition.containerName,
      Command: override.command,
      Cpu: override.cpu,
      Memory: override.memoryLimit,
      MemoryReservation: override.memoryReservation,
      Environment: override.environment && override.environment.map(e => ({
        Name: e.name,
        Value: e.value,
      })),
    });
  }

  return { ContainerOverrides: ret };
}
