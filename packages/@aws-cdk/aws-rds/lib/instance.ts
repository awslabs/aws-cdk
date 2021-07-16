import * as ec2 from '@aws-cdk/aws-ec2';
import * as events from '@aws-cdk/aws-events';
import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import * as logs from '@aws-cdk/aws-logs';
import * as s3 from '@aws-cdk/aws-s3';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import { ArnComponents, Duration, FeatureFlags, IResource, Lazy, RemovalPolicy, Resource, Stack, Token } from '@aws-cdk/core';
import * as cxapi from '@aws-cdk/cx-api';
import { Construct, Node } from 'constructs';
import { DatabaseSecret } from './database-secret';
import { Endpoint } from './endpoint';
import { IInstanceEngine } from './instance-engine';
import { IOptionGroup } from './option-group';
import { IParameterGroup } from './parameter-group';
import { DEFAULT_PASSWORD_EXCLUDE_CHARS, defaultDeletionProtection, engineDescription, renderCredentials, setupS3ImportExport, helperRemovalPolicy, renderUnless } from './private/util';
import { Credentials, PerformanceInsightRetention, RotationMultiUserOptions, RotationSingleUserOptions, SnapshotCredentials } from './props';
import { DatabaseProxy, DatabaseProxyOptions, ProxyTarget } from './proxy';
import { CfnDBInstance, CfnDBInstanceProps } from './rds.generated';
import { ISubnetGroup, SubnetGroup } from './subnet-group';

/**
 * A database instance
 */
export interface IDatabaseInstance extends IResource, ec2.IConnectable, secretsmanager.ISecretAttachmentTarget {
  /**
   * The instance identifier.
   */
  readonly instanceIdentifier: string;

  /**
   * The instance arn.
   */
  readonly instanceArn: string;

  /**
   * The instance endpoint address.
   *
   * @attribute EndpointAddress
   */
  readonly dbInstanceEndpointAddress: string;

  /**
   * The instance endpoint port.
   *
   * @attribute EndpointPort
   */
  readonly dbInstanceEndpointPort: string;

  /**
   * The instance endpoint.
   */
  readonly instanceEndpoint: Endpoint;

  /**
   * The engine of this database Instance.
   * May be not known for imported Instances if it wasn't provided explicitly,
   * or for read replicas.
   */
  readonly engine?: IInstanceEngine;

  /**
   * Add a new db proxy to this instance.
   */
  addProxy(id: string, options: DatabaseProxyOptions): DatabaseProxy;

  /**
   * Grant the given identity connection access to the database.
   */
  grantConnect(grantee: iam.IGrantable): iam.Grant;

  /**
   * Defines a CloudWatch event rule which triggers for instance events. Use
   * `rule.addEventPattern(pattern)` to specify a filter.
   */
  onEvent(id: string, options?: events.OnEventOptions): events.Rule;
}

/**
 * Properties that describe an existing instance
 */
export interface DatabaseInstanceAttributes {
  /**
   * The instance identifier.
   */
  readonly instanceIdentifier: string;

  /**
   * The endpoint address.
   */
  readonly instanceEndpointAddress: string;

  /**
   * The database port.
   */
  readonly port: number;

  /**
   * The security groups of the instance.
   */
  readonly securityGroups: ec2.ISecurityGroup[];

  /**
   * The engine of the existing database Instance.
   *
   * @default - the imported Instance's engine is unknown
   */
  readonly engine?: IInstanceEngine;
}

/**
 * A new or imported database instance.
 */
export abstract class DatabaseInstanceBase extends Resource implements IDatabaseInstance {
  /**
   * Import an existing database instance.
   */
  public static fromDatabaseInstanceAttributes(scope: Construct, id: string, attrs: DatabaseInstanceAttributes): IDatabaseInstance {
    class Import extends DatabaseInstanceBase implements IDatabaseInstance {
      public readonly defaultPort = ec2.Port.tcp(attrs.port);
      public readonly connections = new ec2.Connections({
        securityGroups: attrs.securityGroups,
        defaultPort: this.defaultPort,
      });
      public readonly instanceIdentifier = attrs.instanceIdentifier;
      public readonly dbInstanceEndpointAddress = attrs.instanceEndpointAddress;
      public readonly dbInstanceEndpointPort = attrs.port.toString();
      public readonly instanceEndpoint = new Endpoint(attrs.instanceEndpointAddress, attrs.port);
      public readonly engine = attrs.engine;
      protected enableIamAuthentication = true;
    }

    return new Import(scope, id);
  }

  public abstract readonly instanceIdentifier: string;
  public abstract readonly dbInstanceEndpointAddress: string;
  public abstract readonly dbInstanceEndpointPort: string;
  public abstract readonly instanceEndpoint: Endpoint;
  // only required because of JSII bug: https://github.com/aws/jsii/issues/2040
  public abstract readonly engine?: IInstanceEngine;
  protected abstract enableIamAuthentication?: boolean;

  /**
   * Access to network connections.
   */
  public abstract readonly connections: ec2.Connections;

