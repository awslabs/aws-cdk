import ec2 = require('@aws-cdk/aws-ec2');
import ecs = require('@aws-cdk/aws-ecs');
import iam = require('@aws-cdk/aws-iam');
import stepfunctions = require('@aws-cdk/aws-stepfunctions');
import cdk = require('@aws-cdk/cdk');

/**
 * Properties for SendMessageTask
 */
export interface CommonRunTaskProps extends stepfunctions.BasicTaskProps {
  /**
   * The topic to run the task on
   */
  readonly cluster: ecs.ICluster;

  /**
   * Task Definition used for running tasks in the service
   */
  readonly taskDefinition: ecs.TaskDefinition;

  /**
   * Container setting overrides
   *
   * Key is the name of the container to override, value is the
   * values you want to override.
   */
  readonly containerOverrides?: ContainerOverride[];

  /**
   * Whether to wait for the task to complete and return the response
   *
   * @default true
   */
  readonly synchronous?: boolean;
}

/**
 * Construction properties for the BaseRunTaskProps
 */
export interface BaseRunTaskProps extends CommonRunTaskProps {
  /**
   * Additional parameters to pass to the base task
   */
  readonly parameters?: {[key: string]: any};
}

export interface ContainerOverride {
  /**
   * Name of the container inside the task definition
   *
   * Exactly one of `containerName` and `containerNamePath` is required.
   */
  readonly containerName?: string;

  /**
   * JSONPath expression for the name of the container inside the task definition
   *
   * Exactly one of `containerName` and `containerNamePath` is required.
   */
  readonly containerNamePath?: string;

  /**
   * Command to run inside the container
   *
   * @default Default command
   */
  readonly command?: string[];

  /**
   * JSON expression for command to run inside the container
   *
   * @default Default command
   */
  readonly commandPath?: string;

  /**
   * Variables to set in the container's environment
   */
  readonly environment?: TaskEnvironmentVariable[];

  /**
   * The number of cpu units reserved for the container
   *
   * @Default The default value from the task definition.
   */
  readonly cpu?: number;

  /**
   * JSON expression for the number of CPU units
   *
   * @Default The default value from the task definition.
   */
  readonly cpuPath?: string;

  /**
   * Hard memory limit on the container
   *
   * @Default The default value from the task definition.
   */
  readonly memoryLimit?: number;

  /**
   * JSON expression path for the hard memory limit
   *
   * @Default The default value from the task definition.
   */
  readonly memoryLimitPath?: string;

  /**
   * Soft memory limit on the container
   *
   * @Default The default value from the task definition.
   */
  readonly memoryReservation?: number;

  /**
   * JSONExpr path for memory limit on the container
   *
   * @Default The default value from the task definition.
   */
  readonly memoryReservationPath?: number;
}

/**
 * An environment variable to be set in the container run as a task
 */
export interface TaskEnvironmentVariable {
  /**
   * Name for the environment variable
   *
   * Exactly one of `name` and `namePath` must be specified.
   */
  readonly name?: string;

  /**
   * JSONExpr for the name of the variable
   *
   * Exactly one of `name` and `namePath` must be specified.
   */
  readonly namePath?: string;

  /**
   * Value of the environment variable
   *
   * Exactly one of `value` and `valuePath` must be specified.
   */
  readonly value?: string;

  /**
   * JSONPath expr for the environment variable
   *
   * Exactly one of `value` and `valuePath` must be specified.
   */
  readonly valuePath?: string;
}

/**
 * A StepFunctions Task to run a Task on ECS or Fargate
 */
export class BaseRunTask extends stepfunctions.Task implements ec2.IConnectable {
  /**
   * Manage allowed network traffic for this service
   */
  public readonly connections: ec2.Connections = new ec2.Connections();

  protected networkConfiguration?: any;
  protected readonly taskDefinition: ecs.TaskDefinition;
  private readonly sync: boolean;

  constructor(scope: cdk.Construct, id: string, props: BaseRunTaskProps) {
    super(scope, id, {
      ...props,
      resourceArn: 'arn:aws:states:::ecs:runTask' + (props.synchronous !== false ? '.sync' : ''),
      parameters: {
        Cluster: props.cluster.clusterArn,
        TaskDefinition: props.taskDefinition.taskDefinitionArn,
        NetworkConfiguration: new cdk.Token(() => this.networkConfiguration),
        Overrides: renderOverrides(props.containerOverrides),
        ...props.parameters,
      }
    });

    this.sync = props.synchronous !== false;
    this.taskDefinition = props.taskDefinition;
  }

