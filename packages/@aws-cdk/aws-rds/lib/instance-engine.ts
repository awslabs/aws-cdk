import * as iam from '@aws-cdk/aws-iam';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import { Construct } from 'constructs';
import { IEngine } from './engine';
import { EngineVersion } from './engine-version';
import { IOptionGroup, OptionGroup } from './option-group';

/**
 * The options passed to {@link IInstanceEngine.bind}.
 */
export interface InstanceEngineBindOptions {
  /**
   * The Active Directory directory ID to create the DB instance in.
   *
   * @default - none (it's an optional field)
   */
  readonly domain?: string;

  /**
   * The timezone of the database, set by the customer.
   *
   * @default - none (it's an optional field)
   */
  readonly timezone?: string;

  /**
   * The role used for S3 importing.
   *
   * @default - none
   */
  readonly s3ImportRole?: iam.IRole;

  /**
   * The role used for S3 exporting.
   *
   * @default - none
   */
  readonly s3ExportRole?: iam.IRole;

  /**
   * The option group of the database
   *
   * @default - none
   */
  readonly optionGroup?: IOptionGroup;
}

/**
 * The type returned from the {@link IInstanceEngine.bind} method.
 */
export interface InstanceEngineConfig {
  /**
   * Features supported by the database engine.
   *
   * @see https://docs.aws.amazon.com/AmazonRDS/latest/APIReference/API_DBEngineVersion.html
   *
   * @default - no features
   */
  readonly features?: InstanceEngineFeatures;

  /**
   * Option group of the database.
   *
   * @default - none
   */
  readonly optionGroup?: IOptionGroup;
}

/**
 * Represents Database Engine features
 */
export interface InstanceEngineFeatures {
  /**
   * Feature name for the DB instance that the IAM role to access the S3 bucket for import
   * is to be associated with.
   *
   * @default - no s3Import feature name
   */
  readonly s3Import?: string;

  /**
   * Feature name for the DB instance that the IAM role to export to S3 bucket is to be
   * associated with.
   *
   * @default - no s3Export feature name
   */
  readonly s3Export?: string;
}

/**
 * Interface representing a database instance (as opposed to cluster) engine.
 */
export interface IInstanceEngine extends IEngine {
  /** The application used by this engine to perform rotation for a single-user scenario. */
  readonly singleUserRotationApplication: secretsmanager.SecretRotationApplication;

  /** The application used by this engine to perform rotation for a multi-user scenario. */
  readonly multiUserRotationApplication: secretsmanager.SecretRotationApplication;

  /**
   * Method called when the engine is used to create a new instance.
   */
  bindToInstance(scope: Construct, options: InstanceEngineBindOptions): InstanceEngineConfig;
}

interface InstanceEngineBaseProps {
  readonly engineType: string;
  readonly singleUserRotationApplication: secretsmanager.SecretRotationApplication;
  readonly multiUserRotationApplication: secretsmanager.SecretRotationApplication;
  readonly version?: EngineVersion;
  readonly parameterGroupFamily?: string;
  readonly engineFamily?: string;
  readonly features?: InstanceEngineFeatures;
}

abstract class InstanceEngineBase implements IInstanceEngine {
  public readonly engineType: string;
  public readonly engineVersion?: EngineVersion;
  public readonly parameterGroupFamily?: string;
  public readonly singleUserRotationApplication: secretsmanager.SecretRotationApplication;
  public readonly multiUserRotationApplication: secretsmanager.SecretRotationApplication;
  public readonly engineFamily?: string;

  private readonly features?: InstanceEngineFeatures;

  constructor(props: InstanceEngineBaseProps) {
    this.engineType = props.engineType;
    this.features = props.features;
    this.singleUserRotationApplication = props.singleUserRotationApplication;
    this.multiUserRotationApplication = props.multiUserRotationApplication;
    this.engineVersion = props.version;
    this.parameterGroupFamily = props.parameterGroupFamily ??
      (this.engineVersion ? `${this.engineType}${this.engineVersion.majorVersion}` : undefined);
    this.engineFamily = props.engineFamily;
  }

  public bindToInstance(_scope: Construct, options: InstanceEngineBindOptions): InstanceEngineConfig {
    if (options.timezone && !this.supportsTimezone) {
      throw new Error(`timezone property can not be configured for ${this.engineType}`);
    }
    return {
      features: this.features,
      optionGroup: options.optionGroup,
    };
  }

  /** Defines whether this Instance Engine can support timezone properties. */
  protected get supportsTimezone() { return false; }
}

/**
 * The versions for the MariaDB instance engines
 * (those returned by {@link DatabaseInstanceEngine.mariaDb}).
 */
export class MariaDbEngineVersion {
  /**
   * Version "10.0" (only a major version, without a specific minor version).
   * @deprecated MariaDB 10.0 will reach end of life on May 18, 2021
  */
  public static readonly VER_10_0 = MariaDbEngineVersion.of('10.0', '10.0');
  /**
   * Version "10.0.17".
   * @deprecated MariaDB 10.0 will reach end of life on May 18, 2021
  */
  public static readonly VER_10_0_17 = MariaDbEngineVersion.of('10.0.17', '10.0');
  /**
   * Version "10.0.24".
   * @deprecated MariaDB 10.0 will reach end of life on May 18, 2021
  */
  public static readonly VER_10_0_24 = MariaDbEngineVersion.of('10.0.24', '10.0');
  /**
   * Version "10.0.28".
   * @deprecated MariaDB 10.0 will reach end of life on May 18, 2021
  */
  public static readonly VER_10_0_28 = MariaDbEngineVersion.of('10.0.28', '10.0');
  /**
   * Version "10.0.31".
   * @deprecated MariaDB 10.0 will reach end of life on May 18, 2021
  */
  public static readonly VER_10_0_31 = MariaDbEngineVersion.of('10.0.31', '10.0');
  /**
   * Version "10.0.32".
   * @deprecated MariaDB 10.0 will reach end of life on May 18, 2021
  */
  public static readonly VER_10_0_32 = MariaDbEngineVersion.of('10.0.32', '10.0');
  /**
   * Version "10.0.34".
   * @deprecated MariaDB 10.0 will reach end of life on May 18, 2021
  */
  public static readonly VER_10_0_34 = MariaDbEngineVersion.of('10.0.34', '10.0');
  /**
   * Version "10.0.35".
   * @deprecated MariaDB 10.0 will reach end of life on May 18, 2021
  */
  public static readonly VER_10_0_35 = MariaDbEngineVersion.of('10.0.35', '10.0');

  /**
   * Version "10.1" (only a major version, without a specific minor version).
   * @deprecated MariaDB 10.1 will reach end of life on May 18, 2021
  */
  public static readonly VER_10_1 = MariaDbEngineVersion.of('10.1', '10.1');
  /**
   * Version "10.1.14".
   * @deprecated MariaDB 10.1 will reach end of life on May 18, 2021
  */
  public static readonly VER_10_1_14 = MariaDbEngineVersion.of('10.1.14', '10.1');
  /**
   * Version "10.1.19".
   * @deprecated MariaDB 10.1 will reach end of life on May 18, 2021
  */
  public static readonly VER_10_1_19 = MariaDbEngineVersion.of('10.1.19', '10.1');
  /**
   * Version "10.1.23".
   * @deprecated MariaDB 10.1 will reach end of life on May 18, 2021
  */
  public static readonly VER_10_1_23 = MariaDbEngineVersion.of('10.1.23', '10.1');
  /**
   * Version "10.1.26".
   * @deprecated MariaDB 10.1 will reach end of life on May 18, 2021
  */
  public static readonly VER_10_1_26 = MariaDbEngineVersion.of('10.1.26', '10.1');
  /**
   * Version "10.1.31".
   * @deprecated MariaDB 10.1 will reach end of life on May 18, 2021
  */
  public static readonly VER_10_1_31 = MariaDbEngineVersion.of('10.1.31', '10.1');
  /**
   * Version "10.1.34".
   * @deprecated MariaDB 10.1 will reach end of life on May 18, 2021
  */
  public static readonly VER_10_1_34 = MariaDbEngineVersion.of('10.1.34', '10.1');

  /** Version "10.2" (only a major version, without a specific minor version). */
  public static readonly VER_10_2 = MariaDbEngineVersion.of('10.2', '10.2');
  /** Version "10.2.11". */
  public static readonly VER_10_2_11 = MariaDbEngineVersion.of('10.2.11', '10.2');
  /** Version "10.2.12". */
  public static readonly VER_10_2_12 = MariaDbEngineVersion.of('10.2.12', '10.2');
  /** Version "10.2.15". */
  public static readonly VER_10_2_15 = MariaDbEngineVersion.of('10.2.15', '10.2');
  /** Version "10.2.21". */
  public static readonly VER_10_2_21 = MariaDbEngineVersion.of('10.2.21', '10.2');
  /** Version "10.2.32". */
  public static readonly VER_10_2_32 = MariaDbEngineVersion.of('10.2.32', '10.2');
  /** Version "10.2.37". */
  public static readonly VER_10_2_37 = MariaDbEngineVersion.of('10.2.37', '10.2');

  /** Version "10.3" (only a major version, without a specific minor version). */
  public static readonly VER_10_3 = MariaDbEngineVersion.of('10.3', '10.3');
  /** Version "10.3.8". */
  public static readonly VER_10_3_8 = MariaDbEngineVersion.of('10.3.8', '10.3');
  /** Version "10.3.13". */
  public static readonly VER_10_3_13 = MariaDbEngineVersion.of('10.3.13', '10.3');
  /** Version "10.3.20". */
  public static readonly VER_10_3_20 = MariaDbEngineVersion.of('10.3.20', '10.3');
  /** Version "10.3.23". */
  public static readonly VER_10_3_23 = MariaDbEngineVersion.of('10.3.23', '10.3');
  /** Version "10.3.28". */
  public static readonly VER_10_3_28 = MariaDbEngineVersion.of('10.3.28', '10.3');

