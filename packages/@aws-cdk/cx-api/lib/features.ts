// --------------------------------------------------------------------------------
// This file defines context keys that enable certain features that are
// implemented behind a flag in order to preserve backwards compatibility for
// existing apps. When a new app is initialized through `cdk init`, the CLI will
// automatically add enable these features by adding them to the generated
// `cdk.json` file. In the next major release of the CDK, these feature flags
// will be removed and will become the default behavior.
// See https://github.com/aws/aws-cdk-rfcs/blob/master/text/0055-feature-flags.md
// --------------------------------------------------------------------------------

/**
 * If this is set, multiple stacks can use the same stack name (e.g. deployed to
 * different environments). This means that the name of the synthesized template
 * file will be based on the construct path and not on the defined `stackName`
 * of the stack.
 *
 * This is a "future flag": the feature is disabled by default for backwards
 * compatibility, but new projects created using `cdk init` will have this
 * enabled through the generated `cdk.json`.
 */
export const ENABLE_STACK_NAME_DUPLICATES_CONTEXT = '@aws-cdk/core:enableStackNameDuplicates';

/**
 * IF this is set, `cdk diff` will always exit with 0.
 *
 * Use `cdk diff --fail` to exit with 1 if there's a diff.
 */
export const ENABLE_DIFF_NO_FAIL_CONTEXT = 'aws-cdk:enableDiffNoFail';
/** @deprecated use `ENABLE_DIFF_NO_FAIL_CONTEXT` */
export const ENABLE_DIFF_NO_FAIL = ENABLE_DIFF_NO_FAIL_CONTEXT;

/**
 * Switch to new stack synthesis method which enable CI/CD
 */
export const NEW_STYLE_STACK_SYNTHESIS_CONTEXT = '@aws-cdk/core:newStyleStackSynthesis';

/**
 * Name exports based on the construct paths relative to the stack, rather than the global construct path
 *
 * Combined with the stack name this relative construct path is good enough to
 * ensure uniqueness, and makes the export names robust against refactoring
 * the location of the stack in the construct tree (specifically, moving the Stack
 * into a Stage).
 */
export const STACK_RELATIVE_EXPORTS_CONTEXT = '@aws-cdk/core:stackRelativeExports';

/**
 * DockerImageAsset properly supports `.dockerignore` files by default
 *
 * If this flag is not set, the default behavior for `DockerImageAsset` is to use
 * glob semantics for `.dockerignore` files. If this flag is set, the default behavior
 * is standard Docker ignore semantics.
 *
 * This is a feature flag as the old behavior was technically incorrect but
 * users may have come to depend on it.
 */
export const DOCKER_IGNORE_SUPPORT = '@aws-cdk/aws-ecr-assets:dockerIgnoreSupport';

/**
 * Secret.secretName for an "owned" secret will attempt to parse the secretName from the ARN,
 * rather than the default full resource name, which includes the SecretsManager suffix.
 *
 * If this flag is not set, Secret.secretName will include the SecretsManager suffix, which cannot be directly
 * used by SecretsManager.DescribeSecret, and must be parsed by the user first (e.g., Fn:Join, Fn:Select, Fn:Split).
 */
export const SECRETS_MANAGER_PARSE_OWNED_SECRET_NAME = '@aws-cdk/aws-secretsmanager:parseOwnedSecretName';

/**
 * KMS Keys start with a default key policy that grants the account access to administer the key,
 * mirroring the behavior of the KMS SDK/CLI/Console experience. Users may override the default key
 * policy by specifying their own.
 *
 * If this flag is not set, the default key policy depends on the setting of the `trustAccountIdentities`
 * flag. If false (the default, for backwards-compatibility reasons), the default key policy somewhat
 * resemebles the default admin key policy, but with the addition of 'GenerateDataKey' permissions. If
 * true, the policy matches what happens when this feature flag is set.
 *
 * Additionally, if this flag is not set and the user supplies a custom key policy, this will be appended
 * to the key's default policy (rather than replacing it).
 */
export const KMS_DEFAULT_KEY_POLICIES = '@aws-cdk/aws-kms:defaultKeyPolicies';

/**
 * Change the old 's3:PutObject*' permission to 's3:PutObject' on Bucket,
 * as the former includes 's3:PutObjectAcl',
 * which could be used to grant read/write object access to IAM principals in other accounts.
 * Use a feature flag to make sure existing customers who might be relying
 * on the overly-broad permissions are not broken.
 */
export const S3_GRANT_WRITE_WITHOUT_ACL = '@aws-cdk/aws-s3:grantWriteWithoutAcl';

