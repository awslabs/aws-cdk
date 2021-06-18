import { Construct } from 'constructs';
import { CfnHook } from './cfn-hook';
import { FromCloudFormationOptions } from './cfn-parse';
import { CfnResource } from './cfn-resource';
import { undefinedIfAllValuesAreEmpty } from './util';

/**
 * The possible types of traffic shifting for the blue-green deployment configuration.
 * The type of the {@link CfnTrafficRoutingConfig.type} property.
 */
export enum CfnTrafficRoutingType {
  /**
   * Switch from blue to green at once.
   */
  ALL_AT_ONCE = 'AllAtOnce',

  /**
   * Specifies a configuration that shifts traffic from blue to green in two increments.
   */
  TIME_BASED_CANARY = 'TimeBasedCanary',

  /**
   * Specifies a configuration that shifts traffic from blue to green in equal increments,
   * with an equal number of minutes between each increment.
   */
  TIME_BASED_LINEAR = 'TimeBasedLinear',
}

/**
 * The traffic routing configuration if {@link CfnTrafficRoutingConfig.type}
 * is {@link CfnTrafficRoutingType.TIME_BASED_CANARY}.
 */
export interface CfnTrafficRoutingTimeBasedCanary {
  /**
   * The percentage of traffic to shift in the first increment of a time-based canary deployment.
   * The step percentage must be 14% or greater.
   *
   * @default 15
   */
  readonly stepPercentage?: number;

  /**
   * The number of minutes between the first and second traffic shifts of a time-based canary deployment.
   *
   * @default 5
   */
  readonly bakeTimeMins?: number;
}

/**
 * The traffic routing configuration if {@link CfnTrafficRoutingConfig.type}
 * is {@link CfnTrafficRoutingType.TIME_BASED_LINEAR}.
 */
export interface CfnTrafficRoutingTimeBasedLinear {
  /**
   * The percentage of traffic that is shifted at the start of each increment of a time-based linear deployment.
   * The step percentage must be 14% or greater.
   *
   * @default 15
   */
  readonly stepPercentage?: number;

  /**
   * The number of minutes between the first and second traffic shifts of a time-based linear deployment.
   *
   * @default 5
   */
  readonly bakeTimeMins?: number;
}

/**
 * Traffic routing configuration settings.
 * The type of the {@link CfnCodeDeployBlueGreenHookProps.trafficRoutingConfig} property.
 */
export interface CfnTrafficRoutingConfig {
  /**
   * The type of traffic shifting used by the blue-green deployment configuration.
   */
  readonly type: CfnTrafficRoutingType;

  /**
   * The configuration for traffic routing when {@link type} is
   * {@link CfnTrafficRoutingType.TIME_BASED_CANARY}.
   *
   * @default - none
   */
  readonly timeBasedCanary?: CfnTrafficRoutingTimeBasedCanary;

  /**
   * The configuration for traffic routing when {@link type} is
   * {@link CfnTrafficRoutingType.TIME_BASED_LINEAR}.
   *
   * @default - none
   */
  readonly timeBasedLinear?: CfnTrafficRoutingTimeBasedLinear;
}

/**
 * Additional options for the blue/green deployment.
 * The type of the {@link CfnCodeDeployBlueGreenHookProps.additionalOptions} property.
 */
export interface CfnCodeDeployBlueGreenAdditionalOptions {
  /**
   * Specifies time to wait, in minutes, before terminating the blue resources.
   *
   * @default - 5 minutes
   */
  readonly terminationWaitTimeInMinutes?: number;
}

/**
 * Lifecycle events for blue-green deployments.
 * The type of the {@link CfnCodeDeployBlueGreenHookProps.lifecycleEventHooks} property.
 */
export interface CfnCodeDeployBlueGreenLifecycleEventHooks {
  /**
   * Function to use to run tasks before the replacement task set is created.
   *
   * @default - none
   */
  readonly beforeInstall?: string;

  /**
   * Function to use to run tasks after the replacement task set is created and one of the target groups is associated with it.
   *
   * @default - none
   */
  readonly afterInstall?: string;

  /**
   * Function to use to run tasks after the test listener serves traffic to the replacement task set.
   *
   * @default - none
   */
  readonly afterAllowTestTraffic?: string;

  /**
   * Function to use to run tasks after the second target group is associated with the replacement task set,
   * but before traffic is shifted to the replacement task set.
   *
   * @default - none
   */
  readonly beforeAllowTraffic?: string;

  /**
   * Function to use to run tasks after the second target group serves traffic to the replacement task set.
   *
   * @default - none
   */
  readonly afterAllowTraffic?: string;
}

/**
 * Type of the {@link CfnCodeDeployBlueGreenApplication.target} property.
 */
