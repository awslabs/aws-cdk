import * as ec2 from '@aws-cdk/aws-ec2';
import * as cdk from '@aws-cdk/core';
import { Construct } from 'constructs';
import { BaseService, BaseServiceOptions, DeploymentControllerType, IBaseService, IService, LaunchType } from '../base/base-service';
import { fromServiceAtrributes } from '../base/from-service-attributes';
import { TaskDefinition } from '../base/task-definition';
import { ICluster } from '../cluster';

/**
 * The properties for defining a service using the Fargate launch type.
 */
export interface FargateServiceProps extends BaseServiceOptions {
  /**
   * The task definition to use for tasks in the service.
   *
   * [disable-awslint:ref-via-interface]
   */
  readonly taskDefinition: TaskDefinition;

  /**
   * Specifies whether the task's elastic network interface receives a public IP address.
   *
   * If true, each task will receive a public IP address.
   *
   * @default false
   */
  readonly assignPublicIp?: boolean;

  /**
   * The subnets to associate with the service.
   *
   * @default - Public subnets if `assignPublicIp` is set, otherwise the first available one of Private, Isolated, Public, in that order.
   */
  readonly vpcSubnets?: ec2.SubnetSelection;

  /**
   * The security groups to associate with the service. If you do not specify a security group, the default security group for the VPC is used.
   *
   * @default - A new security group is created.
   * @deprecated use securityGroups instead.
   */
  readonly securityGroup?: ec2.ISecurityGroup;

  /**
   * The security groups to associate with the service. If you do not specify a security group, the default security group for the VPC is used.
   *
   * @default - A new security group is created.
   */
  readonly securityGroups?: ec2.ISecurityGroup[];

  /**
   * The platform version on which to run your service.
   *
   * If one is not specified, the LATEST platform version is used by default. For more information, see
   * [AWS Fargate Platform Versions](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/platform_versions.html)
   * in the Amazon Elastic Container Service Developer Guide.
   *
   * @default Latest
   */
  readonly platformVersion?: FargatePlatformVersion;
}

/**
 * The interface for a service using the Fargate launch type on an ECS cluster.
 */
export interface IFargateService extends IService {

}

/**
 * The properties to import from the service using the Fargate launch type.
 */
export interface FargateServiceAttributes {
  /**
   * The cluster that hosts the service.
   */
  readonly cluster: ICluster;

  /**
   * The service ARN.
   *
   * @default - either this, or {@link serviceName}, is required
   */
  readonly serviceArn?: string;

  /**
   * The name of the service.
   *
   * @default - either this, or {@link serviceArn}, is required
   */
  readonly serviceName?: string;
}

/**
 * This creates a service using the Fargate launch type on an ECS cluster.
 *
 * @resource AWS::ECS::Service
 */
export class FargateService extends BaseService implements IFargateService {
  /**
   * Imports from the specified service ARN.
   */
  public static fromFargateServiceArn(scope: Construct, id: string, fargateServiceArn: string): IFargateService {
    class Import extends cdk.Resource implements IFargateService {
      public readonly serviceArn = fargateServiceArn;
      public readonly serviceName = cdk.Stack.of(scope).parseArn(fargateServiceArn).resourceName as string;
    }
    return new Import(scope, id);
  }

  /**
   * Imports from the specified service attrributes.
   */
  public static fromFargateServiceAttributes(scope: Construct, id: string, attrs: FargateServiceAttributes): IBaseService {
    return fromServiceAtrributes(scope, id, attrs);
  }

  /**
   * Constructs a new instance of the FargateService class.
   */
  constructor(scope: Construct, id: string, props: FargateServiceProps) {
    if (!props.taskDefinition.isFargateCompatible) {
      throw new Error('Supplied TaskDefinition is not configured for compatibility with Fargate');
    }

    if (props.securityGroup !== undefined && props.securityGroups !== undefined) {
      throw new Error('Only one of SecurityGroup or SecurityGroups can be populated.');
    }

    if (props.taskDefinition.referencesSecretJsonField
        && props.platformVersion
        && SECRET_JSON_FIELD_UNSUPPORTED_PLATFORM_VERSIONS.includes(props.platformVersion)) {
      throw new Error(`The task definition of this service uses at least one container that references a secret JSON field. This feature requires platform version ${FargatePlatformVersion.VERSION1_4} or later.`);
    }
    super(scope, id, {
      ...props,
      desiredCount: props.desiredCount,
      launchType: LaunchType.FARGATE,
      capacityProviderStrategies: props.capacityProviderStrategies,
      enableECSManagedTags: props.enableECSManagedTags,
    }, {
      cluster: props.cluster.clusterName,
      taskDefinition: props.deploymentController?.type === DeploymentControllerType.EXTERNAL ? undefined : props.taskDefinition.taskDefinitionArn,
      platformVersion: props.platformVersion,
    }, props.taskDefinition);

    let securityGroups;
    if (props.securityGroup !== undefined) {
      securityGroups = [props.securityGroup];
    } else if (props.securityGroups !== undefined) {
      securityGroups = props.securityGroups;
    }

    this.configureAwsVpcNetworkingWithSecurityGroups(props.cluster.vpc, props.assignPublicIp, props.vpcSubnets, securityGroups);

    this.node.addValidation({
      validate: () => !this.taskDefinition.defaultContainer ? ['A TaskDefinition must have at least one essential container'] : [],
    });
  }
}

/**
 * The platform version on which to run your service.
 *
 * @see https://docs.aws.amazon.com/AmazonECS/latest/developerguide/platform_versions.html
 */
export enum FargatePlatformVersion {
  /**
   * The latest, recommended platform version.
   */
  LATEST = 'LATEST',

  /**
   * Version 1.4.0
   *
   * Supports EFS endpoints, CAP_SYS_PTRACE Linux capability,
   * network performance metrics in CloudWatch Container Insights,
   * consolidated 20 GB ephemeral volume.
   */
  VERSION1_4 = '1.4.0',

  /**
   * Version 1.3.0
   *
   * Supports secrets, task recycling.
   */
  VERSION1_3 = '1.3.0',

  /**
   * Version 1.2.0
   *
   * Supports private registries.
   */
  VERSION1_2 = '1.2.0',

  /**
   * Version 1.1.0
   *
   * Supports task metadata, health checks, service discovery.
   */
  VERSION1_1 = '1.1.0',

  /**
   * Initial release
   *
   * Based on Amazon Linux 2017.09.
   */
  VERSION1_0 = '1.0.0',
}

const SECRET_JSON_FIELD_UNSUPPORTED_PLATFORM_VERSIONS = [
  FargatePlatformVersion.VERSION1_0,
  FargatePlatformVersion.VERSION1_1,
  FargatePlatformVersion.VERSION1_2,
  FargatePlatformVersion.VERSION1_3,
];
