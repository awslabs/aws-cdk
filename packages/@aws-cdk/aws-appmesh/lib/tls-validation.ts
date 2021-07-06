import * as acmpca from '@aws-cdk/aws-acmpca';
import { CfnVirtualNode } from './appmesh.generated';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '@aws-cdk/core';

/**
 * Represents the properties needed to define TLS Validation context
 */
interface TlsValidationCommon {
  /**
   * Represents the subject alternative names (SANs) secured by the certificate.
   * SANs must be in the FQDN or URI format.
   *
   * @default - If you don't specify SANs on the terminating mesh endpoint,
   * the Envoy proxy for that node doesn't verify the SAN on a peer client certificate.
   * If you don't specify SANs on the originating mesh endpoint,
   * the SAN on the certificate provided by the terminating endpoint must match the mesh endpoint service discovery configuration.
   */
  readonly subjectAlternativeNames?: SubjectAlternativeNames;
}

/**
 * Represents the properties needed to define TLS Validation context
 */
export interface TlsValidation extends TlsValidationCommon {
  /**
   * Reference to where to retrieve the trust chain.
   */
  readonly trust: TlsValidationTrust;
}

/**
 * Represents the properties needed to define TLS Validation context that is supported for mutual TLS authentication.
 */
export interface MutualTlsValidation extends TlsValidationCommon {
  /**
   * Reference to where to retrieve the trust chain.
   */
  readonly trust: MutualTlsValidationTrust;
}

/**
 * All Properties for TLS Validation Trusts for both Client Policy and Listener.
 */
export interface TlsValidationTrustConfig {
  /**
   * VirtualNode CFN configuration for client policy's TLS Validation Trust
   */
  readonly tlsValidationTrust: CfnVirtualNode.TlsValidationContextTrustProperty;
}

/**
 * Defines the TLS Validation Context Trust.
 */
export abstract class TlsValidationTrust {
  /**
   * Tells envoy where to fetch the validation context from
   */
  public static file(certificateChain: string): MutualTlsValidationTrust {
    return new TlsValidationFileTrust(certificateChain);
  }

  /**
   * TLS Validation Context Trust for ACM Private Certificate Authority (CA).
   */
  public static acm(certificateAuthorities: acmpca.ICertificateAuthority[]): TlsValidationTrust {
    return new TlsValidationAcmTrust(certificateAuthorities);
  }

  /**
   * TLS Validation Context Trust for Envoy' service discovery service.
   */
  public static sds(secretName: string): MutualTlsValidationTrust {
    return new TlsValidationSdsTrust(secretName);
  }

  /**
   * Returns Trust context based on trust type.
   */
  public abstract bind(scope: Construct): TlsValidationTrustConfig;
}

/**
 * Represents a TLS Validation Context Trust that is supported for mutual TLS authentication.
 */
export abstract class MutualTlsValidationTrust extends TlsValidationTrust {
  // TypeScript uses structural typing, so we need a property different from TlsValidationTrust
  protected readonly differentiator = false;
}

class TlsValidationAcmTrust extends TlsValidationTrust {
  /**
   * Contains information for your private certificate authority
   */
  readonly certificateAuthorities: acmpca.ICertificateAuthority[];

  constructor (certificateAuthorities: acmpca.ICertificateAuthority[]) {
    super();
    this.certificateAuthorities = certificateAuthorities;
  }

  public bind(_scope: Construct): TlsValidationTrustConfig {
    if (this.certificateAuthorities.length === 0) {
      throw new Error('you must provide at least one Certificate Authority when creating an ACM Trust ClientPolicy');
    } else {
      return {
        tlsValidationTrust: {
          acm: {
            certificateAuthorityArns: this.certificateAuthorities.map(certificateArn =>
              certificateArn.certificateAuthorityArn),
          },
        },
      };
    }
  }
}

class TlsValidationFileTrust extends MutualTlsValidationTrust {
  /**
   * Path to the Certificate Chain file on the file system where the Envoy is deployed.
   */
  readonly certificateChain: string;

  constructor (certificateChain: string) {
    super();
    this.certificateChain = certificateChain;
  }

  public bind(_scope: Construct): TlsValidationTrustConfig {
    return {
      tlsValidationTrust: {
        file: {
          certificateChain: this.certificateChain,
        },
      },
    };
  }
}

class TlsValidationSdsTrust extends MutualTlsValidationTrust {
  /**
   * The name of the secret for Envoy to fetch from a specific endpoint through the Secrets Discovery Protocol.
   */
  readonly secretName: string;

  constructor (secretName: string) {
    super();
    this.secretName = secretName;
  }

  public bind(_scope: Construct): TlsValidationTrustConfig {
    return {
      tlsValidationTrust: {
        sds: {
          secretName: this.secretName,
        },
      },
    };
  }
}

/**
 * All Properties for Subject Alternative Names Matcher for both Client Policy and Listener.
 */
export interface SubjectAlternativeNamesMatcherConfig {
  /**
   * VirtualNode CFN configuration for subject alternative names secured by the certificate.
   */
  readonly subjectAlternativeNamesMatch: CfnVirtualNode.SubjectAlternativeNameMatchersProperty;
}

/**
 * Used to generate Subject Alternative Names Matchers
 */
export abstract class SubjectAlternativeNames {
  /**
   * The values of the SAN must match the specified values exactly.
   *
   * @param names The exact values to test against.
   */
  public static matchingExactly(...names: string[]): SubjectAlternativeNames {
    return new SubjectAlternativeNamesImpl({ exact: names });
  }

  /**
   * Returns Subject Alternative Names Matcher based on method type.
   */
  public abstract bind(scope: Construct): SubjectAlternativeNamesMatcherConfig;
}

class SubjectAlternativeNamesImpl extends SubjectAlternativeNames {
  constructor(
    private readonly matchProperty: CfnVirtualNode.SubjectAlternativeNameMatchersProperty,
  ) { super(); }

  public bind(_scope: Construct): SubjectAlternativeNamesMatcherConfig {
    return {
      subjectAlternativeNamesMatch: this.matchProperty,
    };
  }
}
