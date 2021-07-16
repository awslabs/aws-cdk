import * as acm from '@aws-cdk/aws-certificatemanager';
import * as lambda from '@aws-cdk/aws-lambda';
import * as s3 from '@aws-cdk/aws-s3';
import { IResource, Lazy, Resource, Stack, Token, Duration, Names } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { ICachePolicy } from './cache-policy';
import { CfnDistribution } from './cloudfront.generated';
import { FunctionAssociation } from './function';
import { GeoRestriction } from './geo-restriction';
import { Invalidation } from './invalidation';
import { IKeyGroup } from './key-group';
import { IOrigin, OriginBindConfig, OriginBindOptions } from './origin';
import { IOriginRequestPolicy } from './origin-request-policy';
import { CacheBehavior } from './private/cache-behavior';

// v2 - keep this import as a separate section to reduce merge conflict when forward merging with the v2 branch.
// eslint-disable-next-line
import { Construct as CoreConstruct } from '@aws-cdk/core';

/**
 * Interface for CloudFront distributions
 */
export interface IDistribution extends IResource {
  /**
   * The domain name of the Distribution, such as d111111abcdef8.cloudfront.net.
   *
   * @attribute
   * @deprecated - Use `distributionDomainName` instead.
   */
  readonly domainName: string;

  /**
   * The domain name of the Distribution, such as d111111abcdef8.cloudfront.net.
   *
   * @attribute
   */
  readonly distributionDomainName: string;

  /**
   * The distribution ID for this distribution.
   *
   * @attribute
   */
  readonly distributionId: string;
}

/**
 * Attributes used to import a Distribution.
 */
export interface DistributionAttributes {
  /**
   * The generated domain name of the Distribution, such as d111111abcdef8.cloudfront.net.
   *
   * @attribute
   */
  readonly domainName: string;

  /**
   * The distribution ID for this distribution.
   *
   * @attribute
   */
  readonly distributionId: string;
}

interface BoundOrigin extends OriginBindOptions, OriginBindConfig {
  readonly origin: IOrigin;
  readonly originGroupId?: string;
}

/**
 * Properties for a Distribution
 */
export interface DistributionProps {
  /**
   * The default behavior for the distribution.
   */
  readonly defaultBehavior: BehaviorOptions;

  /**
   * Additional behaviors for the distribution, mapped by the pathPattern that specifies which requests to apply the behavior to.
   *
   * @default - no additional behaviors are added.
   */
  readonly additionalBehaviors?: Record<string, BehaviorOptions>;

  /**
   * A certificate to associate with the distribution. The certificate must be located in N. Virginia (us-east-1).
   *
   * @default - the CloudFront wildcard certificate (*.cloudfront.net) will be used.
   */
  readonly certificate?: acm.ICertificate;

  /**
   * Any comments you want to include about the distribution.
   *
   * @default - no comment
   */
  readonly comment?: string;

  /**
   * The object that you want CloudFront to request from your origin (for example, index.html)
   * when a viewer requests the root URL for your distribution. If no default object is set, the
   * request goes to the origin's root (e.g., example.com/).
   *
   * @default - no default root object
   */
  readonly defaultRootObject?: string;

  /**
   * Alternative domain names for this distribution.
   *
   * If you want to use your own domain name, such as www.example.com, instead of the cloudfront.net domain name,
   * you can add an alternate domain name to your distribution. If you attach a certificate to the distribution,
   * you must add (at least one of) the domain names of the certificate to this list.
   *
   * @default - The distribution will only support the default generated name (e.g., d111111abcdef8.cloudfront.net)
   */
  readonly domainNames?: string[];

  /**
   * Enable or disable the distribution.
   *
   * @default true
   */
  readonly enabled?: boolean;

  /**
   * Whether CloudFront will respond to IPv6 DNS requests with an IPv6 address.
   *
   * If you specify false, CloudFront responds to IPv6 DNS requests with the DNS response code NOERROR and with no IP addresses.
   * This allows viewers to submit a second request, for an IPv4 address for your distribution.
   *
   * @default true
   */
  readonly enableIpv6?: boolean;

