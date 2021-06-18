import * as acm from '@aws-cdk/aws-certificatemanager';
import { CfnVirtualNode } from './appmesh.generated';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '@aws-cdk/core';

/**
 * A wrapper for the tls config returned by {@link TlsCertificate.bind}
 */
export interface TlsCertificateConfig {
  /**
   * The CFN shape for a TLS certificate
   */
  readonly tlsCertificate: CfnVirtualNode.ListenerTlsCertificateProperty,
}

/**
 * ACM Certificate Properties
 */
export interface AcmCertificateOptions {
  /**
   * The ACM certificate
   */
  readonly certificate: acm.ICertificate;
}

/**
 * File Certificate Properties
 */
export interface FileCertificateOptions {
  /**
   * The file path of the certificate chain file.
   */
  readonly certificateChainPath: string;

  /**
   * The file path of the private key file.
   */
  readonly privateKeyPath: string;
}

/**
 * Represents a TLS certificate
 */
export abstract class TlsCertificate {
  /**
   * Returns an File TLS Certificate
   */
  public static file(props: FileCertificateOptions): TlsCertificate {
    return new FileTlsCertificate(props);
  }

  /**
   * Returns an ACM TLS Certificate
   */
  public static acm(props: AcmCertificateOptions): TlsCertificate {
    return new AcmTlsCertificate(props);
  }

  /**
   * Returns TLS certificate based provider.
   */
  public abstract bind(_scope: Construct): TlsCertificateConfig;
}

/**
 * Represents a ACM provided TLS certificate
 */
class AcmTlsCertificate extends TlsCertificate {
  /**
   * The ARN of the ACM certificate
   */
  readonly acmCertificate: acm.ICertificate;

  constructor(props: AcmCertificateOptions) {
    super();
    this.acmCertificate = props.certificate;
  }

  bind(_scope: Construct): TlsCertificateConfig {
    return {
      tlsCertificate: {
        acm: {
          certificateArn: this.acmCertificate.certificateArn,
        },
      },
    };
  }
}

/**
 * Represents a file provided TLS certificate
 */
class FileTlsCertificate extends TlsCertificate {
  /**
   * The file path of the certificate chain file.
   */
  readonly certificateChain: string;

  /**
   * The file path of the private key file.
   */
  readonly privateKey: string;

  constructor(props: FileCertificateOptions) {
    super();
    this.certificateChain = props.certificateChainPath;
    this.privateKey = props.privateKeyPath;
  }

  bind(_scope: Construct): TlsCertificateConfig {
    return {
      tlsCertificate: {
        file: {
          certificateChain: this.certificateChain,
          privateKey: this.privateKey,
        },
      },
    };
  }
}
