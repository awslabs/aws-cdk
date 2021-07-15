import * as cdk from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnGatewayRoute } from './appmesh.generated';
import { GatewayRouteSpec } from './gateway-route-spec';
import { renderMeshOwner } from './private/utils';
import { IVirtualGateway, VirtualGateway } from './virtual-gateway';

/**
 * Interface for which all GatewayRoute based classes MUST implement
 */
export interface IGatewayRoute extends cdk.IResource {
  /**
   * The name of the GatewayRoute
   *
   * @attribute
   */
  readonly gatewayRouteName: string,

  /**
   * The Amazon Resource Name (ARN) for the GatewayRoute
   *
   * @attribute
   */
  readonly gatewayRouteArn: string;

  /**
   * The VirtualGateway the GatewayRoute belongs to
   */
  readonly virtualGateway: IVirtualGateway;
}

/**
 * Basic configuration properties for a GatewayRoute
 */
export interface GatewayRouteBaseProps {
  /**
   * The name of the GatewayRoute
   *
   * @default - an automatically generated name
   */
  readonly gatewayRouteName?: string;

  /**
   * What protocol the route uses
   */
  readonly routeSpec: GatewayRouteSpec;
}

/**
 * Properties to define a new GatewayRoute
 */
export interface GatewayRouteProps extends GatewayRouteBaseProps {
  /**
   * The VirtualGateway this GatewayRoute is associated with
   */
  readonly virtualGateway: IVirtualGateway;
}

/**
 * GatewayRoute represents a new or existing gateway route attached to a VirtualGateway and Mesh
 *
 * @see https://docs.aws.amazon.com/app-mesh/latest/userguide/gateway-routes.html
 */
export class GatewayRoute extends cdk.Resource implements IGatewayRoute {
  /**
   * Import an existing GatewayRoute given an ARN
   */
  public static fromGatewayRouteArn(scope: Construct, id: string, gatewayRouteArn: string): IGatewayRoute {
    return new class extends cdk.Resource implements IGatewayRoute {
      readonly gatewayRouteArn = gatewayRouteArn;
      readonly gatewayRouteName = cdk.Fn.select(4, cdk.Fn.split('/', cdk.Stack.of(scope).parseArn(gatewayRouteArn).resourceName!));
      readonly virtualGateway = VirtualGateway.fromVirtualGatewayArn(this, 'virtualGateway', gatewayRouteArn);
    }(scope, id);
  }

  /**
   * Import an existing GatewayRoute given attributes
   */
  public static fromGatewayRouteAttributes(scope: Construct, id: string, attrs: GatewayRouteAttributes): IGatewayRoute {
    return new class extends cdk.Resource implements IGatewayRoute {
      readonly gatewayRouteName = attrs.gatewayRouteName;
      readonly gatewayRouteArn = cdk.Stack.of(scope).formatArn({
        service: 'appmesh',
        resource: `mesh/${attrs.virtualGateway.mesh.meshName}/virtualGateway/${attrs.virtualGateway.virtualGatewayName}/gatewayRoute`,
        resourceName: this.gatewayRouteName,
      });
      readonly virtualGateway = attrs.virtualGateway;
    }(scope, id);
  }

  /**
   * The name of the GatewayRoute
   */
  public readonly gatewayRouteName: string;

  /**
   * The Amazon Resource Name (ARN) for the GatewayRoute
   */
  public readonly gatewayRouteArn: string;

  /**
   * The VirtualGateway this GatewayRoute is a part of
   */
  public readonly virtualGateway: IVirtualGateway;

  constructor(scope: Construct, id: string, props: GatewayRouteProps) {
    super(scope, id, {
      physicalName: props.gatewayRouteName || cdk.Lazy.string({ produce: () => cdk.Names.uniqueId(this) }),
    });

    this.virtualGateway = props.virtualGateway;
    const routeSpecConfig = props.routeSpec.bind(this);

    const gatewayRoute = new CfnGatewayRoute(this, 'Resource', {
      gatewayRouteName: this.physicalName,
      meshName: props.virtualGateway.mesh.meshName,
      meshOwner: renderMeshOwner(this.env.account, this.virtualGateway.mesh.env.account),
      spec: {
        httpRoute: routeSpecConfig.httpSpecConfig,
        http2Route: routeSpecConfig.http2SpecConfig,
        grpcRoute: routeSpecConfig.grpcSpecConfig,
      },
      virtualGatewayName: this.virtualGateway.virtualGatewayName,
    });

    this.gatewayRouteName = this.getResourceNameAttribute(gatewayRoute.attrGatewayRouteName);
    this.gatewayRouteArn = this.getResourceArnAttribute(gatewayRoute.ref, {
      service: 'appmesh',
      resource: `mesh/${props.virtualGateway.mesh.meshName}/virtualRouter/${this.virtualGateway.virtualGatewayName}/gatewayRoute`,
      resourceName: this.physicalName,
    });
  }
}

/**
 * Interface with properties necessary to import a reusable GatewayRoute
 */
export interface GatewayRouteAttributes {
  /**
   * The name of the GatewayRoute
   */
  readonly gatewayRouteName: string;

  /**
   * The VirtualGateway this GatewayRoute is associated with.
   */
  readonly virtualGateway: IVirtualGateway;
}
