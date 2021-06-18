import * as cdk from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnDeploymentConfig } from '../codedeploy.generated';
import { arnForDeploymentConfig } from '../utils';

/**
 * The Deployment Configuration of an EC2/on-premise Deployment Group.
 * The default, pre-defined Configurations are available as constants on the {@link ServerDeploymentConfig} class
 * (`ServerDeploymentConfig.HALF_AT_A_TIME`, `ServerDeploymentConfig.ALL_AT_ONCE`, etc.).
 * To create a custom Deployment Configuration,
 * instantiate the {@link ServerDeploymentConfig} Construct.
 */
export interface IServerDeploymentConfig {
  /**
   * @attribute
   */
  readonly deploymentConfigName: string;

  /**
   * @attribute
   */
  readonly deploymentConfigArn: string;
}

/**
 * Minimum number of healthy hosts for a server deployment.
 */
export class MinimumHealthyHosts {
  /**
   * The minimum healhty hosts threshold expressed as an absolute number.
   */
  public static count(value: number): MinimumHealthyHosts {
    return new MinimumHealthyHosts({
      type: 'HOST_COUNT',
      value,
    });
  }

  /**
   * The minmum healhty hosts threshold expressed as a percentage of the fleet.
   */
  public static percentage(value: number): MinimumHealthyHosts {
    return new MinimumHealthyHosts({
      type: 'FLEET_PERCENT',
      value,
    });
  }

  private constructor(private readonly json: CfnDeploymentConfig.MinimumHealthyHostsProperty) { }

  /**
   * @internal
   */
  public get _json() {
    return this.json;
  }
}

/**
 * Construction properties of {@link ServerDeploymentConfig}.
 */
export interface ServerDeploymentConfigProps {
  /**
   * The physical, human-readable name of the Deployment Configuration.
   *
   * @default a name will be auto-generated
   */
  readonly deploymentConfigName?: string;

  /**
   * Minimum number of healthy hosts.
   */
  readonly minimumHealthyHosts: MinimumHealthyHosts;
}

/**
 * A custom Deployment Configuration for an EC2/on-premise Deployment Group.
 *
 * @resource AWS::CodeDeploy::DeploymentConfig
 */
export class ServerDeploymentConfig extends cdk.Resource implements IServerDeploymentConfig {
  public static readonly ONE_AT_A_TIME = deploymentConfig('CodeDeployDefault.OneAtATime');
  public static readonly HALF_AT_A_TIME = deploymentConfig('CodeDeployDefault.HalfAtATime');
  public static readonly ALL_AT_ONCE = deploymentConfig('CodeDeployDefault.AllAtOnce');

  /**
   * Import a custom Deployment Configuration for an EC2/on-premise Deployment Group defined either outside the CDK app,
   * or in a different region.
   *
   * @param scope the parent Construct for this new Construct
   * @param id the logical ID of this new Construct
   * @param serverDeploymentConfigName the properties of the referenced custom Deployment Configuration
   * @returns a Construct representing a reference to an existing custom Deployment Configuration
   */
  public static fromServerDeploymentConfigName(
    scope: Construct,
    id: string,
    serverDeploymentConfigName: string): IServerDeploymentConfig {
    ignore(scope);
    ignore(id);
    return deploymentConfig(serverDeploymentConfigName);
  }

  public readonly deploymentConfigName: string;
  public readonly deploymentConfigArn: string;

  constructor(scope: Construct, id: string, props: ServerDeploymentConfigProps) {
    super(scope, id, {
      physicalName: props.deploymentConfigName,
    });

    const resource = new CfnDeploymentConfig(this, 'Resource', {
      deploymentConfigName: this.physicalName,
      minimumHealthyHosts: props.minimumHealthyHosts._json,
    });

    this.deploymentConfigName = resource.ref;
    this.deploymentConfigArn = arnForDeploymentConfig(this.deploymentConfigName);
  }
}

function deploymentConfig(name: string): IServerDeploymentConfig {
  return {
    deploymentConfigName: name,
    deploymentConfigArn: arnForDeploymentConfig(name),
  };
}

function ignore(_x: any) { return; }
