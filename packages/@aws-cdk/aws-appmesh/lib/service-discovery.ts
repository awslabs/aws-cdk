import * as cloudmap from '@aws-cdk/aws-servicediscovery';
import { CfnVirtualNode } from './appmesh.generated';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '@aws-cdk/core';

/**
 * Properties for VirtualNode Service Discovery
 */
export interface ServiceDiscoveryConfig {
  /**
   * DNS based Service Discovery
   *
   * @default - no DNS based service discovery
   */
  readonly dns?: CfnVirtualNode.DnsServiceDiscoveryProperty;

  /**
   * Cloud Map based Service Discovery
   *
   * @default - no Cloud Map based service discovery
   */
  readonly cloudmap?: CfnVirtualNode.AwsCloudMapServiceDiscoveryProperty;
}

/**
 * Enum of DNS service discovery response type
 */
export enum DnsResponseType {
  /**
   * DNS resolver returns a loadbalanced set of endpoints and the traffic would be sent to the given endpoints.
   * It would not drain existing connections to other endpoints that are not part of this list.
   */
  LOAD_BALANCER = 'LOADBALANCER',

  /**
   * DNS resolver is returning all the endpoints.
   * This also means that if an endpoint is missing, it would drain the current connections to the missing endpoint.
   */
  ENDPOINTS = 'ENDPOINTS',
}

/**
 * Provides the Service Discovery method a VirtualNode uses
 */
export abstract class ServiceDiscovery {
  /**
   * Returns DNS based service discovery
   *
   * @param hostname
   * @param responseType Specifies the DNS response type for the virtual node.
   *  The default is `DnsResponseType.LOAD_BALANCER`.
   */
  public static dns(hostname: string, responseType?: DnsResponseType): ServiceDiscovery {
    return new DnsServiceDiscovery(hostname, responseType);
  }

  /**
   * Returns Cloud Map based service discovery
   *
   * @param service The AWS Cloud Map Service to use for service discovery
   * @param instanceAttributes A string map that contains attributes with values that you can use to
   *  filter instances by any custom attribute that you specified when you
   *  registered the instance. Only instances that match all of the specified
   *  key/value pairs will be returned.
   */
  public static cloudMap(service: cloudmap.IService, instanceAttributes?: {[key: string]: string}): ServiceDiscovery {
    return new CloudMapServiceDiscovery(service, instanceAttributes);
  }

  /**
   * Binds the current object when adding Service Discovery to a VirtualNode
   */
  public abstract bind(scope: Construct): ServiceDiscoveryConfig;
}

class DnsServiceDiscovery extends ServiceDiscovery {
  private readonly hostname: string;
  private readonly responseType?: DnsResponseType;

  constructor(hostname: string, responseType?: DnsResponseType) {
    super();
    this.hostname = hostname;
    this.responseType = responseType;
  }

  public bind(_scope: Construct): ServiceDiscoveryConfig {
    return {
      dns: {
        hostname: this.hostname,
        responseType: this.responseType,
      },
    };
  }
}

class CloudMapServiceDiscovery extends ServiceDiscovery {
  private readonly service: cloudmap.IService;
  private readonly instanceAttributes?: {[key: string]: string};

  constructor(service: cloudmap.IService, instanceAttributes?: {[key: string]: string}) {
    super();
    this.service = service;
    this.instanceAttributes = instanceAttributes;
  }

  public bind(_scope: Construct): ServiceDiscoveryConfig {
    return {
      cloudmap: {
        namespaceName: this.service.namespace.namespaceName,
        serviceName: this.service.serviceName,
        attributes: renderAttributes(this.instanceAttributes),
      },
    };
  }
}

function renderAttributes(attrs?: {[key: string]: string}) {
  if (attrs === undefined) { return undefined; }
  return Object.entries(attrs).map(([key, value]) => ({ key, value }));
}