  /**
   * Enable access logging for the distribution.
   *
   * @default - false, unless `logBucket` is specified.
   */
  readonly enableLogging?: boolean;

  /**
   * Controls the countries in which your content is distributed.
   *
   * @default - No geographic restrictions
   */
  readonly geoRestriction?: GeoRestriction;

  /**
   * Specify the maximum HTTP version that you want viewers to use to communicate with CloudFront.
   *
   * For viewers and CloudFront to use HTTP/2, viewers must support TLS 1.2 or later, and must support server name identification (SNI).
   *
   * @default HttpVersion.HTTP2
   */
  readonly httpVersion?: HttpVersion;

  /**
   * The Amazon S3 bucket to store the access logs in.
   *
   * @default - A bucket is created if `enableLogging` is true
   */
  readonly logBucket?: s3.IBucket;

  /**
   * Specifies whether you want CloudFront to include cookies in access logs
   *
   * @default false
   */
  readonly logIncludesCookies?: boolean;

  /**
   * An optional string that you want CloudFront to prefix to the access log filenames for this distribution.
   *
   * @default - no prefix
   */
  readonly logFilePrefix?: string;

  /**
   * The price class that corresponds with the maximum price that you want to pay for CloudFront service.
   * If you specify PriceClass_All, CloudFront responds to requests for your objects from all CloudFront edge locations.
   * If you specify a price class other than PriceClass_All, CloudFront serves your objects from the CloudFront edge location
   * that has the lowest latency among the edge locations in your price class.
   *
   * @default PriceClass.PRICE_CLASS_ALL
   */
  readonly priceClass?: PriceClass;

  /**
   * Unique identifier that specifies the AWS WAF web ACL to associate with this CloudFront distribution.
   *
   * To specify a web ACL created using the latest version of AWS WAF, use the ACL ARN, for example
   * `arn:aws:wafv2:us-east-1:123456789012:global/webacl/ExampleWebACL/473e64fd-f30b-4765-81a0-62ad96dd167a`.
   * To specify a web ACL created using AWS WAF Classic, use the ACL ID, for example `473e64fd-f30b-4765-81a0-62ad96dd167a`.
   *
   * @see https://docs.aws.amazon.com/waf/latest/developerguide/what-is-aws-waf.html
   * @see https://docs.aws.amazon.com/cloudfront/latest/APIReference/API_CreateDistribution.html#API_CreateDistribution_RequestParameters.
   *
   * @default - No AWS Web Application Firewall web access control list (web ACL).
   */
  readonly webAclId?: string;

  /**
   * How CloudFront should handle requests that are not successful (e.g., PageNotFound).
   *
   * @default - No custom error responses.
   */
  readonly errorResponses?: ErrorResponse[];

  /**
    * The minimum version of the SSL protocol that you want CloudFront to use for HTTPS connections.
    *
    * CloudFront serves your objects only to browsers or devices that support at
    * least the SSL version that you specify.
    *
    * @default SecurityPolicyProtocol.TLS_V1_2_2019
    */
  readonly minimumProtocolVersion?: SecurityPolicyProtocol;

  /**
   * Set of paths to invalidate for distribution or empty array to invalidate all paths
   *
   *
   * @default - No CloudFront Invalidation.
   */
  readonly invalidationPaths?: string[];
}

/**
 * A CloudFront distribution with associated origin(s) and caching behavior(s).
 */
export class Distribution extends Resource implements IDistribution {

  /**
   * Creates a Distribution construct that represents an external (imported) distribution.
   */
  public static fromDistributionAttributes(scope: Construct, id: string, attrs: DistributionAttributes): IDistribution {
    return new class extends Resource implements IDistribution {
      public readonly domainName: string;
      public readonly distributionDomainName: string;
      public readonly distributionId: string;

      constructor() {
        super(scope, id);
        this.domainName = attrs.domainName;
        this.distributionDomainName = attrs.domainName;
        this.distributionId = attrs.distributionId;
      }
    }();
  }