  /** Version "10.4" (only a major version, without a specific minor version). */
  public static readonly VER_10_4 = MariaDbEngineVersion.of('10.4', '10.4');
  /** Version "10.4.8". */
  public static readonly VER_10_4_8 = MariaDbEngineVersion.of('10.4.8', '10.4');
  /** Version "10.4.13". */
  public static readonly VER_10_4_13 = MariaDbEngineVersion.of('10.4.13', '10.4');
  /** Version "10.4.18". */
  public static readonly VER_10_4_18 = MariaDbEngineVersion.of('10.4.18', '10.4');

  /** Version "10.5" (only a major version, without a specific minor version). */
  public static readonly VER_10_5 = MariaDbEngineVersion.of('10.5', '10.5');
  /** Version "10.5.8". */
  public static readonly VER_10_5_8 = MariaDbEngineVersion.of('10.5.8', '10.5');
  /** Version "10.5.9". */
  public static readonly VER_10_5_9 = MariaDbEngineVersion.of('10.5.9', '10.5');

  /**
   * Create a new MariaDbEngineVersion with an arbitrary version.
   *
   * @param mariaDbFullVersion the full version string,
   *   for example "10.5.28"
   * @param mariaDbMajorVersion the major version of the engine,
   *   for example "10.5"
   */
  public static of(mariaDbFullVersion: string, mariaDbMajorVersion: string): MariaDbEngineVersion {
    return new MariaDbEngineVersion(mariaDbFullVersion, mariaDbMajorVersion);
  }

  /** The full version string, for example, "10.5.28". */
  public readonly mariaDbFullVersion: string;
  /** The major version of the engine, for example, "10.5". */
  public readonly mariaDbMajorVersion: string;

  private constructor(mariaDbFullVersion: string, mariaDbMajorVersion: string) {
    this.mariaDbFullVersion = mariaDbFullVersion;
    this.mariaDbMajorVersion = mariaDbMajorVersion;
  }
}

/**
 * Properties for MariaDB instance engines.
 * Used in {@link DatabaseInstanceEngine.mariaDb}.
 */
export interface MariaDbInstanceEngineProps {
  /** The exact version of the engine to use. */
  readonly version: MariaDbEngineVersion;
}

class MariaDbInstanceEngine extends InstanceEngineBase {
  constructor(version?: MariaDbEngineVersion) {
    super({
      engineType: 'mariadb',
      singleUserRotationApplication: secretsmanager.SecretRotationApplication.MARIADB_ROTATION_SINGLE_USER,
      multiUserRotationApplication: secretsmanager.SecretRotationApplication.MARIADB_ROTATION_MULTI_USER,
      version: version
        ? {
          fullVersion: version.mariaDbFullVersion,
          majorVersion: version.mariaDbMajorVersion,
        }
        : undefined,
    });
  }

  public bindToInstance(scope: Construct, options: InstanceEngineBindOptions): InstanceEngineConfig {
    if (options.domain) {
      throw new Error(`domain property cannot be configured for ${this.engineType}`);
    }
    return super.bindToInstance(scope, options);
  }
}

/**
 * The versions for the MySQL instance engines
 * (those returned by {@link DatabaseInstanceEngine.mysql}).
 */
export class MysqlEngineVersion {
  /**
   * Version "5.5" (only a major version, without a specific minor version).
   * @deprecated MySQL 5.5 will reach end of life on May 25, 2021
  */
  public static readonly VER_5_5 = MysqlEngineVersion.of('5.5', '5.5');
  /**
   * Version "5.5.46".
   * @deprecated MySQL 5.5 will reach end of life on May 25, 2021
  */
  public static readonly VER_5_5_46 = MysqlEngineVersion.of('5.5.46', '5.5');
  /**
   * Version "5.5.53".
   * @deprecated MySQL 5.5 will reach end of life on May 25, 2021
  */
  public static readonly VER_5_5_53 = MysqlEngineVersion.of('5.5.53', '5.5');
  /**
   * Version "5.5.57".
   * @deprecated MySQL 5.5 will reach end of life on May 25, 2021
  */
  public static readonly VER_5_5_57 = MysqlEngineVersion.of('5.5.57', '5.5');
  /**
   * Version "5.5.59".
   * @deprecated MySQL 5.5 will reach end of life on May 25, 2021
  */
  public static readonly VER_5_5_59 = MysqlEngineVersion.of('5.5.59', '5.5');
  /**
   * Version "5.5.61".
   * @deprecated MySQL 5.5 will reach end of life on May 25, 2021
  */
  public static readonly VER_5_5_61 = MysqlEngineVersion.of('5.5.61', '5.5');

  /**
   * Version "5.6" (only a major version, without a specific minor version).
   * @deprecated MySQL 5.6 will reach end of life on August 3, 2021
  */
  public static readonly VER_5_6 = MysqlEngineVersion.of('5.6', '5.6');
  /**
   * Version "5.6.34".
   * @deprecated MySQL 5.6 will reach end of life on August 3, 2021
  */
  public static readonly VER_5_6_34 = MysqlEngineVersion.of('5.6.34', '5.6');
  /**
   * Version "5.6.35".
   * @deprecated MySQL 5.6 will reach end of life on August 3, 2021
  */
  public static readonly VER_5_6_35 = MysqlEngineVersion.of('5.6.35', '5.6');
  /**
   * Version "5.6.37".
   * @deprecated MySQL 5.6 will reach end of life on August 3, 2021
  */
  public static readonly VER_5_6_37 = MysqlEngineVersion.of('5.6.37', '5.6');
  /**
   * Version "5.6.39".
   * @deprecated MySQL 5.6 will reach end of life on August 3, 2021
  */
  public static readonly VER_5_6_39 = MysqlEngineVersion.of('5.6.39', '5.6');
  /**
   * Version "5.6.40".
   * @deprecated MySQL 5.6 will reach end of life on August 3, 2021
  */
  public static readonly VER_5_6_40 = MysqlEngineVersion.of('5.6.40', '5.6');
  /**
   * Version "5.6.41".
   * @deprecated MySQL 5.6 will reach end of life on August 3, 2021
  */
  public static readonly VER_5_6_41 = MysqlEngineVersion.of('5.6.41', '5.6');
  /**
   * Version "5.6.43".
   * @deprecated MySQL 5.6 will reach end of life on August 3, 2021
  */
  public static readonly VER_5_6_43 = MysqlEngineVersion.of('5.6.43', '5.6');
  /**
   * Version "5.6.44".
   * @deprecated MySQL 5.6 will reach end of life on August 3, 2021
  */
  public static readonly VER_5_6_44 = MysqlEngineVersion.of('5.6.44', '5.6');
  /**
   * Version "5.6.46".
   * @deprecated MySQL 5.6 will reach end of life on August 3, 2021
  */
  public static readonly VER_5_6_46 = MysqlEngineVersion.of('5.6.46', '5.6');
  /**
   * Version "5.6.48".
   * @deprecated MySQL 5.6 will reach end of life on August 3, 2021
  */
  public static readonly VER_5_6_48 = MysqlEngineVersion.of('5.6.48', '5.6');
  /**
   * Version "5.6.49".
   * @deprecated MySQL 5.6 will reach end of life on August 3, 2021
  */
  public static readonly VER_5_6_49 = MysqlEngineVersion.of('5.6.49', '5.6');
  /**
   * Version "5.6.51".
   * @deprecated MySQL 5.6 will reach end of life on August 3, 2021
  */
  public static readonly VER_5_6_51 = MysqlEngineVersion.of('5.6.51', '5.6');

  /** Version "5.7" (only a major version, without a specific minor version). */
  public static readonly VER_5_7 = MysqlEngineVersion.of('5.7', '5.7');
  /** Version "5.7.16". */
  public static readonly VER_5_7_16 = MysqlEngineVersion.of('5.7.16', '5.7');
  /** Version "5.7.17". */
  public static readonly VER_5_7_17 = MysqlEngineVersion.of('5.7.17', '5.7');
  /** Version "5.7.19". */
  public static readonly VER_5_7_19 = MysqlEngineVersion.of('5.7.19', '5.7');
  /** Version "5.7.21". */
  public static readonly VER_5_7_21 = MysqlEngineVersion.of('5.7.21', '5.7');
  /** Version "5.7.22". */
  public static readonly VER_5_7_22 = MysqlEngineVersion.of('5.7.22', '5.7');
  /** Version "5.7.23". */
  public static readonly VER_5_7_23 = MysqlEngineVersion.of('5.7.23', '5.7');
  /** Version "5.7.24". */
  public static readonly VER_5_7_24 = MysqlEngineVersion.of('5.7.24', '5.7');
  /** Version "5.7.25". */
  public static readonly VER_5_7_25 = MysqlEngineVersion.of('5.7.25', '5.7');
  /** Version "5.7.26". */
  public static readonly VER_5_7_26 = MysqlEngineVersion.of('5.7.26', '5.7');
  /** Version "5.7.28". */
  public static readonly VER_5_7_28 = MysqlEngineVersion.of('5.7.28', '5.7');
  /** Version "5.7.30". */
  public static readonly VER_5_7_30 = MysqlEngineVersion.of('5.7.30', '5.7');
  /** Version "5.7.31". */
  public static readonly VER_5_7_31 = MysqlEngineVersion.of('5.7.31', '5.7');
  /** Version "5.7.33". */
  public static readonly VER_5_7_33 = MysqlEngineVersion.of('5.7.33', '5.7');

  /** Version "8.0" (only a major version, without a specific minor version). */
  public static readonly VER_8_0 = MysqlEngineVersion.of('8.0', '8.0');
  /** Version "8.0.11". */
  public static readonly VER_8_0_11 = MysqlEngineVersion.of('8.0.11', '8.0');
  /** Version "8.0.13". */
  public static readonly VER_8_0_13 = MysqlEngineVersion.of('8.0.13', '8.0');
  /** Version "8.0.15". */
  public static readonly VER_8_0_15 = MysqlEngineVersion.of('8.0.15', '8.0');
  /** Version "8.0.16". */
  public static readonly VER_8_0_16 = MysqlEngineVersion.of('8.0.16', '8.0');
  /** Version "8.0.17". */
  public static readonly VER_8_0_17 = MysqlEngineVersion.of('8.0.17', '8.0');
  /** Version "8.0.19". */
  public static readonly VER_8_0_19 = MysqlEngineVersion.of('8.0.19', '8.0');
  /** Version "8.0.20 ". */
  public static readonly VER_8_0_20 = MysqlEngineVersion.of('8.0.20', '8.0');
  /** Version "8.0.21 ". */
  public static readonly VER_8_0_21 = MysqlEngineVersion.of('8.0.21', '8.0');
  /** Version "8.0.23". */
  public static readonly VER_8_0_23 = MysqlEngineVersion.of('8.0.23', '8.0');
  /** Version "8.0.25". */
  public static readonly VER_8_0_25 = MysqlEngineVersion.of('8.0.25', '8.0');

