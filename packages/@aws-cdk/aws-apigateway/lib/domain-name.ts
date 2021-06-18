import * as acm from '@aws-cdk/aws-certificatemanager';
import { IBucket } from '@aws-cdk/aws-s3';
import { IResource, Names, Resource, Token } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnDomainName } from './apigateway.generated';
import { BasePathMapping, BasePathMappingOptions } from './base-path-mapping';
import { EndpointType, IRestApi } from './restapi';

/**
 * The minimum version of the SSL protocol that you want API Gateway to use for HTTPS connections.
 */
export enum SecurityPolicy {
  /** Cipher suite TLS 1.0 */
  TLS_1_0 = 'TLS_1_0',

  /** Cipher suite TLS 1.2 */
  TLS_1_2 = 'TLS_1_2',
}

export interface DomainNameOptions {
  /**
   * The custom domain name for your API. Uppercase letters are not supported.
   */
  readonly domainName: string;

  /**
   * The reference to an AWS-managed certificate for use by the edge-optimized
   * endpoint for the domain name. For "EDGE" domain names, the certificate
   * needs to be in the US East (N. Virginia) region.
   */
  readonly certificate: acm.ICertificate;

  /**
   * The type of endpoint for this DomainName.
   * @default REGIONAL
   */
  readonly endpointType?: EndpointType;

  /**
   * The Transport Layer Security (TLS) version + cipher suite for this domain name.
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-apigateway-domainname.html
   * @default SecurityPolicy.TLS_1_0
   */
  readonly securityPolicy?: SecurityPolicy;

  /**
   * The mutual TLS authentication configuration for a custom domain name.
   * @default - mTLS is not configured.
   */
  readonly mtls?: MTLSConfig;
}

export interface DomainNameProps extends DomainNameOptions {
  /**
   * If specified, all requests to this domain will be mapped to the production
   * deployment of this API. If you wish to map this domain to multiple APIs
   * with different base paths, don't specify this option and use
   * `addBasePathMapping`.
   *
   * @default - you will have to call `addBasePathMapping` to map this domain to
   * API endpoints.
   */
  readonly mapping?: IRestApi;
}

export interface IDomainName extends IResource {
  /**
   * The domain name (e.g. `example.com`)
   *
   * @attribute DomainName
   */
  readonly domainName: string;

  /**
   * The Route53 alias target to use in order to connect a record set to this domain through an alias.
   *
   * @attribute DistributionDomainName,RegionalDomainName
   */
  readonly domainNameAliasDomainName: string;

  /**
   * The Route53 hosted zone ID to use in order to connect a record set to this domain through an alias.
   *
   * @attribute DistributionHostedZoneId,RegionalHostedZoneId
   */
  readonly domainNameAliasHostedZoneId: string;
}

export class DomainName extends Resource implements IDomainName {
  /**
   * Imports an existing domain name.
   */
  public static fromDomainNameAttributes(scope: Construct, id: string, attrs: DomainNameAttributes): IDomainName {
    class Import extends Resource implements IDomainName {
      public readonly domainName = attrs.domainName;
      public readonly domainNameAliasDomainName = attrs.domainNameAliasTarget;
      public readonly domainNameAliasHostedZoneId = attrs.domainNameAliasHostedZoneId;
    }

    return new Import(scope, id);
  }

  public readonly domainName: string;
  public readonly domainNameAliasDomainName: string;
  public readonly domainNameAliasHostedZoneId: string;

  constructor(scope: Construct, id: string, props: DomainNameProps) {
    super(scope, id);

    const endpointType = props.endpointType || EndpointType.REGIONAL;
    const edge = endpointType === EndpointType.EDGE;

    if (!Token.isUnresolved(props.domainName) && /[A-Z]/.test(props.domainName)) {
      throw new Error(`Domain name does not support uppercase letters. Got: ${props.domainName}`);
    }

    const mtlsConfig = this.configureMTLS(props.mtls);
    const resource = new CfnDomainName(this, 'Resource', {
      domainName: props.domainName,
      certificateArn: edge ? props.certificate.certificateArn : undefined,
      regionalCertificateArn: edge ? undefined : props.certificate.certificateArn,
      endpointConfiguration: { types: [endpointType] },
      mutualTlsAuthentication: mtlsConfig,
      securityPolicy: props.securityPolicy,
    });

    this.domainName = resource.ref;

    this.domainNameAliasDomainName = edge
      ? resource.attrDistributionDomainName
      : resource.attrRegionalDomainName;

    this.domainNameAliasHostedZoneId = edge
      ? resource.attrDistributionHostedZoneId
      : resource.attrRegionalHostedZoneId;

    if (props.mapping) {
      this.addBasePathMapping(props.mapping);
    }
  }

  /**
   * Maps this domain to an API endpoint.
   * @param targetApi That target API endpoint, requests will be mapped to the deployment stage.
   * @param options Options for mapping to base path with or without a stage
   */
  public addBasePathMapping(targetApi: IRestApi, options: BasePathMappingOptions = { }) {
    const basePath = options.basePath || '/';
    const id = `Map:${basePath}=>${Names.nodeUniqueId(targetApi.node)}`;
    return new BasePathMapping(this, id, {
      domainName: this,
      restApi: targetApi,
      ...options,
    });
  }

  private configureMTLS(mtlsConfig?: MTLSConfig): CfnDomainName.MutualTlsAuthenticationProperty | undefined {
    if (!mtlsConfig) return undefined;
    return {
      truststoreUri: mtlsConfig.bucket.s3UrlForObject(mtlsConfig.key),
      truststoreVersion: mtlsConfig.version,
    };
  }
}

export interface DomainNameAttributes {
  /**
   * The domain name (e.g. `example.com`)
   */
  readonly domainName: string;

  /**
   * The Route53 alias target to use in order to connect a record set to this domain through an alias.
   */
  readonly domainNameAliasTarget: string;

  /**
   * The Route53 hosted zone ID to use in order to connect a record set to this domain through an alias.
   */
  readonly domainNameAliasHostedZoneId: string;
}

/**
 * The mTLS authentication configuration for a custom domain name.
 */
export interface MTLSConfig {
  /**
   * The bucket that the trust store is hosted in.
   */
  readonly bucket: IBucket;

  /**
   * The key in S3 to look at for the trust store.
   */
  readonly key: string;

  /**
   *  The version of the S3 object that contains your truststore.
   *  To specify a version, you must have versioning enabled for the S3 bucket.
   *  @default - latest version
   */
  readonly version?: string;
}