  /**
   * Add a new db proxy to this instance.
   */
  public addProxy(id: string, options: DatabaseProxyOptions): DatabaseProxy {
    return new DatabaseProxy(this, id, {
      proxyTarget: ProxyTarget.fromInstance(this),
      ...options,
    });
  }

  public grantConnect(grantee: iam.IGrantable): iam.Grant {
    if (this.enableIamAuthentication === false) {
      throw new Error('Cannot grant connect when IAM authentication is disabled');
    }

    this.enableIamAuthentication = true;
    return iam.Grant.addToPrincipal({
      grantee,
      actions: ['rds-db:connect'],
      resourceArns: [this.instanceArn],
    });
  }

  /**
   * Defines a CloudWatch event rule which triggers for instance events. Use
   * `rule.addEventPattern(pattern)` to specify a filter.
   */
  public onEvent(id: string, options: events.OnEventOptions = {}) {
    const rule = new events.Rule(this, id, options);
    rule.addEventPattern({
      source: ['aws.rds'],
      resources: [this.instanceArn],
    });
    rule.addTarget(options.target);
    return rule;
  }

  /**
   * The instance arn.
   */
  public get instanceArn(): string {
    const commonAnComponents: ArnComponents = {
      service: 'rds',
      resource: 'db',
      sep: ':',
    };
    const localArn = Stack.of(this).formatArn({
      ...commonAnComponents,
      resourceName: this.instanceIdentifier,
    });
    return this.getResourceArnAttribute(localArn, {
      ...commonAnComponents,
      resourceName: this.physicalName,
    });
  }

  /**
   * Renders the secret attachment target specifications.
   */
  public asSecretAttachmentTarget(): secretsmanager.SecretAttachmentTargetProps {
    return {
      targetId: this.instanceIdentifier,
      targetType: secretsmanager.AttachmentTargetType.RDS_DB_INSTANCE,
    };
  }
}

/**
 * The license model.
 */
export enum LicenseModel {
  /**
   * License included.
   */
  LICENSE_INCLUDED = 'license-included',

  /**
   * Bring your own licencse.
   */
  BRING_YOUR_OWN_LICENSE = 'bring-your-own-license',

  /**
   * General public license.
   */
  GENERAL_PUBLIC_LICENSE = 'general-public-license'
}

/**
 * The processor features.
 */
export interface ProcessorFeatures {
  /**
   * The number of CPU core.
   *
   * @default - the default number of CPU cores for the chosen instance class.
   */
  readonly coreCount?: number;

  /**
   * The number of threads per core.
   *
   * @default - the default number of threads per core for the chosen instance class.
   */
  readonly threadsPerCore?: number;
}

/**
 * The type of storage.
 */
export enum StorageType {
  /**
   * Standard.
   */
  STANDARD = 'standard',

  /**
   * General purpose (SSD).
   */
  GP2 = 'gp2',

  /**
   * Provisioned IOPS (SSD).
   */
  IO1 = 'io1'
}

/**
 * Construction properties for a DatabaseInstanceNew
 */
export interface DatabaseInstanceNewProps {
  /**
   * Specifies if the database instance is a multiple Availability Zone deployment.
   *
   * @default false
   */
  readonly multiAz?: boolean;

  /**
   * The name of the Availability Zone where the DB instance will be located.
   *
   * @default - no preference
   */
  readonly availabilityZone?: string;

  /**
   * The storage type. Storage types supported are gp2, io1, standard.
   *
   * @see https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Storage.html#Concepts.Storage.GeneralSSD
   *
   * @default GP2
   */
  readonly storageType?: StorageType;

  /**
   * The number of I/O operations per second (IOPS) that the database provisions.
   * The value must be equal to or greater than 1000.
   *
   * @default - no provisioned iops
   */
  readonly iops?: number;

  /**
   * The number of CPU cores and the number of threads per core.
   *
   * @default - the default number of CPU cores and threads per core for the
   * chosen instance class.
   *
   * See https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.DBInstanceClass.html#USER_ConfigureProcessor
   */
  readonly processorFeatures?: ProcessorFeatures;

  /**
   * A name for the DB instance. If you specify a name, AWS CloudFormation
   * converts it to lowercase.
   *
   * @default - a CloudFormation generated name
   */
  readonly instanceIdentifier?: string;

  /**
   * The VPC network where the DB subnet group should be created.
   */
  readonly vpc: ec2.IVpc;

  /**
   * The type of subnets to add to the created DB subnet group.
   *
   * @deprecated use `vpcSubnets`
   * @default - private subnets
   */
  readonly vpcPlacement?: ec2.SubnetSelection;

  /**
   * The type of subnets to add to the created DB subnet group.
   *
   * @default - private subnets
   */
  readonly vpcSubnets?: ec2.SubnetSelection;

  /**
   * The security groups to assign to the DB instance.
   *
   * @default - a new security group is created
   */
  readonly securityGroups?: ec2.ISecurityGroup[];

  /**
   * The port for the instance.
   *
   * @default - the default port for the chosen engine.
   */
  readonly port?: number;

