import * as cdk from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnVirtualRouter } from './appmesh.generated';
import { IMesh, Mesh } from './mesh';
import { renderMeshOwner } from './private/utils';
import { Route, RouteBaseProps } from './route';
import { VirtualRouterListener } from './virtual-router-listener';

/**
 * Interface which all VirtualRouter based classes MUST implement
 */
export interface IVirtualRouter extends cdk.IResource {
  /**
   * The name of the VirtualRouter
   *
   * @attribute
   */
  readonly virtualRouterName: string;

  /**
   * The Amazon Resource Name (ARN) for the VirtualRouter
   *
   * @attribute
   */
  readonly virtualRouterArn: string;

  /**
   * The Mesh which the VirtualRouter belongs to
   */
  readonly mesh: IMesh;

  /**
   * Add a single route to the router
   */
  addRoute(id: string, props: RouteBaseProps): Route;
}

/**
 * Interface with base properties all routers willl inherit
 */
export interface VirtualRouterBaseProps {
  /**
   * Listener specification for the VirtualRouter
   *
   * @default - A listener on HTTP port 8080
   */
  readonly listeners?: VirtualRouterListener[];

  /**
   * The name of the VirtualRouter
   *
   * @default - A name is automatically determined
   */
  readonly virtualRouterName?: string;
}

abstract class VirtualRouterBase extends cdk.Resource implements IVirtualRouter {
  /**
   * The name of the VirtualRouter
   */
  public abstract readonly virtualRouterName: string;

  /**
   * The Amazon Resource Name (ARN) for the VirtualRouter
   */
  public abstract readonly virtualRouterArn: string;

  /**
   * The Mesh which the VirtualRouter belongs to
   */
  public abstract readonly mesh: IMesh;

  /**
   * Add a single route to the router
   */
  public addRoute(id: string, props: RouteBaseProps): Route {
    const route = new Route(this, id, {
      ...props,
      routeName: id,
      mesh: this.mesh,
      virtualRouter: this,
    });

    return route;
  }
}

/**
 * The properties used when creating a new VirtualRouter
 */
export interface VirtualRouterProps extends VirtualRouterBaseProps {
  /**
   * The Mesh which the VirtualRouter belongs to
   */
  readonly mesh: IMesh;
}

export class VirtualRouter extends VirtualRouterBase {
  /**
   * Import an existing VirtualRouter given an ARN
   */
  public static fromVirtualRouterArn(scope: Construct, id: string, virtualRouterArn: string): IVirtualRouter {
    return new class extends VirtualRouterBase {
      readonly virtualRouterArn = virtualRouterArn;
      private readonly parsedArn = cdk.Fn.split('/', cdk.Stack.of(scope).parseArn(virtualRouterArn).resourceName!);
      readonly virtualRouterName = cdk.Fn.select(2, this.parsedArn);
      readonly mesh = Mesh.fromMeshName(this, 'Mesh', cdk.Fn.select(0, this.parsedArn));
    }(scope, id);
  }

  /**
   * Import an existing VirtualRouter given attributes
   */
  public static fromVirtualRouterAttributes(scope: Construct, id: string, attrs: VirtualRouterAttributes): IVirtualRouter {
    return new class extends VirtualRouterBase {
      readonly virtualRouterName = attrs.virtualRouterName;
      readonly mesh = attrs.mesh;
      readonly virtualRouterArn = cdk.Stack.of(this).formatArn({
        service: 'appmesh',
        resource: `mesh/${attrs.mesh.meshName}/virtualRouter`,
        resourceName: this.virtualRouterName,
      });
    }(scope, id);
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
   * The Mesh which the VirtualRouter belongs to
   */
  public readonly mesh: IMesh;

  private readonly listeners = new Array<CfnVirtualRouter.VirtualRouterListenerProperty>();

  constructor(scope: Construct, id: string, props: VirtualRouterProps) {
    super(scope, id, {
      physicalName: props.virtualRouterName || cdk.Lazy.string({ produce: () => cdk.Names.uniqueId(this) }),
    });

    this.mesh = props.mesh;
    if (props.listeners && props.listeners.length) {
      props.listeners.forEach(listener => this.addListener(listener));
    } else {
      this.addListener(VirtualRouterListener.http());
    }

    const router = new CfnVirtualRouter(this, 'Resource', {
      virtualRouterName: this.physicalName,
      meshName: this.mesh.meshName,
      meshOwner: renderMeshOwner(this.env.account, this.mesh.env.account),
      spec: {
        listeners: this.listeners,
      },
    });

    this.virtualRouterName = this.getResourceNameAttribute(router.attrVirtualRouterName);
    this.virtualRouterArn = this.getResourceArnAttribute(router.ref, {
      service: 'appmesh',
      resource: `mesh/${props.mesh.meshName}/virtualRouter`,
      resourceName: this.physicalName,
    });
  }

  /**
   * Add port mappings to the router
   */
  private addListener(listener: VirtualRouterListener) {
    this.listeners.push(listener.bind(this).listener);
  }
}

/**
 * Interface with properties ncecessary to import a reusable VirtualRouter
 */
export interface VirtualRouterAttributes {
  /**
   * The name of the VirtualRouter
   */
  readonly virtualRouterName: string;

  /**
   * The Mesh which the VirtualRouter belongs to
   */
  readonly mesh: IMesh;
}
