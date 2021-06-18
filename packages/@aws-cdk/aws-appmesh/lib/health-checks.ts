import * as cdk from '@aws-cdk/core';
import { CfnVirtualGateway, CfnVirtualNode } from './appmesh.generated';
import { Protocol } from './shared-interfaces';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '@aws-cdk/core';

/**
 * Properties used to define healthchecks.
 */
interface HealthCheckCommonOptions {
  /**
   * The number of consecutive successful health checks that must occur before declaring listener healthy.
   *
   * @default 2
   */
  readonly healthyThreshold?: number;

  /**
   * The time period between each health check execution.
   *
   * @default Duration.seconds(5)
   */
  readonly interval?: cdk.Duration;

  /**
   * The amount of time to wait when receiving a response from the health check.
   *
   * @default Duration.seconds(2)
   */
  readonly timeout?: cdk.Duration;

  /**
   * The number of consecutive failed health checks that must occur before declaring a listener unhealthy.
   *
   * @default - 2
   */
  readonly unhealthyThreshold?: number;
}

/**
 * Properties used to define HTTP Based healthchecks.
 */
export interface HttpHealthCheckOptions extends HealthCheckCommonOptions {
  /**
   * The destination path for the health check request.
   *
   * @default /
   */
  readonly path?: string;
}

/**
 * Properties used to define GRPC Based healthchecks.
 */
export interface GrpcHealthCheckOptions extends HealthCheckCommonOptions { }

/**
 * Properties used to define TCP Based healthchecks.
 */
export interface TcpHealthCheckOptions extends HealthCheckCommonOptions { }

/**
 * All Properties for Health Checks for mesh endpoints
 */
export interface HealthCheckConfig {
  /**
   * VirtualNode CFN configuration for Health Checks
   *
   * @default - no health checks
   */
  readonly virtualNodeHealthCheck?: CfnVirtualNode.HealthCheckProperty;

  /**
   * VirtualGateway CFN configuration for Health Checks
   *
   * @default - no health checks
   */
  readonly virtualGatewayHealthCheck?: CfnVirtualGateway.VirtualGatewayHealthCheckPolicyProperty;
}

/**
 * Options used for creating the Health Check object
 */
export interface HealthCheckBindOptions {
  /**
   * Port for Health Check interface
   *
   * @default - no default port is provided
   */
  readonly defaultPort?: number;
}


/**
 * Contains static factory methods for creating health checks for different protocols
 */
export abstract class HealthCheck {
  /**
   * Construct a HTTP health check
   */
  public static http(options: HttpHealthCheckOptions = {}): HealthCheck {
    return new HealthCheckImpl(Protocol.HTTP, options.healthyThreshold, options.unhealthyThreshold, options.interval, options.timeout, options.path);
  }

  /**
   * Construct a HTTP2 health check
   */
  public static http2(options: HttpHealthCheckOptions = {}): HealthCheck {
    return new HealthCheckImpl(Protocol.HTTP2, options.healthyThreshold, options.unhealthyThreshold, options.interval, options.timeout, options.path);
  }

  /**
   * Construct a GRPC health check
   */
  public static grpc(options: GrpcHealthCheckOptions = {}): HealthCheck {
    return new HealthCheckImpl(Protocol.GRPC, options.healthyThreshold, options.unhealthyThreshold, options.interval, options.timeout);
  }

  /**
   * Construct a TCP health check
   */
  public static tcp(options: TcpHealthCheckOptions = {}): HealthCheck {
    return new HealthCheckImpl(Protocol.TCP, options.healthyThreshold, options.unhealthyThreshold, options.interval, options.timeout);
  }

  /**
   * Called when the AccessLog type is initialized. Can be used to enforce
   * mutual exclusivity with future properties
   */
  public abstract bind(scope: Construct, options: HealthCheckBindOptions): HealthCheckConfig;
}

class HealthCheckImpl extends HealthCheck {
  constructor(
    private readonly protocol: Protocol,
    private readonly healthyThreshold: number = 2,
    private readonly unhealthyThreshold: number = 2,
    private readonly interval: cdk.Duration = cdk.Duration.seconds(5),
    private readonly timeout: cdk.Duration = cdk.Duration.seconds(2),
    private readonly path?: string) {
    super();
    if (healthyThreshold < 2 || healthyThreshold > 10) {
      throw new Error('healthyThreshold must be between 2 and 10');
    }

    if (unhealthyThreshold < 2 || unhealthyThreshold > 10) {
      throw new Error('unhealthyThreshold must be between 2 and 10');
    }

    if (interval.toMilliseconds() < 5000 || interval.toMilliseconds() > 300_000) {
      throw new Error('interval must be between 5 seconds and 300 seconds');
    }

    if (timeout.toMilliseconds() < 2000 || timeout.toMilliseconds() > 60_000) {
      throw new Error('timeout must be between 2 seconds and 60 seconds');
    }

    // Default to / for HTTP Health Checks
    if (path === undefined && (protocol === Protocol.HTTP || protocol === Protocol.HTTP2)) {
      this.path = '/';
    }
  }

  public bind(_scope: Construct, options: HealthCheckBindOptions): HealthCheckConfig {
    return {
      virtualNodeHealthCheck: {
        protocol: this.protocol,
        healthyThreshold: this.healthyThreshold,
        unhealthyThreshold: this.unhealthyThreshold,
        intervalMillis: this.interval.toMilliseconds(),
        timeoutMillis: this.timeout.toMilliseconds(),
        path: this.path,
        port: options.defaultPort,
      },
      virtualGatewayHealthCheck: {
        protocol: this.protocol,
        healthyThreshold: this.healthyThreshold,
        unhealthyThreshold: this.unhealthyThreshold,
        intervalMillis: this.interval.toMilliseconds(),
        timeoutMillis: this.timeout.toMilliseconds(),
        path: this.path,
        port: options.defaultPort,
      },
    };
  }
}