  /**
   * The option group to associate with the instance.
   *
   * @default - no option group
   */
  readonly optionGroup?: IOptionGroup;

  /**
   * Whether to enable mapping of AWS Identity and Access Management (IAM) accounts
   * to database accounts.
   *
   * @default false
   */
  readonly iamAuthentication?: boolean;

  /**
   * The number of days during which automatic DB snapshots are retained.
   * Set to zero to disable backups.
   * When creating a read replica, you must enable automatic backups on the source
   * database instance by setting the backup retention to a value other than zero.
   *
   * @default Duration.days(1)
   */
  readonly backupRetention?: Duration;

  /**
   * The daily time range during which automated backups are performed.
   *
   * Constraints:
   * - Must be in the format `hh24:mi-hh24:mi`.
   * - Must be in Universal Coordinated Time (UTC).
   * - Must not conflict with the preferred maintenance window.
   * - Must be at least 30 minutes.
   *
   * @default - a 30-minute window selected at random from an 8-hour block of
   * time for each AWS Region. To see the time blocks available, see
   * https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html#USER_WorkingWithAutomatedBackups.BackupWindow
   */
  readonly preferredBackupWindow?: string;

  /**
   * Indicates whether to copy all of the user-defined tags from the
   * DB instance to snapshots of the DB instance.
   *
   * @default true
   */
  readonly copyTagsToSnapshot?: boolean;

  /**
   * Indicates whether automated backups should be deleted or retained when
   * you delete a DB instance.
   *
   * @default false
   */
  readonly deleteAutomatedBackups?: boolean;

  /**
   * The interval, in seconds, between points when Amazon RDS collects enhanced
   * monitoring metrics for the DB instance.
   *
   * @default - no enhanced monitoring
   */
  readonly monitoringInterval?: Duration;

  /**
   * Role that will be used to manage DB instance monitoring.
   *
   * @default - A role is automatically created for you
   */
  readonly monitoringRole?: iam.IRole;

  /**
   * Whether to enable Performance Insights for the DB instance.
   *
   * @default - false, unless ``performanceInsightRentention`` or ``performanceInsightEncryptionKey`` is set.
   */
  readonly enablePerformanceInsights?: boolean;

  /**
   * The amount of time, in days, to retain Performance Insights data.
   *
   * @default 7
   */
  readonly performanceInsightRetention?: PerformanceInsightRetention;

  /**
   * The AWS KMS key for encryption of Performance Insights data.
   *
   * @default - default master key
   */
  readonly performanceInsightEncryptionKey?: kms.IKey;

  /**
   * The list of log types that need to be enabled for exporting to
   * CloudWatch Logs.
   *
   * @default - no log exports
   */
  readonly cloudwatchLogsExports?: string[];

  /**
   * The number of days log events are kept in CloudWatch Logs. When updating
   * this property, unsetting it doesn't remove the log retention policy. To
   * remove the retention policy, set the value to `Infinity`.
   *
   * @default - logs never expire
   */
  readonly cloudwatchLogsRetention?: logs.RetentionDays;

  /**
   * The IAM role for the Lambda function associated with the custom resource
   * that sets the retention policy.
   *
   * @default - a new role is created.
   */
  readonly cloudwatchLogsRetentionRole?: iam.IRole;

  /**
   * Indicates that minor engine upgrades are applied automatically to the
   * DB instance during the maintenance window.
   *
   * @default true
   */
  readonly autoMinorVersionUpgrade?: boolean;

  /**
   * The weekly time range (in UTC) during which system maintenance can occur.
   *
   * Format: `ddd:hh24:mi-ddd:hh24:mi`
   * Constraint: Minimum 30-minute window
   *
   * @default - a 30-minute window selected at random from an 8-hour block of
   * time for each AWS Region, occurring on a random day of the week. To see
   * the time blocks available, see https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_UpgradeDBInstance.Maintenance.html#Concepts.DBMaintenance
   */
  readonly preferredMaintenanceWindow?: string;

  /**
   * Indicates whether the DB instance should have deletion protection enabled.
   *
   * @default - true if ``removalPolicy`` is RETAIN, false otherwise
   */
  readonly deletionProtection?: boolean;

  /**
   * The CloudFormation policy to apply when the instance is removed from the
   * stack or replaced during an update.
   *
   * @default - RemovalPolicy.SNAPSHOT (remove the resource, but retain a snapshot of the data)
   */
  readonly removalPolicy?: RemovalPolicy;

  /**
   * Upper limit to which RDS can scale the storage in GiB(Gibibyte).
   * @see https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIOPS.StorageTypes.html#USER_PIOPS.Autoscaling
   * @default - No autoscaling of RDS instance
   */
  readonly maxAllocatedStorage?: number;

  /**
   * The Active Directory directory ID to create the DB instance in.
   *
   * @default - Do not join domain
   */
  readonly domain?: string;

