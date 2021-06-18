import { IResource, Resource } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnApplication } from '../codedeploy.generated';
import { arnForApplication } from '../utils';

/**
 * Represents a reference to a CodeDeploy Application deploying to EC2/on-premise instances.
 *
 * If you're managing the Application alongside the rest of your CDK resources,
 * use the {@link ServerApplication} class.
 *
 * If you want to reference an already existing Application,
 * or one defined in a different CDK Stack,
 * use the {@link #fromServerApplicationName} method.
 */
export interface IServerApplication extends IResource {
  /** @attribute */
  readonly applicationArn: string;

  /** @attribute */
  readonly applicationName: string;
}

/**
 * Construction properties for {@link ServerApplication}.
 */
export interface ServerApplicationProps {
  /**
   * The physical, human-readable name of the CodeDeploy Application.
   *
   * @default an auto-generated name will be used
   */
  readonly applicationName?: string;
}

/**
 * A CodeDeploy Application that deploys to EC2/on-premise instances.
 *
 * @resource AWS::CodeDeploy::Application
 */
export class ServerApplication extends Resource implements IServerApplication {
  /**
   * Import an Application defined either outside the CDK app, or in a different region.
   *
   * @param scope the parent Construct for this new Construct
   * @param id the logical ID of this new Construct
   * @param serverApplicationName the name of the application to import
   * @returns a Construct representing a reference to an existing Application
   */
  public static fromServerApplicationName(scope: Construct, id: string, serverApplicationName: string): IServerApplication {
    class Import extends Resource implements IServerApplication {
      public readonly applicationArn = arnForApplication(serverApplicationName);
      public readonly applicationName = serverApplicationName;
    }

    return new Import(scope, id);
  }

  public readonly applicationArn: string;
  public readonly applicationName: string;

  constructor(scope: Construct, id: string, props: ServerApplicationProps = {}) {
    super(scope, id, {
      physicalName: props.applicationName,
    });

    const resource = new CfnApplication(this, 'Resource', {
      applicationName: this.physicalName,
      computePlatform: 'Server',
    });

    this.applicationName = this.getResourceNameAttribute(resource.ref);
    this.applicationArn = this.getResourceArnAttribute(arnForApplication(resource.ref), {
      service: 'codedeploy',
      resource: 'application',
      resourceName: this.physicalName,
      sep: ':',
    });
  }
}