  public readonly domainName: string;
  public readonly distributionDomainName: string;
  public readonly distributionId: string;

  private readonly defaultBehavior: CacheBehavior;
  private readonly additionalBehaviors: CacheBehavior[] = [];
  private readonly boundOrigins: BoundOrigin[] = [];
  private readonly originGroups: CfnDistribution.OriginGroupProperty[] = [];

  private readonly errorResponses: ErrorResponse[];
  private readonly certificate?: acm.ICertificate;

  constructor(scope: Construct, id: string, props: DistributionProps) {
    super(scope, id);

    if (props.certificate) {
      const certificateRegion = Stack.of(this).parseArn(props.certificate.certificateArn).region;
      if (!Token.isUnresolved(certificateRegion) && certificateRegion !== 'us-east-1') {
        throw new Error(`Distribution certificates must be in the us-east-1 region and the certificate you provided is in ${certificateRegion}.`);
      }

      if ((props.domainNames ?? []).length === 0) {
        throw new Error('Must specify at least one domain name to use a certificate with a distribution');
      }
    }

    const originId = this.addOrigin(props.defaultBehavior.origin);
    this.defaultBehavior = new CacheBehavior(originId, { pathPattern: '*', ...props.defaultBehavior });
    if (props.additionalBehaviors) {
      Object.entries(props.additionalBehaviors).forEach(([pathPattern, behaviorOptions]) => {
        this.addBehavior(pathPattern, behaviorOptions.origin, behaviorOptions);
      });
    }

    this.certificate = props.certificate;
    this.errorResponses = props.errorResponses ?? [];

    // Comments have an undocumented limit of 128 characters
    const trimmedComment =
      props.comment && props.comment.length > 128
        ? `${props.comment.substr(0, 128 - 3)}...`
        : props.comment;

    const distribution = new CfnDistribution(this, 'Resource', {
      distributionConfig: {
        enabled: props.enabled ?? true,
        origins: Lazy.any({ produce: () => this.renderOrigins() }),
        originGroups: Lazy.any({ produce: () => this.renderOriginGroups() }),
        defaultCacheBehavior: this.defaultBehavior._renderBehavior(),
        aliases: props.domainNames,
        cacheBehaviors: Lazy.any({ produce: () => this.renderCacheBehaviors() }),
        comment: trimmedComment,
        customErrorResponses: this.renderErrorResponses(),
        defaultRootObject: props.defaultRootObject,
        httpVersion: props.httpVersion ?? HttpVersion.HTTP2,
        ipv6Enabled: props.enableIpv6 ?? true,
        logging: this.renderLogging(props),
        priceClass: props.priceClass ?? undefined,
        restrictions: this.renderRestrictions(props.geoRestriction),
        viewerCertificate: this.certificate ? this.renderViewerCertificate(this.certificate, props.minimumProtocolVersion) : undefined,
        webAclId: props.webAclId,
      },
    });

    this.domainName = distribution.attrDomainName;
    this.distributionDomainName = distribution.attrDomainName;
    this.distributionId = distribution.ref;

    if (props.invalidationPaths) {
      this.clearEdgeCaches(Array.isArray(props.invalidationPaths) ? props.invalidationPaths : undefined);
    }

  }

  /**
   * Adds a new behavior to this distribution for the given pathPattern.
   *
   * @param pathPattern the path pattern (e.g., 'images/*') that specifies which requests to apply the behavior to.
   * @param origin the origin to use for this behavior
   * @param behaviorOptions the options for the behavior at this path.
   */
  public addBehavior(pathPattern: string, origin: IOrigin, behaviorOptions: AddBehaviorOptions = {}) {
    if (pathPattern === '*') {
      throw new Error('Only the default behavior can have a path pattern of \'*\'');
    }
    const originId = this.addOrigin(origin);
    this.additionalBehaviors.push(new CacheBehavior(originId, { pathPattern, ...behaviorOptions }));
  }