  /**
   * The IAM role to be used when making API calls to the Directory Service. The role needs the AWS-managed policy
   * AmazonRDSDirectoryServiceAccess or equivalent.
   *
   * @default - The role will be created for you if {@link DatabaseInstanceNewProps#domain} is specified
   */
  readonly domainRole?: iam.IRole;

  /**
   * Existing subnet group for the instance.
   *
   * @default - a new subnet group will be created.
   */
  readonly subnetGroup?: ISubnetGroup;

  /**
   * Role that will be associated with this DB instance to enable S3 import.
   * This feature is only supported by the Microsoft SQL Server, Oracle, and PostgreSQL engines.
   *
   * This property must not be used if `s3ImportBuckets` is used.
   *
   * For Microsoft SQL Server:
   * @see https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/SQLServer.Procedural.Importing.html
   * For Oracle:
   * @see https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/oracle-s3-integration.html
   * For PostgreSQL:
   * @see https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Procedural.Importing.html
   *
   * @default - New role is created if `s3ImportBuckets` is set, no role is defined otherwise
   */
  readonly s3ImportRole?: iam.IRole;

  /**
   * S3 buckets that you want to load data from.
   * This feature is only supported by the Microsoft SQL Server, Oracle, and PostgreSQL engines.
   *
   * This property must not be used if `s3ImportRole` is used.
   *
   * For Microsoft SQL Server:
   * @see https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/SQLServer.Procedural.Importing.html
   * For Oracle:
   * @see https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/oracle-s3-integration.html
   * For PostgreSQL:
   * @see https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Procedural.Importing.html
   *
   * @default - None
   */
  readonly s3ImportBuckets?: s3.IBucket[];

  /**
   * Role that will be associated with this DB instance to enable S3 export.
   * This feature is only supported by the Microsoft SQL Server and Oracle engines.
   *
   * This property must not be used if `s3ExportBuckets` is used.
   *
   * For Microsoft SQL Server:
   * @see https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/SQLServer.Procedural.Importing.html
   * For Oracle:
   * @see https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/oracle-s3-integration.html
   *
   * @default - New role is created if `s3ExportBuckets` is set, no role is defined otherwise
   */
  readonly s3ExportRole?: iam.IRole;

  /**
   * S3 buckets that you want to load data into.
   * This feature is only supported by the Microsoft SQL Server and Oracle engines.
   *
   * This property must not be used if `s3ExportRole` is used.
   *
   * For Microsoft SQL Server:
   * @see https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/SQLServer.Procedural.Importing.html
   * For Oracle:
   * @see https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/oracle-s3-integration.html
   *
   * @default - None
   */
  readonly s3ExportBuckets?: s3.IBucket[];

  /**
   * Indicates whether the DB instance is an internet-facing instance.
   *
   * @default - `true` if `vpcSubnets` is `subnetType: SubnetType.PUBLIC`, `false` otherwise
   */
  readonly publiclyAccessible?: boolean;
}

/**
 * A new database instance.
 */
abstract class DatabaseInstanceNew extends DatabaseInstanceBase implements IDatabaseInstance {
  /**
   * The VPC where this database instance is deployed.
   */
  public readonly vpc: ec2.IVpc;

  public readonly connections: ec2.Connections;

  protected abstract readonly instanceType: ec2.InstanceType;

  protected readonly vpcPlacement?: ec2.SubnetSelection;
  protected readonly newCfnProps: CfnDBInstanceProps;

  private readonly cloudwatchLogsExports?: string[];
  private readonly cloudwatchLogsRetention?: logs.RetentionDays;
  private readonly cloudwatchLogsRetentionRole?: iam.IRole;

  private readonly domainId?: string;
  private readonly domainRole?: iam.IRole;

  protected enableIamAuthentication?: boolean;