  protected configureAwsVpcNetworking(
      vpc: ec2.IVpcNetwork,
      assignPublicIp?: boolean,
      subnetSelection?: ec2.SubnetSelection,
      securityGroup?: ec2.ISecurityGroup) {
    if (subnetSelection === undefined) {
      subnetSelection = { subnetType: assignPublicIp ? ec2.SubnetType.Public : ec2.SubnetType.Private };
    }
    if (securityGroup === undefined) {
      securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', { vpc });
    }
    const subnets = vpc.selectSubnets(subnetSelection);
    this.connections.addSecurityGroup(securityGroup);

    this.networkConfiguration = {
      AwsvpcConfiguration: {
        AssignPublicIp: assignPublicIp ? 'ENABLED' : 'DISABLED',
        Subnets: subnets.subnetIds,
        SecurityGroups: new cdk.Token(() => [securityGroup!.securityGroupId]),
      }
    };
  }

  protected onBindToGraph(graph: stepfunctions.StateGraph) {
    super.onBindToGraph(graph);

    const stack = this.node.stack;

    // https://docs.aws.amazon.com/step-functions/latest/dg/ecs-iam.html
    const policyStatements = [
      new iam.PolicyStatement()
        .addAction('ecs:RunTask')
        .addResource(this.taskDefinition.taskDefinitionArn),
      new iam.PolicyStatement()
        .addActions('ecs:StopTask', 'ecs:DescribeTasks')
        .addAllResources(),
      new iam.PolicyStatement()
        .addAction('iam:PassRole')
        .addResources(...new cdk.Token(() => this.taskExecutionRoles().map(r => r.roleArn)).toList())
    ];

    if (this.sync) {
      policyStatements.push(new iam.PolicyStatement()
        .addActions("events:PutTargets", "events:PutRule", "events:DescribeRule")
        .addResource(stack.formatArn({
          service: 'events',
          resource: 'rule',
          resourceName: 'StepFunctionsGetEventsForECSTaskRule'
      })));
    }

    for (const policyStatement of policyStatements) {
      graph.registerPolicyStatement(policyStatement);
    }
  }

  private taskExecutionRoles(): iam.IRole[] {
    // Need to be able to pass both Task and Execution role, apparently
    const ret = new Array<iam.IRole>();
    ret.push(this.taskDefinition.taskRole);
    if ((this.taskDefinition as any).executionRole) {
      ret.push((this.taskDefinition as any).executionRole);
    }
    return ret;
  }
}

function extractRequired(obj: any, srcKey: string, dstKey: string) {
    if ((obj[srcKey] !== undefined) === (obj[srcKey + 'Path'] !== undefined)) {
      throw new Error(`Supply exactly one of '${srcKey}' or '${srcKey}Path'`);
    }
    return mapValue(obj, srcKey, dstKey);
}

function renderOverrides(containerOverrides?: ContainerOverride[]) {
  if (!containerOverrides) { return undefined; }

  const ret = new Array<any>();
  for (const override of containerOverrides) {
    ret.push({
      ...extractRequired(override, 'containerName', 'Name'),
      ...extractOptional(override, 'command', 'Command'),
      ...extractOptional(override, 'cpu', 'Cpu'),
      ...extractOptional(override, 'memoryLimit', 'Memory'),
      ...extractOptional(override, 'memoryReservation', 'MemoryReservation'),
      Environment: override.environment && override.environment.map(e => ({
        ...extractRequired(e, 'name', 'Name'),
        ...extractRequired(e, 'value', 'Value'),
      }))
    });
  }

  return { ContainerOverrides: ret };
}

function extractOptional(obj: any, srcKey: string, dstKey: string) {
    if ((obj[srcKey] !== undefined) && (obj[srcKey + 'Path'] !== undefined)) {
      throw new Error(`Supply only one of '${srcKey}' or '${srcKey}Path'`);
    }
    return mapValue(obj, srcKey, dstKey);
}

function mapValue(obj: any, srcKey: string, dstKey: string) {
  if (obj[srcKey + 'Path'] !== undefined && !obj[srcKey + 'Path'].startsWith('$.')) {
    throw new Error(`Value for '${srcKey}Path' must start with '$.', got: '${obj[srcKey + 'Path']}'`);
  }

  return {
    [dstKey]: obj[srcKey],
    [dstKey + '.$']: obj[srcKey + 'Path']
  };
}