import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import { ContextProvider, Duration, Lazy, Resource, Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { HostedZoneProviderProps } from './hosted-zone-provider';
import { HostedZoneAttributes, IHostedZone } from './hosted-zone-ref';
import { CaaAmazonRecord, ZoneDelegationRecord } from './record-set';
import { CfnHostedZone } from './route53.generated';
import { makeHostedZoneArn, validateZoneName } from './util';

/**
 * Common properties to create a Route 53 hosted zone
 */
export interface CommonHostedZoneProps {
  /**
   * The name of the domain. For resource record types that include a domain
   * name, specify a fully qualified domain name.
   */
  readonly zoneName: string;

  /**
   * Any comments that you want to include about the hosted zone.
   *
   * @default none
   */
  readonly comment?: string;

  /**
   * The Amazon Resource Name (ARN) for the log group that you want Amazon Route 53 to send query logs to.
   *
   * @default disabled
   */
  readonly queryLogsLogGroupArn?: string;
}

/**
 * Properties of a new hosted zone
 */
export interface HostedZoneProps extends CommonHostedZoneProps {
  /**
   * A VPC that you want to associate with this hosted zone. When you specify
   * this property, a private hosted zone will be created.
   *
   * You can associate additional VPCs to this private zone using `addVpc(vpc)`.
   *
   * @default public (no VPCs associated)
   */
  readonly vpcs?: ec2.IVpc[];
}

/**
 * Container for records, and records contain information about how to route traffic for a
 * specific domain, such as example.com and its subdomains (acme.example.com, zenith.example.com)
 */
export class HostedZone extends Resource implements IHostedZone {
  public get hostedZoneArn(): string {
    return makeHostedZoneArn(this, this.hostedZoneId);
  }

  /**
   * Import a Route 53 hosted zone defined either outside the CDK, or in a different CDK stack
   *
   * Use when hosted zone ID is known. Hosted zone name becomes unavailable through this query.
   *
   * @param scope the parent Construct for this Construct
   * @param id  the logical name of this Construct
   * @param hostedZoneId the ID of the hosted zone to import
   */
  public static fromHostedZoneId(scope: Construct, id: string, hostedZoneId: string): IHostedZone {
    class Import extends Resource implements IHostedZone {
      public readonly hostedZoneId = hostedZoneId;
      public get zoneName(): string {
        throw new Error('HostedZone.fromHostedZoneId doesn\'t support "zoneName"');
      }
      public get hostedZoneArn(): string {
        return makeHostedZoneArn(this, this.hostedZoneId);
      }
    }

    return new Import(scope, id);
  }

  /**
   * Imports a hosted zone from another stack.
   *
   * Use when both hosted zone ID and hosted zone name are known.
   *
   * @param scope the parent Construct for this Construct
   * @param id  the logical name of this Construct
   * @param attrs the HostedZoneAttributes (hosted zone ID and hosted zone name)
   */
  public static fromHostedZoneAttributes(scope: Construct, id: string, attrs: HostedZoneAttributes): IHostedZone {
    class Import extends Resource implements IHostedZone {
      public readonly hostedZoneId = attrs.hostedZoneId;
      public readonly zoneName = attrs.zoneName;
      public get hostedZoneArn(): string {
        return makeHostedZoneArn(this, this.hostedZoneId);
      }
    }

    return new Import(scope, id);
  }

  /**
   * Lookup a hosted zone in the current account/region based on query parameters.
   * Requires environment, you must specify env for the stack.
   *
   * Use to easily query hosted zones.
   *
   * @see https://docs.aws.amazon.com/cdk/latest/guide/environments.html
   */
  public static fromLookup(scope: Construct, id: string, query: HostedZoneProviderProps): IHostedZone {
    const DEFAULT_HOSTED_ZONE: HostedZoneContextResponse = {
      Id: 'DUMMY',
      Name: query.domainName,
    };

    interface HostedZoneContextResponse {
      Id: string;
      Name: string;
    }

    const response: HostedZoneContextResponse = ContextProvider.getValue(scope, {
      provider: cxschema.ContextProvider.HOSTED_ZONE_PROVIDER,
      dummyValue: DEFAULT_HOSTED_ZONE,
      props: query,
    }).value;

    // CDK handles the '.' at the end, so remove it here
    if (response.Name.endsWith('.')) {
      response.Name = response.Name.substring(0, response.Name.length - 1);
    }

    response.Id = response.Id.replace('/hostedzone/', '');

    return HostedZone.fromHostedZoneAttributes(scope, id, {
      hostedZoneId: response.Id,
      zoneName: response.Name,
    });
  }

  public readonly hostedZoneId: string;
  public readonly zoneName: string;
  public readonly hostedZoneNameServers?: string[];

  /**
   * VPCs to which this hosted zone will be added
   */
  protected readonly vpcs = new Array<CfnHostedZone.VPCProperty>();

  constructor(scope: Construct, id: string, props: HostedZoneProps) {
    super(scope, id);

    validateZoneName(props.zoneName);

    const resource = new CfnHostedZone(this, 'Resource', {
      name: props.zoneName + '.',
      hostedZoneConfig: props.comment ? { comment: props.comment } : undefined,
      queryLoggingConfig: props.queryLogsLogGroupArn ? { cloudWatchLogsLogGroupArn: props.queryLogsLogGroupArn } : undefined,
      vpcs: Lazy.any({ produce: () => this.vpcs.length === 0 ? undefined : this.vpcs }),
    });

    this.hostedZoneId = resource.ref;
    this.hostedZoneNameServers = resource.attrNameServers;
    this.zoneName = props.zoneName;

    for (const vpc of props.vpcs || []) {
      this.addVpc(vpc);
    }
  }

  /**
   * Add another VPC to this private hosted zone.
   *
   * @param vpc the other VPC to add.
   */
  public addVpc(vpc: ec2.IVpc) {
    this.vpcs.push({ vpcId: vpc.vpcId, vpcRegion: Stack.of(vpc).region });
  }
}

/**
 * Construction properties for a PublicHostedZone.
 */
export interface PublicHostedZoneProps extends CommonHostedZoneProps {
  /**
   * Whether to create a CAA record to restrict certificate authorities allowed
   * to issue certificates for this domain to Amazon only.
   *
   * @default false
   */
  readonly caaAmazon?: boolean;

  /**
   * A principal which is trusted to assume a role for zone delegation
   *
   * @default - No delegation configuration
   */
  readonly crossAccountZoneDelegationPrincipal?: iam.IPrincipal;

  /**
   * The name of the role created for cross account delegation
   *
   * @default - A role name is generated automatically
   */
  readonly crossAccountZoneDelegationRoleName?: string;
}

/**
 * Represents a Route 53 public hosted zone
 */
export interface IPublicHostedZone extends IHostedZone { }

/**
 * Create a Route53 public hosted zone.
 *
 * @resource AWS::Route53::HostedZone
 */
export class PublicHostedZone extends HostedZone implements IPublicHostedZone {
  /**
   * Import a Route 53 public hosted zone defined either outside the CDK, or in a different CDK stack
   *
   * @param scope the parent Construct for this Construct
   * @param id the logical name of this Construct
   * @param publicHostedZoneId the ID of the public hosted zone to import
   */
  public static fromPublicHostedZoneId(scope: Construct, id: string, publicHostedZoneId: string): IPublicHostedZone {
    class Import extends Resource implements IPublicHostedZone {
      public readonly hostedZoneId = publicHostedZoneId;
      public get zoneName(): string { throw new Error('cannot retrieve "zoneName" from an an imported hosted zone'); }
      public get hostedZoneArn(): string {
        return makeHostedZoneArn(this, this.hostedZoneId);
      }
    }
    return new Import(scope, id);
  }

  /**
   * Role for cross account zone delegation
   */
  public readonly crossAccountZoneDelegationRole?: iam.Role;

  constructor(scope: Construct, id: string, props: PublicHostedZoneProps) {
    super(scope, id, props);

    if (props.caaAmazon) {
      new CaaAmazonRecord(this, 'CaaAmazon', {
        zone: this,
      });
    }

    if (!props.crossAccountZoneDelegationPrincipal && props.crossAccountZoneDelegationRoleName) {
      throw Error('crossAccountZoneDelegationRoleName property is not supported without crossAccountZoneDelegationPrincipal');
    }

    if (props.crossAccountZoneDelegationPrincipal) {
      this.crossAccountZoneDelegationRole = new iam.Role(this, 'CrossAccountZoneDelegationRole', {
        roleName: props.crossAccountZoneDelegationRoleName,
        assumedBy: props.crossAccountZoneDelegationPrincipal,
        inlinePolicies: {
          delegation: new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                actions: ['route53:ChangeResourceRecordSets'],
                resources: [this.hostedZoneArn],
              }),
              new iam.PolicyStatement({
                actions: ['route53:ListHostedZonesByName'],
                resources: ['*'],
              }),
            ],
          }),
        },
      });
    }
  }

  public addVpc(_vpc: ec2.IVpc) {
    throw new Error('Cannot associate public hosted zones with a VPC');
  }

  /**
   * Adds a delegation from this zone to a designated zone.
   *
   * @param delegate the zone being delegated to.
   * @param opts     options for creating the DNS record, if any.
   */
  public addDelegation(delegate: IPublicHostedZone, opts: ZoneDelegationOptions = {}): void {
    new ZoneDelegationRecord(this, `${this.zoneName} -> ${delegate.zoneName}`, {
      zone: this,
      recordName: delegate.zoneName,
      nameServers: delegate.hostedZoneNameServers!, // PublicHostedZones always have name servers!
      comment: opts.comment,
      ttl: opts.ttl,
    });
  }
}

