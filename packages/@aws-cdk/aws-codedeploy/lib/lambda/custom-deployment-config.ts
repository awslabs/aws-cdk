import { Duration, Names, Resource } from '@aws-cdk/core';
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from '@aws-cdk/custom-resources';
import { Construct } from 'constructs';
import { arnForDeploymentConfig } from '../utils';
import { ILambdaDeploymentConfig } from './deployment-config';

/**
 * Lambda Deployment config type
 */
export enum CustomLambdaDeploymentConfigType {
  /**
   * Canary deployment type
   */
  CANARY = 'Canary',

  /**
   * Linear deployment type
   */
  LINEAR = 'Linear'
}

/**
 * Properties of a reference to a CodeDeploy Lambda Deployment Configuration.
 */
export interface CustomLambdaDeploymentConfigProps {

  /**
   * The type of deployment config, either CANARY or LINEAR
   */
  readonly type: CustomLambdaDeploymentConfigType;

  /**
   * The integer percentage of traffic to shift:
   * - For LINEAR, the percentage to shift every interval
   * - For CANARY, the percentage to shift until the interval passes, before the full deployment
   */
  readonly percentage: number;

  /**
   * The interval, in number of minutes:
   * - For LINEAR, how frequently additional traffic is shifted
   * - For CANARY, how long to shift traffic before the full deployment
   */
  readonly interval: Duration;

  /**
   * The verbatim name of the deployment config. Must be unique per account/region.
   * Other parameters cannot be updated if this name is provided.
   * @default - automatically generated name
   */
  readonly deploymentConfigName?: string;
}

/**
 * A custom Deployment Configuration for a Lambda Deployment Group.
 * @resource AWS::CodeDeploy::DeploymentGroup
 */
export class CustomLambdaDeploymentConfig extends Resource implements ILambdaDeploymentConfig {
  /**
   * The name of the deployment config
   * @attribute
   */
  public readonly deploymentConfigName: string;

  /**
   * The arn of the deployment config
   * @attribute
   */
  public readonly deploymentConfigArn: string;

  public constructor(scope: Construct, id: string, props: CustomLambdaDeploymentConfigProps) {
    super(scope, id);
    this.validateParameters(props);

    // In this section we make the argument for the AWS API call
    const deploymentType = 'TimeBased' + props.type.toString();
    const intervalMinutes = props.interval.toMinutes().toString();
    const percentage = props.percentage.toString();
    let routingConfig; // The argument to the AWS API call
    if (props.type == CustomLambdaDeploymentConfigType.CANARY) {
      routingConfig = {
        type: deploymentType,
        timeBasedCanary: {
          canaryInterval: intervalMinutes,
          canaryPercentage: percentage,
        },
      };
    } else if (props.type == CustomLambdaDeploymentConfigType.LINEAR) {
      routingConfig = {
        type: deploymentType,
        timeBasedLinear: {
          linearInterval: intervalMinutes,
          linearPercentage: percentage,
        },
      };
    }

    // Generates the name of the deployment config. It's also what you'll see in the AWS console
    // The name of the config is <construct unique id>.Lambda<deployment type><percentage>Percent<interval>Minutes
    // Unless the user provides an explicit name
    this.deploymentConfigName = props.deploymentConfigName
      ?? `${Names.uniqueId(this)}.Lambda${props.type}${props.percentage}Percent${props.type === CustomLambdaDeploymentConfigType.LINEAR
        ? 'Every'
        : ''}${props.interval.toMinutes()}Minutes`;
    this.deploymentConfigArn = arnForDeploymentConfig(this.deploymentConfigName);

    // The AWS Custom Resource that calls CodeDeploy to create and delete the resource
    new AwsCustomResource(this, 'DeploymentConfig', {
      onCreate: { // Run on creation only, to make the resource
        service: 'CodeDeploy',
        action: 'createDeploymentConfig',
        parameters: {
          deploymentConfigName: this.deploymentConfigName,
          computePlatform: 'Lambda',
          trafficRoutingConfig: routingConfig,
        },
        // This `resourceName` is the initial physical ID of the config
        physicalResourceId: PhysicalResourceId.of(this.deploymentConfigName),
      },
      onUpdate: { // Run on stack update
        service: 'CodeDeploy',
        action: 'createDeploymentConfig',
        parameters: {
          deploymentConfigName: this.deploymentConfigName,
          computePlatform: 'Lambda',
          trafficRoutingConfig: routingConfig,
        },
        // If `resourceName` is different from the last stack update (or creation),
        // the old config gets deleted and the new one is created
        physicalResourceId: PhysicalResourceId.of(this.deploymentConfigName),
      },
      onDelete: { // Run on deletion, or on resource replacement
        service: 'CodeDeploy',
        action: 'deleteDeploymentConfig',
        parameters: {
          deploymentConfigName: this.deploymentConfigName,
        },
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });
  }

  // Validate the inputs. The percentage/interval limits come from CodeDeploy
  private validateParameters(props: CustomLambdaDeploymentConfigProps): void {
    if ( !(1 <= props.percentage && props.percentage <= 99) ) {
      throw new Error(
        `Invalid deployment config percentage "${props.percentage.toString()}". \
        Step percentage must be an integer between 1 and 99.`);
    }
    if (props.interval.toMinutes() > 2880) {
      throw new Error(
        `Invalid deployment config interval "${props.interval.toString()}". \
        Traffic shifting intervals must be positive integers up to 2880 (2 days).`);
    }
  }
}
