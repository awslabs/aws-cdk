import { Duration, Token } from '@aws-cdk/core';
import { CfnDistribution } from './cloudfront.generated';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '@aws-cdk/core';

/**
 * The failover configuration used for Origin Groups,
 * returned in {@link OriginBindConfig.failoverConfig}.
 */
export interface OriginFailoverConfig {
  /** The origin to use as the fallback origin. */
  readonly failoverOrigin: IOrigin;

  /**
   * The HTTP status codes of the response that trigger querying the failover Origin.
   *
   * @default - 500, 502, 503 and 504
   */
  readonly statusCodes?: number[];
}

/** The struct returned from {@link IOrigin.bind}. */
export interface OriginBindConfig {
  /**
   * The CloudFormation OriginProperty configuration for this Origin.
   *
   * @default - nothing is returned
   */
  readonly originProperty?: CfnDistribution.OriginProperty;

  /**
   * The failover configuration for this Origin.
   *
   * @default - nothing is returned
   */
  readonly failoverConfig?: OriginFailoverConfig;
}

/**
 * Represents the concept of a CloudFront Origin.
 * You provide one or more origins when creating a Distribution.
 */
export interface IOrigin {
  /**
   * The method called when a given Origin is added
   * (for the first time) to a Distribution.
   */
  bind(scope: Construct, options: OriginBindOptions): OriginBindConfig;
}

/**
 * Properties to define an Origin.
 */
export interface OriginProps {
  /**
   * An optional path that CloudFront appends to the origin domain name when CloudFront requests content from the origin.
   * Must begin, but not end, with '/' (e.g., '/production/images').
   *
   * @default '/'
   */
  readonly originPath?: string;

  /**
   * The number of seconds that CloudFront waits when trying to establish a connection to the origin.
   * Valid values are 1-10 seconds, inclusive.
   *
   * @default Duration.seconds(10)
   */
  readonly connectionTimeout?: Duration;

  /**
   * The number of times that CloudFront attempts to connect to the origin; valid values are 1, 2, or 3 attempts.
   *
   * @default 3
   */
  readonly connectionAttempts?: number;

  /**
   * A list of HTTP header names and values that CloudFront adds to requests it sends to the origin.
   *
   * @default {}
   */
  readonly customHeaders?: Record<string, string>;

  /**
   * When you enable Origin Shield in the AWS Region that has the lowest latency to your origin, you can get better network performance
   *
   * @see https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/origin-shield.html
   *
   * @default - origin shield not enabled
   */
  readonly originShieldRegion?: string;
}

/**
 * Options passed to Origin.bind().
 */
export interface OriginBindOptions {
  /**
   * The identifier of this Origin,
   * as assigned by the Distribution this Origin has been used added to.
   */
  readonly originId: string;
}

/**
 * Represents a distribution origin, that describes the Amazon S3 bucket, HTTP server (for example, a web server),
 * Amazon MediaStore, or other server from which CloudFront gets your files.
 */
export abstract class OriginBase implements IOrigin {
  private readonly domainName: string;
  private readonly originPath?: string;
  private readonly connectionTimeout?: Duration;
  private readonly connectionAttempts?: number;
  private readonly customHeaders?: Record<string, string>;
  private readonly originShieldRegion?: string

  protected constructor(domainName: string, props: OriginProps = {}) {
    validateIntInRangeOrUndefined('connectionTimeout', 1, 10, props.connectionTimeout?.toSeconds());
    validateIntInRangeOrUndefined('connectionAttempts', 1, 3, props.connectionAttempts, false);

    this.domainName = domainName;
    this.originPath = this.validateOriginPath(props.originPath);
    this.connectionTimeout = props.connectionTimeout;
    this.connectionAttempts = props.connectionAttempts;
    this.customHeaders = props.customHeaders;
    this.originShieldRegion = props.originShieldRegion;
  }

  /**
   * Binds the origin to the associated Distribution. Can be used to grant permissions, create dependent resources, etc.
   */
  public bind(_scope: Construct, options: OriginBindOptions): OriginBindConfig {
    const s3OriginConfig = this.renderS3OriginConfig();
    const customOriginConfig = this.renderCustomOriginConfig();

    if (!s3OriginConfig && !customOriginConfig) {
      throw new Error('Subclass must override and provide either s3OriginConfig or customOriginConfig');
    }

    return {
      originProperty: {
        domainName: this.domainName,
        id: options.originId,
        originPath: this.originPath,
        connectionAttempts: this.connectionAttempts,
        connectionTimeout: this.connectionTimeout?.toSeconds(),
        originCustomHeaders: this.renderCustomHeaders(),
        s3OriginConfig,
        customOriginConfig,
        originShield: this.getOriginShield(this.originShieldRegion),
      },
    };
  }

  // Overridden by sub-classes to provide S3 origin config.
  protected renderS3OriginConfig(): CfnDistribution.S3OriginConfigProperty | undefined {
    return undefined;
  }

  // Overridden by sub-classes to provide custom origin config.
  protected renderCustomOriginConfig(): CfnDistribution.CustomOriginConfigProperty | undefined {
    return undefined;
  }

  private renderCustomHeaders(): CfnDistribution.OriginCustomHeaderProperty[] | undefined {
    if (!this.customHeaders || Object.entries(this.customHeaders).length === 0) { return undefined; }
    return Object.entries(this.customHeaders).map(([headerName, headerValue]) => {
      return { headerName, headerValue };
    });
  }

  /**
   * If the path is defined, it must start with a '/' and not end with a '/'.
   * This method takes in the originPath, and returns it back (if undefined) or adds/removes the '/' as appropriate.
   */
  private validateOriginPath(originPath?: string): string | undefined {
    if (Token.isUnresolved(originPath)) { return originPath; }
    if (originPath === undefined) { return undefined; }
    let path = originPath;
    if (!path.startsWith('/')) { path = '/' + path; }
    if (path.endsWith('/')) { path = path.substr(0, path.length - 1); }
    return path;
  }

  /**
   * Takes origin shield region and converts to CfnDistribution.OriginShieldProperty
  */
  private getOriginShield(originShieldRegion:string = ''): CfnDistribution.OriginShieldProperty | undefined {
    if (originShieldRegion) {
      if (!(/^\w\w\-[a-z]*\-\d$/).test(originShieldRegion)) throw new Error(`originShieldRegion ${originShieldRegion} is not a valid AWS region.`);
      return {
        enabled: true,
        originShieldRegion,
      };
    }
    return undefined;
  }
}

/**
 * Throws an error if a value is defined and not an integer or not in a range.
 */
function validateIntInRangeOrUndefined(name: string, min: number, max: number, value?: number, isDuration: boolean = true) {
  if (value === undefined) { return; }
  if (!Number.isInteger(value) || value < min || value > max) {
    const seconds = isDuration ? ' seconds' : '';
    throw new Error(`${name}: Must be an int between ${min} and ${max}${seconds} (inclusive); received ${value}.`);
  }
}