  /**
   * Removes files from CloudFront edge caches before they expire by utilizing
   * the CloudFront Invalidation Construct.
   *
   * @param invalidationPaths the paths at which to clear the edge caches, or
   * undefined to invalidate all paths
   */
  public clearEdgeCaches(invalidationPaths?:string[]):string {
    const invalidation = new Invalidation(new CoreConstruct(this, 'CloudFrontInvalidationScope'), 'CloudFrontInvalidation', {
      distributionId: this.distributionId,
      invalidationPaths,
    });
    return invalidation.invalidationId;
  }

  private addOrigin(origin: IOrigin, isFailoverOrigin: boolean = false): string {
    const ORIGIN_ID_MAX_LENGTH = 128;

    const existingOrigin = this.boundOrigins.find(boundOrigin => boundOrigin.origin === origin);
    if (existingOrigin) {
      return existingOrigin.originGroupId ?? existingOrigin.originId;
    } else {
      const originIndex = this.boundOrigins.length + 1;
      const scope = new CoreConstruct(this, `Origin${originIndex}`);
      const originId = Names.uniqueId(scope).slice(-ORIGIN_ID_MAX_LENGTH);
      const originBindConfig = origin.bind(scope, { originId });
      if (!originBindConfig.failoverConfig) {
        this.boundOrigins.push({ origin, originId, ...originBindConfig });
      } else {
        if (isFailoverOrigin) {
          throw new Error('An Origin cannot use an Origin with its own failover configuration as its fallback origin!');
        }
        const groupIndex = this.originGroups.length + 1;
        const originGroupId = Names.uniqueId(new CoreConstruct(this, `OriginGroup${groupIndex}`)).slice(-ORIGIN_ID_MAX_LENGTH);
        this.boundOrigins.push({ origin, originId, originGroupId, ...originBindConfig });

        const failoverOriginId = this.addOrigin(originBindConfig.failoverConfig.failoverOrigin, true);
        this.addOriginGroup(originGroupId, originBindConfig.failoverConfig.statusCodes, originId, failoverOriginId);
        return originGroupId;
      }
      return originId;
    }
  }

  private addOriginGroup(originGroupId: string, statusCodes: number[] | undefined, originId: string, failoverOriginId: string): void {
    statusCodes = statusCodes ?? [500, 502, 503, 504];
    if (statusCodes.length === 0) {
      throw new Error('fallbackStatusCodes cannot be empty');
    }
    this.originGroups.push({
      failoverCriteria: {
        statusCodes: {
          items: statusCodes,
          quantity: statusCodes.length,
        },
      },
      id: originGroupId,
      members: {
        items: [
          { originId },
          { originId: failoverOriginId },
        ],
        quantity: 2,
      },
    });
  }

  private renderOrigins(): CfnDistribution.OriginProperty[] {
    const renderedOrigins: CfnDistribution.OriginProperty[] = [];
    this.boundOrigins.forEach(boundOrigin => {
      if (boundOrigin.originProperty) {
        renderedOrigins.push(boundOrigin.originProperty);
      }
    });
    return renderedOrigins;
  }

  private renderOriginGroups(): CfnDistribution.OriginGroupsProperty | undefined {
    return this.originGroups.length === 0
      ? undefined
      : {
        items: this.originGroups,
        quantity: this.originGroups.length,
      };
  }

  private renderCacheBehaviors(): CfnDistribution.CacheBehaviorProperty[] | undefined {
    if (this.additionalBehaviors.length === 0) { return undefined; }
    return this.additionalBehaviors.map(behavior => behavior._renderBehavior());
  }

