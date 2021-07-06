import { MutualTlsCertificate } from './tls-certificate';
import { TlsValidation } from './tls-validation';

/**
 * Represents the properties needed to define client policy
 */
export interface TlsClientPolicy {
  /**
   * Whether the policy is enforced.
   *
   * @default true
   */
  readonly enforce?: boolean;

  /**
   * TLS is enforced on the ports specified here.
   * If no ports are specified, TLS will be enforced on all the ports.
   *
   * @default - all ports
   */
  readonly ports?: number[];

  /**
   * Represents the object for TLS validation context
   */
  readonly validation: TlsValidation;

  /**
   * Represents a client TLS certificate.
   * The certificate will be sent only if the server requests it, enabling mutual TLS.
   *
   * @default - client TLS certificate is not provided
   */
  readonly mutualTlsCertificate?: MutualTlsCertificate;
}
