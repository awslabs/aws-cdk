import cdk = require('@aws-cdk/cdk');

import { CfnVirtualRouter } from './appmesh.generated';
import { IMesh } from './mesh';
import { NAME_TAG, PortMappingProps, Protocol } from './shared-interfaces';
import { Route, RouteBaseProps } from './virtual-route';

/**
 * Interface with properties ncecessary to import a reusable VirtualRouter
 */
export interface VirtualRouterImportProps {
  /**
   * The name of the VirtualRouter
   */
  readonly virtualRouterName: string;

  /**
   * The Amazon Resource Name (ARN) for the VirtualRouter
   */
  readonly virtualRouterArn: string;

  /**
   * The unique identifier for the virtual router
   */
  readonly virtualRouterUid: string;

  /**
   * The AppMesh mesh the VirtualRouter belongs to
   */
  readonly mesh: IMesh;
}
/**
 * Interface which all VirtualRouter based classes MUST implement
 */
export interface IVirtualRouter extends cdk.IConstruct {
  /**
   * The name of the VirtualRouter
   */
  readonly virtualRouterName: string;

  /**
   * The Amazon Resource Name (ARN) for the VirtualRouter
   */
  readonly virtualRouterArn: string;

  /**
   * The unique identifier for the virtual router
   */
  readonly virtualRouterUid: string;

  /**
   * Utility method for adding a single route to the router
   */
  addRoute(id: string, props: RouteBaseProps): Route;

  /**
   * Utility method to add multiple routes to the router
   */
  addRoutes(ids: string[], props: RouteBaseProps[]): Route[];

  /**
   * Exports properties for reusable VirtualRouter
   */
  export(): VirtualRouterImportProps;
}

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

export abstract class VirtualRouterBase extends cdk.Construct implements IVirtualRouter {
  /**
   * The name of the VirtualRouter
   */
  public abstract readonly virtualRouterName: string;

  /**
   * The Amazon Resource Name (ARN) for the VirtualRouter
   */
  public abstract readonly virtualRouterArn: string;

  /**
   * The unique identifier for the virtual router
   */
  public abstract readonly virtualRouterUid: string;

  /**
   * The AppMesh mesh the VirtualRouter belongs to
   */
  public abstract readonly mesh: IMesh;

  /**
   * Exports properties for reusable VirtualRouter
   */
  public abstract export(): VirtualRouterImportProps;

  /**
   * Utility method for adding a single route to the router
   */
  public addRoute(id: string, props: RouteBaseProps) {
    const route = new Route(this, id, {
      routeName: id,
      mesh: this.mesh,
      virtualRouterName: this.virtualRouterName,
      routeTargets: props.routeTargets,
      isHttpRoute: props.isHttpRoute,
      prefix: props.prefix,
    });

    return route;
  }

  /**
   * Utility method to add multiple routes to the router
   */
  public addRoutes(ids: string[], props: RouteBaseProps[]) {
    const routes = new Array<Route>();

    if (ids.length < 1 || props.length < 1) {
      throw new Error('When adding routes, IDs and Route Properties cannot be empty.');
    }
    if (ids.length !== props.length) {
      throw new Error('Routes must have the same number of IDs and RouteProps.');
    }

    for (let i = 0; i < ids.length; i++) {
      const route = new Route(this, ids[i], {
        routeName: ids[i],
        mesh: this.mesh,
        virtualRouterName: this.virtualRouterName,
        routeTargets: props[i].routeTargets,
        isHttpRoute: props[i].isHttpRoute,
        prefix: props[i].prefix,
      });
      routes.push(route);
    }

    return routes;
  }
}

/**
 * The properties used when creating a new VritualRouter
 */
export interface VirtualRouterProps extends VirtualRouterBaseProps {
  /**
   * The AppMesh mesh the VirtualRouter belongs to
   */
  readonly mesh: IMesh;
}