  /**
   * Create a new MysqlEngineVersion with an arbitrary version.
   *
   * @param mysqlFullVersion the full version string,
   *   for example "8.1.43"
   * @param mysqlMajorVersion the major version of the engine,
   *   for example "8.1"
   */
  public static of(mysqlFullVersion: string, mysqlMajorVersion: string): MysqlEngineVersion {
    return new MysqlEngineVersion(mysqlFullVersion, mysqlMajorVersion);
  }

  /** The full version string, for example, "10.5.28". */
  public readonly mysqlFullVersion: string;
  /** The major version of the engine, for example, "10.5". */
  public readonly mysqlMajorVersion: string;

  private constructor(mysqlFullVersion: string, mysqlMajorVersion: string) {
    this.mysqlFullVersion = mysqlFullVersion;
    this.mysqlMajorVersion = mysqlMajorVersion;
  }
}

/**
 * Properties for MySQL instance engines.
 * Used in {@link DatabaseInstanceEngine.mysql}.
 */
export interface MySqlInstanceEngineProps {
  /** The exact version of the engine to use. */
  readonly version: MysqlEngineVersion;
}

class MySqlInstanceEngine extends InstanceEngineBase {
  constructor(version?: MysqlEngineVersion) {
    super({
      engineType: 'mysql',
      singleUserRotationApplication: secretsmanager.SecretRotationApplication.MYSQL_ROTATION_SINGLE_USER,
      multiUserRotationApplication: secretsmanager.SecretRotationApplication.MYSQL_ROTATION_MULTI_USER,
      version: version
        ? {
          fullVersion: version.mysqlFullVersion,
          majorVersion: version.mysqlMajorVersion,
        }
        : undefined,
      engineFamily: 'MYSQL',
    });
  }
}

/**
 * Features supported by the Postgres database engine
 */
export interface PostgresEngineFeatures {
  /**
   * Whether this version of the Postgres engine supports the S3 data import feature.
   *
   * @default false
   */
  readonly s3Import?: boolean;
}

/**
 * The versions for the PostgreSQL instance engines
 * (those returned by {@link DatabaseInstanceEngine.postgres}).
 */
export class PostgresEngineVersion {
  /**
   * Version "9.5" (only a major version, without a specific minor version).
   * @deprecated PostgreSQL 9.5 will reach end of life on February 16, 2021
  */
  public static readonly VER_9_5 = PostgresEngineVersion.of('9.5', '9.5');
  /**
   * Version "9.5.2".
   * @deprecated PostgreSQL 9.5 will reach end of life on February 16, 2021
  */
  public static readonly VER_9_5_2 = PostgresEngineVersion.of('9.5.2', '9.5');
  /**
   * Version "9.5.4".
   * @deprecated PostgreSQL 9.5 will reach end of life on February 16, 2021
  */
  public static readonly VER_9_5_4 = PostgresEngineVersion.of('9.5.4', '9.5');
  /**
   * Version "9.5.6".
   * @deprecated PostgreSQL 9.5 will reach end of life on February 16, 2021
  */
  public static readonly VER_9_5_6 = PostgresEngineVersion.of('9.5.6', '9.5');
  /**
   * Version "9.5.7".
   * @deprecated PostgreSQL 9.5 will reach end of life on February 16, 2021
  */
  public static readonly VER_9_5_7 = PostgresEngineVersion.of('9.5.7', '9.5');
  /**
   * Version "9.5.9".
   * @deprecated PostgreSQL 9.5 will reach end of life on February 16, 2021
  */
  public static readonly VER_9_5_9 = PostgresEngineVersion.of('9.5.9', '9.5');
  /**
   * Version "9.5.10".
   * @deprecated PostgreSQL 9.5 will reach end of life on February 16, 2021
  */
  public static readonly VER_9_5_10 = PostgresEngineVersion.of('9.5.10', '9.5');
  /**
   * Version "9.5.12".
   * @deprecated PostgreSQL 9.5 will reach end of life on February 16, 2021
  */
  public static readonly VER_9_5_12 = PostgresEngineVersion.of('9.5.12', '9.5');
  /**
   * Version "9.5.13".
   * @deprecated PostgreSQL 9.5 will reach end of life on February 16, 2021
  */
  public static readonly VER_9_5_13 = PostgresEngineVersion.of('9.5.13', '9.5');
  /**
   * Version "9.5.14".
   * @deprecated PostgreSQL 9.5 will reach end of life on February 16, 2021
  */
  public static readonly VER_9_5_14 = PostgresEngineVersion.of('9.5.14', '9.5');
  /**
   * Version "9.5.15".
   * @deprecated PostgreSQL 9.5 will reach end of life on February 16, 2021
  */
  public static readonly VER_9_5_15 = PostgresEngineVersion.of('9.5.15', '9.5');
  /**
   * Version "9.5.16".
   * @deprecated PostgreSQL 9.5 will reach end of life on February 16, 2021
  */
  public static readonly VER_9_5_16 = PostgresEngineVersion.of('9.5.16', '9.5');
  /**
   * Version "9.5.18".
   * @deprecated PostgreSQL 9.5 will reach end of life on February 16, 2021
  */
  public static readonly VER_9_5_18 = PostgresEngineVersion.of('9.5.18', '9.5');
  /**
   * Version "9.5.19".
   * @deprecated PostgreSQL 9.5 will reach end of life on February 16, 2021
  */
  public static readonly VER_9_5_19 = PostgresEngineVersion.of('9.5.19', '9.5');
  /**
   * Version "9.5.20".
   * @deprecated PostgreSQL 9.5 will reach end of life on February 16, 2021
  */
  public static readonly VER_9_5_20 = PostgresEngineVersion.of('9.5.20', '9.5');
  /**
   * Version "9.5.21".
   * @deprecated PostgreSQL 9.5 will reach end of life on February 16, 2021
  */
  public static readonly VER_9_5_21 = PostgresEngineVersion.of('9.5.21', '9.5');
  /**
   * Version "9.5.22".
   * @deprecated PostgreSQL 9.5 will reach end of life on February 16, 2021
  */
  public static readonly VER_9_5_22 = PostgresEngineVersion.of('9.5.22', '9.5');
  /**
   * Version "9.5.23".
   * @deprecated PostgreSQL 9.5 will reach end of life on February 16, 2021
  */
  public static readonly VER_9_5_23 = PostgresEngineVersion.of('9.5.23', '9.5');
  /**
   * Version "9.5.24".
   * @deprecated PostgreSQL 9.5 will reach end of life on February 16, 2021
  */
  public static readonly VER_9_5_24 = PostgresEngineVersion.of('9.5.24', '9.5');
  /**
   * Version "9.5.25".
   * @deprecated PostgreSQL 9.5 will reach end of life on February 16, 2021
  */
  public static readonly VER_9_5_25 = PostgresEngineVersion.of('9.5.25', '9.5');

  /**
   * Version "9.6" (only a major version, without a specific minor version).
   * @deprecated PostgreSQL 9.6 will reach end of life in November 2021
  */
  public static readonly VER_9_6 = PostgresEngineVersion.of('9.6', '9.6');
  /**
   * Version "9.6.1".
   * @deprecated PostgreSQL 9.6 will reach end of life in November 2021
  */
  public static readonly VER_9_6_1 = PostgresEngineVersion.of('9.6.1', '9.6');
  /**
   * Version "9.6.2".
   * @deprecated PostgreSQL 9.6 will reach end of life in November 2021
  */
  public static readonly VER_9_6_2 = PostgresEngineVersion.of('9.6.2', '9.6');
  /**
   * Version "9.6.3".
   * @deprecated PostgreSQL 9.6 will reach end of life in November 2021
  */
  public static readonly VER_9_6_3 = PostgresEngineVersion.of('9.6.3', '9.6');
  /**
   * Version "9.6.5".
   * @deprecated PostgreSQL 9.6 will reach end of life in November 2021
  */
  public static readonly VER_9_6_5 = PostgresEngineVersion.of('9.6.5', '9.6');
  /**
   * Version "9.6.6".
   * @deprecated PostgreSQL 9.6 will reach end of life in November 2021
  */
  public static readonly VER_9_6_6 = PostgresEngineVersion.of('9.6.6', '9.6');
  /**
   * Version "9.6.8".
   * @deprecated PostgreSQL 9.6 will reach end of life in November 2021
  */
  public static readonly VER_9_6_8 = PostgresEngineVersion.of('9.6.8', '9.6');
  /**
   * Version "9.6.9".
   * @deprecated PostgreSQL 9.6 will reach end of life in November 2021
  */
  public static readonly VER_9_6_9 = PostgresEngineVersion.of('9.6.9', '9.6');
  /**
   * Version "9.6.10".
   * @deprecated PostgreSQL 9.6 will reach end of life in November 2021
  */
  public static readonly VER_9_6_10 = PostgresEngineVersion.of('9.6.10', '9.6');
  /**
   * Version "9.6.11".
   * @deprecated PostgreSQL 9.6 will reach end of life in November 2021
  */
  public static readonly VER_9_6_11 = PostgresEngineVersion.of('9.6.11', '9.6');
  /**
   * Version "9.6.12".
   * @deprecated PostgreSQL 9.6 will reach end of life in November 2021
  */
  public static readonly VER_9_6_12 = PostgresEngineVersion.of('9.6.12', '9.6');
  /**
   * Version "9.6.14".
   * @deprecated PostgreSQL 9.6 will reach end of life in November 2021
  */
  public static readonly VER_9_6_14 = PostgresEngineVersion.of('9.6.14', '9.6');
  /**
   * Version "9.6.15".
   * @deprecated PostgreSQL 9.6 will reach end of life in November 2021
  */
  public static readonly VER_9_6_15 = PostgresEngineVersion.of('9.6.15', '9.6');
  /**
   * Version "9.6.16".
   * @deprecated PostgreSQL 9.6 will reach end of life in November 2021
  */
  public static readonly VER_9_6_16 = PostgresEngineVersion.of('9.6.16', '9.6');
  /**
   * Version "9.6.17".
   * @deprecated PostgreSQL 9.6 will reach end of life in November 2021
  */
  public static readonly VER_9_6_17 = PostgresEngineVersion.of('9.6.17', '9.6');
  /**
   * Version "9.6.18".
   * @deprecated PostgreSQL 9.6 will reach end of life in November 2021
  */
  public static readonly VER_9_6_18 = PostgresEngineVersion.of('9.6.18', '9.6');
  /**
   * Version "9.6.19".
   * @deprecated PostgreSQL 9.6 will reach end of life in November 2021
  */
  public static readonly VER_9_6_19 = PostgresEngineVersion.of('9.6.19', '9.6');
  /**
   * Version "9.6.20".
   * @deprecated PostgreSQL 9.6 will reach end of life in November 2021
  */
  public static readonly VER_9_6_20 = PostgresEngineVersion.of('9.6.20', '9.6');
  /**
   * Version "9.6.21".
   * @deprecated PostgreSQL 9.6 will reach end of life in November 2021
  */
  public static readonly VER_9_6_21 = PostgresEngineVersion.of('9.6.21', '9.6');
  /**
   * Version "9.6.22".
   * @deprecated PostgreSQL 9.6 will reach end of life in November 2022
  */
  public static readonly VER_9_6_22 = PostgresEngineVersion.of('9.6.22', '9.6');