/**
 * ApplicationLoadBalancedServiceBase, ApplicationMultipleTargetGroupServiceBase,
 * NetworkLoadBalancedServiceBase, NetworkMultipleTargetGroupServiceBase, and
 * QueueProcessingServiceBase currently determine a default value for the desired count of
 * a CfnService if a desiredCount is not provided.
 *
 * If this flag is not set, the default behaviour for CfnService.desiredCount is to set a
 * desiredCount of 1, if one is not provided. If true, a default will not be defined for
 * CfnService.desiredCount and as such desiredCount will be undefined, if one is not provided.
 *
 * This is a feature flag as the old behavior was technically incorrect, but
 * users may have come to depend on it.
 */
export const ECS_REMOVE_DEFAULT_DESIRED_COUNT = '@aws-cdk/aws-ecs-patterns:removeDefaultDesiredCount';

/**
 * ServerlessCluster.clusterIdentifier currently can has uppercase letters,
 * and ServerlessCluster pass it through to CfnDBCluster.dbClusterIdentifier.
 * The identifier is saved as lowercase string in AWS and is resolved as original string in CloudFormation.
 *
 * If this flag is not set, original value that one set to ServerlessCluster.clusterIdentifier
 * is passed to CfnDBCluster.dbClusterIdentifier.
 * If this flag is true, ServerlessCluster.clusterIdentifier is converted into a string containing
 * only lowercase characters by the `toLowerCase` function and passed to CfnDBCluster.dbClusterIdentifier.
 *
 * This feature flag make correct the ServerlessCluster.clusterArn when
 * clusterIdentifier contains a Upper case letters.
 */
export const RDS_LOWERCASE_DB_IDENTIFIER = '@aws-cdk/aws-rds:lowercaseDbIdentifier';

/**
 * Change the behavior of cross stack references, instead of creating and consuming
 * Cloudformation exports, use SSM parameter store to put values to be consumed as stack
 * parameters
 */
export const LOOSE_CROSS_STACK_REF = '@aws-cdk/core:looseCrossStackRefs';

/**
 * This map includes context keys and values for feature flags that enable
 * capabilities "from the future", which we could not introduce as the default
 * behavior due to backwards compatibility for existing projects.
 *
 * New projects generated through `cdk init` will include these flags in their
 * generated `cdk.json` file.
 *
 * When we release the next major version of the CDK, we will flip the logic of
 * these features and clean up the `cdk.json` generated by `cdk init`.
 *
 * Tests must cover the default (disabled) case and the future (enabled) case.
 */
export const FUTURE_FLAGS: { [key: string]: any } = {
  [ENABLE_STACK_NAME_DUPLICATES_CONTEXT]: 'true',
  [ENABLE_DIFF_NO_FAIL_CONTEXT]: 'true',
  [STACK_RELATIVE_EXPORTS_CONTEXT]: 'true',
  [DOCKER_IGNORE_SUPPORT]: true,
  [SECRETS_MANAGER_PARSE_OWNED_SECRET_NAME]: true,
  [KMS_DEFAULT_KEY_POLICIES]: true,
  [S3_GRANT_WRITE_WITHOUT_ACL]: true,
  [ECS_REMOVE_DEFAULT_DESIRED_COUNT]: true,
  [RDS_LOWERCASE_DB_IDENTIFIER]: true,
  [LOOSE_CROSS_STACK_REF]: true,

  // We will advertise this flag when the feature is complete
  // [NEW_STYLE_STACK_SYNTHESIS_CONTEXT]: 'true',
};

/**
 * The list of future flags that are now expired. This is going to be used to identify
 * and block usages of old feature flags in the new major version of CDK.
 */
export const FUTURE_FLAGS_EXPIRED: string[] = [
];

/**
 * The set of defaults that should be applied if the feature flag is not
 * explicitly configured.
 */
const FUTURE_FLAGS_DEFAULTS: { [key: string]: boolean } = {
  [ENABLE_STACK_NAME_DUPLICATES_CONTEXT]: false,
  [ENABLE_DIFF_NO_FAIL_CONTEXT]: false,
  [STACK_RELATIVE_EXPORTS_CONTEXT]: false,
  [NEW_STYLE_STACK_SYNTHESIS_CONTEXT]: false,
  [DOCKER_IGNORE_SUPPORT]: false,
  [SECRETS_MANAGER_PARSE_OWNED_SECRET_NAME]: false,
  [KMS_DEFAULT_KEY_POLICIES]: false,
  [S3_GRANT_WRITE_WITHOUT_ACL]: false,
  [ECS_REMOVE_DEFAULT_DESIRED_COUNT]: false,
  [RDS_LOWERCASE_DB_IDENTIFIER]: false,
  [LOOSE_CROSS_STACK_REF]: false,
};

export function futureFlagDefault(flag: string): boolean {
  return FUTURE_FLAGS_DEFAULTS[flag];
}