  private renderErrorResponses(): CfnDistribution.CustomErrorResponseProperty[] | undefined {
    if (this.errorResponses.length === 0) { return undefined; }

    return this.errorResponses.map(errorConfig => {
      if (!errorConfig.responseHttpStatus && !errorConfig.ttl && !errorConfig.responsePagePath) {
        throw new Error('A custom error response without either a \'responseHttpStatus\', \'ttl\' or \'responsePagePath\' is not valid.');
      }

      return {
        errorCachingMinTtl: errorConfig.ttl?.toSeconds(),
        errorCode: errorConfig.httpStatus,
        responseCode: errorConfig.responsePagePath
          ? errorConfig.responseHttpStatus ?? errorConfig.httpStatus
          : errorConfig.responseHttpStatus,
        responsePagePath: errorConfig.responsePagePath,
      };
    });
  }

  private renderLogging(props: DistributionProps): CfnDistribution.LoggingProperty | undefined {
    if (!props.enableLogging && !props.logBucket) { return undefined; }
    if (props.enableLogging === false && props.logBucket) {
      throw new Error('Explicitly disabled logging but provided a logging bucket.');
    }

    const bucket = props.logBucket ?? new s3.Bucket(this, 'LoggingBucket');
    return {
      bucket: bucket.bucketRegionalDomainName,
      includeCookies: props.logIncludesCookies,
      prefix: props.logFilePrefix,
    };
  }

  private renderRestrictions(geoRestriction?: GeoRestriction) {
    return geoRestriction ? {
      geoRestriction: {
        restrictionType: geoRestriction.restrictionType,
        locations: geoRestriction.locations,
      },
    } : undefined;
  }

  private renderViewerCertificate(certificate: acm.ICertificate,
    minimumProtocolVersion: SecurityPolicyProtocol = SecurityPolicyProtocol.TLS_V1_2_2019): CfnDistribution.ViewerCertificateProperty {
    return {
      acmCertificateArn: certificate.certificateArn,
      sslSupportMethod: SSLMethod.SNI,
      minimumProtocolVersion: minimumProtocolVersion,
    };
  }
}

/** Maximum HTTP version to support */
export enum HttpVersion {
  /** HTTP 1.1 */
  HTTP1_1 = 'http1.1',
  /** HTTP 2 */
  HTTP2 = 'http2'
}

/**
 * The price class determines how many edge locations CloudFront will use for your distribution.
 * See https://aws.amazon.com/cloudfront/pricing/ for full list of supported regions.
 */
export enum PriceClass {
  /** USA, Canada, Europe, & Israel */
  PRICE_CLASS_100 = 'PriceClass_100',
  /** PRICE_CLASS_100 + South Africa, Kenya, Middle East, Japan, Singapore, South Korea, Taiwan, Hong Kong, & Philippines */
  PRICE_CLASS_200 = 'PriceClass_200',
  /** All locations */
  PRICE_CLASS_ALL = 'PriceClass_All'
}

/**
 * How HTTPs should be handled with your distribution.
 */
export enum ViewerProtocolPolicy {
  /** HTTPS only */
  HTTPS_ONLY = 'https-only',
  /** Will redirect HTTP requests to HTTPS */
  REDIRECT_TO_HTTPS = 'redirect-to-https',
  /** Both HTTP and HTTPS supported */
  ALLOW_ALL = 'allow-all'
}

/**
 * Defines what protocols CloudFront will use to connect to an origin.
 */
export enum OriginProtocolPolicy {
  /** Connect on HTTP only */
  HTTP_ONLY = 'http-only',
  /** Connect with the same protocol as the viewer */
  MATCH_VIEWER = 'match-viewer',
  /** Connect on HTTPS only */
  HTTPS_ONLY = 'https-only',
}