export class VirtualRouter extends VirtualRouterBase {
  /**
   * A static method to import a VirtualRouter an make it re-usable accross stacks
   */
  public static import(scope: cdk.Construct, id: string, props: VirtualRouterImportProps): IVirtualRouter {
    return new ImportedVirtualRouter(scope, id, props);
  }

  /**
   * The name of the VirtualRouter
   */
  public readonly virtualRouterName: string;

  /**
   * The Amazon Resource Name (ARN) for the VirtualRouter
   */
  public readonly virtualRouterArn: string;

  /**
   * The unique identifier for the virtual router
   */
  public readonly virtualRouterUid: string;

  /**
   * The AppMesh mesh name for whiich the VirtualService belongs to
   */
  public readonly virtualNodeMeshName: string;

  /**
   * The AppMesh mesh the VirtualRouter belongs to
   */
  public readonly mesh: IMesh;

  private readonly listeners = new Array<CfnVirtualRouter.VirtualRouterListenerProperty>();

  constructor(scope: cdk.Construct, id: string, props: VirtualRouterProps) {
    super(scope, id);

    this.mesh = props.mesh;
    this.virtualNodeMeshName = this.mesh.meshName;

    this.node.apply(new cdk.Tag(NAME_TAG, this.node.path));
    const name = props && props.virtualRouterName ? props.virtualRouterName : this.node.id;

    this.addListeners(props);

    const router = new CfnVirtualRouter(this, 'VirtualRouter', {
      virtualRouterName: name,
      meshName: this.mesh.meshName,
      spec: {
        listeners: this.listeners,
      },
    });

    this.virtualRouterName = router.virtualRouterName;
    this.virtualRouterArn = router.virtualRouterArn;
    this.virtualRouterUid = router.virtualRouterUid;
  }

  /**
   * Exports properties for reusable VirtualRouter
   */
  public export(): VirtualRouterImportProps {
    return {
      virtualRouterName: this.virtualRouterName,
      virtualRouterArn: this.virtualRouterArn,
      virtualRouterUid: this.virtualRouterUid,
      mesh: this.mesh,
    };
  }

  /**
   * Add listeners to the router, such as ports and protocols
   */
  private addListeners(props: VirtualRouterBaseProps) {
    if (props.portMappings.length <= 0) {
      throw new Error('Portmappings cannot be empty for VirtualRouter listeners');
    }

    if (props.portMappings) {
      this.addPortMappings(props.portMappings);
    } else {
      const portMappings = [{ port: 8080, protocol: Protocol.HTTP }];
      this.addPortMappings(portMappings);
    }
  }

  private addPortMappings(props: PortMappingProps[]) {
    if (props.length <= 0) {
      throw new Error('Portmappings cannot be empty for VirtualRouter listeners');
    }

    for (const p of props) {
      this.listeners.push({
        portMapping: {
          port: p.port,
          protocol: p.protocol,
        },
      });
    }
  }
}

/**
 * Used to import a VirtualRouter and perform actions or read properties from
 */
export class ImportedVirtualRouter extends VirtualRouterBase {
  /**
   * The name of the VirtualRouter
   */
  public readonly virtualRouterName: string;

  /**
   * The Amazon Resource Name (ARN) for the VirtualRouter
   */
  public readonly virtualRouterArn: string;

  /**
   * The unique identifier for the virtual router
   */
  public readonly virtualRouterUid: string;

  /**
   * The AppMesh mesh the VirtualRouter belongs to
   */
  public readonly mesh: IMesh;

  constructor(scope: cdk.Construct, id: string, props: VirtualRouterImportProps) {
    super(scope, id);

    this.virtualRouterName = props.virtualRouterName;
    this.virtualRouterArn = props.virtualRouterArn;
    this.virtualRouterUid = props.virtualRouterUid;
    this.mesh = props.mesh;
  }

  /**
   * Exports the VirtualRouter to re-use accross stacks
   */
  public export(): VirtualRouterImportProps {
    return {
      virtualRouterName: this.virtualRouterName,
      virtualRouterArn: this.virtualRouterArn,
      virtualRouterUid: this.virtualRouterUid,
      mesh: this.mesh,
    };
  }
}