  /** Version "10" (only a major version, without a specific minor version). */
  public static readonly VER_10 = PostgresEngineVersion.of('10', '10');
  /** Version "10.1". */
  public static readonly VER_10_1 = PostgresEngineVersion.of('10.1', '10');
  /** Version "10.3". */
  public static readonly VER_10_3 = PostgresEngineVersion.of('10.3', '10');
  /** Version "10.4". */
  public static readonly VER_10_4 = PostgresEngineVersion.of('10.4', '10');
  /** Version "10.5". */
  public static readonly VER_10_5 = PostgresEngineVersion.of('10.5', '10');
  /** Version "10.6". */
  public static readonly VER_10_6 = PostgresEngineVersion.of('10.6', '10');
  /** Version "10.7". */
  public static readonly VER_10_7 = PostgresEngineVersion.of('10.7', '10', { s3Import: true });
  /** Version "10.9". */
  public static readonly VER_10_9 = PostgresEngineVersion.of('10.9', '10', { s3Import: true });
  /** Version "10.10". */
  public static readonly VER_10_10 = PostgresEngineVersion.of('10.10', '10', { s3Import: true });
  /** Version "10.11". */
  public static readonly VER_10_11 = PostgresEngineVersion.of('10.11', '10', { s3Import: true });
  /** Version "10.12". */
  public static readonly VER_10_12 = PostgresEngineVersion.of('10.12', '10', { s3Import: true });
  /** Version "10.13". */
  public static readonly VER_10_13 = PostgresEngineVersion.of('10.13', '10', { s3Import: true });
  /** Version "10.14". */
  public static readonly VER_10_14 = PostgresEngineVersion.of('10.14', '10', { s3Import: true });
  /** Version "10.15". */
  public static readonly VER_10_15 = PostgresEngineVersion.of('10.15', '10', { s3Import: true });
  /** Version "10.16". */
  public static readonly VER_10_16 = PostgresEngineVersion.of('10.16', '10', { s3Import: true });
  /** Version "10.17". */
  public static readonly VER_10_17 = PostgresEngineVersion.of('10.17', '10', { s3Import: true });

  /** Version "11" (only a major version, without a specific minor version). */
  public static readonly VER_11 = PostgresEngineVersion.of('11', '11', { s3Import: true });
  /** Version "11.1". */
  public static readonly VER_11_1 = PostgresEngineVersion.of('11.1', '11', { s3Import: true });
  /** Version "11.2". */
  public static readonly VER_11_2 = PostgresEngineVersion.of('11.2', '11', { s3Import: true });
  /** Version "11.4". */
  public static readonly VER_11_4 = PostgresEngineVersion.of('11.4', '11', { s3Import: true });
  /** Version "11.5". */
  public static readonly VER_11_5 = PostgresEngineVersion.of('11.5', '11', { s3Import: true });
  /** Version "11.6". */
  public static readonly VER_11_6 = PostgresEngineVersion.of('11.6', '11', { s3Import: true });
  /** Version "11.7". */
  public static readonly VER_11_7 = PostgresEngineVersion.of('11.7', '11', { s3Import: true });
  /** Version "11.8". */
  public static readonly VER_11_8 = PostgresEngineVersion.of('11.8', '11', { s3Import: true });
  /** Version "11.9". */
  public static readonly VER_11_9 = PostgresEngineVersion.of('11.9', '11', { s3Import: true });
  /** Version "11.10". */
  public static readonly VER_11_10 = PostgresEngineVersion.of('11.10', '11', { s3Import: true });
  /** Version "11.11". */
  public static readonly VER_11_11 = PostgresEngineVersion.of('11.11', '11', { s3Import: true });
  /** Version "11.12". */
  public static readonly VER_11_12 = PostgresEngineVersion.of('11.12', '11', { s3Import: true });

  /** Version "12" (only a major version, without a specific minor version). */
  public static readonly VER_12 = PostgresEngineVersion.of('12', '12', { s3Import: true });
  /** Version "12.2". */
  public static readonly VER_12_2 = PostgresEngineVersion.of('12.2', '12', { s3Import: true });
  /** Version "12.3". */
  public static readonly VER_12_3 = PostgresEngineVersion.of('12.3', '12', { s3Import: true });
  /** Version "12.4". */
  public static readonly VER_12_4 = PostgresEngineVersion.of('12.4', '12', { s3Import: true });
  /** Version "12.5". */
  public static readonly VER_12_5 = PostgresEngineVersion.of('12.5', '12', { s3Import: true });
  /** Version "12.6". */
  public static readonly VER_12_6 = PostgresEngineVersion.of('12.6', '12', { s3Import: true });
  /** Version "12.7". */
  public static readonly VER_12_7 = PostgresEngineVersion.of('12.7', '12', { s3Import: true });

  /** Version "13" (only a major version, without a specific minor version). */
  public static readonly VER_13 = PostgresEngineVersion.of('13', '13', { s3Import: true });
  /** Version "13.1". */
  public static readonly VER_13_1 = PostgresEngineVersion.of('13.1', '13', { s3Import: true });
  /** Version "13.2". */
  public static readonly VER_13_2 = PostgresEngineVersion.of('13.2', '13', { s3Import: true });
  /** Version "13.3". */
  public static readonly VER_13_3 = PostgresEngineVersion.of('13.3', '13', { s3Import: true });

  /**
   * Create a new PostgresEngineVersion with an arbitrary version.
   *
   * @param postgresFullVersion the full version string,
   *   for example "13.11"
   * @param postgresMajorVersion the major version of the engine,
   *   for example "13"
   */
  public static of(postgresFullVersion: string, postgresMajorVersion: string, postgresFeatures?: PostgresEngineFeatures): PostgresEngineVersion {
    return new PostgresEngineVersion(postgresFullVersion, postgresMajorVersion, postgresFeatures);
  }

  /** The full version string, for example, "13.11". */
  public readonly postgresFullVersion: string;
  /** The major version of the engine, for example, "13". */
  public readonly postgresMajorVersion: string;

  /**
   * The supported features for the DB engine
   * @internal
   */
  public readonly _features: InstanceEngineFeatures;

  private constructor(postgresFullVersion: string, postgresMajorVersion: string, postgresFeatures?: PostgresEngineFeatures) {
    this.postgresFullVersion = postgresFullVersion;
    this.postgresMajorVersion = postgresMajorVersion;
    this._features = {
      s3Import: postgresFeatures?.s3Import ? 's3Import' : undefined,
    };
  }
}

/**
 * Properties for PostgreSQL instance engines.
 * Used in {@link DatabaseInstanceEngine.postgres}.
 */
export interface PostgresInstanceEngineProps {
  /** The exact version of the engine to use. */
  readonly version: PostgresEngineVersion;
}

/**
 * The instance engine for PostgreSQL.
 */
class PostgresInstanceEngine extends InstanceEngineBase {
  public readonly defaultUsername = 'postgres';

  constructor(version?: PostgresEngineVersion) {
    super({
      engineType: 'postgres',
      singleUserRotationApplication: secretsmanager.SecretRotationApplication.POSTGRES_ROTATION_SINGLE_USER,
      multiUserRotationApplication: secretsmanager.SecretRotationApplication.POSTGRES_ROTATION_MULTI_USER,
      version: version
        ? {
          fullVersion: version.postgresFullVersion,
          majorVersion: version.postgresMajorVersion,
        }
        : undefined,
      features: version ? version?._features : { s3Import: 's3Import' },
      engineFamily: 'POSTGRESQL',
    });
  }
}

/**
 * The versions for the legacy Oracle instance engines
 * (those returned by {@link DatabaseInstanceEngine.oracleSe}
 * and {@link DatabaseInstanceEngine.oracleSe1}).
 * Note: RDS will stop allowing creating new databases with this version in August 2020.
 *
 * @deprecated instances can no longer be created with these engine versions. See https://forums.aws.amazon.com/ann.jspa?annID=7341
 */