/**
 * The SSL method CloudFront will use for your distribution.
 *
 * Server Name Indication (SNI) - is an extension to the TLS computer networking protocol by which a client indicates
 *  which hostname it is attempting to connect to at the start of the handshaking process. This allows a server to present
 *  multiple certificates on the same IP address and TCP port number and hence allows multiple secure (HTTPS) websites
 * (or any other service over TLS) to be served by the same IP address without requiring all those sites to use the same certificate.
 *
 * CloudFront can use SNI to host multiple distributions on the same IP - which a large majority of clients will support.
 *
 * If your clients cannot support SNI however - CloudFront can use dedicated IPs for your distribution - but there is a prorated monthly charge for
 * using this feature. By default, we use SNI - but you can optionally enable dedicated IPs (VIP).
 *
 * See the CloudFront SSL for more details about pricing : https://aws.amazon.com/cloudfront/custom-ssl-domains/
 *
 */
export enum SSLMethod {
  SNI = 'sni-only',
  VIP = 'vip'
}

/**
 * The minimum version of the SSL protocol that you want CloudFront to use for HTTPS connections.
 * CloudFront serves your objects only to browsers or devices that support at least the SSL version that you specify.
 */
export enum SecurityPolicyProtocol {
  SSL_V3 = 'SSLv3',
  TLS_V1 = 'TLSv1',
  TLS_V1_2016 = 'TLSv1_2016',
  TLS_V1_1_2016 = 'TLSv1.1_2016',
  TLS_V1_2_2018 = 'TLSv1.2_2018',
  TLS_V1_2_2019 = 'TLSv1.2_2019'
}

/**
 * The HTTP methods that the Behavior will accept requests on.
 */
export class AllowedMethods {
  /** HEAD and GET */
  public static readonly ALLOW_GET_HEAD = new AllowedMethods(['GET', 'HEAD']);
  /** HEAD, GET, and OPTIONS */
  public static readonly ALLOW_GET_HEAD_OPTIONS = new AllowedMethods(['GET', 'HEAD', 'OPTIONS']);
  /** All supported HTTP methods */
  public static readonly ALLOW_ALL = new AllowedMethods(['GET', 'HEAD', 'OPTIONS', 'PUT', 'PATCH', 'POST', 'DELETE']);

  /** HTTP methods supported */
  public readonly methods: string[];

  private constructor(methods: string[]) { this.methods = methods; }
}

/**
 * The HTTP methods that the Behavior will cache requests on.
 */
export class CachedMethods {
  /** HEAD and GET */
  public static readonly CACHE_GET_HEAD = new CachedMethods(['GET', 'HEAD']);
  /** HEAD, GET, and OPTIONS */
  public static readonly CACHE_GET_HEAD_OPTIONS = new CachedMethods(['GET', 'HEAD', 'OPTIONS']);

  /** HTTP methods supported */
  public readonly methods: string[];

  private constructor(methods: string[]) { this.methods = methods; }
}

/**
 * Options for configuring custom error responses.
 */
export interface ErrorResponse {
  /**
   * The minimum amount of time, in seconds, that you want CloudFront to cache the HTTP status code specified in ErrorCode.
   *
   * @default - the default caching TTL behavior applies
   */
  readonly ttl?: Duration;
  /**
   * The HTTP status code for which you want to specify a custom error page and/or a caching duration.
   */
  readonly httpStatus: number;
  /**
   * The HTTP status code that you want CloudFront to return to the viewer along with the custom error page.
   *
   * If you specify a value for `responseHttpStatus`, you must also specify a value for `responsePagePath`.
   *
   * @default - the error code will be returned as the response code.
   */
  readonly responseHttpStatus?: number;
  /**
   * The path to the custom error page that you want CloudFront to return to a viewer when your origin returns the
   * `httpStatus`, for example, /4xx-errors/403-forbidden.html
   *
   * @default - the default CloudFront response is shown.
   */
  readonly responsePagePath?: string;
}

/**
 * The type of events that a Lambda@Edge function can be invoked in response to.
 */
export enum LambdaEdgeEventType {
  /**
   * The origin-request specifies the request to the
   * origin location (e.g. S3)
   */
  ORIGIN_REQUEST = 'origin-request',