  constructor(scope: Construct, id: string, props: DatabaseInstanceNewProps) {
    // RDS always lower-cases the ID of the database, so use that for the physical name
    // (which is the name used for cross-environment access, so it needs to be correct,
    // regardless of the feature flag that changes it in the template for the L1)
    const instancePhysicalName = Token.isUnresolved(props.instanceIdentifier)
      ? props.instanceIdentifier
      : props.instanceIdentifier?.toLowerCase();
    super(scope, id, {
      physicalName: instancePhysicalName,
    });

    this.vpc = props.vpc;
    if (props.vpcSubnets && props.vpcPlacement) {
      throw new Error('Only one of `vpcSubnets` or `vpcPlacement` can be specified');
    }
    this.vpcPlacement = props.vpcSubnets ?? props.vpcPlacement;

    if (props.multiAz === true && props.availabilityZone) {
      throw new Error('Requesting a specific availability zone is not valid for Multi-AZ instances');
    }

    const subnetGroup = props.subnetGroup ?? new SubnetGroup(this, 'SubnetGroup', {
      description: `Subnet group for ${this.node.id} database`,
      vpc: this.vpc,
      vpcSubnets: this.vpcPlacement,
      removalPolicy: renderUnless(helperRemovalPolicy(props.removalPolicy), RemovalPolicy.DESTROY),
    });

    const securityGroups = props.securityGroups || [new ec2.SecurityGroup(this, 'SecurityGroup', {
      description: `Security group for ${this.node.id} database`,
      vpc: props.vpc,
    })];

    this.connections = new ec2.Connections({
      securityGroups,
      defaultPort: ec2.Port.tcp(Lazy.number({ produce: () => this.instanceEndpoint.port })),
    });

    let monitoringRole;
    if (props.monitoringInterval && props.monitoringInterval.toSeconds()) {
      monitoringRole = props.monitoringRole || new iam.Role(this, 'MonitoringRole', {
        assumedBy: new iam.ServicePrincipal('monitoring.rds.amazonaws.com'),
        managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonRDSEnhancedMonitoringRole')],
      });
    }

    const storageType = props.storageType || StorageType.GP2;
    const iops = storageType === StorageType.IO1 ? (props.iops || 1000) : undefined;

    this.cloudwatchLogsExports = props.cloudwatchLogsExports;
    this.cloudwatchLogsRetention = props.cloudwatchLogsRetention;
    this.cloudwatchLogsRetentionRole = props.cloudwatchLogsRetentionRole;
    this.enableIamAuthentication = props.iamAuthentication;

    const enablePerformanceInsights = props.enablePerformanceInsights
      || props.performanceInsightRetention !== undefined || props.performanceInsightEncryptionKey !== undefined;
    if (enablePerformanceInsights && props.enablePerformanceInsights === false) {
      throw new Error('`enablePerformanceInsights` disabled, but `performanceInsightRetention` or `performanceInsightEncryptionKey` was set');
    }

    if (props.domain) {
      this.domainId = props.domain;
      this.domainRole = props.domainRole || new iam.Role(this, 'RDSDirectoryServiceRole', {
        assumedBy: new iam.ServicePrincipal('rds.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonRDSDirectoryServiceAccess'),
        ],
      });
    }

    const maybeLowercasedInstanceId = FeatureFlags.of(this).isEnabled(cxapi.RDS_LOWERCASE_DB_IDENTIFIER)
      ? props.instanceIdentifier?.toLowerCase()
      : props.instanceIdentifier;

    this.newCfnProps = {
      autoMinorVersionUpgrade: props.autoMinorVersionUpgrade,
      availabilityZone: props.multiAz ? undefined : props.availabilityZone,
      backupRetentionPeriod: props.backupRetention?.toDays(),
      copyTagsToSnapshot: props.copyTagsToSnapshot ?? true,
      dbInstanceClass: Lazy.string({ produce: () => `db.${this.instanceType}` }),
      dbInstanceIdentifier: Token.isUnresolved(props.instanceIdentifier)
        // if the passed identifier is a Token,
        // we need to use the physicalName of the database
        // (we cannot change its case anyway),
        // as it might be used in a cross-environment fashion
        ? this.physicalName
        : maybeLowercasedInstanceId,
      dbSubnetGroupName: subnetGroup.subnetGroupName,
      deleteAutomatedBackups: props.deleteAutomatedBackups,
      deletionProtection: defaultDeletionProtection(props.deletionProtection, props.removalPolicy),
      enableCloudwatchLogsExports: this.cloudwatchLogsExports,
      enableIamDatabaseAuthentication: Lazy.any({ produce: () => this.enableIamAuthentication }),
      enablePerformanceInsights: enablePerformanceInsights || props.enablePerformanceInsights, // fall back to undefined if not set,
      iops,
      monitoringInterval: props.monitoringInterval?.toSeconds(),
      monitoringRoleArn: monitoringRole?.roleArn,
      multiAz: props.multiAz,
      optionGroupName: props.optionGroup?.optionGroupName,
      performanceInsightsKmsKeyId: props.performanceInsightEncryptionKey?.keyArn,
      performanceInsightsRetentionPeriod: enablePerformanceInsights
        ? (props.performanceInsightRetention || PerformanceInsightRetention.DEFAULT)
        : undefined,
      port: props.port?.toString(),
      preferredBackupWindow: props.preferredBackupWindow,
      preferredMaintenanceWindow: props.preferredMaintenanceWindow,
      processorFeatures: props.processorFeatures && renderProcessorFeatures(props.processorFeatures),
      publiclyAccessible: props.publiclyAccessible ?? (this.vpcPlacement && this.vpcPlacement.subnetType === ec2.SubnetType.PUBLIC),
      storageType,
      vpcSecurityGroups: securityGroups.map(s => s.securityGroupId),
      maxAllocatedStorage: props.maxAllocatedStorage,
      domain: this.domainId,
      domainIamRoleName: this.domainRole?.roleName,
    };
  }

  protected setLogRetention() {
    if (this.cloudwatchLogsExports && this.cloudwatchLogsRetention) {
      for (const log of this.cloudwatchLogsExports) {
        new logs.LogRetention(this, `LogRetention${log}`, {
          logGroupName: `/aws/rds/instance/${this.instanceIdentifier}/${log}`,
          retention: this.cloudwatchLogsRetention,
          role: this.cloudwatchLogsRetentionRole,
        });
      }
    }
  }
}