export class OracleLegacyEngineVersion {
  /** Version "11.2" (only a major version, without a specific minor version). */
  public static readonly VER_11_2 = OracleLegacyEngineVersion.of('11.2', '11.2');
  /** Version "11.2.0.2.v2". */
  public static readonly VER_11_2_0_2_V2 = OracleLegacyEngineVersion.of('11.2.0.2.v2', '11.2');
  /** Version "11.2.0.4.v1". */
  public static readonly VER_11_2_0_4_V1 = OracleLegacyEngineVersion.of('11.2.0.4.v1', '11.2');
  /** Version "11.2.0.4.v3". */
  public static readonly VER_11_2_0_4_V3 = OracleLegacyEngineVersion.of('11.2.0.4.v3', '11.2');
  /** Version "11.2.0.4.v4". */
  public static readonly VER_11_2_0_4_V4 = OracleLegacyEngineVersion.of('11.2.0.4.v4', '11.2');
  /** Version "11.2.0.4.v5". */
  public static readonly VER_11_2_0_4_V5 = OracleLegacyEngineVersion.of('11.2.0.4.v5', '11.2');
  /** Version "11.2.0.4.v6". */
  public static readonly VER_11_2_0_4_V6 = OracleLegacyEngineVersion.of('11.2.0.4.v6', '11.2');
  /** Version "11.2.0.4.v7". */
  public static readonly VER_11_2_0_4_V7 = OracleLegacyEngineVersion.of('11.2.0.4.v7', '11.2');
  /** Version "11.2.0.4.v8". */
  public static readonly VER_11_2_0_4_V8 = OracleLegacyEngineVersion.of('11.2.0.4.v8', '11.2');
  /** Version "11.2.0.4.v9". */
  public static readonly VER_11_2_0_4_V9 = OracleLegacyEngineVersion.of('11.2.0.4.v9', '11.2');
  /** Version "11.2.0.4.v10". */
  public static readonly VER_11_2_0_4_V10 = OracleLegacyEngineVersion.of('11.2.0.4.v10', '11.2');
  /** Version "11.2.0.4.v11". */
  public static readonly VER_11_2_0_4_V11 = OracleLegacyEngineVersion.of('11.2.0.4.v11', '11.2');
  /** Version "11.2.0.4.v12". */
  public static readonly VER_11_2_0_4_V12 = OracleLegacyEngineVersion.of('11.2.0.4.v12', '11.2');
  /** Version "11.2.0.4.v13". */
  public static readonly VER_11_2_0_4_V13 = OracleLegacyEngineVersion.of('11.2.0.4.v13', '11.2');
  /** Version "11.2.0.4.v14". */
  public static readonly VER_11_2_0_4_V14 = OracleLegacyEngineVersion.of('11.2.0.4.v14', '11.2');
  /** Version "11.2.0.4.v15". */
  public static readonly VER_11_2_0_4_V15 = OracleLegacyEngineVersion.of('11.2.0.4.v15', '11.2');
  /** Version "11.2.0.4.v16". */
  public static readonly VER_11_2_0_4_V16 = OracleLegacyEngineVersion.of('11.2.0.4.v16', '11.2');
  /** Version "11.2.0.4.v17". */
  public static readonly VER_11_2_0_4_V17 = OracleLegacyEngineVersion.of('11.2.0.4.v17', '11.2');
  /** Version "11.2.0.4.v18". */
  public static readonly VER_11_2_0_4_V18 = OracleLegacyEngineVersion.of('11.2.0.4.v18', '11.2');
  /** Version "11.2.0.4.v19". */
  public static readonly VER_11_2_0_4_V19 = OracleLegacyEngineVersion.of('11.2.0.4.v19', '11.2');
  /** Version "11.2.0.4.v20". */
  public static readonly VER_11_2_0_4_V20 = OracleLegacyEngineVersion.of('11.2.0.4.v20', '11.2');
  /** Version "11.2.0.4.v21". */
  public static readonly VER_11_2_0_4_V21 = OracleLegacyEngineVersion.of('11.2.0.4.v21', '11.2');
  /** Version "11.2.0.4.v22". */
  public static readonly VER_11_2_0_4_V22 = OracleLegacyEngineVersion.of('11.2.0.4.v22', '11.2');
  /** Version "11.2.0.4.v23". */
  public static readonly VER_11_2_0_4_V23 = OracleLegacyEngineVersion.of('11.2.0.4.v23', '11.2');
  /** Version "11.2.0.4.v24". */
  public static readonly VER_11_2_0_4_V24 = OracleLegacyEngineVersion.of('11.2.0.4.v24', '11.2');
  /** Version "11.2.0.4.v25". */
  public static readonly VER_11_2_0_4_V25 = OracleLegacyEngineVersion.of('11.2.0.4.v25', '11.2');

  private static of(oracleLegacyFullVersion: string, oracleLegacyMajorVersion: string): OracleLegacyEngineVersion {
    return new OracleLegacyEngineVersion(oracleLegacyFullVersion, oracleLegacyMajorVersion);
  }

  /** The full version string, for example, "11.2.0.4.v24". */
  public readonly oracleLegacyFullVersion: string;
  /** The major version of the engine, for example, "11.2". */
  public readonly oracleLegacyMajorVersion: string;

  private constructor(oracleLegacyFullVersion: string, oracleLegacyMajorVersion: string) {
    this.oracleLegacyFullVersion = oracleLegacyFullVersion;
    this.oracleLegacyMajorVersion = oracleLegacyMajorVersion;
  }
}

/**
 * The versions for the Oracle instance engines
 * (those returned by {@link DatabaseInstanceEngine.oracleSe2} and
 * {@link DatabaseInstanceEngine.oracleEe}).
 */
export class OracleEngineVersion {
  /** Version "12.1" (only a major version, without a specific minor version). */
  public static readonly VER_12_1 = OracleEngineVersion.of('12.1', '12.1');
  /** Version "12.1.0.2.v1". */
  public static readonly VER_12_1_0_2_V1 = OracleEngineVersion.of('12.1.0.2.v1', '12.1');
  /** Version "12.1.0.2.v2". */
  public static readonly VER_12_1_0_2_V2 = OracleEngineVersion.of('12.1.0.2.v2', '12.1');
  /** Version "12.1.0.2.v3". */
  public static readonly VER_12_1_0_2_V3 = OracleEngineVersion.of('12.1.0.2.v3', '12.1');
  /** Version "12.1.0.2.v4". */
  public static readonly VER_12_1_0_2_V4 = OracleEngineVersion.of('12.1.0.2.v4', '12.1');
  /** Version "12.1.0.2.v5". */
  public static readonly VER_12_1_0_2_V5 = OracleEngineVersion.of('12.1.0.2.v5', '12.1');
  /** Version "12.1.0.2.v6". */
  public static readonly VER_12_1_0_2_V6 = OracleEngineVersion.of('12.1.0.2.v6', '12.1');
  /** Version "12.1.0.2.v7". */
  public static readonly VER_12_1_0_2_V7 = OracleEngineVersion.of('12.1.0.2.v7', '12.1');
  /** Version "12.1.0.2.v8". */
  public static readonly VER_12_1_0_2_V8 = OracleEngineVersion.of('12.1.0.2.v8', '12.1');
  /** Version "12.1.0.2.v9". */
  public static readonly VER_12_1_0_2_V9 = OracleEngineVersion.of('12.1.0.2.v9', '12.1');
  /** Version "12.1.0.2.v10". */
  public static readonly VER_12_1_0_2_V10 = OracleEngineVersion.of('12.1.0.2.v10', '12.1');
  /** Version "12.1.0.2.v11". */
  public static readonly VER_12_1_0_2_V11 = OracleEngineVersion.of('12.1.0.2.v11', '12.1');
  /** Version "12.1.0.2.v12". */
  public static readonly VER_12_1_0_2_V12 = OracleEngineVersion.of('12.1.0.2.v12', '12.1');
  /** Version "12.1.0.2.v13". */
  public static readonly VER_12_1_0_2_V13 = OracleEngineVersion.of('12.1.0.2.v13', '12.1');
  /** Version "12.1.0.2.v14". */
  public static readonly VER_12_1_0_2_V14 = OracleEngineVersion.of('12.1.0.2.v14', '12.1');
  /** Version "12.1.0.2.v15". */
  public static readonly VER_12_1_0_2_V15 = OracleEngineVersion.of('12.1.0.2.v15', '12.1');
  /** Version "12.1.0.2.v16". */
  public static readonly VER_12_1_0_2_V16 = OracleEngineVersion.of('12.1.0.2.v16', '12.1');
  /** Version "12.1.0.2.v17". */
  public static readonly VER_12_1_0_2_V17 = OracleEngineVersion.of('12.1.0.2.v17', '12.1');
  /** Version "12.1.0.2.v18". */
  public static readonly VER_12_1_0_2_V18 = OracleEngineVersion.of('12.1.0.2.v18', '12.1');
  /** Version "12.1.0.2.v19". */
  public static readonly VER_12_1_0_2_V19 = OracleEngineVersion.of('12.1.0.2.v19', '12.1');
  /** Version "12.1.0.2.v20". */
  public static readonly VER_12_1_0_2_V20 = OracleEngineVersion.of('12.1.0.2.v20', '12.1');
  /** Version "12.1.0.2.v21". */
  public static readonly VER_12_1_0_2_V21 = OracleEngineVersion.of('12.1.0.2.v21', '12.1');
  /** Version "12.1.0.2.v22". */
  public static readonly VER_12_1_0_2_V22 = OracleEngineVersion.of('12.1.0.2.v22', '12.1');
  /** Version "12.1.0.2.v23". */
  public static readonly VER_12_1_0_2_V23 = OracleEngineVersion.of('12.1.0.2.v23', '12.1');
  /** Version "12.1.0.2.v24". */
  public static readonly VER_12_1_0_2_V24 = OracleEngineVersion.of('12.1.0.2.v24', '12.1');

