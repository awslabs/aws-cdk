import * as path from 'path';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import { Duration, NestedStack, Stack } from '@aws-cdk/core';
import * as cr from '@aws-cdk/custom-resources';
import { Construct } from 'constructs';

// v2 - keep this import as a separate section to reduce merge conflict when forward merging with the v2 branch.
// eslint-disable-next-line
import { Construct as CoreConstruct } from '@aws-cdk/core';

const HANDLER_DIR = path.join(__dirname, 'cluster-resource-handler');
const HANDLER_RUNTIME = lambda.Runtime.NODEJS_12_X;

export interface ClusterResourceProviderProps {
  /**
   * The IAM role to assume in order to interact with the cluster.
   */
  readonly adminRole: iam.IRole;

  /**
   * The VPC to provision the functions in.
   */
  readonly vpc?: ec2.IVpc;

  /**
   * The subnets to place the functions in.
   */
  readonly subnets?: ec2.ISubnet[];

  /**
   * Environment to add to the handler.
   */
  readonly environment?: { [key: string]: string };
}

/**
 * A custom resource provider that handles cluster operations. It serves
 * multiple custom resources such as the cluster resource and the fargate
 * resource.
 *
 * @internal
 */
export class ClusterResourceProvider extends NestedStack {
  public static getOrCreate(scope: Construct, props: ClusterResourceProviderProps) {
    const stack = Stack.of(scope);
    const uid = '@aws-cdk/aws-eks.ClusterResourceProvider';
    return stack.node.tryFindChild(uid) as ClusterResourceProvider ?? new ClusterResourceProvider(stack, uid, props);
  }

  /**
   * The custom resource provider to use for custom resources.
   */
  public readonly provider: cr.Provider;

  private constructor(scope: Construct, id: string, props: ClusterResourceProviderProps) {
    super(scope as CoreConstruct, id);

    const onEvent = new lambda.Function(this, 'OnEventHandler', {
      code: lambda.Code.fromAsset(HANDLER_DIR),
      description: 'onEvent handler for EKS cluster resource provider',
      runtime: HANDLER_RUNTIME,
      environment: props.environment,
      handler: 'index.onEvent',
      timeout: Duration.minutes(1),
      vpc: props.subnets ? props.vpc : undefined,
      vpcSubnets: props.subnets ? { subnets: props.subnets } : undefined,
    });

    const isComplete = new lambda.Function(this, 'IsCompleteHandler', {
      code: lambda.Code.fromAsset(HANDLER_DIR),
      description: 'isComplete handler for EKS cluster resource provider',
      runtime: HANDLER_RUNTIME,
      handler: 'index.isComplete',
      timeout: Duration.minutes(1),
      vpc: props.subnets ? props.vpc : undefined,
      vpcSubnets: props.subnets ? { subnets: props.subnets } : undefined,
    });

    this.provider = new cr.Provider(this, 'Provider', {
      onEventHandler: onEvent,
      isCompleteHandler: isComplete,
      totalTimeout: Duration.hours(1),
      queryInterval: Duration.minutes(1),
      vpc: props.subnets ? props.vpc : undefined,
      vpcSubnets: props.subnets ? { subnets: props.subnets } : undefined,
    });

    props.adminRole.grant(onEvent.role!, 'sts:AssumeRole');
    props.adminRole.grant(isComplete.role!, 'sts:AssumeRole');
  }

  /**
   * The custom resource service token for this provider.
   */
  public get serviceToken() { return this.provider.serviceToken; }
}