import { CfnVirtualNode } from './appmesh.generated';
import { HealthCheck } from './health-checks';
import { ListenerTlsOptions } from './listener-tls-options';
import { ConnectionPoolConfig, renderListenerTlsOptions } from './private/utils';
import {
  GrpcConnectionPool, GrpcTimeout, Http2ConnectionPool, HttpConnectionPool,
  HttpTimeout, OutlierDetection, Protocol, TcpConnectionPool, TcpTimeout,
} from './shared-interfaces';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '@aws-cdk/core';

/**
 * Properties for a VirtualNode listener
 */
export interface VirtualNodeListenerConfig {
  /**
   * Single listener config for a VirtualNode
   */
  readonly listener: CfnVirtualNode.ListenerProperty,
}

/**
 * Represents the properties needed to define a Listeners for a VirtualNode
 */
interface VirtualNodeListenerCommonOptions {
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

  /**
   * Represents the configuration for enabling outlier detection
   *
   * @default - none
   */
  readonly outlierDetection?: OutlierDetection;
}

interface CommonHttpVirtualNodeListenerOptions extends VirtualNodeListenerCommonOptions {
  /**
   * Timeout for HTTP protocol
   *
   * @default - None
   */
  readonly timeout?: HttpTimeout;
}

/**
 * Represent the HTTP Node Listener prorperty
 */
export interface HttpVirtualNodeListenerOptions extends CommonHttpVirtualNodeListenerOptions {

  /**
   * Connection pool for http listeners
   *
   * @default - None
   */
  readonly connectionPool?: HttpConnectionPool;
}

/**
 * Represent the HTTP2 Node Listener prorperty
 */
export interface Http2VirtualNodeListenerOptions extends CommonHttpVirtualNodeListenerOptions {
  /**
   * Connection pool for http2 listeners
   *
   * @default - None
   */
  readonly connectionPool?: Http2ConnectionPool;
}

/**
 * Represent the GRPC Node Listener prorperty
 */
export interface GrpcVirtualNodeListenerOptions extends VirtualNodeListenerCommonOptions {
  /**
   * Timeout for GRPC protocol
   *
   * @default - None
   */
  readonly timeout?: GrpcTimeout;

  /**
   * Connection pool for http listeners
   *
   * @default - None
   */
  readonly connectionPool?: GrpcConnectionPool;
}

/**
 * Represent the TCP Node Listener prorperty
 */
export interface TcpVirtualNodeListenerOptions extends VirtualNodeListenerCommonOptions {
  /**
   * Timeout for TCP protocol
   *
   * @default - None
   */
  readonly timeout?: TcpTimeout;

  /**
   * Connection pool for http listeners
   *
   * @default - None
   */
  readonly connectionPool?: TcpConnectionPool;
}

/**
 *  Defines listener for a VirtualNode
 */
export abstract class VirtualNodeListener {
  /**
   * Returns an HTTP Listener for a VirtualNode
   */
  public static http(props: HttpVirtualNodeListenerOptions = {}): VirtualNodeListener {
    return new VirtualNodeListenerImpl(Protocol.HTTP, props.healthCheck, props.timeout, props.port, props.tls, props.outlierDetection,
      props.connectionPool);
  }

  /**
   * Returns an HTTP2 Listener for a VirtualNode
   */
  public static http2(props: Http2VirtualNodeListenerOptions = {}): VirtualNodeListener {
    return new VirtualNodeListenerImpl(Protocol.HTTP2, props.healthCheck, props.timeout, props.port, props.tls, props.outlierDetection,
      props.connectionPool);
  }

  /**
   * Returns an GRPC Listener for a VirtualNode
   */
  public static grpc(props: GrpcVirtualNodeListenerOptions = {}): VirtualNodeListener {
    return new VirtualNodeListenerImpl(Protocol.GRPC, props.healthCheck, props.timeout, props.port, props.tls, props.outlierDetection,
      props.connectionPool);
  }

  /**
   * Returns an TCP Listener for a VirtualNode
   */
  public static tcp(props: TcpVirtualNodeListenerOptions = {}): VirtualNodeListener {
    return new VirtualNodeListenerImpl(Protocol.TCP, props.healthCheck, props.timeout, props.port, props.tls, props.outlierDetection,
      props.connectionPool);
  }

  /**
   * Binds the current object when adding Listener to a VirtualNode
   */
  public abstract bind(scope: Construct): VirtualNodeListenerConfig;
}

class VirtualNodeListenerImpl extends VirtualNodeListener {
  constructor(private readonly protocol: Protocol,
    private readonly healthCheck: HealthCheck | undefined,
    private readonly timeout: HttpTimeout | undefined,
    private readonly port: number = 8080,
    private readonly tls: ListenerTlsOptions | undefined,
    private readonly outlierDetection: OutlierDetection | undefined,
    private readonly connectionPool: ConnectionPoolConfig | undefined) { super(); }

  public bind(scope: Construct): VirtualNodeListenerConfig {
    return {
      listener: {
        portMapping: {
          port: this.port,
          protocol: this.protocol,
        },
        healthCheck: this.healthCheck?.bind(scope, { defaultPort: this.port }).virtualNodeHealthCheck,
        timeout: this.timeout ? this.renderTimeout(this.timeout) : undefined,
        tls: renderListenerTlsOptions(scope, this.tls),
        outlierDetection: this.outlierDetection ? this.renderOutlierDetection(this.outlierDetection) : undefined,
        connectionPool: this.connectionPool ? this.renderConnectionPool(this.connectionPool) : undefined,
      },
    };
  }

  private renderTimeout(timeout: HttpTimeout): CfnVirtualNode.ListenerTimeoutProperty {
    return ({
      [this.protocol]: {
        idle: timeout?.idle !== undefined ? {
          unit: 'ms',
          value: timeout?.idle.toMilliseconds(),
        } : undefined,
        perRequest: timeout?.perRequest !== undefined ? {
          unit: 'ms',
          value: timeout?.perRequest.toMilliseconds(),
        } : undefined,
      },
    });
  }

  private renderOutlierDetection(outlierDetection: OutlierDetection): CfnVirtualNode.OutlierDetectionProperty {
    return {
      baseEjectionDuration: {
        unit: 'ms',
        value: outlierDetection.baseEjectionDuration.toMilliseconds(),
      },
      interval: {
        unit: 'ms',
        value: outlierDetection.interval.toMilliseconds(),
      },
      maxEjectionPercent: outlierDetection.maxEjectionPercent,
      maxServerErrors: outlierDetection.maxServerErrors,
    };
  }

  private renderConnectionPool(connectionPool: ConnectionPoolConfig): CfnVirtualNode.VirtualNodeConnectionPoolProperty {
    return ({
      [this.protocol]: {
        maxRequests: connectionPool?.maxRequests !== undefined ? connectionPool.maxRequests : undefined,
        maxConnections: connectionPool?.maxConnections !== undefined ? connectionPool.maxConnections : undefined,
        maxPendingRequests: connectionPool?.maxPendingRequests !== undefined ? connectionPool.maxPendingRequests : undefined,
      },
    });
  }
}