  /** Version "12.2" (only a major version, without a specific minor version). */
  public static readonly VER_12_2 = OracleEngineVersion.of('12.2', '12.2');
  /** Version "12.2.0.1.ru-2018-10.rur-2018-10.r1". */
  public static readonly VER_12_2_0_1_2018_10_R1 = OracleEngineVersion.of('12.2.0.1.ru-2018-10.rur-2018-10.r1', '12.2');
  /** Version "12.2.0.1.ru-2019-01.rur-2019-01.r1". */
  public static readonly VER_12_2_0_1_2019_01_R1 = OracleEngineVersion.of('12.2.0.1.ru-2019-01.rur-2019-01.r1', '12.2');
  /** Version "12.2.0.1.ru-2019-04.rur-2019-04.r1". */
  public static readonly VER_12_2_0_1_2019_04_R1 = OracleEngineVersion.of('12.2.0.1.ru-2019-04.rur-2019-04.r1', '12.2');
  /** Version "12.2.0.1.ru-2019-07.rur-2019-07.r1". */
  public static readonly VER_12_2_0_1_2019_07_R1 = OracleEngineVersion.of('12.2.0.1.ru-2019-07.rur-2019-07.r1', '12.2');
  /** Version "12.2.0.1.ru-2019-10.rur-2019-10.r1". */
  public static readonly VER_12_2_0_1_2019_10_R1 = OracleEngineVersion.of('12.2.0.1.ru-2019-10.rur-2019-10.r1', '12.2');
  /** Version "12.2.0.1.ru-2020-01.rur-2020-01.r1". */
  public static readonly VER_12_2_0_1_2020_01_R1 = OracleEngineVersion.of('12.2.0.1.ru-2020-01.rur-2020-01.r1', '12.2');
  /** Version "12.2.0.1.ru-2020-04.rur-2020-04.r1". */
  public static readonly VER_12_2_0_1_2020_04_R1 = OracleEngineVersion.of('12.2.0.1.ru-2020-04.rur-2020-04.r1', '12.2');
  /** Version "12.2.0.1.ru-2020-07.rur-2020-07.r1". */
  public static readonly VER_12_2_0_1_2020_07_R1 = OracleEngineVersion.of('12.2.0.1.ru-2020-07.rur-2020-07.r1', '12.2');
  /** Version "12.2.0.1.ru-2021-10.rur-2020-10.r1". */
  public static readonly VER_12_2_0_1_2020_10_R1 = OracleEngineVersion.of('12.2.0.1.ru-2020-10.rur-2020-10.r1', '12.2');
  /** Version "12.2.0.1.ru-2021-01.rur-2021-01.r1". */
  public static readonly VER_12_2_0_1_2021_01_R1 = OracleEngineVersion.of('12.2.0.1.ru-2021-01.rur-2021-01.r1', '12.2');
  /** Version "12.2.0.1.ru-2021-04.rur-2021-04.r1". */
  public static readonly VER_12_2_0_1_2021_04_R1 = OracleEngineVersion.of('12.2.0.1.ru-2021-04.rur-2021-04.r1', '12.2');


  /** Version "18" (only a major version, without a specific minor version). */
  public static readonly VER_18 = OracleEngineVersion.of('18', '18');
  /** Version "18.0.0.0.ru-2019-07.rur-2019-07.r1". */
  public static readonly VER_18_0_0_0_2019_07_R1 = OracleEngineVersion.of('18.0.0.0.ru-2019-07.rur-2019-07.r1', '18');
  /** Version "18.0.0.0.ru-2019-10.rur-2019-10.r1". */
  public static readonly VER_18_0_0_0_2019_10_R1 = OracleEngineVersion.of('18.0.0.0.ru-2019-10.rur-2019-10.r1', '18');
  /** Version "18.0.0.0.ru-2020-01.rur-2020-01.r1". */
  public static readonly VER_18_0_0_0_2020_01_R1 = OracleEngineVersion.of('18.0.0.0.ru-2020-01.rur-2020-01.r1', '18');
  /** Version "18.0.0.0.ru-2020-04.rur-2020-04.r1". */
  public static readonly VER_18_0_0_0_2020_04_R1 = OracleEngineVersion.of('18.0.0.0.ru-2020-04.rur-2020-04.r1', '18');
  /** Version "18.0.0.0.ru-2020-07.rur-2020-07.r1". */
  public static readonly VER_18_0_0_0_2020_07_R1 = OracleEngineVersion.of('18.0.0.0.ru-2020-07.rur-2020-07.r1', '18');

  /** Version "19" (only a major version, without a specific minor version). */
  public static readonly VER_19 = OracleEngineVersion.of('19', '19');
  /** Version "19.0.0.0.ru-2019-07.rur-2019-07.r1". */
  public static readonly VER_19_0_0_0_2019_07_R1 = OracleEngineVersion.of('19.0.0.0.ru-2019-07.rur-2019-07.r1', '19');
  /** Version "19.0.0.0.ru-2019-10.rur-2019-10.r1". */
  public static readonly VER_19_0_0_0_2019_10_R1 = OracleEngineVersion.of('19.0.0.0.ru-2019-10.rur-2019-10.r1', '19');
  /** Version "19.0.0.0.ru-2020-01.rur-2020-01.r1". */
  public static readonly VER_19_0_0_0_2020_01_R1 = OracleEngineVersion.of('19.0.0.0.ru-2020-01.rur-2020-01.r1', '19');
  /** Version "19.0.0.0.ru-2020-04.rur-2020-04.r1". */
  public static readonly VER_19_0_0_0_2020_04_R1 = OracleEngineVersion.of('19.0.0.0.ru-2020-04.rur-2020-04.r1', '19');
  /** Version "19.0.0.0.ru-2020-07.rur-2020-07.r1". */
  public static readonly VER_19_0_0_0_2020_07_R1 = OracleEngineVersion.of('19.0.0.0.ru-2020-07.rur-2020-07.r1', '19');
  /** Version "19.0.0.0.ru-2020-07.rur-2020-10.r1". */
  public static readonly VER_19_0_0_0_2020_10_R1 = OracleEngineVersion.of('19.0.0.0.ru-2020-10.rur-2020-10.r1', '19');
  /** Version "19.0.0.0.ru-2021-01.rur-2021-01.r1". */
  public static readonly VER_19_0_0_0_2021_01_R1 = OracleEngineVersion.of('19.0.0.0.ru-2021-01.rur-2021-01.r1', '19');
  /** Version "19.0.0.0.ru-2021-01.rur-2021-01.r2". */
  public static readonly VER_19_0_0_0_2021_01_R2 = OracleEngineVersion.of('19.0.0.0.ru-2021-01.rur-2021-01.r2', '19');
  /** Version "19.0.0.0.ru-2021-01.rur-2021-04.r1". */
  public static readonly VER_19_0_0_0_2021_04_R1 = OracleEngineVersion.of('19.0.0.0.ru-2021-04.rur-2021-04.r1', '19');


  /**
   * Creates a new OracleEngineVersion with an arbitrary version.
   *
   * @param oracleFullVersion the full version string,
   *   for example "19.0.0.0.ru-2019-10.rur-2019-10.r1"
   * @param oracleMajorVersion the major version of the engine,
   *   for example "19"
   */
  public static of(oracleFullVersion: string, oracleMajorVersion: string): OracleEngineVersion {
    return new OracleEngineVersion(oracleFullVersion, oracleMajorVersion);
  }

  /** The full version string, for example, "19.0.0.0.ru-2019-10.rur-2019-10.r1". */
  public readonly oracleFullVersion: string;
  /** The major version of the engine, for example, "19". */
  public readonly oracleMajorVersion: string;

  private constructor(oracleFullVersion: string, oracleMajorVersion: string) {
    this.oracleFullVersion = oracleFullVersion;
    this.oracleMajorVersion = oracleMajorVersion;
  }
}

interface OracleInstanceEngineBaseProps {
  readonly engineType: string;
  readonly version?: EngineVersion;
}

abstract class OracleInstanceEngineBase extends InstanceEngineBase {
  constructor(props: OracleInstanceEngineBaseProps) {
    super({
      ...props,
      singleUserRotationApplication: secretsmanager.SecretRotationApplication.ORACLE_ROTATION_SINGLE_USER,
      multiUserRotationApplication: secretsmanager.SecretRotationApplication.ORACLE_ROTATION_MULTI_USER,
      parameterGroupFamily: props.version ? `${props.engineType}-${props.version.majorVersion}` : undefined,
      features: {
        s3Import: 'S3_INTEGRATION',
        s3Export: 'S3_INTEGRATION',
      },
    });
  }

  public bindToInstance(scope: Construct, options: InstanceEngineBindOptions): InstanceEngineConfig {
    const config = super.bindToInstance(scope, options);

    let optionGroup = options.optionGroup;
    if (options.s3ImportRole || options.s3ExportRole) {
      if (!optionGroup) {
        optionGroup = new OptionGroup(scope, 'InstanceOptionGroup', {
          engine: this,
          configurations: [],
        });
      }
      // https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/oracle-s3-integration.html
      optionGroup.addConfiguration({
        name: 'S3_INTEGRATION',
        version: '1.0',
      });
    }

    return {
      ...config,
      optionGroup,
    };
  }
}

interface OracleInstanceEngineProps {
  /** The exact version of the engine to use. */
  readonly version: OracleEngineVersion;
}

/**
 * Properties for Oracle Standard Edition instance engines.
 * Used in {@link DatabaseInstanceEngine.oracleSe}.
 *
 * @deprecated instances can no longer be created with this engine. See https://forums.aws.amazon.com/ann.jspa?annID=7341
 */
export interface OracleSeInstanceEngineProps {
  /** The exact version of the engine to use. */
  readonly version: OracleLegacyEngineVersion;
}

/** @deprecated instances can no longer be created with this engine. See https://forums.aws.amazon.com/ann.jspa?annID=7341 */
class OracleSeInstanceEngine extends OracleInstanceEngineBase {
  constructor(version?: OracleLegacyEngineVersion) {
    super({
      engineType: 'oracle-se',
      version: version
        ? {
          fullVersion: version.oracleLegacyFullVersion,
          majorVersion: version.oracleLegacyMajorVersion,
        }
        : {
          majorVersion: '11.2',
        },
    });
  }
}

/**
 * Properties for Oracle Standard Edition 1 instance engines.
 * Used in {@link DatabaseInstanceEngine.oracleSe1}.
 *
 * @deprecated instances can no longer be created with this engine. See https://forums.aws.amazon.com/ann.jspa?annID=7341
 */
