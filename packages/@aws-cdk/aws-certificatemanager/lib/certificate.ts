import * as route53 from '@aws-cdk/aws-route53';
import { IResource, Resource, Token } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnCertificate } from './certificatemanager.generated';
import { apexDomain } from './util';

/**
 * Represents a certificate in AWS Certificate Manager
 */
export interface ICertificate extends IResource {
  /**
   * The certificate's ARN
   *
   * @attribute
   */
  readonly certificateArn: string;
}

/**
 * Properties for your certificate
 */
export interface CertificateProps {
  /**
   * Fully-qualified domain name to request a certificate for.
   *
   * May contain wildcards, such as ``*.domain.com``.
   */
  readonly domainName: string;

  /**
   * Alternative domain names on your certificate.
   *
   * Use this to register alternative domain names that represent the same site.
   *
   * @default - No additional FQDNs will be included as alternative domain names.
   */
  readonly subjectAlternativeNames?: string[];

  /**
   * What validation domain to use for every requested domain.
   *
   * Has to be a superdomain of the requested domain.
   *
   * @default - Apex domain is used for every domain that's not overridden.
   * @deprecated use `validation` instead.
   */
  readonly validationDomains?: {[domainName: string]: string};

  /**
   * Validation method used to assert domain ownership
   *
   * @default ValidationMethod.EMAIL
   * @deprecated use `validation` instead.
   */
  readonly validationMethod?: ValidationMethod;

  /**
   * How to validate this certificate
   *
   * @default CertificateValidation.fromEmail()
   */
  readonly validation?: CertificateValidation;
}

/**
 * Properties for certificate validation
 */
export interface CertificationValidationProps {
  /**
   * Validation method
   *
   * @default ValidationMethod.EMAIL
   */
  readonly method?: ValidationMethod;

  /**
   * Hosted zone to use for DNS validation
   *
   * @default - use email validation
   */
  readonly hostedZone?: route53.IHostedZone;

  /**
   * A map of hosted zones to use for DNS validation
   *
   * @default - use `hostedZone`
   */
  readonly hostedZones?: { [domainName: string]: route53.IHostedZone };

  /**
   * Validation domains to use for email validation
   *
   * @default - Apex domain
   */
  readonly validationDomains?: { [domainName: string]: string };
}

/**
 * How to validate a certificate
 */
export class CertificateValidation {
  /**
   * Validate the certificate with DNS
   *
   * IMPORTANT: If `hostedZone` is not specified, DNS records must be added
   * manually and the stack will not complete creating until the records are
   * added.
   *
   * @param hostedZone the hosted zone where DNS records must be created
   */
  public static fromDns(hostedZone?: route53.IHostedZone) {
    return new CertificateValidation({
      method: ValidationMethod.DNS,
      hostedZone,
    });
  }

  /**
   * Validate the certificate with automatically created DNS records in multiple
   * Amazon Route 53 hosted zones.
   *
   * @param hostedZones a map of hosted zones where DNS records must be created
   * for the domains in the certificate
   */
  public static fromDnsMultiZone(hostedZones: { [domainName: string]: route53.IHostedZone }) {
    return new CertificateValidation({
      method: ValidationMethod.DNS,
      hostedZones,
    });
  }

  /**
   * Validate the certificate with Email
   *
   * IMPORTANT: if you are creating a certificate as part of your stack, the stack
   * will not complete creating until you read and follow the instructions in the
   * email that you will receive.
   *
   * ACM will send validation emails to the following addresses:
   *
   *  admin@domain.com
   *  administrator@domain.com
   *  hostmaster@domain.com
   *  postmaster@domain.com
   *  webmaster@domain.com
   *
   * For every domain that you register.
   *
   * @param validationDomains a map of validation domains to use for domains in the certificate
   */
  public static fromEmail(validationDomains?: { [domainName: string]: string }) {
    return new CertificateValidation({
      method: ValidationMethod.EMAIL,
      validationDomains,
    });
  }

  /**
   * The validation method
   */
  public readonly method: ValidationMethod;

  /** @param props Certification validation properties */
  private constructor(public readonly props: CertificationValidationProps) {
    this.method = props.method ?? ValidationMethod.EMAIL;
  }
}

/**
 * A certificate managed by AWS Certificate Manager
 */
export class Certificate extends Resource implements ICertificate {
  /**
   * Import a certificate
   */
  public static fromCertificateArn(scope: Construct, id: string, certificateArn: string): ICertificate {
    class Import extends Resource implements ICertificate {
      public certificateArn = certificateArn;
    }

    return new Import(scope, id);
  }

  /**
   * The certificate's ARN
   */
  public readonly certificateArn: string;

  constructor(scope: Construct, id: string, props: CertificateProps) {
    super(scope, id);

    let validation: CertificateValidation;
    if (props.validation) {
      validation = props.validation;
    } else { // Deprecated props
      if (props.validationMethod === ValidationMethod.DNS) {
        validation = CertificateValidation.fromDns();
      } else {
        validation = CertificateValidation.fromEmail(props.validationDomains);
      }
    }

    const allDomainNames = [props.domainName].concat(props.subjectAlternativeNames || []);

    const cert = new CfnCertificate(this, 'Resource', {
      domainName: props.domainName,
      subjectAlternativeNames: props.subjectAlternativeNames,
      domainValidationOptions: renderDomainValidation(validation, allDomainNames),
      validationMethod: validation.method,
    });

    this.certificateArn = cert.ref;
  }
}

/**
 * Method used to assert ownership of the domain
 */
export enum ValidationMethod {
  /**
   * Send email to a number of email addresses associated with the domain
   *
   * @see https://docs.aws.amazon.com/acm/latest/userguide/gs-acm-validate-email.html
   */
  EMAIL = 'EMAIL',

  /**
   * Validate ownership by adding appropriate DNS records
   *
   * @see https://docs.aws.amazon.com/acm/latest/userguide/gs-acm-validate-dns.html
   */
  DNS = 'DNS',
}

// eslint-disable-next-line max-len
function renderDomainValidation(validation: CertificateValidation, domainNames: string[]): CfnCertificate.DomainValidationOptionProperty[] | undefined {
  const domainValidation: CfnCertificate.DomainValidationOptionProperty[] = [];

  switch (validation.method) {
    case ValidationMethod.DNS:
      for (const domainName of getUniqueDnsDomainNames(domainNames)) {
        const hostedZone = validation.props.hostedZones?.[domainName] ?? validation.props.hostedZone;
        if (hostedZone) {
          domainValidation.push({ domainName, hostedZoneId: hostedZone.hostedZoneId });
        }
      }
      break;
    case ValidationMethod.EMAIL:
      for (const domainName of domainNames) {
        const validationDomain = validation.props.validationDomains?.[domainName];
        if (!validationDomain && Token.isUnresolved(domainName)) {
          throw new Error('When using Tokens for domain names, \'validationDomains\' needs to be supplied');
        }
        domainValidation.push({ domainName, validationDomain: validationDomain ?? apexDomain(domainName) });
      }
      break;
    default:
      throw new Error(`Unknown validation method ${validation.method}`);
  }

  return domainValidation.length !== 0 ? domainValidation : undefined;
}

/**
 * Removes wildcard domains (*.example.com) where the base domain (example.com) is present.
 * This is because the DNS validation treats them as the same thing, and the automated CloudFormation
 * DNS validation errors out with the duplicate records.
 */
function getUniqueDnsDomainNames(domainNames: string[]) {
  return domainNames.filter(domain => {
    return Token.isUnresolved(domain) || !domain.startsWith('*.') || !domainNames.includes(domain.replace('*.', ''));
  });
}