/**
 * Construction properties for a DatabaseInstanceSource
 */
export interface DatabaseInstanceSourceProps extends DatabaseInstanceNewProps {
  /**
   * The database engine.
   */
  readonly engine: IInstanceEngine;

  /**
   * The name of the compute and memory capacity for the instance.
   *
   * @default - m5.large (or, more specifically, db.m5.large)
   */
  readonly instanceType?: ec2.InstanceType;

  /**
   * The license model.
   *
   * @default - RDS default license model
   */
  readonly licenseModel?: LicenseModel;

  /**
   * Whether to allow major version upgrades.
   *
   * @default false
   */
  readonly allowMajorVersionUpgrade?: boolean;

  /**
   * The time zone of the instance. This is currently supported only by Microsoft Sql Server.
   *
   * @default - RDS default timezone
   */
  readonly timezone?: string;

  /**
   * The allocated storage size, specified in gigabytes (GB).
   *
   * @default 100
   */
  readonly allocatedStorage?: number;

  /**
   * The name of the database.
   *
   * @default - no name
   */
  readonly databaseName?: string;

  /**
   * The DB parameter group to associate with the instance.
   *
   * @default - no parameter group
   */
  readonly parameterGroup?: IParameterGroup;
}

/**
 * A new source database instance (not a read replica)
 */
abstract class DatabaseInstanceSource extends DatabaseInstanceNew implements IDatabaseInstance {
  public readonly engine?: IInstanceEngine;
  /**
   * The AWS Secrets Manager secret attached to the instance.
   */
  public abstract readonly secret?: secretsmanager.ISecret;

  protected readonly sourceCfnProps: CfnDBInstanceProps;
  protected readonly instanceType: ec2.InstanceType;

  private readonly singleUserRotationApplication: secretsmanager.SecretRotationApplication;
  private readonly multiUserRotationApplication: secretsmanager.SecretRotationApplication;

  constructor(scope: Construct, id: string, props: DatabaseInstanceSourceProps) {
    super(scope, id, props);

    this.singleUserRotationApplication = props.engine.singleUserRotationApplication;
    this.multiUserRotationApplication = props.engine.multiUserRotationApplication;
    this.engine = props.engine;

    let { s3ImportRole, s3ExportRole } = setupS3ImportExport(this, props, true);
    const engineConfig = props.engine.bindToInstance(this, {
      ...props,
      s3ImportRole,
      s3ExportRole,
    });

    const instanceAssociatedRoles: CfnDBInstance.DBInstanceRoleProperty[] = [];
    const engineFeatures = engineConfig.features;
    if (s3ImportRole) {
      if (!engineFeatures?.s3Import) {
        throw new Error(`Engine '${engineDescription(props.engine)}' does not support S3 import`);
      }
      instanceAssociatedRoles.push({ roleArn: s3ImportRole.roleArn, featureName: engineFeatures?.s3Import });
    }
    if (s3ExportRole) {
      if (!engineFeatures?.s3Export) {
        throw new Error(`Engine '${engineDescription(props.engine)}' does not support S3 export`);
      }
      // Only add the export role and feature if they are different from the import role & feature.
      if (s3ImportRole !== s3ExportRole || engineFeatures.s3Import !== engineFeatures?.s3Export) {
        instanceAssociatedRoles.push({ roleArn: s3ExportRole.roleArn, featureName: engineFeatures?.s3Export });
      }
    }

    this.instanceType = props.instanceType ?? ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.LARGE);

    const instanceParameterGroupConfig = props.parameterGroup?.bindToInstance({});
    this.sourceCfnProps = {
      ...this.newCfnProps,
      associatedRoles: instanceAssociatedRoles.length > 0 ? instanceAssociatedRoles : undefined,
      optionGroupName: engineConfig.optionGroup?.optionGroupName,
      allocatedStorage: props.allocatedStorage?.toString() ?? '100',
      allowMajorVersionUpgrade: props.allowMajorVersionUpgrade,
      dbName: props.databaseName,
      dbParameterGroupName: instanceParameterGroupConfig?.parameterGroupName,
      engine: props.engine.engineType,
      engineVersion: props.engine.engineVersion?.fullVersion,
      licenseModel: props.licenseModel,
      timezone: props.timezone,
    };
  }

  /**
   * Adds the single user rotation of the master password to this instance.
   *
   * @param options the options for the rotation,
   *                if you want to override the defaults
   */
  public addRotationSingleUser(options: RotationSingleUserOptions = {}): secretsmanager.SecretRotation {
    return !options.secret || options.secret === this.secret
      ? this.addSingleUserRotationForMasterSecret(options)
      : this.addSingleUserRotationForSecret(options.secret as unknown as Construct, 'RotationSingleUser', options.secret, options);
  }

  /**
   * Adds the multi user rotation to this instance.
   */
  public addRotationMultiUser(id: string, options: RotationMultiUserOptions): secretsmanager.SecretRotation {
    if (!this.secret) {
      throw new Error('Cannot add multi user rotation for an instance without secret.');
    }
    return new secretsmanager.SecretRotation(this, id, {
      ...options,
      excludeCharacters: options.excludeCharacters ?? DEFAULT_PASSWORD_EXCLUDE_CHARS,
      masterSecret: this.secret,
      application: this.multiUserRotationApplication,
      vpc: this.vpc,
      vpcSubnets: this.vpcPlacement,
      target: this,
    });
  }

  private addSingleUserRotationForMasterSecret(options: RotationSingleUserOptions): secretsmanager.SecretRotation {
    if (!this.secret) {
      throw new Error('Cannot add single user rotation for an instance without master secret.');
    }

    return this.addSingleUserRotationForSecret(this, 'RotationSingleUser', this.secret, options);
  }

  private addSingleUserRotationForSecret(
    scope: Construct, id: string, secret: secretsmanager.ISecret, options: RotationSingleUserOptions,
  ): secretsmanager.SecretRotation {
    if (Node.of(scope).tryFindChild(id)) {
      const secretDescription = this === scope ? 'master secret' : `secret '${Node.of(secret).path}'`;
      throw new Error(`Single user rotation was already enabled for the ${secretDescription} of this instance.`);
    }

    return new secretsmanager.SecretRotation(scope, id, {
      application: this.singleUserRotationApplication,
      vpc: this.vpc,
      vpcSubnets: this.vpcPlacement,
      target: this,
      ...options,
      secret: secret,
      excludeCharacters: options.excludeCharacters ?? DEFAULT_PASSWORD_EXCLUDE_CHARS,
    });
  }
}

