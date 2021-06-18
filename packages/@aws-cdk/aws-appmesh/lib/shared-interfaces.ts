import * as cdk from '@aws-cdk/core';
import { CfnVirtualGateway, CfnVirtualNode } from './appmesh.generated';
import { renderTlsClientPolicy } from './private/utils';
import { TlsClientPolicy } from './tls-client-policy';
import { IVirtualService } from './virtual-service';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '@aws-cdk/core';

/**
 * Represents timeouts for HTTP protocols.
 */
export interface HttpTimeout {
  /**
   * Represents an idle timeout. The amount of time that a connection may be idle.
   *
   * @default - none
   */
  readonly idle?: cdk.Duration;

  /**
   * Represents per request timeout.
   *
   * @default - 15 s
   */
  readonly perRequest?: cdk.Duration;
}

/**
 * Represents timeouts for GRPC protocols.
 */
export interface GrpcTimeout {
  /**
   * Represents an idle timeout. The amount of time that a connection may be idle.
   *
   * @default - none
   */
  readonly idle?: cdk.Duration;

  /**
   * Represents per request timeout.
   *
   * @default - 15 s
   */
  readonly perRequest?: cdk.Duration;
}

/**
 * Represents timeouts for TCP protocols.
 */
export interface TcpTimeout {
  /**
   * Represents an idle timeout. The amount of time that a connection may be idle.
   *
   * @default - none
   */
  readonly idle?: cdk.Duration;
}

/**
 * Enum of supported AppMesh protocols
 *
 * @deprecated not for use outside package
 */
export enum Protocol {
  HTTP = 'http',
  TCP = 'tcp',
  HTTP2 = 'http2',
  GRPC = 'grpc',
}

/**
 * Represents the outlier detection for a listener.
 */
export interface OutlierDetection {
  /**
   * The base amount of time for which a host is ejected.
   */
  readonly baseEjectionDuration: cdk.Duration;

  /**
   * The time interval between ejection sweep analysis.
   */
  readonly interval: cdk.Duration;

  /**
   * Maximum percentage of hosts in load balancing pool for upstream service that can be ejected. Will eject at
   * least one host regardless of the value.
   */
  readonly maxEjectionPercent: number;

  /**
   * Number of consecutive 5xx errors required for ejection.
   */
  readonly maxServerErrors: number;
}

/**
 * All Properties for Envoy Access logs for mesh endpoints
 */
export interface AccessLogConfig {

  /**
   * VirtualNode CFN configuration for Access Logging
   *
   * @default - no access logging
   */
  readonly virtualNodeAccessLog?: CfnVirtualNode.AccessLogProperty;

  /**
   * VirtualGateway CFN configuration for Access Logging
   *
   * @default - no access logging
   */
  readonly virtualGatewayAccessLog?: CfnVirtualGateway.VirtualGatewayAccessLogProperty;
}

/**
 * Configuration for Envoy Access logs for mesh endpoints
 */
export abstract class AccessLog {
  /**
   * Path to a file to write access logs to
   *
   * @default - no file based access logging
   */
  public static fromFilePath(filePath: string): AccessLog {
    return new FileAccessLog(filePath);
  }

  /**
   * Called when the AccessLog type is initialized. Can be used to enforce
   * mutual exclusivity with future properties
   */
  public abstract bind(scope: Construct): AccessLogConfig;
}

/**
 * Configuration for Envoy Access logs for mesh endpoints
 */
class FileAccessLog extends AccessLog {
  /**
   * Path to a file to write access logs to
   *
   * @default - no file based access logging
   */
  public readonly filePath: string;

  constructor(filePath: string) {
    super();
    this.filePath = filePath;
  }

  public bind(_scope: Construct): AccessLogConfig {
    return {
      virtualNodeAccessLog: {
        file: {
          path: this.filePath,
        },
      },
      virtualGatewayAccessLog: {
        file: {
          path: this.filePath,
        },
      },
    };
  }
}

/**
 * Represents the properties needed to define backend defaults
 */
export interface BackendDefaults {
  /**
   * Client policy for backend defaults
   *
   * @default - none
   */
  readonly tlsClientPolicy?: TlsClientPolicy;
}

/**
 * Represents the properties needed to define a Virtual Service backend
 */
export interface VirtualServiceBackendOptions {

  /**
   * Client policy for the backend
   *
   * @default - none
   */
  readonly tlsClientPolicy?: TlsClientPolicy;
}

/**
 * Properties for a backend
 */
export interface BackendConfig {
  /**
   * Config for a Virtual Service backend
   */
  readonly virtualServiceBackend: CfnVirtualNode.BackendProperty;
}


/**
 * Contains static factory methods to create backends
 */
export abstract class Backend {
  /**
   * Construct a Virtual Service backend
   */
  public static virtualService(virtualService: IVirtualService, props: VirtualServiceBackendOptions = {}): Backend {
    return new VirtualServiceBackend(virtualService, props.tlsClientPolicy);
  }

  /**
   * Return backend config
   */
  public abstract bind(_scope: Construct): BackendConfig;
}

/**
 * Represents the properties needed to define a Virtual Service backend
 */
class VirtualServiceBackend extends Backend {
  constructor (private readonly virtualService: IVirtualService,
    private readonly tlsClientPolicy: TlsClientPolicy | undefined) {
    super();
  }

  /**
   * Return config for a Virtual Service backend
   */
  public bind(scope: Construct): BackendConfig {
    return {
      virtualServiceBackend: {
        virtualService: {
          virtualServiceName: this.virtualService.virtualServiceName,
          clientPolicy: this.tlsClientPolicy
            ? {
              tls: renderTlsClientPolicy(scope, this.tlsClientPolicy, (config) => config.virtualNodeClientTlsValidationTrust),
            }
            : undefined,
        },
      },
    };
  }
}

/**
 * Connection pool properties for HTTP listeners
 */
export interface HttpConnectionPool {
  /**
   * The maximum connections in the pool
   *
   * @default - none
   */
  readonly maxConnections: number;

  /**
   * The maximum pending requests in the pool
   *
   * @default - none
   */
  readonly maxPendingRequests: number;
}

/**
 * Connection pool properties for TCP listeners
 */
export interface TcpConnectionPool {
  /**
   * The maximum connections in the pool
   *
   * @default - none
   */
  readonly maxConnections: number;
}

/**
 * Connection pool properties for gRPC listeners
 */
export interface GrpcConnectionPool {
  /**
   * The maximum requests in the pool
   *
   * @default - none
   */
  readonly maxRequests: number;
}

/**
 * Connection pool properties for HTTP2 listeners
 */
export interface Http2ConnectionPool {
  /**
   * The maximum requests in the pool
   *
   * @default - none
   */
  readonly maxRequests: number;
}