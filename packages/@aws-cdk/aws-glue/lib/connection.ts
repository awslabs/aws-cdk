import * as ec2 from '@aws-cdk/aws-ec2';
import * as cdk from '@aws-cdk/core';
import * as constructs from 'constructs';
import { CfnConnection } from './glue.generated';

/**
 * The type of the glue connection
 *
 * If you need to use a connection type that doesn't exist as a static member, you
 * can instantiate a `ConnectionType` object, e.g: `new ConnectionType('NEW_TYPE')`.
 */
export class ConnectionType {
  /**
   * Designates a connection to a database through Java Database Connectivity (JDBC).
   */
  public static readonly JDBC = new ConnectionType('JDBC');

  /**
   * Designates a connection to an Apache Kafka streaming platform.
   */
  public static readonly KAFKA = new ConnectionType('KAFKA');

  /**
   * Designates a connection to a MongoDB document database.
   */
  public static readonly MONGODB = new ConnectionType('MONGODB');

  /**
   * Designates a network connection to a data source within an Amazon Virtual Private Cloud environment (Amazon VPC).
   */
  public static readonly NETWORK = new ConnectionType('NETWORK');

  /**
   * The name of this ConnectionType, as expected by Connection resource.
   */
  public readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * The connection type name as expected by Connection resource.
   */
  public toString(): string {
    return this.name;
  }
}

/**
 * Interface representing a created or an imported {@link Connection}
 */
export interface IConnection extends cdk.IResource {
  /**
   * The name of the connection
   * @attribute
   */
  readonly connectionName: string;

  /**
   * The ARN of the connection
   * @attribute
   */
  readonly connectionArn: string;
}

/**
 * Base Connection Options
 */
export interface ConnectionOptions {
  /**
   * The name of the connection
   * @default cloudformation generated name
   */
  readonly connectionName?: string;

  /**
   * The description of the connection.
   * @default no description
   */
  readonly description?: string;

  /**
   *  Key-Value pairs that define parameters for the connection.
   *  @default empty properties
   *  @see https://docs.aws.amazon.com/glue/latest/dg/aws-glue-programming-etl-connect.html
   */
  readonly properties?: { [key: string]: string };

  /**
   * A list of criteria that can be used in selecting this connection.
   * This is useful for filtering the results of https://awscli.amazonaws.com/v2/documentation/api/latest/reference/glue/get-connections.html
   * @default no match criteria
   */
  readonly matchCriteria?: string[];

  /**
   * The list of security groups needed to successfully make this connection e.g. to successfully connect to VPC.
   * @default no security group
   */
  readonly securityGroups?: ec2.ISecurityGroup[];

  /**
   * The VPC subnet to connect to resources within a VPC. See more at https://docs.aws.amazon.com/glue/latest/dg/start-connecting.html.
   * @default no subnet
   */
  readonly subnet?: ec2.ISubnet;
}

/**
 * Construction properties for {@link Connection}
 */
export interface ConnectionProps extends ConnectionOptions {
  /**
   * The type of the connection
   */
  readonly type: ConnectionType;
}

/**
 * An AWS Glue connection to a data source.
 */
export class Connection extends cdk.Resource implements IConnection {
  /**
   * Creates a Connection construct that represents an external connection.
   *
   * @param scope The scope creating construct (usually `this`).
   * @param id The construct's id.
   * @param connectionArn arn of external connection.
   */
  public static fromConnectionArn(scope: constructs.Construct, id: string, connectionArn: string): IConnection {
    class Import extends cdk.Resource implements IConnection {
      public readonly connectionName = cdk.Arn.extractResourceName(connectionArn, 'connection');
      public readonly connectionArn = connectionArn;
    }

    return new Import(scope, id);
  }

  /**
   * Creates a Connection construct that represents an external connection.
   *
   * @param scope The scope creating construct (usually `this`).
   * @param id The construct's id.
   * @param connectionName name of external connection.
   */
  public static fromConnectionName(scope: constructs.Construct, id: string, connectionName: string): IConnection {
    class Import extends cdk.Resource implements IConnection {
      public readonly connectionName = connectionName;
      public readonly connectionArn = Connection.buildConnectionArn(scope, connectionName);
    }

    return new Import(scope, id);
  }

  private static buildConnectionArn(scope: constructs.Construct, connectionName: string) : string {
    return cdk.Stack.of(scope).formatArn({
      service: 'glue',
      resource: 'connection',
      resourceName: connectionName,
    });
  }

  /**
   * The ARN of the connection
   */
  public readonly connectionArn: string;

  /**
   * The name of the connection
   */
  public readonly connectionName: string;

  private readonly properties: {[key: string]: string};

  constructor(scope: constructs.Construct, id: string, props: ConnectionProps) {
    super(scope, id, {
      physicalName: props.connectionName,
    });

    this.properties = props.properties || {};

    const physicalConnectionRequirements = props.subnet || props.securityGroups ? {
      availabilityZone: props.subnet ? props.subnet.availabilityZone : undefined,
      subnetId: props.subnet ? props.subnet.subnetId : undefined,
      securityGroupIdList: props.securityGroups ? props.securityGroups.map(sg => sg.securityGroupId) : undefined,
    } : undefined;

    const connectionResource = new CfnConnection(this, 'Resource', {
      catalogId: cdk.Stack.of(this).account,
      connectionInput: {
        connectionProperties: cdk.Lazy.any({ produce: () => Object.keys(this.properties).length > 0 ? this.properties : undefined }),
        connectionType: props.type.name,
        description: props.description,
        matchCriteria: props.matchCriteria,
        name: props.connectionName,
        physicalConnectionRequirements,
      },
    });

    const resourceName = this.getResourceNameAttribute(connectionResource.ref);
    this.connectionArn = Connection.buildConnectionArn(this, resourceName);
    this.connectionName = resourceName;
  }

  /**
   * Add additional connection parameters
   * @param key parameter key
   * @param value parameter value
   */
  public addProperty(key: string, value: string): void {
    this.properties[key] = value;
  }
}
