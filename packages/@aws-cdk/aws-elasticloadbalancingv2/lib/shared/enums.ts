/**
 * What kind of addresses to allocate to the load balancer
 */
export enum IpAddressType {
  /**
   * Allocate IPv4 addresses
   */
  IPV4 = 'ipv4',

  /**
   * Allocate both IPv4 and IPv6 addresses
   */
  DUAL_STACK = 'dualstack',
}

/**
 * Backend protocol for network load balancers and health checks
 */
export enum Protocol {
  /**
   * HTTP (ALB health checks and NLB health checks)
   */
  HTTP = 'HTTP',

  /**
   * HTTPS (ALB health checks and NLB health checks)
   */
  HTTPS = 'HTTPS',

  /**
   * TCP (NLB, NLB health checks)
   */
  TCP = 'TCP',

  /**
   * TLS (NLB)
   */
  TLS = 'TLS',

  /**
   * UDP (NLB)
   */
  UDP = 'UDP',

  /**
   * Listen to both TCP and UDP on the same port (NLB)
   */
  TCP_UDP = 'TCP_UDP',
}

/**
 * Load balancing protocol for application load balancers
 */
export enum ApplicationProtocol {
  /**
   * HTTP
   */
  HTTP = 'HTTP',

  /**
   * HTTPS
   */
  HTTPS = 'HTTPS'
}

/**
 * Load balancing protocol version for application load balancers
 */
export enum ApplicationProtocolVersion {
  /**
   * GRPC
   */
  GRPC = 'GRPC',

  /**
   * HTTP1
   */
  HTTP1 = 'HTTP1',

  /**
   * HTTP2
   */
  HTTP2 = 'HTTP2',
}

/**
 * Elastic Load Balancing provides the following security policies for Application Load Balancers
 *
 * We recommend the Recommended policy for general use. You can
 * use the ForwardSecrecy policy if you require Forward Secrecy
 * (FS).
 *
 * You can use one of the TLS policies to meet compliance and security
 * standards that require disabling certain TLS protocol versions, or to
 * support legacy clients that require deprecated ciphers.
 *
 * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/application/create-https-listener.html
 */
export enum SslPolicy {
  /**
   * The recommended security policy
   */
  RECOMMENDED = 'ELBSecurityPolicy-2016-08',

  /**
   * Strong forward secrecy ciphers and TLV1.2 only (2020 edition).
   * Same as FORWARD_SECRECY_TLS12_RES, but only supports GCM versions of the TLS ciphers
   */
  FORWARD_SECRECY_TLS12_RES_GCM = 'ELBSecurityPolicy-FS-1-2-Res-2020-10',

  /**
   * Strong forward secrecy ciphers and TLS1.2 only
   */
  FORWARD_SECRECY_TLS12_RES = 'ELBSecurityPolicy-FS-1-2-Res-2019-08',

  /**
   * Forward secrecy ciphers and TLS1.2 only
   */
  FORWARD_SECRECY_TLS12 = 'ELBSecurityPolicy-FS-1-2-2019-08',

  /**
   * Forward secrecy ciphers only with TLS1.1 and higher
   */
  FORWARD_SECRECY_TLS11 = 'ELBSecurityPolicy-FS-1-1-2019-08',

  /**
   * Forward secrecy ciphers only
   */
  FORWARD_SECRECY = 'ELBSecurityPolicy-FS-2018-06',

  /**
   * TLS1.2 only and no SHA ciphers
   */
  TLS12 = 'ELBSecurityPolicy-TLS-1-2-2017-01',

  /**
   * TLS1.2 only with all ciphers
   */
  TLS12_EXT = 'ELBSecurityPolicy-TLS-1-2-Ext-2018-06',

  /**
   * TLS1.1 and higher with all ciphers
   */
  TLS11 = 'ELBSecurityPolicy-TLS-1-1-2017-01',

  /**
   * Support for DES-CBC3-SHA
   *
   * Do not use this security policy unless you must support a legacy client
   * that requires the DES-CBC3-SHA cipher, which is a weak cipher.
   */
  LEGACY = 'ELBSecurityPolicy-TLS-1-0-2015-04',
}

/**
 * How to interpret the load balancing target identifiers
 */
export enum TargetType {
  /**
   * Targets identified by instance ID
   */
  INSTANCE = 'instance',

  /**
   * Targets identified by IP address
   */
  IP = 'ip',

  /**
   * Target is a single Lambda Function
   */
  LAMBDA = 'lambda',
}
