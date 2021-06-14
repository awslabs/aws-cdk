import { IVpc, SubnetSelection, SubnetType } from '@aws-cdk/aws-ec2';
import { AwsLogDriver, Cluster, ContainerImage, ICluster, LogDriver, Secret, TaskDefinition } from '@aws-cdk/aws-ecs';
import { Rule, Schedule } from '@aws-cdk/aws-events';
import { EcsTask } from '@aws-cdk/aws-events-targets';
import { Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';

// v2 - keep this import as a separate section to reduce merge conflict when forward merging with the v2 branch.
// eslint-disable-next-line
import { Construct as CoreConstruct } from '@aws-cdk/core';

/**
 * The properties for the base ScheduledEc2Task or ScheduledFargateTask task.
 */
export interface ScheduledTaskBaseProps {
  /**
   * The name of the cluster that hosts the service.
   *
   * If a cluster is specified, the vpc construct should be omitted. Alternatively, you can omit both cluster and vpc.
   * @default - create a new cluster; if both cluster and vpc are omitted, a new VPC will be created for you.
   */
  readonly cluster?: ICluster;

  /**
   * The VPC where the container instances will be launched or the elastic network interfaces (ENIs) will be deployed.
   *
   * If a vpc is specified, the cluster construct should be omitted. Alternatively, you can omit both vpc and cluster.
   * @default - uses the VPC defined in the cluster or creates a new VPC.
   */
  readonly vpc?: IVpc;

  /**
   * The schedule or rate (frequency) that determines when CloudWatch Events
   * runs the rule. For more information, see
   * [Schedule Expression Syntax for Rules](https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/ScheduledEvents.html)
   * in the Amazon CloudWatch User Guide.
   */
  readonly schedule: Schedule;

  /**
   * Indicates whether the rule is enabled.
   *
   * @default true
   */
  readonly enabled?: boolean;

  /**
   * A name for the rule.
   *
   * @default - AWS CloudFormation generates a unique physical ID and uses that ID
   * for the rule name. For more information, see [Name Type](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-name.html).
   */
  readonly ruleName?: string;

  /**
   * The desired number of instantiations of the task definition to keep running on the service.
   *
   * @default 1
   */
  readonly desiredTaskCount?: number;

  /**
   * In what subnets to place the task's ENIs
   *
   * (Only applicable in case the TaskDefinition is configured for AwsVpc networking)
   *
   * @default Private subnets
   */
  readonly subnetSelection?: SubnetSelection;
}

export interface ScheduledTaskImageProps {
  /**
   * The image used to start a container. Image or taskDefinition must be specified, but not both.
   *
   * @default - none
   */
  readonly image: ContainerImage;

  /**
   * The command that is passed to the container.
   *
   * If you provide a shell command as a single string, you have to quote command-line arguments.
   *
   * @default - CMD value built into container image.
   */
  readonly command?: string[];

  /**
   * The environment variables to pass to the container.
   *
   * @default none
   */
  readonly environment?: { [key: string]: string };

  /**
   * The secret to expose to the container as an environment variable.
   *
   * @default - No secret environment variables.
   */
  readonly secrets?: { [key: string]: Secret };

  /**
   * The log driver to use.
   *
   * @default - AwsLogDriver if enableLogging is true
   */
  readonly logDriver?: LogDriver;
}

/**
 * The base class for ScheduledEc2Task and ScheduledFargateTask tasks.
 */
export abstract class ScheduledTaskBase extends CoreConstruct {
  /**
   * The name of the cluster that hosts the service.
   */
  public readonly cluster: ICluster;
  /**
   * The desired number of instantiations of the task definition to keep running on the service.
   *
   * The minimum value is 1
   */
  public readonly desiredTaskCount: number;

  /**
   * In what subnets to place the task's ENIs
   *
   * (Only applicable in case the TaskDefinition is configured for AwsVpc networking)
   *
   * @default Private subnets
   */
  public readonly subnetSelection: SubnetSelection;

  /**
   * The CloudWatch Events rule for the service.
   */
  public readonly eventRule: Rule;

  /**
   * Constructs a new instance of the ScheduledTaskBase class.
   */
  constructor(scope: Construct, id: string, props: ScheduledTaskBaseProps) {
    super(scope, id);

    this.cluster = props.cluster || this.getDefaultCluster(this, props.vpc);
    if (props.desiredTaskCount !== undefined && props.desiredTaskCount < 1) {
      throw new Error('You must specify a desiredTaskCount greater than 0');
    }
    this.desiredTaskCount = props.desiredTaskCount || 1;
    this.subnetSelection = props.subnetSelection || { subnetType: SubnetType.PRIVATE };

    // An EventRule that describes the event trigger (in this case a scheduled run)
    this.eventRule = new Rule(this, 'ScheduledEventRule', {
      schedule: props.schedule,
      ruleName: props.ruleName,
      enabled: props.enabled,
    });
  }

  /**
   * Create an ECS task using the task definition provided and add it to the scheduled event rule.
   *
   * @param taskDefinition the TaskDefinition to add to the event rule
   */
  protected addTaskDefinitionToEventTarget(taskDefinition: TaskDefinition): EcsTask {
    // Use the EcsTask as the target of the EventRule
    const eventRuleTarget = new EcsTask( {
      cluster: this.cluster,
      taskDefinition,
      taskCount: this.desiredTaskCount,
      subnetSelection: this.subnetSelection,
    });

    this.addTaskAsTarget(eventRuleTarget);

    return eventRuleTarget;
  }

  /**
   * Adds task as a target of the scheduled event rule.
   *
   * @param ecsTaskTarget the EcsTask to add to the event rule
   */
  protected addTaskAsTarget(ecsTaskTarget: EcsTask) {
    this.eventRule.addTarget(ecsTaskTarget);
  }

  /**
   * Returns the default cluster.
   */
  protected getDefaultCluster(scope: CoreConstruct, vpc?: IVpc): Cluster {
    // magic string to avoid collision with user-defined constructs
    const DEFAULT_CLUSTER_ID = `EcsDefaultClusterMnL3mNNYN${vpc ? vpc.node.id : ''}`;
    const stack = Stack.of(scope);
    return stack.node.tryFindChild(DEFAULT_CLUSTER_ID) as Cluster || new Cluster(stack, DEFAULT_CLUSTER_ID, { vpc });
  }

  /**
   * Create an AWS Log Driver with the provided streamPrefix
   *
   * @param prefix the Cloudwatch logging prefix
   */
  protected createAWSLogDriver(prefix: string): AwsLogDriver {
    return new AwsLogDriver({ streamPrefix: prefix });
  }
}
