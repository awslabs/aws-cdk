import { Names, Resource, Token } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnOriginRequestPolicy } from './cloudfront.generated';

/**
 * Represents a Origin Request Policy
 */
export interface IOriginRequestPolicy {
  /**
   * The ID of the origin request policy
   * @attribute
   */
  readonly originRequestPolicyId: string;
}

/**
 * Properties for creating a Origin Request Policy
 */
export interface OriginRequestPolicyProps {
  /**
   * A unique name to identify the origin request policy.
   * The name must only include '-', '_', or alphanumeric characters.
   * @default - generated from the `id`
   */
  readonly originRequestPolicyName?: string;

  /**
   * A comment to describe the origin request policy.
   * @default - no comment
   */
  readonly comment?: string;

  /**
   * The cookies from viewer requests to include in origin requests.
   * @default OriginRequestCookieBehavior.none()
   */
  readonly cookieBehavior?: OriginRequestCookieBehavior;

  /**
   * The HTTP headers to include in origin requests. These can include headers from viewer requests and additional headers added by CloudFront.
   * @default OriginRequestHeaderBehavior.none()
   */
  readonly headerBehavior?: OriginRequestHeaderBehavior;

  /**
   * The URL query strings from viewer requests to include in origin requests.
   * @default OriginRequestQueryStringBehavior.none()
   */
  readonly queryStringBehavior?: OriginRequestQueryStringBehavior;
}

/**
 * A Origin Request Policy configuration.
 *
 * @resource AWS::CloudFront::OriginRequestPolicy
 */
export class OriginRequestPolicy extends Resource implements IOriginRequestPolicy {

  /** This policy includes only the User-Agent and Referer headers. It doesn’t include any query strings or cookies. */
  public static readonly USER_AGENT_REFERER_HEADERS = OriginRequestPolicy.fromManagedOriginRequestPolicy('acba4595-bd28-49b8-b9fe-13317c0390fa');
  /** This policy includes the header that enables cross-origin resource sharing (CORS) requests when the origin is a custom origin. */
  public static readonly CORS_CUSTOM_ORIGIN = OriginRequestPolicy.fromManagedOriginRequestPolicy('59781a5b-3903-41f3-afcb-af62929ccde1');
  /** This policy includes the headers that enable cross-origin resource sharing (CORS) requests when the origin is an Amazon S3 bucket. */
  public static readonly CORS_S3_ORIGIN = OriginRequestPolicy.fromManagedOriginRequestPolicy('88a5eaf4-2fd4-4709-b370-b4c650ea3fcf');
  /** This policy includes all values (query strings, headers, and cookies) in the viewer request. */
  public static readonly ALL_VIEWER = OriginRequestPolicy.fromManagedOriginRequestPolicy('216adef6-5c7f-47e4-b989-5492eafa07d3');
  /** This policy is designed for use with an origin that is an AWS Elemental MediaTailor endpoint. */
  public static readonly ELEMENTAL_MEDIA_TAILOR = OriginRequestPolicy.fromManagedOriginRequestPolicy('775133bc-15f2-49f9-abea-afb2e0bf67d2');

  /** Imports a Origin Request Policy from its id. */
  public static fromOriginRequestPolicyId(scope: Construct, id: string, originRequestPolicyId: string): IOriginRequestPolicy {
    return new class extends Resource implements IOriginRequestPolicy {
      public readonly originRequestPolicyId = originRequestPolicyId;
    }(scope, id);
  }

  /** Use an existing managed origin request policy. */
  private static fromManagedOriginRequestPolicy(managedOriginRequestPolicyId: string): IOriginRequestPolicy {
    return new class implements IOriginRequestPolicy {
      public readonly originRequestPolicyId = managedOriginRequestPolicyId;
    }();
  }

  public readonly originRequestPolicyId: string;

  constructor(scope: Construct, id: string, props: OriginRequestPolicyProps = {}) {
    super(scope, id, {
      physicalName: props.originRequestPolicyName,
    });

    const originRequestPolicyName = props.originRequestPolicyName ?? Names.uniqueId(this);
    if (!Token.isUnresolved(originRequestPolicyName) && !originRequestPolicyName.match(/^[\w-]+$/i)) {
      throw new Error(`'originRequestPolicyName' can only include '-', '_', and alphanumeric characters, got: '${props.originRequestPolicyName}'`);
    }

    const cookies = props.cookieBehavior ?? OriginRequestCookieBehavior.none();
    const headers = props.headerBehavior ?? OriginRequestHeaderBehavior.none();
    const queryStrings = props.queryStringBehavior ?? OriginRequestQueryStringBehavior.none();

    const resource = new CfnOriginRequestPolicy(this, 'Resource', {
      originRequestPolicyConfig: {
        name: originRequestPolicyName,
        comment: props.comment,
        cookiesConfig: {
          cookieBehavior: cookies.behavior,
          cookies: cookies.cookies,
        },
        headersConfig: {
          headerBehavior: headers.behavior,
          headers: headers.headers,
        },
        queryStringsConfig: {
          queryStringBehavior: queryStrings.behavior,
          queryStrings: queryStrings.queryStrings,
        },
      },
    });

    this.originRequestPolicyId = resource.ref;
  }
}

