import { CfnVirtualGateway } from './appmesh.generated';
import { HealthCheck } from './health-checks';
import { ListenerTlsOptions } from './listener-tls-options';
import { ConnectionPoolConfig, renderListenerTlsOptions } from './private/utils';
import {
  GrpcConnectionPool,
  Http2ConnectionPool,
  HttpConnectionPool,
  Protocol,
} from './shared-interfaces';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '@aws-cdk/core';

/**
 * Represents the properties needed to define a Listeners for a VirtualGateway
 */
interface VirtualGatewayListenerCommonOptions {
  /**
   * Port to listen for connections on
   *
   * @default - 8080
   */
  readonly port?: number

  /**
   * The health check information for the listener
   *
   * @default - no healthcheck
   */
  readonly healthCheck?: HealthCheck;

  /**
   * Represents the configuration for enabling TLS on a listener
   *
   * @default - none
   */
  readonly tls?: ListenerTlsOptions;
}

/**
 * Represents the properties needed to define HTTP Listeners for a VirtualGateway
 */
export interface HttpGatewayListenerOptions extends VirtualGatewayListenerCommonOptions {
  /**
   * Connection pool for http listeners
   *
   * @default - None
   */
  readonly connectionPool?: HttpConnectionPool;
}

/**
 * Represents the properties needed to define HTTP2 Listeners for a VirtualGateway
 */
export interface Http2GatewayListenerOptions extends VirtualGatewayListenerCommonOptions {
  /**
   * Connection pool for http listeners
   *
   * @default - None
   */
  readonly connectionPool?: Http2ConnectionPool;
}

/**
 * Represents the properties needed to define GRPC Listeners for a VirtualGateway
 */
export interface GrpcGatewayListenerOptions extends VirtualGatewayListenerCommonOptions {
  /**
   * Connection pool for http listeners
   *
   * @default - None
   */
  readonly connectionPool?: GrpcConnectionPool;
}

/**
 * Properties for a VirtualGateway listener
 */
export interface VirtualGatewayListenerConfig {
  /**
   * Single listener config for a VirtualGateway
   */
  readonly listener: CfnVirtualGateway.VirtualGatewayListenerProperty;
}

/**
 * Represents the properties needed to define listeners for a VirtualGateway
 */
export abstract class VirtualGatewayListener {
  /**
   * Returns an HTTP Listener for a VirtualGateway
   */
  public static http(options: HttpGatewayListenerOptions = {}): VirtualGatewayListener {
    return new VirtualGatewayListenerImpl(Protocol.HTTP, options.healthCheck, options.port, options.tls, options.connectionPool);
  }

  /**
   * Returns an HTTP2 Listener for a VirtualGateway
   */
  public static http2(options: Http2GatewayListenerOptions = {}): VirtualGatewayListener {
    return new VirtualGatewayListenerImpl(Protocol.HTTP2, options.healthCheck, options.port, options.tls, options.connectionPool);
  }

  /**
   * Returns a GRPC Listener for a VirtualGateway
   */
  public static grpc(options: GrpcGatewayListenerOptions = {}): VirtualGatewayListener {
    return new VirtualGatewayListenerImpl(Protocol.GRPC, options.healthCheck, options.port, options.tls, options.connectionPool);
  }

  /**
   * Called when the GatewayListener type is initialized. Can be used to enforce
   * mutual exclusivity
   */
  public abstract bind(scope: Construct): VirtualGatewayListenerConfig;
}

/**
 * Represents the properties needed to define an HTTP Listener for a VirtualGateway
 */
class VirtualGatewayListenerImpl extends VirtualGatewayListener {

  constructor(private readonly protocol: Protocol,
    private readonly healthCheck: HealthCheck | undefined,
    private readonly port: number = 8080,
    private readonly listenerTls: ListenerTlsOptions | undefined,
    private readonly connectionPool: ConnectionPoolConfig | undefined) {
    super();
  }

  /**
   * Called when the GatewayListener type is initialized. Can be used to enforce
   * mutual exclusivity
   */
  public bind(scope: Construct): VirtualGatewayListenerConfig {
    return {
      listener: {
        portMapping: {
          port: this.port,
          protocol: this.protocol,
        },
        healthCheck: this.healthCheck?.bind(scope, { defaultPort: this.port }).virtualGatewayHealthCheck,
        tls: renderListenerTlsOptions(scope, this.listenerTls),
        connectionPool: this.connectionPool ? renderConnectionPool(this.connectionPool, this.protocol) : undefined,
      },
    };
  }
}

function renderConnectionPool(connectionPool: ConnectionPoolConfig, listenerProtocol: Protocol):
CfnVirtualGateway.VirtualGatewayConnectionPoolProperty {
  return ({
    [listenerProtocol]: {
      maxRequests: connectionPool?.maxRequests !== undefined ? connectionPool.maxRequests : undefined,
      maxConnections: connectionPool?.maxConnections !== undefined ? connectionPool.maxConnections : undefined,
      maxPendingRequests: connectionPool?.maxPendingRequests !== undefined ? connectionPool.maxPendingRequests : undefined,
    },
  });
}