/**
 * Construction properties for a DatabaseInstance.
 */
export interface DatabaseInstanceProps extends DatabaseInstanceSourceProps {
  /**
   * Credentials for the administrative user
   *
   * @default - A username of 'admin' (or 'postgres' for PostgreSQL) and SecretsManager-generated password
   */
  readonly credentials?: Credentials;

  /**
   * For supported engines, specifies the character set to associate with the
   * DB instance.
   *
   * @default - RDS default character set name
   */
  readonly characterSetName?: string;

  /**
   * Indicates whether the DB instance is encrypted.
   *
   * @default - true if storageEncryptionKey has been provided, false otherwise
   */
  readonly storageEncrypted?: boolean;

  /**
   * The KMS key that's used to encrypt the DB instance.
   *
   * @default - default master key if storageEncrypted is true, no key otherwise
   */
  readonly storageEncryptionKey?: kms.IKey;
}

/**
 * A database instance
 *
 * @resource AWS::RDS::DBInstance
 */
export class DatabaseInstance extends DatabaseInstanceSource implements IDatabaseInstance {
  public readonly instanceIdentifier: string;
  public readonly dbInstanceEndpointAddress: string;
  public readonly dbInstanceEndpointPort: string;
  public readonly instanceEndpoint: Endpoint;
  public readonly secret?: secretsmanager.ISecret;

  constructor(scope: Construct, id: string, props: DatabaseInstanceProps) {
    super(scope, id, props);

    const credentials = renderCredentials(this, props.engine, props.credentials);
    const secret = credentials.secret;

    const instance = new CfnDBInstance(this, 'Resource', {
      ...this.sourceCfnProps,
      characterSetName: props.characterSetName,
      kmsKeyId: props.storageEncryptionKey && props.storageEncryptionKey.keyArn,
      masterUsername: credentials.username,
      masterUserPassword: credentials.password?.toString(),
      storageEncrypted: props.storageEncryptionKey ? true : props.storageEncrypted,
    });

    this.instanceIdentifier = this.getResourceNameAttribute(instance.ref);
    this.dbInstanceEndpointAddress = instance.attrEndpointAddress;
    this.dbInstanceEndpointPort = instance.attrEndpointPort;

    // create a number token that represents the port of the instance
    const portAttribute = Token.asNumber(instance.attrEndpointPort);
    this.instanceEndpoint = new Endpoint(instance.attrEndpointAddress, portAttribute);

    instance.applyRemovalPolicy(props.removalPolicy ?? RemovalPolicy.SNAPSHOT);

    if (secret) {
      this.secret = secret.attach(this);
    }

    this.setLogRetention();
  }
}

/**
 * Construction properties for a DatabaseInstanceFromSnapshot.
 */
export interface DatabaseInstanceFromSnapshotProps extends DatabaseInstanceSourceProps {
  /**
   * The name or Amazon Resource Name (ARN) of the DB snapshot that's used to
   * restore the DB instance. If you're restoring from a shared manual DB
   * snapshot, you must specify the ARN of the snapshot.
   */
  readonly snapshotIdentifier: string;

  /**
   * Master user credentials.
   *
   * Note - It is not possible to change the master username for a snapshot;
   * however, it is possible to provide (or generate) a new password.
   *
   * @default - The existing username and password from the snapshot will be used.
   */
  readonly credentials?: SnapshotCredentials;
}

/**
 * A database instance restored from a snapshot.
 *
 * @resource AWS::RDS::DBInstance
 */
