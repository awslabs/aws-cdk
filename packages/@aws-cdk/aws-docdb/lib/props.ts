import * as kms from '@aws-cdk/aws-kms';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import { Duration, SecretValue } from '@aws-cdk/core';

/**
 * Backup configuration for DocumentDB databases
 *
 * @default - The retention period for automated backups is 1 day.
 * The preferred backup window will be a 30-minute window selected at random
 * from an 8-hour block of time for each AWS Region.
 * @see https://docs.aws.amazon.com/documentdb/latest/developerguide/backup-restore.db-cluster-snapshots.html#backup-restore.backup-window
 */
export interface BackupProps {

  /**
   * How many days to retain the backup
   */
  readonly retention: Duration;

  /**
   * A daily time range in 24-hours UTC format in which backups preferably execute.
   *
   * Must be at least 30 minutes long.
   *
   * Example: '01:00-02:00'
   *
   * @default - a 30-minute window selected at random from an 8-hour block of
   * time for each AWS Region. To see the time blocks available, see
   * https://docs.aws.amazon.com/documentdb/latest/developerguide/backup-restore.db-cluster-snapshots.html#backup-restore.backup-window
   */
  readonly preferredWindow?: string;
}

/**
 * Login credentials for a database cluster
 */
export interface Login {
  /**
   * Username
   */
  readonly username: string;
  /**
   * Password
   *
   * Do not put passwords in your CDK code directly.
   *
   * @default a Secrets Manager generated password
   */
  readonly password?: SecretValue;
  /**
   * KMS encryption key to encrypt the generated secret.
   *
   * @default default master key
   */
  readonly kmsKey?: kms.IKey;
}

/**
 * Options to add the multi user rotation
 */
export interface RotationMultiUserOptions {
  /**
   * The secret to rotate. It must be a JSON string with the following format:
   * ```
   * {
   *   "engine": <required: must be set to 'mongo'>,
   *   "host": <required: instance host name>,
   *   "username": <required: username>,
   *   "password": <required: password>,
   *   "dbname": <optional: database name>,
   *   "port": <optional: if not specified, default port 27017 will be used>,
   *   "masterarn": <required: the arn of the master secret which will be used to create users/change passwords>
   *   "ssl": <optional: if not specified, defaults to false. This must be true if being used for DocumentDB rotations
   *          where the cluster has TLS enabled>
   * }
   * ```
   */
  readonly secret: secretsmanager.ISecret;

  /**
   * Specifies the number of days after the previous rotation before
   * Secrets Manager triggers the next automatic rotation.
   *
   * @default Duration.days(30)
   */
  readonly automaticallyAfter?: Duration;
}