/**
 * Options available when creating a delegation relationship from one PublicHostedZone to another.
 */
export interface ZoneDelegationOptions {
  /**
   * A comment to add on the DNS record created to incorporate the delegation.
   *
   * @default none
   */
  readonly comment?: string;

  /**
   * The TTL (Time To Live) of the DNS delegation record in DNS caches.
   *
   * @default 172800
   */
  readonly ttl?: Duration;
}

/**
 * Properties to create a Route 53 private hosted zone
 */
export interface PrivateHostedZoneProps extends CommonHostedZoneProps {
  /**
   * A VPC that you want to associate with this hosted zone.
   *
   * Private hosted zones must be associated with at least one VPC. You can
   * associated additional VPCs using `addVpc(vpc)`.
   */
  readonly vpc: ec2.IVpc;
}

/**
 * Represents a Route 53 private hosted zone
 */
export interface IPrivateHostedZone extends IHostedZone {}

/**
 * Create a Route53 private hosted zone for use in one or more VPCs.
 *
 * Note that `enableDnsHostnames` and `enableDnsSupport` must have been enabled
 * for the VPC you're configuring for private hosted zones.
 *
 * @resource AWS::Route53::HostedZone
 */
export class PrivateHostedZone extends HostedZone implements IPrivateHostedZone {
  /**
   * Import a Route 53 private hosted zone defined either outside the CDK, or in a different CDK stack
   *
   * @param scope the parent Construct for this Construct
   * @param id the logical name of this Construct
   * @param privateHostedZoneId the ID of the private hosted zone to import
   */
  public static fromPrivateHostedZoneId(scope: Construct, id: string, privateHostedZoneId: string): IPrivateHostedZone {
    class Import extends Resource implements IPrivateHostedZone {
      public readonly hostedZoneId = privateHostedZoneId;
      public get zoneName(): string { throw new Error('cannot retrieve "zoneName" from an an imported hosted zone'); }
      public get hostedZoneArn(): string {
        return makeHostedZoneArn(this, this.hostedZoneId);
      }
    }
    return new Import(scope, id);
  }

  constructor(scope: Construct, id: string, props: PrivateHostedZoneProps) {
    super(scope, id, props);

    this.addVpc(props.vpc);
  }
}
