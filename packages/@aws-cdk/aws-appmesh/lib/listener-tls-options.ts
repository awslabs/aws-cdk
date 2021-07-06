import { TlsCertificate } from './tls-certificate';
import { MutualTlsValidation } from './tls-validation';

/**
 * Enum of supported TLS modes
 */
export enum TlsMode {
  /**
   * Only accept encrypted traffic
   */
  STRICT = 'STRICT',

  /**
   * Accept encrypted and plaintext traffic.
   */
  PERMISSIVE = 'PERMISSIVE',

  /**
   * TLS is disabled, only accept plaintext traffic.
   */
  DISABLED = 'DISABLED',
}

/**
 * Represents TLS properties for listener
 */
export interface ListenerTlsOptions {
  /**
   * Represents TLS certificate
   */
  readonly certificate: TlsCertificate;

  /**
   * The TLS mode.
   */
  readonly mode: TlsMode;

  /**
   * Represents a listener's TLS validation context.
   * The client certificate will only be validated if the client provides it, enabling mutual TLS.
   *
   * @default - client TLS certificate is not required
   */
  readonly mutualTlsValidation?: MutualTlsValidation;
}
