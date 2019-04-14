import cdk = require('@aws-cdk/cdk');
import { CfnVirtualRouter } from './appmesh.generated';
import { NAME_TAG, PortMappingProps, Protocol } from './shared-interfaces';
import { VirtualRoute, VirtualRouteBaseProps } from './virtual-route';

// TODO: Add import() and eport() capabilities

/**
 * Interface with base properties all routers willl inherit
 */
export interface VirtualRouterBaseProps {
  /**
   * Array of PortMappingProps for the virtual router
   */
  readonly portMappings: PortMappingProps[];
  /**
   * The name of the VirtualRouter
   */
  readonly virtualRouterName?: string;
}

/**
 * The properties used when creating a new VritualRouter
 */
export interface VirtualRouterProps extends VirtualRouterBaseProps {
  /**
   * The name of the AppMesh mesh the VirtualRouter belongs to
   */
  readonly meshName: string;
}

export class VirtualRouter extends cdk.Construct {
  /**
   * The name of the VirtualRouter
   *
   * @default id - if not provided in props
   * @type {string}
   * @memberof VirtualRouter
   */
  public readonly virtualRouterName: string;
  /**
   * The Amazon Resource Name (ARN) for the VirtualRouter
   *
   * @type {string}
   * @memberof VirtualRouter
   */
  public readonly virtualRouterArn: string;
  /**
   * The name of the AppMesh mesh for which this router belongs to
   *
   * @type {string}
   * @memberof VirtualRouter
   */
  public readonly meshName: string;
  /**
   * The routes that this router forwards to
   *
   * @type {VirtualRoute[]}
   * @memberof VirtualRouter
   */
  public readonly routes: VirtualRoute[] = [];

  private readonly listeners: CfnVirtualRouter.VirtualRouterListenerProperty[] = [];

  constructor(scope: cdk.Construct, id: string, props: VirtualRouterProps) {
    super(scope, id);

    this.meshName = props.meshName;

    this.node.apply(new cdk.Tag(NAME_TAG, this.node.path));
    const name = props && props.virtualRouterName ? props.virtualRouterName : this.node.id;

    this.addListeners(props);

    const router = new CfnVirtualRouter(this, 'VirtualRouter', {
      virtualRouterName: name,
      meshName: this.meshName,
      spec: {
        listeners: this.listeners,
      },
    });

    this.virtualRouterName = router.virtualRouterName;
    this.virtualRouterArn = router.virtualRouterArn;
  }

  /**
   * Utility method for adding a single route to the router
   *
   * @param {string} id
   * @param {AddVirtualRouteProps} props
   * @returns
   * @memberof VirtualRouter
   */
  public addRoute(id: string, props: VirtualRouteBaseProps) {
    const route = new VirtualRoute(this, id, {
      virtualRouteName: id,
      meshName: this.meshName,
      virtualRouterName: this.virtualRouterName,
      routeTargets: props.routeTargets,
      isHttpRoute: props.isHttpRoute,
      prefix: props.prefix,
    });
    this.routes.push(route);

    return route;
  }

  /**
   * Utility method to add multiple routes to the router
   *
   * @param {string[]} ids
   * @param {AddVirtualRouteProps[]} props
   * @returns
   * @memberof VirtualRouter
   */
  public addRoutes(ids: string[], props: VirtualRouteBaseProps[]) {
    const routes: VirtualRoute[] = [];

    if (ids.length != props.length) {
      throw new Error('Routes must have the same number of IDs and RouteProps.');
    }

    for (let i = 0; i < ids.length; i++) {
      const route = new VirtualRoute(this, ids[i], {
        virtualRouteName: ids[i],
        meshName: this.meshName,
        virtualRouterName: this.virtualRouterName,
        routeTargets: props[i].routeTargets,
        isHttpRoute: props[i].isHttpRoute,
        prefix: props[i].prefix,
      });
      this.routes.push(route);
      routes.push(route);
    }

    return routes;
  }

  /**
   * Add listeners to the router, such as ports and protocols
   *
   * @private
   * @param {VirtualRouterBaseProps} props
   * @memberof VirtualRouter
   */
  private addListeners(props: VirtualRouterBaseProps) {
    if (props && props.portMappings) {
      this.addPortMappings(props.portMappings);
    } else {
      const portMappings = [{ port: 8080, protocol: Protocol.HTTP }];
      this.addPortMappings(portMappings);
    }
  }

  private addPortMappings(props: PortMappingProps[]) {
    props.forEach(p => {
      this.listeners.push({
        portMapping: {
          port: p.port,
          protocol: p.protocol,
        },
      });
    });
  }
}