export class DatabaseInstanceFromSnapshot extends DatabaseInstanceSource implements IDatabaseInstance {
  public readonly instanceIdentifier: string;
  public readonly dbInstanceEndpointAddress: string;
  public readonly dbInstanceEndpointPort: string;
  public readonly instanceEndpoint: Endpoint;
  public readonly secret?: secretsmanager.ISecret;

  constructor(scope: Construct, id: string, props: DatabaseInstanceFromSnapshotProps) {
    super(scope, id, props);

    let credentials = props.credentials;
    let secret = credentials?.secret;
    if (!secret && credentials?.generatePassword) {
      if (!credentials.username) {
        throw new Error('`credentials` `username` must be specified when `generatePassword` is set to true');
      }

      secret = new DatabaseSecret(this, 'Secret', {
        username: credentials.username,
        encryptionKey: credentials.encryptionKey,
        excludeCharacters: credentials.excludeCharacters,
        replaceOnPasswordCriteriaChanges: credentials.replaceOnPasswordCriteriaChanges,
      });
    }

    const instance = new CfnDBInstance(this, 'Resource', {
      ...this.sourceCfnProps,
      dbSnapshotIdentifier: props.snapshotIdentifier,
      masterUserPassword: secret?.secretValueFromJson('password')?.toString() ?? credentials?.password?.toString(),
    });

    this.instanceIdentifier = instance.ref;
    this.dbInstanceEndpointAddress = instance.attrEndpointAddress;
    this.dbInstanceEndpointPort = instance.attrEndpointPort;

    // create a number token that represents the port of the instance
    const portAttribute = Token.asNumber(instance.attrEndpointPort);
    this.instanceEndpoint = new Endpoint(instance.attrEndpointAddress, portAttribute);

    instance.applyRemovalPolicy(props.removalPolicy ?? RemovalPolicy.SNAPSHOT);

    if (secret) {
      this.secret = secret.attach(this);
    }

    this.setLogRetention();
  }
}

/**
 * Construction properties for a DatabaseInstanceReadReplica.
 */
export interface DatabaseInstanceReadReplicaProps extends DatabaseInstanceNewProps {
  /**
   * The name of the compute and memory capacity classes.
   */
  readonly instanceType: ec2.InstanceType;

  /**
   * The source database instance.
   *
   * Each DB instance can have a limited number of read replicas. For more
   * information, see https://docs.aws.amazon.com/AmazonRDS/latest/DeveloperGuide/USER_ReadRepl.html.
   *
   */
  readonly sourceDatabaseInstance: IDatabaseInstance;

  /**
   * Indicates whether the DB instance is encrypted.
   *
   * @default - true if storageEncryptionKey has been provided, false otherwise
   */
  readonly storageEncrypted?: boolean;

  /**
   * The KMS key that's used to encrypt the DB instance.
   *
   * @default - default master key if storageEncrypted is true, no key otherwise
   */
  readonly storageEncryptionKey?: kms.IKey;
}

/**
 * A read replica database instance.
 *
 * @resource AWS::RDS::DBInstance
 */
export class DatabaseInstanceReadReplica extends DatabaseInstanceNew implements IDatabaseInstance {
  public readonly instanceIdentifier: string;
  public readonly dbInstanceEndpointAddress: string;
  public readonly dbInstanceEndpointPort: string;
  public readonly instanceEndpoint: Endpoint;
  public readonly engine?: IInstanceEngine = undefined;
  protected readonly instanceType: ec2.InstanceType;

  constructor(scope: Construct, id: string, props: DatabaseInstanceReadReplicaProps) {
    super(scope, id, props);

    const instance = new CfnDBInstance(this, 'Resource', {
      ...this.newCfnProps,
      // this must be ARN, not ID, because of https://github.com/terraform-providers/terraform-provider-aws/issues/528#issuecomment-391169012
      sourceDbInstanceIdentifier: props.sourceDatabaseInstance.instanceArn,
      kmsKeyId: props.storageEncryptionKey?.keyArn,
      storageEncrypted: props.storageEncryptionKey ? true : props.storageEncrypted,
    });

    this.instanceType = props.instanceType;
    this.instanceIdentifier = instance.ref;
    this.dbInstanceEndpointAddress = instance.attrEndpointAddress;
    this.dbInstanceEndpointPort = instance.attrEndpointPort;

    // create a number token that represents the port of the instance
    const portAttribute = Token.asNumber(instance.attrEndpointPort);
    this.instanceEndpoint = new Endpoint(instance.attrEndpointAddress, portAttribute);

    instance.applyRemovalPolicy(props.removalPolicy ?? RemovalPolicy.SNAPSHOT);

    this.setLogRetention();
  }
}

/**
 * Renders the processor features specifications
 *
 * @param features the processor features
 */
function renderProcessorFeatures(features: ProcessorFeatures): CfnDBInstance.ProcessorFeatureProperty[] | undefined {
  const featuresList = Object.entries(features).map(([name, value]) => ({ name, value: value.toString() }));

  return featuresList.length === 0 ? undefined : featuresList;
}