export interface OracleSe1InstanceEngineProps {
  /** The exact version of the engine to use. */
  readonly version: OracleLegacyEngineVersion;
}

/** @deprecated instances can no longer be created with this engine. See https://forums.aws.amazon.com/ann.jspa?annID=7341 */
class OracleSe1InstanceEngine extends OracleInstanceEngineBase {
  constructor(version?: OracleLegacyEngineVersion) {
    super({
      engineType: 'oracle-se1',
      version: version
        ? {
          fullVersion: version.oracleLegacyFullVersion,
          majorVersion: version.oracleLegacyMajorVersion,
        }
        : {
          majorVersion: '11.2',
        },
    });
  }
}

/**
 * Properties for Oracle Standard Edition 2 instance engines.
 * Used in {@link DatabaseInstanceEngine.oracleSe2}.
 */
export interface OracleSe2InstanceEngineProps extends OracleInstanceEngineProps {
}

class OracleSe2InstanceEngine extends OracleInstanceEngineBase {
  constructor(version?: OracleEngineVersion) {
    super({
      engineType: 'oracle-se2',
      version: version
        ? {
          fullVersion: version.oracleFullVersion,
          majorVersion: version.oracleMajorVersion,
        }
        : undefined,
    });
  }
}

/**
 * Properties for Oracle Enterprise Edition instance engines.
 * Used in {@link DatabaseInstanceEngine.oracleEe}.
 */
export interface OracleEeInstanceEngineProps extends OracleInstanceEngineProps {
}

class OracleEeInstanceEngine extends OracleInstanceEngineBase {
  constructor(version?: OracleEngineVersion) {
    super({
      engineType: 'oracle-ee',
      version: version
        ? {
          fullVersion: version.oracleFullVersion,
          majorVersion: version.oracleMajorVersion,
        }
        : undefined,
    });
  }
}

/**
 * The versions for the SQL Server instance engines
 * (those returned by {@link DatabaseInstanceEngine.sqlServerSe},
 * {@link DatabaseInstanceEngine.sqlServerEx}, {@link DatabaseInstanceEngine.sqlServerWeb}
 * and {@link DatabaseInstanceEngine.sqlServerEe}).
 */
export class SqlServerEngineVersion {
  /** Version "11.00" (only a major version, without a specific minor version). */
  public static readonly VER_11 = SqlServerEngineVersion.of('11.00', '11.00');
  /** Version "11.00.5058.0.v1". */
  public static readonly VER_11_00_5058_0_V1 = SqlServerEngineVersion.of('11.00.5058.0.v1', '11.00');
  /** Version "11.00.6020.0.v1". */
  public static readonly VER_11_00_6020_0_V1 = SqlServerEngineVersion.of('11.00.6020.0.v1', '11.00');
  /** Version "11.00.6594.0.v1". */
  public static readonly VER_11_00_6594_0_V1 = SqlServerEngineVersion.of('11.00.6594.0.v1', '11.00');
  /** Version "11.00.7462.6.v1". */
  public static readonly VER_11_00_7462_6_V1 = SqlServerEngineVersion.of('11.00.7462.6.v1', '11.00');
  /** Version "11.00.7493.4.v1". */
  public static readonly VER_11_00_7493_4_V1 = SqlServerEngineVersion.of('11.00.7493.4.v1', '11.00');

  /** Version "12.00" (only a major version, without a specific minor version). */
  public static readonly VER_12 = SqlServerEngineVersion.of('12.00', '12.00');
  /** Version "12.00.5000.0.v1". */
  public static readonly VER_12_00_5000_0_V1 = SqlServerEngineVersion.of('12.00.5000.0.v1', '12.00');
  /** Version "12.00.5546.0.v1". */
  public static readonly VER_12_00_5546_0_V1 = SqlServerEngineVersion.of('12.00.5546.0.v1', '12.00');
  /** Version "12.00.5571.0.v1". */
  public static readonly VER_12_00_5571_0_V1 = SqlServerEngineVersion.of('12.00.5571.0.v1', '12.00');
  /** Version "12.00.6293.0.v1". */
  public static readonly VER_12_00_6293_0_V1 = SqlServerEngineVersion.of('12.00.6293.0.v1', '12.00');
  /** Version "12.00.6329.1.v1". */
  public static readonly VER_12_00_6329_1_V1 = SqlServerEngineVersion.of('12.00.6329.1.v1', '12.00');

  /** Version "13.00" (only a major version, without a specific minor version). */
  public static readonly VER_13 = SqlServerEngineVersion.of('13.00', '13.00');
  /** Version "13.00.2164.0.v1". */
  public static readonly VER_13_00_2164_0_V1 = SqlServerEngineVersion.of('13.00.2164.0.v1', '13.00');
  /** Version "13.00.4422.0.v1". */
  public static readonly VER_13_00_4422_0_V1 = SqlServerEngineVersion.of('13.00.4422.0.v1', '13.00');
  /** Version "13.00.4451.0.v1". */
  public static readonly VER_13_00_4451_0_V1 = SqlServerEngineVersion.of('13.00.4451.0.v1', '13.00');
  /** Version "13.00.4466.4.v1". */
  public static readonly VER_13_00_4466_4_V1 = SqlServerEngineVersion.of('13.00.4466.4.v1', '13.00');
  /** Version "13.00.4522.0.v1". */
  public static readonly VER_13_00_4522_0_V1 = SqlServerEngineVersion.of('13.00.4522.0.v1', '13.00');
  /** Version "13.00.5216.0.v1". */
  public static readonly VER_13_00_5216_0_V1 = SqlServerEngineVersion.of('13.00.5216.0.v1', '13.00');
  /** Version "13.00.5292.0.v1". */
  public static readonly VER_13_00_5292_0_V1 = SqlServerEngineVersion.of('13.00.5292.0.v1', '13.00');
  /** Version "13.00.5366.0.v1". */
  public static readonly VER_13_00_5366_0_V1 = SqlServerEngineVersion.of('13.00.5366.0.v1', '13.00');
  /** Version "13.00.5426.0.v1". */
  public static readonly VER_13_00_5426_0_V1 = SqlServerEngineVersion.of('13.00.5426.0.v1', '13.00');
  /** Version "13.00.5598.27.v1". */
  public static readonly VER_13_00_5598_27_V1 = SqlServerEngineVersion.of('13.00.5598.27.v1', '13.00');
  /** Version "13.00.5820.21.v1". */
  public static readonly VER_13_00_5820_21_V1 = SqlServerEngineVersion.of('13.00.5820.21.v1', '13.00');

  /** Version "14.00" (only a major version, without a specific minor version). */
  public static readonly VER_14 = SqlServerEngineVersion.of('14.00', '14.00');
  /** Version "14.00.1000.169.v1". */
  public static readonly VER_14_00_1000_169_V1 = SqlServerEngineVersion.of('14.00.1000.169.v1', '14.00');
  /** Version "14.00.3015.40.v1". */
  public static readonly VER_14_00_3015_40_V1 = SqlServerEngineVersion.of('14.00.3015.40.v1', '14.00');
  /** Version "14.00.3035.2.v1". */
  public static readonly VER_14_00_3035_2_V1 = SqlServerEngineVersion.of('14.00.3035.2.v1', '14.00');
  /** Version "14.00.3049.1.v1". */
  public static readonly VER_14_00_3049_1_V1 = SqlServerEngineVersion.of('14.00.3049.1.v1', '14.00');
  /** Version "14.00.3192.2.v1". */
  public static readonly VER_14_00_3192_2_V1 = SqlServerEngineVersion.of('14.00.3192.2.v1', '14.00');
  /** Version "14.00.3223.3.v1". */
  public static readonly VER_14_00_3223_3_V1 = SqlServerEngineVersion.of('14.00.3223.3.v1', '14.00');
  /** Version "14.00.3281.6.v1". */
  public static readonly VER_14_00_3281_6_V1 = SqlServerEngineVersion.of('14.00.3281.6.v1', '14.00');
  /** Version "14.00.3294.2.v1". */
  public static readonly VER_14_00_3294_2_V1 = SqlServerEngineVersion.of('14.00.3294.2.v1', '14.00');
  /** Version "14.00.3356.20.v1". */
  public static readonly VER_14_00_3356_20_V1 = SqlServerEngineVersion.of('14.00.3356.20.v1', '14.00');

  /** Version "15.00" (only a major version, without a specific minor version). */
  public static readonly VER_15 = SqlServerEngineVersion.of('15.00', '15.00');
  /** Version "15.00.4043.16.v1". */
  public static readonly VER_15_00_4043_16_V1 = SqlServerEngineVersion.of('15.00.4043.16.v1', '15.00');
  /** Version "15.00.4043.23.v1". */
  public static readonly VER_15_00_4043_23_V1 = SqlServerEngineVersion.of('15.00.4043.23.v1', '15.00');

  /**
   * Create a new SqlServerEngineVersion with an arbitrary version.
   *
   * @param sqlServerFullVersion the full version string,
   *   for example "15.00.3049.1.v1"
   * @param sqlServerMajorVersion the major version of the engine,
   *   for example "15.00"
   */
  public static of(sqlServerFullVersion: string, sqlServerMajorVersion: string): SqlServerEngineVersion {
    return new SqlServerEngineVersion(sqlServerFullVersion, sqlServerMajorVersion);
  }

  /** The full version string, for example, "15.00.3049.1.v1". */
  public readonly sqlServerFullVersion: string;
  /** The major version of the engine, for example, "15.00". */
  public readonly sqlServerMajorVersion: string;

  private constructor(sqlServerFullVersion: string, sqlServerMajorVersion: string) {
    this.sqlServerFullVersion = sqlServerFullVersion;
    this.sqlServerMajorVersion = sqlServerMajorVersion;
  }
}

interface SqlServerInstanceEngineProps {
  /** The exact version of the engine to use. */
  readonly version: SqlServerEngineVersion;
}

interface SqlServerInstanceEngineBaseProps {
  readonly engineType: string;
  readonly version?: SqlServerEngineVersion;
}

