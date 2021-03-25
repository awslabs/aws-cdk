import { Resource, IResource } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnCertificate, CfnPolicyPrincipalAttachment, CfnThingPrincipalAttachment } from './iot.generated';
import { IPolicy } from './policy';
import { IThing } from './thing';
import { parseCertificateId, parseCertificateArn } from './util';

/**
 * All supported Certifcate status
 **/
export enum CertificateStatus {
  /**
   * Certificates must be in the ACTIVE state to authenticate devices that use a
   * certificate to connect to AWS IoT.
   */
  ACTIVE = 'ACTIVE',
  /**
   * You can create and register client certificates without activating them so
   * they can't be used until you want to use them. You can also deactivate
   * active client certificates to disable them temporarily.
   */
  INACTIVE = 'INACTIVE',
  /**
   * If you detect suspicious activity on a registered client certificate, you
   * can revoke it so that it can't be used again.
   */
  REVOKED = 'REVOKED',
  /**
   * Setting the status to PENDING_TRANSFER or PENDING_ACTIVATION will result in
   * an exception being thrown. PENDING_TRANSFER and PENDING_ACTIVATION are
   * statuses used internally by AWS IoT. They are not intended for developer
   * use.
   */
}
/**
 * All supported Certifcate modes
 **/
export enum CertificateMode {
  /**
   * Specifies which mode of certificate registration to use with this resource.
   * Valid options are DEFAULT with CaCertificatePem and CertificatePem,
   * SNI_ONLY with CertificatePem, and Default with CertificateSigningRequest.
   */
  DEFAULT = 'DEFAULT',
  /**
   * You can create and register client certificates without activating them so
   * they can't be used until you want to use them. You can also deactivate
   * active client certificates to disable them temporarily.
   */
  SNI_ONLY = 'SNI_ONLY',
}
/**
 * Represents a `Certificate`.
 */
export interface ICertificate extends IResource {
  /**
   * ARN of the IoT certificate
   * i.e. arn:aws:iot:us-east-2:123456789012:cert/certificateId
   *
   * @attribute
   */
  readonly certificateArn: string;

  /**
   * The ID of the certificate.
   * (The last part of the certificate ARN contains the certificate ID.)
   *
   * @attribute
   */
  readonly certificateId: string;

  /**
   * Adds a principal policy attachment.
   */
  attachPolicy(policy: IPolicy): void;

  /**
   * Adds a thing principal attachment.
   */
  attachThing(thing: IThing): void;
}
/**
 * Properties to initialize an instance of `Certificate`.
 */
export interface CertificateAttributes {
  /**
   * ARN of the IoT certificate
   * i.e. arn:aws:iot:us-east-2:123456789012:cert/certificateId
   *
   * @attribute
   */
  readonly certificateArn?: string;

  /**
   * The ID of the certificate.
   * (The last part of the certificate ARN contains the certificate ID.)
   *
   * @attribute
   */
  readonly certificateId?: string;
}
/**
 * Properties to initialize an instance of `Certificate`.
 */
export interface CertificateProps {
  /**
   * The status of the certificate
   *
   * @default - CertificateStatus.INACTIVE
   */
  readonly status?: CertificateStatus
  /**
   * The CA certificate used to sign the device certificate being registered,
   * not available when CertificateMode is SNI_ONLY.
   *
   * @default - none
   */
  readonly caCertificatePem?: string
  /**
   * The certificate data in PEM format. Requires SNI_ONLY for the certificate
   * mode or the accompanying CACertificatePem for registration.
   *
   * @default - none
   */
  readonly certificatePem?: string
  /**
   * Specifies which mode of certificate registration to use with this resource.
   * Valid options are DEFAULT with CaCertificatePem and CertificatePem,
   * SNI_ONLY with CertificatePem, and Default with CertificateSigningRequest.
   *
   * @default - CertificateMode.DEFAULT
   */
  readonly certificateMode?: CertificateMode
  /**
   * The certificate signing request (CSR).
   *
   * @default - none
   */
  readonly certificateSigningRequest?: string
}
/**
 * Represents an IoT Certificate.
 *
 * Certificates can be either defined within this stack:
 *
 *   new Certificate(this, 'MyCert', { props });
 *
 * Or imported from an existing certificate:
 *
 *   Certificate.import(this, 'MyImportedCertificate', { certificateArn: ... });
 *
 * You can also export a certificate and import it into another stack:
 *
 *   const ref = Certificate.export();
 *   Certificate.import(this, 'MyImportedCertificate', ref);
 *
 */
