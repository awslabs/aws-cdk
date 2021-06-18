import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';
import { RemovalPolicy } from '@aws-cdk/core';
import { DatabaseSecret } from '../database-secret';
import { IEngine } from '../engine';
import { Credentials } from '../props';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '@aws-cdk/core';

/**
 * The default set of characters we exclude from generated passwords for database users.
 * It's a combination of characters that have a tendency to cause problems in shell scripts,
 * some engine-specific characters (for example, Oracle doesn't like '@' in its passwords),
 * and some that trip up other services, like DMS.
 *
 * This constant is private to the RDS module.
 */
export const DEFAULT_PASSWORD_EXCLUDE_CHARS = " %+~`#$&*()|[]{}:;<>?!'/@\"\\";

/** Common base of `DatabaseInstanceProps` and `DatabaseClusterBaseProps` that has only the S3 props */
export interface DatabaseS3ImportExportProps {
  readonly s3ImportRole?: iam.IRole;
  readonly s3ImportBuckets?: s3.IBucket[];
  readonly s3ExportRole?: iam.IRole;
  readonly s3ExportBuckets?: s3.IBucket[];
}

/**
 * Validates the S3 import/export props and returns the import/export roles, if any.
 * If `combineRoles` is true, will reuse the import role for export (or vice versa) if possible.
 *
 * Notably, `combineRoles` is (by default) set to true for instances, but false for clusters.
 * This is because the `combineRoles` functionality is most applicable to instances and didn't exist
 * for the initial clusters implementation. To maintain backwards compatibility, it is set to false for clusters.
 */
export function setupS3ImportExport(
    scope: Construct,
    props: DatabaseS3ImportExportProps,
    combineRoles?: boolean): { s3ImportRole?: iam.IRole, s3ExportRole?: iam.IRole } {
  let s3ImportRole = props.s3ImportRole;
  let s3ExportRole = props.s3ExportRole;

  if (props.s3ImportBuckets && props.s3ImportBuckets.length > 0) {
    if (props.s3ImportRole) {
      throw new Error('Only one of s3ImportRole or s3ImportBuckets must be specified, not both.');
    }

    s3ImportRole = (combineRoles && s3ExportRole) ? s3ExportRole : new iam.Role(scope, 'S3ImportRole', {
      assumedBy: new iam.ServicePrincipal('rds.amazonaws.com'),
    });
    for (const bucket of props.s3ImportBuckets) {
      bucket.grantRead(s3ImportRole);
    }
  }

  if (props.s3ExportBuckets && props.s3ExportBuckets.length > 0) {
    if (props.s3ExportRole) {
      throw new Error('Only one of s3ExportRole or s3ExportBuckets must be specified, not both.');
    }

    s3ExportRole = (combineRoles && s3ImportRole) ? s3ImportRole : new iam.Role(scope, 'S3ExportRole', {
      assumedBy: new iam.ServicePrincipal('rds.amazonaws.com'),
    });
    for (const bucket of props.s3ExportBuckets) {
      bucket.grantReadWrite(s3ExportRole);
    }
  }

  return { s3ImportRole, s3ExportRole };
}

export function engineDescription(engine: IEngine) {
  return engine.engineType + (engine.engineVersion?.fullVersion ? `-${engine.engineVersion.fullVersion}` : '');
}

/**
 * By default, deletion protection is disabled.
 * Enable if explicitly provided or if the RemovalPolicy has been set to RETAIN
 */
export function defaultDeletionProtection(deletionProtection?: boolean, removalPolicy?: RemovalPolicy): boolean | undefined {
  return deletionProtection ?? (removalPolicy === RemovalPolicy.RETAIN ? true : undefined);
}

/**
 * Renders the credentials for an instance or cluster
 */
export function renderCredentials(scope: Construct, engine: IEngine, credentials?: Credentials): Credentials {
  let renderedCredentials = credentials ?? Credentials.fromUsername(engine.defaultUsername ?? 'admin'); // For backwards compatibilty

  if (!renderedCredentials.secret && !renderedCredentials.password) {
    renderedCredentials = Credentials.fromSecret(
      new DatabaseSecret(scope, 'Secret', {
        username: renderedCredentials.username,
        secretName: renderedCredentials.secretName,
        encryptionKey: renderedCredentials.encryptionKey,
        excludeCharacters: renderedCredentials.excludeCharacters,
        // if username must be referenced as a string we can safely replace the
        // secret when customization options are changed without risking a replacement
        replaceOnPasswordCriteriaChanges: credentials?.usernameAsString,
      }),
      // pass username if it must be referenced as a string
      credentials?.usernameAsString ? renderedCredentials.username : undefined,
    );
  }

  return renderedCredentials;
}

/**
 * The RemovalPolicy that should be applied to a "helper" resource, if the base resource has the given removal policy
 *
 * - For Clusters, this determines the RemovalPolicy for Instances/SubnetGroups.
 * - For Instances, this determines the RemovalPolicy for SubnetGroups.
 *
 * If the basePolicy is:
 *
 *  DESTROY or SNAPSHOT -> DESTROY (snapshot is good enough to recreate)
 *  RETAIN              -> RETAIN  (anything else will lose data or fail to deploy)
 *  (undefined)         -> DESTROY (base policy is assumed to be SNAPSHOT)
 */
export function helperRemovalPolicy(basePolicy?: RemovalPolicy): RemovalPolicy {
  return basePolicy === RemovalPolicy.RETAIN
    ? RemovalPolicy.RETAIN
    : RemovalPolicy.DESTROY;
}

/**
 * Return a given value unless it's the same as another value
 */
export function renderUnless<A>(value: A, suppressValue: A): A | undefined {
  return value === suppressValue ? undefined : value;
}