/**
 * Determines whether any cookies in viewer requests (and if so, which cookies)
 * are included in requests that CloudFront sends to the origin.
 */
export class OriginRequestCookieBehavior {
  /**
   * Cookies in viewer requests are not included in requests that CloudFront sends to the origin.
   * Any cookies that are listed in a CachePolicy are still included in origin requests.
   */
  public static none() { return new OriginRequestCookieBehavior('none'); }

  /** All cookies in viewer requests are included in requests that CloudFront sends to the origin. */
  public static all() { return new OriginRequestCookieBehavior('all'); }

  /** Only the provided `cookies` are included in requests that CloudFront sends to the origin. */
  public static allowList(...cookies: string[]) {
    if (cookies.length === 0) {
      throw new Error('At least one cookie to allow must be provided');
    }
    return new OriginRequestCookieBehavior('whitelist', cookies);
  }

  /** The behavior of cookies: allow all, none or an allow list. */
  public readonly behavior: string;
  /** The cookies to allow, if the behavior is an allow list. */
  public readonly cookies?: string[];

  private constructor(behavior: string, cookies?: string[]) {
    this.behavior = behavior;
    this.cookies = cookies;
  }
}

/**
 * Determines whether any HTTP headers (and if so, which headers) are included in requests that CloudFront sends to the origin.
 */
export class OriginRequestHeaderBehavior {
  /**
   * HTTP headers are not included in requests that CloudFront sends to the origin.
   * Any headers that are listed in a CachePolicy are still included in origin requests.
   */
  public static none() { return new OriginRequestHeaderBehavior('none'); }

  /**
   * All HTTP headers in viewer requests are included in requests that CloudFront sends to the origin.
   * Additionally, any additional CloudFront headers provided are included; the additional headers are added by CloudFront.
   * @see https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-cloudfront-headers.html
   */
  public static all(...cloudfrontHeaders: string[]) {
    if (cloudfrontHeaders.length > 0) {
      if (!cloudfrontHeaders.every(header => header.startsWith('CloudFront-'))) {
        throw new Error('additional CloudFront headers passed to `OriginRequestHeaderBehavior.all()` must begin with \'CloudFront-\'');
      }
      return new OriginRequestHeaderBehavior('allViewerAndWhitelistCloudFront', cloudfrontHeaders);
    } else {
      return new OriginRequestHeaderBehavior('allViewer');
    }
  }

  /** Listed headers are included in requests that CloudFront sends to the origin. */
  public static allowList(...headers: string[]) {
    if (headers.length === 0) {
      throw new Error('At least one header to allow must be provided');
    }
    if (/Authorization/i.test(headers.join('|')) || /Accept-Encoding/i.test(headers.join('|'))) {
      throw new Error('you cannot pass `Authorization` or `Accept-Encoding` as header values; use a CachePolicy to forward these headers instead');
    }
    return new OriginRequestHeaderBehavior('whitelist', headers);
  }

  /** The behavior of headers: allow all, none or an allow list. */
  public readonly behavior: string;
  /** The headers for the allow list or the included CloudFront headers, if applicable. */
  public readonly headers?: string[];

  private constructor(behavior: string, headers?: string[]) {
    this.behavior = behavior;
    this.headers = headers;
  }
}

/**
 * Determines whether any URL query strings in viewer requests (and if so, which query strings)
 * are included in requests that CloudFront sends to the origin.
 */
export class OriginRequestQueryStringBehavior {
  /**
   * Query strings in viewer requests are not included in requests that CloudFront sends to the origin.
   * Any query strings that are listed in a CachePolicy are still included in origin requests.
   */
  public static none() { return new OriginRequestQueryStringBehavior('none'); }

  /** All query strings in viewer requests are included in requests that CloudFront sends to the origin. */
  public static all() { return new OriginRequestQueryStringBehavior('all'); }

  /** Only the provided `queryStrings` are included in requests that CloudFront sends to the origin. */
  public static allowList(...queryStrings: string[]) {
    if (queryStrings.length === 0) {
      throw new Error('At least one query string to allow must be provided');
    }
    return new OriginRequestQueryStringBehavior('whitelist', queryStrings);
  }

  /** The behavior of query strings -- allow all, none, or only an allow list. */
  public readonly behavior: string;
  /** The query strings to allow, if the behavior is an allow list. */
  public readonly queryStrings?: string[];

  private constructor(behavior: string, queryStrings?: string[]) {
    this.behavior = behavior;
    this.queryStrings = queryStrings;
  }
}
