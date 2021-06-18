import { CfnVirtualNode } from '../appmesh.generated';
import { TlsClientPolicy } from '../tls-client-policy';
import { TlsValidationTrustConfig } from '../tls-validation';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '@aws-cdk/core';

/**
 * Generated Connection pool config
 */
export interface ConnectionPoolConfig {
  /**
   * The maximum connections in the pool
   *
   * @default - none
   */
  readonly maxConnections?: number;

  /**
   * The maximum pending requests in the pool
   *
   * @default - none
   */
  readonly maxPendingRequests?: number;

  /**
   * The maximum requests in the pool
   *
   * @default - none
   */
  readonly maxRequests?: number;
}

/**
 * This is the helper method to render TLS property of client policy.
 *
 */
export function renderTlsClientPolicy(scope: Construct, tlsClientPolicy: TlsClientPolicy | undefined,
    extractor: (c: TlsValidationTrustConfig) => CfnVirtualNode.TlsValidationContextTrustProperty): CfnVirtualNode.ClientPolicyTlsProperty |
    undefined {
  return tlsClientPolicy
    ? {
      ports: tlsClientPolicy.ports,
      enforce: tlsClientPolicy.enforce,
      validation: {
        trust: extractor(tlsClientPolicy.validation.trust.bind(scope)),
      },
    }
    : undefined;
}