export interface CfnCodeDeployBlueGreenApplicationTarget {
  /**
   * The resource type of the target being deployed.
   * Right now, the only allowed value is 'AWS::ECS::Service'.
   */
  readonly type: string;

  /**
   * The logical id of the target resource.
   */
  readonly logicalId: string;
}

/**
 * A traffic route,
 * representing where the traffic is being directed to.
 */
export interface CfnTrafficRoute {
  /**
   * The resource type of the route.
   * Today, the only allowed value is 'AWS::ElasticLoadBalancingV2::Listener'.
   */
  readonly type: string;

  /**
   * The logical id of the target resource.
   */
  readonly logicalId: string;
}

/**
 * Type of the {@link CfnCodeDeployBlueGreenEcsAttributes.trafficRouting} property.
 */
export interface CfnTrafficRouting {
  /**
   * The listener to be used by your load balancer to direct traffic to your target groups.
   */
  readonly prodTrafficRoute: CfnTrafficRoute;

  /**
   * The listener to be used by your load balancer to direct traffic to your target groups.
   */
  readonly testTrafficRoute: CfnTrafficRoute;

  /**
   * The logical IDs of the blue and green, respectively,
   * AWS::ElasticLoadBalancingV2::TargetGroup target groups.
   */
  readonly targetGroups: string[];
}

/**
 * The attributes of the ECS Service being deployed.
 * Type of the {@link CfnCodeDeployBlueGreenApplication.ecsAttributes} property.
 */
export interface CfnCodeDeployBlueGreenEcsAttributes {
  /**
   * The logical IDs of the blue and green, respectively,
   * AWS::ECS::TaskDefinition task definitions.
   */
  readonly taskDefinitions: string[];

  /**
   * The logical IDs of the blue and green, respectively,
   * AWS::ECS::TaskSet task sets.
   */
  readonly taskSets: string[];

  /**
   * The traffic routing configuration.
   */
  readonly trafficRouting: CfnTrafficRouting;
}

/**
 * The application actually being deployed.
 * Type of the {@link CfnCodeDeployBlueGreenHookProps.applications} property.
 */
export interface CfnCodeDeployBlueGreenApplication {
  /**
   * The target that is being deployed.
   */
  readonly target: CfnCodeDeployBlueGreenApplicationTarget;

  /**
   * The detailed attributes of the deployed target.
   */
  readonly ecsAttributes: CfnCodeDeployBlueGreenEcsAttributes;
}

/**
 * Construction properties of {@link CfnCodeDeployBlueGreenHook}.
 */
export interface CfnCodeDeployBlueGreenHookProps {
  /**
   * The IAM Role for CloudFormation to use to perform blue-green deployments.
   */
  readonly serviceRole: string;

  /**
   * Properties of the Amazon ECS applications being deployed.
   */
  readonly applications: CfnCodeDeployBlueGreenApplication[];

  /**
   * Traffic routing configuration settings.
   *
   * @default - time-based canary traffic shifting, with a 15% step percentage and a five minute bake time
   */
  readonly trafficRoutingConfig?: CfnTrafficRoutingConfig;

  /**
   * Additional options for the blue/green deployment.
   *
   * @default - no additional options
   */
  readonly additionalOptions?: CfnCodeDeployBlueGreenAdditionalOptions;

  /**
   * Use lifecycle event hooks to specify a Lambda function that CodeDeploy can call to validate a deployment.
   * You can use the same function or a different one for deployment lifecycle events.
   * Following completion of the validation tests,
   * the Lambda {@link CfnCodeDeployBlueGreenLifecycleEventHooks.afterAllowTraffic}
   * function calls back CodeDeploy and delivers a result of 'Succeeded' or 'Failed'.
   *
   * @default - no lifecycle event hooks
   */
  readonly lifecycleEventHooks?: CfnCodeDeployBlueGreenLifecycleEventHooks;
}

/**
 * A CloudFormation Hook for CodeDeploy blue-green ECS deployments.
 *
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/blue-green.html#blue-green-template-reference
 */
