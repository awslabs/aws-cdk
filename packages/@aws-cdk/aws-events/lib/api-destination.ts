import * as crypto from 'crypto';
import { Duration, Lazy, Names, Resource } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { IConnection } from './connection';
import { CfnApiDestination } from './events.generated';

/**
 * Supported HTTP operations.
 */
export enum HttpMethod {

  /** POST */
  POST = 'POST',
  /** GET */
  GET = 'GET',
  /** HEAD */
  HEAD = 'HEAD',
  /** OPTIONS */
  OPTIONS = 'OPTIONS',
  /** PUT */
  PUT = 'PUT',
  /** PATCH */
  PATCH = 'PATCH',
  /** DELETE */
  DELETE = 'DELETE',

}

/**
 * The event Api Destination properties
 */
export interface ApiDestinationProps {
  /**
   * The ARN of the connection to use for the API destination
   */
  readonly connection: IConnection;
  /**
   * A description for the API destination.
   *
   * @default - none
   */
  readonly description?: string;
  /**
   * The method to use for the request to the HTTP invocation endpoint.
   */
  readonly httpMethod: HttpMethod;
  /**
   * The URL to the HTTP invocation endpoint for the API destination..
   */
  readonly invocationEndpoint: string;
  /**
   * The maximum number of requests per second to send to the HTTP invocation endpoint.
   * 
   * @default - None
   */
  readonly invocationRateLimit?: number;
  /**
   * The name for the API destination.
   * @default - A unique name will be generated from the construct ID
   */
  readonly apiDestinationName?: string;
}

/**
 * Define an EventBridge Api Destination
 *
 * @resource AWS::Events::ApiDestination
 */
export class ApiDestination extends Resource {
  /**
   * The Connection to associate with Api Destination
   */
  public readonly connection: IConnection;

  /**
   * The Name of the Api Destination created.
   * @attribute
   */
  public readonly apiDestinationName: string;

  /**
   * The ARN of the Api Destination created.
   * @attribute
   */
  public readonly apiDestinationArn: string;

  constructor(scope: Construct, id: string, props: ApiDestinationProps) {
    super(scope, id, {
      physicalName: props.apiDestinationName || Lazy.string({
        produce: () => this.generateUniqueName(),
      }),
    });

    this.connection = props.connection;

    let apiDestination = new CfnApiDestination(this, 'ApiDestination', {
      connectionArn: this.connection.connectionArn,
      description: props.description,
      httpMethod: props.httpMethod,
      invocationEndpoint: props.invocationEndpoint,
      invocationRateLimitPerSecond: props.invocationRateLimit?.toSeconds(),
      name: this.physicalName,
    });

    this.apiDestinationName = this.getResourceNameAttribute(apiDestination.ref);
    this.apiDestinationArn = apiDestination.attrArn;
  }

  /**
   * Creates a unique name for the Api Destination. The generated name is the physical ID of the Api Destination.
   */
  private generateUniqueName(): string {
    const name = Names.uniqueId(this).toLowerCase().replace(' ', '-');
    if (name.length <= 21) {
      return name;
    } else {
      return name.substring(0, 15) + nameHash(name);
    }
  }
}

/**
 * Take a hash of the given name.
 *
 * @param name the name to be hashed
 */
function nameHash(name: string): string {
  const md5 = crypto.createHash('sha256').update(name).digest('hex');
  return md5.slice(0, 6);
}

