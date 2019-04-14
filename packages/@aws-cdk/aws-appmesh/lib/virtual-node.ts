import * as cdk from '@aws-cdk/cdk';
import { CfnVirtualNode } from './appmesh.generated';
import { HealthCheckProps, ListenerProps, NAME_TAG, PortMappingProps, Protocol } from './shared-interfaces';

// TODO: Add import() and eport() capabilities

export interface VirtualNodeBackendProps {
  readonly virtualServiceName: string;
}

export interface VirtualNodeProps {
  readonly meshName: string;
  readonly nodeName?: string;
  readonly hostname: string;
  readonly namespaceName: string;
  /**
   * @default none
   * if not provided must call addBackends()
   */
  readonly backends?: VirtualNodeBackendProps[];
  /**
   * @default none
   * if not specified must call addListeners(), addPortMappings() or addPortAndHealthCheckMappings()
   */
  readonly listeners?: ListenerProps;
}

export class VirtualNode extends cdk.Construct {
  public readonly meshName: string;
  public readonly virtualNodeName: string;
  public readonly virtualNodeArn: string;
  public readonly virtualNodeMeshName: string;

  private readonly backends: CfnVirtualNode.BackendProperty[] = [];
  private readonly listeners: CfnVirtualNode.ListenerProperty[] = [];
  private readonly namespaceName: string;

  constructor(scope: cdk.Construct, id: string, props: VirtualNodeProps) {
    super(scope, id);

    this.meshName = props.meshName;
    this.virtualNodeMeshName = this.meshName;
    this.namespaceName = props.namespaceName;

    if (props.backends) {
      this.addBackends(props.backends);
    }

    if (props.listeners) {
      this.addListeners(props.listeners);
    }

    this.node.apply(new cdk.Tag(NAME_TAG, this.node.path));
    const name = props.nodeName ? props.nodeName : id;

    const node = new CfnVirtualNode(this, 'VirtualNode', {
      virtualNodeName: name,
      meshName: this.meshName,
      spec: {
        backends: this.backends,
        listeners: this.listeners,
        serviceDiscovery: {
          dns: {
            hostname: `${props.hostname}.${this.namespaceName}`,
          },
        },
        logging: {
          accessLog: {
            file: {
              path: '/dev/stdoout',
            },
          },
        },
      },
    });

    this.virtualNodeName = node.virtualNodeName;
    this.virtualNodeArn = node.virtualNodeArn;
  }

  public addBackends(props: VirtualNodeBackendProps[]) {
    props.forEach(s => {
      this.backends.push({
        virtualService: {
          virtualServiceName: s.virtualServiceName,
        },
      });
    });
  }

  public addListeners(props: ListenerProps) {
    if (props.healthChecks && !props.portMappings) {
      throw new Error('Cannot provide healthchecks, without port mappings... impossible');
    } else if (props && props.portMappings && props.healthChecks) {
      this.addPortAndHealthCheckMappings(props.portMappings, props.healthChecks);
    } else if (props.portMappings) {
      this.addPortMappings(props.portMappings);
    } else {
      this.addPortMappings([{ port: 8080, protocol: Protocol.HTTP }]);
    }
  }

  public addPortMappings(props: PortMappingProps[]) {
    props.forEach(p => {
      this.listeners.push({
        portMapping: {
          port: p.port || 8080,
          protocol: p.protocol,
        },
      });
    });
  }

  public addPortAndHealthCheckMappings(ports: PortMappingProps[], health: HealthCheckProps[]) {
    if (ports.length != health.length) {
      throw new Error('Must provide the same number of health checks and port mappings.');
    }

    for (let i = 0; i < ports.length; i++) {
      this.listeners.push({
        portMapping: {
          port: ports[i].port,
          protocol: ports[i].protocol,
        },
        healthCheck: {
          healthyThreshold: health[i].healthyThreshold || 2,
          intervalMillis: health[i].interval || 5000, // min
          path: health[i].path || health[i].protocol === Protocol.HTTP ? '/' : undefined,
          port: health[i].port || 8080,
          protocol: health[i].protocol || Protocol.HTTP,
          timeoutMillis: health[i].timeout || 2000,
          unhealthyThreshold: health[i].unhealthyThreshold || 2,
        },
      });
    }
  }
}