export class CfnCodeDeployBlueGreenHook extends CfnHook {
  /**
   * A factory method that creates a new instance of this class from an object
   * containing the CloudFormation properties of this resource.
   * Used in the @aws-cdk/cloudformation-include module.
   *
   * @internal
   */
  public static _fromCloudFormation(scope: Construct, id: string, hookAttributes: any,
    options: FromCloudFormationOptions): CfnCodeDeployBlueGreenHook {
    hookAttributes = hookAttributes || {};
    const hookProperties = options.parser.parseValue(hookAttributes.Properties);
    return new CfnCodeDeployBlueGreenHook(scope, id, {
      serviceRole: hookProperties?.ServiceRole,
      applications: hookProperties?.Applications?.map(applicationFromCloudFormation),
      trafficRoutingConfig: {
        type: hookProperties?.TrafficRoutingConfig?.Type,
        timeBasedCanary: {
          stepPercentage: hookProperties?.TrafficRoutingConfig?.TimeBasedCanary?.StepPercentage,
          bakeTimeMins: hookProperties?.TrafficRoutingConfig?.TimeBasedCanary?.BakeTimeMins,
        },
        timeBasedLinear: {
          stepPercentage: hookProperties?.TrafficRoutingConfig?.TimeBasedLinear?.StepPercentage,
          bakeTimeMins: hookProperties?.TrafficRoutingConfig?.TimeBasedLinear?.BakeTimeMins,
        },
      },
      additionalOptions: {
        terminationWaitTimeInMinutes: hookProperties?.AdditionalOptions?.TerminationWaitTimeInMinutes,
      },
      lifecycleEventHooks: {
        beforeInstall: hookProperties?.LifecycleEventHooks?.BeforeInstall,
        afterInstall: hookProperties?.LifecycleEventHooks?.AfterInstall,
        afterAllowTestTraffic: hookProperties?.LifecycleEventHooks?.AfterAllowTestTraffic,
        beforeAllowTraffic: hookProperties?.LifecycleEventHooks?.BeforeAllowTraffic,
        afterAllowTraffic: hookProperties?.LifecycleEventHooks?.AfterAllowTraffic,
      },
    });

    function applicationFromCloudFormation(app: any) {
      const target = findResource(app?.Target?.LogicalID);
      const taskDefinitions: Array<CfnResource | undefined> | undefined = app?.ECSAttributes?.TaskDefinitions?.map(
        (td: any) => findResource(td));
      const taskSets: Array<CfnResource | undefined> | undefined = app?.ECSAttributes?.TaskSets?.map(
        (ts: any) => findResource(ts));
      const prodTrafficRoute = findResource(app?.ECSAttributes?.TrafficRouting?.ProdTrafficRoute?.LogicalID);
      const testTrafficRoute = findResource(app?.ECSAttributes?.TrafficRouting?.TestTrafficRoute?.LogicalID);
      const targetGroups: Array<CfnResource | undefined> | undefined = app?.ECSAttributes?.TrafficRouting?.TargetGroups?.map(
        (tg: any) => findResource(tg));

      return {
        target: {
          type: app?.Target?.Type,
          logicalId: target?.logicalId,
        },
        ecsAttributes: {
          taskDefinitions: taskDefinitions?.map(td => td?.logicalId),
          taskSets: taskSets?.map(ts => ts?.logicalId),
          trafficRouting: {
            prodTrafficRoute: {
              type: app?.ECSAttributes?.TrafficRouting?.ProdTrafficRoute?.Type,
              logicalId: prodTrafficRoute?.logicalId,
            },
            testTrafficRoute: {
              type: app?.ECSAttributes?.TrafficRouting?.TestTrafficRoute?.Type,
              logicalId: testTrafficRoute?.logicalId,
            },
            targetGroups: targetGroups?.map((tg) => tg?.logicalId),
          },
        },
      };
    }

    function findResource(logicalId: string | undefined): CfnResource | undefined {
      if (logicalId == null) {
        return undefined;
      }
      const ret = options.parser.finder.findResource(logicalId);
      if (!ret) {
        throw new Error(`Hook '${id}' references resource '${logicalId}' that was not found in the template`);
      }
      return ret;
    }
  }

  private _serviceRole: string;
  private _applications: CfnCodeDeployBlueGreenApplication[];
  private _trafficRoutingConfig?: CfnTrafficRoutingConfig;
  private _additionalOptions?: CfnCodeDeployBlueGreenAdditionalOptions;
  private _lifecycleEventHooks?: CfnCodeDeployBlueGreenLifecycleEventHooks;

  /**
   * Creates a new CodeDeploy blue-green ECS Hook.
   *
   * @param scope the scope to create the hook in (usually the containing Stack object)
   * @param id the identifier of the construct - will be used to generate the logical ID of the Hook
   * @param props the properties of the Hook
   */
  constructor(scope: Construct, id: string, props: CfnCodeDeployBlueGreenHookProps) {
    super(scope, id, {
      type: 'AWS::CodeDeploy::BlueGreen',
      // we render the properties ourselves
    });

    this._serviceRole = props.serviceRole;
    this._applications = props.applications;
    this._trafficRoutingConfig = props.trafficRoutingConfig;
    this._additionalOptions = props.additionalOptions;
    this._lifecycleEventHooks = props.lifecycleEventHooks;
  }

