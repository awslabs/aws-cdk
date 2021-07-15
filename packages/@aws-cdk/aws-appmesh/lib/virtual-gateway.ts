import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnVirtualGateway } from './appmesh.generated';
import { GatewayRoute, GatewayRouteBaseProps } from './gateway-route';
import { IMesh, Mesh } from './mesh';
import { renderTlsClientPolicy, renderMeshOwner } from './private/utils';
import { AccessLog, BackendDefaults } from './shared-interfaces';
import { VirtualGatewayListener, VirtualGatewayListenerConfig } from './virtual-gateway-listener';

/**
 * Interface which all Virtual Gateway based classes must implement
 */
export interface IVirtualGateway extends cdk.IResource {
  /**
   * Name of the VirtualGateway
   *
   * @attribute
   */
  readonly virtualGatewayName: string;

  /**
   * The Amazon Resource Name (ARN) for the VirtualGateway
   *
   * @attribute
   */
  readonly virtualGatewayArn: string;

  /**
   * The Mesh which the VirtualGateway belongs to
   */
  readonly mesh: IMesh;

  /**
   * Utility method to add a new GatewayRoute to the VirtualGateway
   */
  addGatewayRoute(id: string, route: GatewayRouteBaseProps): GatewayRoute;

  /**
   * Grants the given entity `appmesh:StreamAggregatedResources`.
   */
  grantStreamAggregatedResources(identity: iam.IGrantable): iam.Grant;
}

/**
 * Basic configuration properties for a VirtualGateway
 */
export interface VirtualGatewayBaseProps {
  /**
   * Name of the VirtualGateway
   *
   * @default - A name is automatically determined
   */
  readonly virtualGatewayName?: string;

  /**
   * Listeners for the VirtualGateway. Only one is supported.
   *
   * @default - Single HTTP listener on port 8080
   */
  readonly listeners?: VirtualGatewayListener[];

  /**
   * Access Logging Configuration for the VirtualGateway
   *
   * @default - no access logging
   */
  readonly accessLog?: AccessLog;

  /**
   * Default Configuration Virtual Node uses to communicate with Virtual Service
   *
   * @default - No Config
   */
  readonly backendDefaults?: BackendDefaults;
}

/**
 * Properties used when creating a new VirtualGateway
 */
export interface VirtualGatewayProps extends VirtualGatewayBaseProps {
  /**
   * The Mesh which the VirtualGateway belongs to
   */
  readonly mesh: IMesh;
}

abstract class VirtualGatewayBase extends cdk.Resource implements IVirtualGateway {
  /**
   * Name of the VirtualGateway
   */
  public abstract readonly virtualGatewayName: string;

  /**
   * The Amazon Resource Name (ARN) for the VirtualGateway
   */
  public abstract readonly virtualGatewayArn: string;

  /**
   * The Mesh which the VirtualGateway belongs to
   */
  public abstract readonly mesh: IMesh;

  /**
   * Utility method to add a new GatewayRoute to the VirtualGateway
   */
  public addGatewayRoute(id: string, props: GatewayRouteBaseProps): GatewayRoute {
    return new GatewayRoute(this, id, {
      ...props,
      virtualGateway: this,
    });
  }

  public grantStreamAggregatedResources(identity: iam.IGrantable): iam.Grant {
    return iam.Grant.addToPrincipal({
      grantee: identity,
      actions: ['appmesh:StreamAggregatedResources'],
      resourceArns: [this.virtualGatewayArn],
    });
  }
}

/**
 * VirtualGateway represents a newly defined App Mesh Virtual Gateway
 *
 * A virtual gateway allows resources that are outside of your mesh to communicate to resources that
 * are inside of your mesh.
 *
 * @see https://docs.aws.amazon.com/app-mesh/latest/userguide/virtual_gateways.html
 */
export class VirtualGateway extends VirtualGatewayBase {
  /**
   * Import an existing VirtualGateway given an ARN
   */
  public static fromVirtualGatewayArn(scope: Construct, id: string, virtualGatewayArn: string): IVirtualGateway {
    return new class extends VirtualGatewayBase {
      private readonly parsedArn = cdk.Fn.split('/', cdk.Stack.of(scope).parseArn(virtualGatewayArn).resourceName!);
      readonly mesh = Mesh.fromMeshName(this, 'Mesh', cdk.Fn.select(0, this.parsedArn));
      readonly virtualGatewayArn = virtualGatewayArn;
      readonly virtualGatewayName = cdk.Fn.select(2, this.parsedArn);
    }(scope, id);
  }

  /**
   * Import an existing VirtualGateway given its attributes
   */
  public static fromVirtualGatewayAttributes(scope: Construct, id: string, attrs: VirtualGatewayAttributes): IVirtualGateway {
    return new class extends VirtualGatewayBase {
      readonly mesh = attrs.mesh;
      readonly virtualGatewayName = attrs.virtualGatewayName;
      readonly virtualGatewayArn = cdk.Stack.of(this).formatArn({
        service: 'appmesh',
        resource: `mesh/${attrs.mesh.meshName}/virtualGateway`,
        resourceName: this.virtualGatewayName,
      });
    }(scope, id);
  }

  /**
   * The name of the VirtualGateway
   */
  public readonly virtualGatewayName: string;

  /**
   * The Amazon Resource Name (ARN) for the VirtualGateway
   */
  public readonly virtualGatewayArn: string;

  /**
   * The Mesh that the VirtualGateway belongs to
   */
  public readonly mesh: IMesh;

  protected readonly listeners = new Array<VirtualGatewayListenerConfig>();

  constructor(scope: Construct, id: string, props: VirtualGatewayProps) {
    super(scope, id, {
      physicalName: props.virtualGatewayName || cdk.Lazy.string({ produce: () => cdk.Names.uniqueId(this) }),
    });

    this.mesh = props.mesh;

    if (!props.listeners) {
      // Use listener default of http listener port 8080 if no listener is defined
      this.listeners.push(VirtualGatewayListener.http().bind(this));
    } else {
      props.listeners.forEach(listener => this.listeners.push(listener.bind(this)));
    }

    const accessLogging = props.accessLog?.bind(this);

    const node = new CfnVirtualGateway(this, 'Resource', {
      virtualGatewayName: this.physicalName,
      meshName: this.mesh.meshName,
      meshOwner: renderMeshOwner(this.env.account, this.mesh.env.account),
      spec: {
        listeners: this.listeners.map(listener => listener.listener),
        backendDefaults: props.backendDefaults !== undefined
          ? {
            clientPolicy: {
              tls: renderTlsClientPolicy(this, props.backendDefaults?.tlsClientPolicy),
            },
          }
          : undefined,
        logging: accessLogging !== undefined ? {
          accessLog: accessLogging.virtualGatewayAccessLog,
        } : undefined,
      },
    });

    this.virtualGatewayName = this.getResourceNameAttribute(node.attrVirtualGatewayName);
    this.virtualGatewayArn = this.getResourceArnAttribute(node.ref, {
      service: 'appmesh',
      resource: `mesh/${props.mesh.meshName}/virtualGateway`,
      resourceName: this.physicalName,
    });
  }
}

/**
 * Unterface with properties necessary to import a reusable VirtualGateway
 */
export interface VirtualGatewayAttributes {
  /**
   * The name of the VirtualGateway
   */
  readonly virtualGatewayName: string;

  /**
   * The Mesh that the VirtualGateway belongs to
   */
  readonly mesh: IMesh;
}