  /**
   * The origin-response specifies the response from the
   * origin location (e.g. S3)
   */
  ORIGIN_RESPONSE = 'origin-response',

  /**
   * The viewer-request specifies the incoming request
   */
  VIEWER_REQUEST = 'viewer-request',

  /**
   * The viewer-response specifies the outgoing response
   */
  VIEWER_RESPONSE = 'viewer-response',
}

/**
 * Represents a Lambda function version and event type when using Lambda@Edge.
 * The type of the {@link AddBehaviorOptions.edgeLambdas} property.
 */
export interface EdgeLambda {
  /**
   * The version of the Lambda function that will be invoked.
   *
   * **Note**: it's not possible to use the '$LATEST' function version for Lambda@Edge!
   */
  readonly functionVersion: lambda.IVersion;

  /** The type of event in response to which should the function be invoked. */
  readonly eventType: LambdaEdgeEventType;

  /**
   * Allows a Lambda function to have read access to the body content.
   * Only valid for "request" event types (`ORIGIN_REQUEST` or `VIEWER_REQUEST`).
   * See https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-include-body-access.html
   *
   * @default false
   */
  readonly includeBody?: boolean;
}

/**
 * Options for adding a new behavior to a Distribution.
 */
export interface AddBehaviorOptions {
  /**
   * HTTP methods to allow for this behavior.
   *
   * @default AllowedMethods.ALLOW_GET_HEAD
   */
  readonly allowedMethods?: AllowedMethods;

  /**
   * HTTP methods to cache for this behavior.
   *
   * @default CachedMethods.CACHE_GET_HEAD
   */
  readonly cachedMethods?: CachedMethods;

  /**
   * The cache policy for this behavior. The cache policy determines what values are included in the cache key,
   * and the time-to-live (TTL) values for the cache.
   *
   * @see https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/controlling-the-cache-key.html.
   * @default CachePolicy.CACHING_OPTIMIZED
   */
  readonly cachePolicy?: ICachePolicy;

  /**
   * Whether you want CloudFront to automatically compress certain files for this cache behavior.
   * See https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/ServingCompressedFiles.html#compressed-content-cloudfront-file-types
   * for file types CloudFront will compress.
   *
   * @default true
   */
  readonly compress?: boolean;

  /**
   * The origin request policy for this behavior. The origin request policy determines which values (e.g., headers, cookies)
   * are included in requests that CloudFront sends to the origin.
   *
   * @default - none
   */
  readonly originRequestPolicy?: IOriginRequestPolicy;

  /**
   * Set this to true to indicate you want to distribute media files in the Microsoft Smooth Streaming format using this behavior.
   *
   * @default false
   */
  readonly smoothStreaming?: boolean;

  /**
   * The protocol that viewers can use to access the files controlled by this behavior.
   *
   * @default ViewerProtocolPolicy.ALLOW_ALL
   */
  readonly viewerProtocolPolicy?: ViewerProtocolPolicy;

  /**
   * The CloudFront functions to invoke before serving the contents.
   *
   * @default - no functions will be invoked
   */
  readonly functionAssociations?: FunctionAssociation[];

  /**
   * The Lambda@Edge functions to invoke before serving the contents.
   *
   * @default - no Lambda functions will be invoked
   * @see https://aws.amazon.com/lambda/edge
   */
  readonly edgeLambdas?: EdgeLambda[];

  /**
   * A list of Key Groups that CloudFront can use to validate signed URLs or signed cookies.
   *
   * @default - no KeyGroups are associated with cache behavior
   * @see https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/PrivateContent.html
   */
  readonly trustedKeyGroups?: IKeyGroup[];
}

/**
 * Options for creating a new behavior.
 */
export interface BehaviorOptions extends AddBehaviorOptions {
  /**
   * The origin that you want CloudFront to route requests to when they match this behavior.
   */
  readonly origin: IOrigin;
}