  /**
   * The IAM Role for CloudFormation to use to perform blue-green deployments.
   */
  public get serviceRole(): string {
    return this._serviceRole;
  }

  public set serviceRole(serviceRole: string) {
    this._serviceRole = serviceRole;
  }

  /**
   * Properties of the Amazon ECS applications being deployed.
   */
  public get applications(): CfnCodeDeployBlueGreenApplication[] {
    return this._applications;
  }

  public set applications(value: CfnCodeDeployBlueGreenApplication[]) {
    this._applications = value;
  }

  /**
   * Traffic routing configuration settings.
   *
   * @default - time-based canary traffic shifting, with a 15% step percentage and a five minute bake time
   */
  public get trafficRoutingConfig(): CfnTrafficRoutingConfig | undefined {
    return this._trafficRoutingConfig;
  }

  public set trafficRoutingConfig(value: CfnTrafficRoutingConfig | undefined) {
    this._trafficRoutingConfig = value;
  }

  /**
   * Additional options for the blue/green deployment.
   *
   * @default - no additional options
   */
  public get additionalOptions(): CfnCodeDeployBlueGreenAdditionalOptions | undefined {
    return this._additionalOptions;
  }

  public set additionalOptions(value: CfnCodeDeployBlueGreenAdditionalOptions | undefined) {
    this._additionalOptions = value;
  }

  /**
   * Use lifecycle event hooks to specify a Lambda function that CodeDeploy can call to validate a deployment.
   * You can use the same function or a different one for deployment lifecycle events.
   * Following completion of the validation tests,
   * the Lambda {@link CfnCodeDeployBlueGreenLifecycleEventHooks.afterAllowTraffic}
   * function calls back CodeDeploy and delivers a result of 'Succeeded' or 'Failed'.
   *
   * @default - no lifecycle event hooks
   */
  public get lifecycleEventHooks(): CfnCodeDeployBlueGreenLifecycleEventHooks | undefined {
    return this._lifecycleEventHooks;
  }

  public set lifecycleEventHooks(value: CfnCodeDeployBlueGreenLifecycleEventHooks | undefined) {
    this._lifecycleEventHooks = value;
  }

  protected renderProperties(_props?: { [p: string]: any }): { [p: string]: any } | undefined {
    return {
      ServiceRole: this.serviceRole,
      Applications: this.applications.map((app) => ({
        Target: {
          Type: app.target.type,
          LogicalID: app.target.logicalId,
        },
        ECSAttributes: {
          TaskDefinitions: app.ecsAttributes.taskDefinitions,
          TaskSets: app.ecsAttributes.taskSets,
          TrafficRouting: {
            ProdTrafficRoute: {
              Type: app.ecsAttributes.trafficRouting.prodTrafficRoute.type,
              LogicalID: app.ecsAttributes.trafficRouting.prodTrafficRoute.logicalId,
            },
            TestTrafficRoute: {
              Type: app.ecsAttributes.trafficRouting.testTrafficRoute.type,
              LogicalID: app.ecsAttributes.trafficRouting.testTrafficRoute.logicalId,
            },
            TargetGroups: app.ecsAttributes.trafficRouting.targetGroups,
          },
        },
      })),
      TrafficRoutingConfig: undefinedIfAllValuesAreEmpty({
        Type: this.trafficRoutingConfig?.type,
        TimeBasedCanary: undefinedIfAllValuesAreEmpty({
          StepPercentage: this.trafficRoutingConfig?.timeBasedCanary?.stepPercentage,
          BakeTimeMins: this.trafficRoutingConfig?.timeBasedCanary?.bakeTimeMins,
        }),
        TimeBasedLinear: undefinedIfAllValuesAreEmpty({
          StepPercentage: this.trafficRoutingConfig?.timeBasedLinear?.stepPercentage,
          BakeTimeMins: this.trafficRoutingConfig?.timeBasedLinear?.bakeTimeMins,
        }),
      }),
      AdditionalOptions: undefinedIfAllValuesAreEmpty({
        TerminationWaitTimeInMinutes: this.additionalOptions?.terminationWaitTimeInMinutes,
      }),
      LifecycleEventHooks: undefinedIfAllValuesAreEmpty({
        BeforeInstall: this.lifecycleEventHooks?.beforeInstall,
        AfterInstall: this.lifecycleEventHooks?.afterInstall,
        AfterAllowTestTraffic: this.lifecycleEventHooks?.afterAllowTestTraffic,
        BeforeAllowTraffic: this.lifecycleEventHooks?.beforeAllowTraffic,
        AfterAllowTraffic: this.lifecycleEventHooks?.afterAllowTraffic,
      }),
    };
  }
}