abstract class CertificateBase extends Resource implements ICertificate {
  public abstract readonly certificateArn: string;
  public abstract readonly certificateId: string;

  /**
   * Attaches an IoT Policy to the Certificate
   *
   * @param policy IPolicy
   */
  public attachPolicy(policy: IPolicy): void {
    const attachment = new CfnPolicyPrincipalAttachment(this, 'PrincipalPolicyAttachment', {
      policyName: policy.policyName,
      principal: this.certificateArn,
    });
    this.node.addDependency(policy);
    attachment.node.addDependency(policy);
  }

  /**
   * Attaches an IoT Thing to the Certificate
   *
   * @param thing IThing
   */
  public attachThing(thing: IThing): void {
    const attachment = new CfnThingPrincipalAttachment(this, 'ThingPrincipalAttachment', {
      principal: this.certificateArn,
      thingName: thing.thingName,
    });
    this.node.addDependency(thing);
    attachment.node.addDependency(thing);
  }
}

/**
 * A new Certificate
 */
export class Certificate extends CertificateBase {
  /**
   * Creates a Certificate construct that represents an external certificate.
   *
   * @param scope The parent creating construct (usually `this`).
   * @param id The construct's name.
   * @param certificateArn The Arn of the certificate to import
   */
  public static fromCertificateArn(scope: Construct, id: string, certificateArn: string): ICertificate {

    class Import extends CertificateBase {
      public readonly certificateArn = certificateArn;
      public readonly certificateId = parseCertificateId(scope, { certificateArn });
    }

    return new Import(scope, id);
  }
  /**
   * Creates a Certificate construct that represents an external certificate.
   *
   * @param scope The parent creating construct (usually `this`).
   * @param id The construct's name.
   * @param certificateId The Id of the certificate to import
   */
  public static fromCertificateId(scope: Construct, id: string, certificateId: string): ICertificate {
    class Import extends CertificateBase {
      // TODO: import certificate from another region applicable to bring your
      // own CA provisioning option?
      public readonly certificateArn = parseCertificateArn(scope, { certificateId });
      public readonly certificateId = certificateId;
    }

    return new Import(scope, id);
  }

  public readonly certificateArn: string;
  public readonly certificateId: string;

  constructor(scope: Construct, id: string, props: CertificateProps = {}) {
    super(scope, id, {});

    if (props.caCertificatePem && props.certificateMode == CertificateMode.SNI_ONLY) {
      throw new Error('Certificate invalid. CaCertificatePem not available when CertificateMode is SNI_ONLY.');
    }

    if (props.certificatePem && props.certificateMode != CertificateMode.SNI_ONLY && !props.caCertificatePem) {
      throw new Error('Certificate invalid. Requires SNI_ONLY or the accompanying CACertificatePem for registration.');
    }

    if (!props.certificateMode && !props.certificateSigningRequest && !props.certificatePem && !props.caCertificatePem) {
      throw new Error('Certificate invalid. Default requires CSR or CACertificatePem and CertificatePem');
    }

    const resource = new CfnCertificate(this, 'Resource', {
      status: props.status || CertificateStatus.INACTIVE,
      certificateMode: props.certificateMode || CertificateMode.DEFAULT,
      caCertificatePem: props.caCertificatePem,
      certificatePem: props.certificatePem,
      certificateSigningRequest: props.certificateSigningRequest,
    });

    this.certificateArn = resource.attrArn;
    this.certificateId = resource.attrId;
  }
}