abstract class SqlServerInstanceEngineBase extends InstanceEngineBase {
  constructor(props: SqlServerInstanceEngineBaseProps) {
    super({
      ...props,
      singleUserRotationApplication: secretsmanager.SecretRotationApplication.SQLSERVER_ROTATION_SINGLE_USER,
      multiUserRotationApplication: secretsmanager.SecretRotationApplication.SQLSERVER_ROTATION_MULTI_USER,
      version: props.version
        ? {
          fullVersion: props.version.sqlServerFullVersion,
          majorVersion: props.version.sqlServerMajorVersion,
        }
        : undefined,
      parameterGroupFamily: props.version
        // for some reason, even though SQL Server major versions usually end in '.00',
        // the ParameterGroup family has to end in '.0'
        ? `${props.engineType}-${props.version.sqlServerMajorVersion.endsWith('.00')
          ? props.version.sqlServerMajorVersion.slice(0, -1)
          : props.version.sqlServerMajorVersion}`
        : undefined,
      features: {
        s3Import: 'S3_INTEGRATION',
        s3Export: 'S3_INTEGRATION',
      },
    });
  }

  public bindToInstance(scope: Construct, options: InstanceEngineBindOptions): InstanceEngineConfig {
    const config = super.bindToInstance(scope, options);

    let optionGroup = options.optionGroup;
    const s3Role = options.s3ImportRole ?? options.s3ExportRole;
    if (s3Role) {
      if (options.s3ImportRole && options.s3ExportRole && options.s3ImportRole !== options.s3ExportRole) {
        throw new Error('S3 import and export roles must be the same for SQL Server engines');
      }

      if (!optionGroup) {
        optionGroup = new OptionGroup(scope, 'InstanceOptionGroup', {
          engine: this,
          configurations: [],
        });
      }
      // https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Appendix.SQLServer.Options.BackupRestore.html
      optionGroup.addConfiguration({
        name: 'SQLSERVER_BACKUP_RESTORE',
        settings: { IAM_ROLE_ARN: s3Role.roleArn },
      });
    }

    return {
      ...config,
      optionGroup,
    };
  }

  protected get supportsTimezone() { return true; }
}

/**
 * Properties for SQL Server Standard Edition instance engines.
 * Used in {@link DatabaseInstanceEngine.sqlServerSe}.
 */
export interface SqlServerSeInstanceEngineProps extends SqlServerInstanceEngineProps {
}

class SqlServerSeInstanceEngine extends SqlServerInstanceEngineBase {
  constructor(version?: SqlServerEngineVersion) {
    super({
      engineType: 'sqlserver-se',
      version,
    });
  }
}

/**
 * Properties for SQL Server Express Edition instance engines.
 * Used in {@link DatabaseInstanceEngine.sqlServerEx}.
 */
export interface SqlServerExInstanceEngineProps extends SqlServerInstanceEngineProps {
}

class SqlServerExInstanceEngine extends SqlServerInstanceEngineBase {
  constructor(version?: SqlServerEngineVersion) {
    super({
      engineType: 'sqlserver-ex',
      version,
    });
  }
}

/**
 * Properties for SQL Server Web Edition instance engines.
 * Used in {@link DatabaseInstanceEngine.sqlServerWeb}.
 */
export interface SqlServerWebInstanceEngineProps extends SqlServerInstanceEngineProps {
}

class SqlServerWebInstanceEngine extends SqlServerInstanceEngineBase {
  constructor(version?: SqlServerEngineVersion) {
    super({
      engineType: 'sqlserver-web',
      version,
    });
  }
}

/**
 * Properties for SQL Server Enterprise Edition instance engines.
 * Used in {@link DatabaseInstanceEngine.sqlServerEe}.
 */
export interface SqlServerEeInstanceEngineProps extends SqlServerInstanceEngineProps {
}

class SqlServerEeInstanceEngine extends SqlServerInstanceEngineBase {
  constructor(version?: SqlServerEngineVersion) {
    super({
      engineType: 'sqlserver-ee',
      version,
    });
  }
}

/**
 * A database instance engine. Provides mapping to DatabaseEngine used for
 * secret rotation.
 */
export class DatabaseInstanceEngine {
  /**
   * The unversioned 'mariadb' instance engine.
   *
   * @deprecated using unversioned engines is an availability risk.
   *   We recommend using versioned engines created using the {@link mariaDb()} method
   */
  public static readonly MARIADB: IInstanceEngine = new MariaDbInstanceEngine();

  /**
   * The unversioned 'mysql' instance engine.
   *
   * @deprecated using unversioned engines is an availability risk.
   *   We recommend using versioned engines created using the {@link mysql()} method
   */
  public static readonly MYSQL: IInstanceEngine = new MySqlInstanceEngine();

  /**
   * The unversioned 'oracle-ee' instance engine.
   *
   * @deprecated using unversioned engines is an availability risk.
   *   We recommend using versioned engines created using the {@link oracleEe()} method
   */
  public static readonly ORACLE_EE: IInstanceEngine = new OracleEeInstanceEngine();

  /**
   * The unversioned 'oracle-se2' instance engine.
   *
   * @deprecated using unversioned engines is an availability risk.
   *   We recommend using versioned engines created using the {@link oracleSe2()} method
   */
  public static readonly ORACLE_SE2: IInstanceEngine = new OracleSe2InstanceEngine();

  /**
   * The unversioned 'oracle-se1' instance engine.
   *
   * @deprecated instances can no longer be created with this engine. See https://forums.aws.amazon.com/ann.jspa?annID=7341
   */
  public static readonly ORACLE_SE1: IInstanceEngine = new OracleSe1InstanceEngine();

  /**
   * The unversioned 'oracle-se' instance engine.
   *
   * @deprecated instances can no longer be created with this engine. See https://forums.aws.amazon.com/ann.jspa?annID=7341
   */
  public static readonly ORACLE_SE: IInstanceEngine = new OracleSeInstanceEngine();

  /**
   * The unversioned 'postgres' instance engine.
   *
   * @deprecated using unversioned engines is an availability risk.
   *   We recommend using versioned engines created using the {@link postgres()} method
   */
  public static readonly POSTGRES: IInstanceEngine = new PostgresInstanceEngine();

  /**
   * The unversioned 'sqlserver-ee' instance engine.
   *
   * @deprecated using unversioned engines is an availability risk.
   *   We recommend using versioned engines created using the {@link sqlServerEe()} method
   */
  public static readonly SQL_SERVER_EE: IInstanceEngine = new SqlServerEeInstanceEngine();

  /**
   * The unversioned 'sqlserver-se' instance engine.
   *
   * @deprecated using unversioned engines is an availability risk.
   *   We recommend using versioned engines created using the {@link sqlServerSe()} method
   */
  public static readonly SQL_SERVER_SE: IInstanceEngine = new SqlServerSeInstanceEngine();

  /**
   * The unversioned 'sqlserver-ex' instance engine.
   *
   * @deprecated using unversioned engines is an availability risk.
   *   We recommend using versioned engines created using the {@link sqlServerEx()} method
   */
  public static readonly SQL_SERVER_EX: IInstanceEngine = new SqlServerExInstanceEngine();

  /**
   * The unversioned 'sqlserver-web' instance engine.
   *
   * @deprecated using unversioned engines is an availability risk.
   *   We recommend using versioned engines created using the {@link sqlServerWeb()} method
   */
  public static readonly SQL_SERVER_WEB: IInstanceEngine = new SqlServerWebInstanceEngine();

  /** Creates a new MariaDB instance engine. */
  public static mariaDb(props: MariaDbInstanceEngineProps): IInstanceEngine {
    return new MariaDbInstanceEngine(props.version);
  }

  /** Creates a new MySQL instance engine. */
  public static mysql(props: MySqlInstanceEngineProps): IInstanceEngine {
    return new MySqlInstanceEngine(props.version);
  }

  /** Creates a new PostgreSQL instance engine. */
  public static postgres(props: PostgresInstanceEngineProps): IInstanceEngine {
    return new PostgresInstanceEngine(props.version);
  }

  /**
   * Creates a new Oracle Standard Edition instance engine.
   * @deprecated instances can no longer be created with this engine. See https://forums.aws.amazon.com/ann.jspa?annID=7341
   */
  public static oracleSe(props: OracleSeInstanceEngineProps): IInstanceEngine {
    return new OracleSeInstanceEngine(props.version);
  }

  /**
   * Creates a new Oracle Standard Edition 1 instance engine.
   * @deprecated instances can no longer be created with this engine. See https://forums.aws.amazon.com/ann.jspa?annID=7341
   */
  public static oracleSe1(props: OracleSe1InstanceEngineProps): IInstanceEngine {
    return new OracleSe1InstanceEngine(props.version);
  }

  /** Creates a new Oracle Standard Edition 1 instance engine. */
  public static oracleSe2(props: OracleSe2InstanceEngineProps): IInstanceEngine {
    return new OracleSe2InstanceEngine(props.version);
  }

  /** Creates a new Oracle Enterprise Edition instance engine. */
  public static oracleEe(props: OracleEeInstanceEngineProps): IInstanceEngine {
    return new OracleEeInstanceEngine(props.version);
  }

  /** Creates a new SQL Server Standard Edition instance engine. */
  public static sqlServerSe(props: SqlServerSeInstanceEngineProps): IInstanceEngine {
    return new SqlServerSeInstanceEngine(props.version);
  }

  /** Creates a new SQL Server Express Edition instance engine. */
  public static sqlServerEx(props: SqlServerExInstanceEngineProps): IInstanceEngine {
    return new SqlServerExInstanceEngine(props.version);
  }

  /** Creates a new SQL Server Web Edition instance engine. */
  public static sqlServerWeb(props: SqlServerWebInstanceEngineProps): IInstanceEngine {
    return new SqlServerWebInstanceEngine(props.version);
  }

  /** Creates a new SQL Server Enterprise Edition instance engine. */
  public static sqlServerEe(props: SqlServerEeInstanceEngineProps): IInstanceEngine {
    return new SqlServerEeInstanceEngine(props.version);
  }
}
