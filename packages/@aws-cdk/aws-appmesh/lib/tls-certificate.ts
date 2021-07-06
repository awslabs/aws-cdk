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
 * Represents a TLS certificate
 */
export abstract class TlsCertificate {
  /**
   * Returns an File TLS Certificate
   */
  public static file(certificateChainPath: string, privateKeyPath: string): MutualTlsCertificate {
    return new FileTlsCertificate(certificateChainPath, privateKeyPath);
  }

  /**
   * Returns an ACM TLS Certificate
   */
  public static acm(certificate: acm.ICertificate): TlsCertificate {
    return new AcmTlsCertificate(certificate);
  }

  /**
   * Returns an SDS TLS Certificate
   */
  public static sds(secretName: string): MutualTlsCertificate {
    return new SdsTlsCertificate(secretName);
  }

  /**
   * Returns TLS certificate based provider.
   */
  public abstract bind(_scope: Construct): TlsCertificateConfig;

}

/**
 * Represents a TLS certificate that is supported for mutual TLS authentication.
 */
export abstract class MutualTlsCertificate extends TlsCertificate {
  // TypeScript uses structural typing, so we need a property different from TlsCertificate
  protected readonly differentiator = false;
}

/**
 * Represents a ACM provided TLS certificate
 */
class AcmTlsCertificate extends TlsCertificate {
  /**
   * The ARN of the ACM certificate
   */
  readonly acmCertificate: acm.ICertificate;

  constructor(certificate: acm.ICertificate) {
    super();
    this.acmCertificate = certificate;
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
class FileTlsCertificate extends MutualTlsCertificate {
  /**
   * The file path of the certificate chain file.
   */
  readonly certificateChain: string;

  /**
   * The file path of the private key file.
   */
  readonly privateKey: string;

  constructor(certificateChainPath: string, privateKeyPath: string) {
    super();
    this.certificateChain = certificateChainPath;
    this.privateKey = privateKeyPath;
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

/**
 * Represents a SDS provided TLS certificate
 */
class SdsTlsCertificate extends MutualTlsCertificate {
  /**
   * The name of the secret requested from the Secret Discovery Service provider.
   */
  readonly secretName: string;

  constructor(secretName: string) {
    super();
    this.secretName = secretName;
  }

  bind(_scope: Construct): TlsCertificateConfig {
    return {
      tlsCertificate: {
        sds: {
          secretName: this.secretName,
        },
      },
    };
  }
}
