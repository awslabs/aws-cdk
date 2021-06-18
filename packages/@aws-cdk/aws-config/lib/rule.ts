import * as events from '@aws-cdk/aws-events';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import { IResource, Lazy, Resource } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnConfigRule } from './config.generated';

/**
 * Interface representing an AWS Config rule
 */
export interface IRule extends IResource {
  /**
   * The name of the rule.
   *
   * @attribute
   */
  readonly configRuleName: string;

  /**
   * Defines an EventBridge event rule which triggers for rule events. Use
   * `rule.addEventPattern(pattern)` to specify a filter.
   */
  onEvent(id: string, options?: events.OnEventOptions): events.Rule;

  /**
   * Defines a EventBridge event rule which triggers for rule compliance events.
   */
  onComplianceChange(id: string, options?: events.OnEventOptions): events.Rule;

  /**
   * Defines a EventBridge event rule which triggers for rule re-evaluation status events.
   */
  onReEvaluationStatus(id: string, options?: events.OnEventOptions): events.Rule;
}

/**
 * A new or imported rule.
 */
abstract class RuleBase extends Resource implements IRule {
  public abstract readonly configRuleName: string;

  /**
   * Defines an EventBridge event rule which triggers for rule events. Use
   * `rule.addEventPattern(pattern)` to specify a filter.
   */
  public onEvent(id: string, options: events.OnEventOptions = {}) {
    const rule = new events.Rule(this, id, options);
    rule.addEventPattern({
      source: ['aws.config'],
      detail: {
        configRuleName: [this.configRuleName],
      },
    });
    rule.addTarget(options.target);
    return rule;
  }

  /**
   * Defines an EventBridge event rule which triggers for rule compliance events.
   */
  public onComplianceChange(id: string, options: events.OnEventOptions = {}): events.Rule {
    const rule = this.onEvent(id, options);
    rule.addEventPattern({
      detailType: ['Config Rules Compliance Change'],
    });
    return rule;
  }

  /**
   * Defines an EventBridge event rule which triggers for rule re-evaluation status events.
   */
  public onReEvaluationStatus(id: string, options: events.OnEventOptions = {}): events.Rule {
    const rule = this.onEvent(id, options);
    rule.addEventPattern({
      detailType: ['Config Rules Re-evaluation Status'],
    });
    return rule;
  }
}

/**
 * A new managed or custom rule.
 */
abstract class RuleNew extends RuleBase {
  /**
   * Imports an existing rule.
   *
   * @param configRuleName the name of the rule
   */
  public static fromConfigRuleName(scope: Construct, id: string, configRuleName: string): IRule {
    class Import extends RuleBase {
      public readonly configRuleName = configRuleName;
    }

    return new Import(scope, id);
  }

  /**
   * The arn of the rule.
   */
  public abstract readonly configRuleArn: string;

  /**
   * The id of the rule.
   */
  public abstract readonly configRuleId: string;

  /**
   * The compliance status of the rule.
   */
  public abstract readonly configRuleComplianceType: string;

  protected ruleScope?: RuleScope;
  protected isManaged?: boolean;
  protected isCustomWithChanges?: boolean;
}

/**
 * Determines which resources trigger an evaluation of an AWS Config rule.
 */
export class RuleScope {
  /** restricts scope of changes to a specific resource type or resource identifier */
  public static fromResource(resourceType: ResourceType, resourceId?: string) {
    return new RuleScope(resourceId, [resourceType]);
  }
  /** restricts scope of changes to specific resource types */
  public static fromResources(resourceTypes: ResourceType[]) {
    return new RuleScope(undefined, resourceTypes);
  }
  /** restricts scope of changes to a specific tag */
  public static fromTag(key: string, value?: string) {
    return new RuleScope(undefined, undefined, key, value);
  }

  /** Resource types that will trigger evaluation of a rule */
  public readonly resourceTypes?: ResourceType[];

  /** ID of the only AWS resource that will trigger evaluation of a rule */
  public readonly resourceId?: string;

  /** tag key applied to resources that will trigger evaluation of a rule  */
  public readonly key?: string;

  /** tag value applied to resources that will trigger evaluation of a rule */
  public readonly value?: string;

  private constructor(resourceId?: string, resourceTypes?: ResourceType[], tagKey?: string, tagValue?: string) {
    this.resourceTypes = resourceTypes;
    this.resourceId = resourceId;
    this.key = tagKey;
    this.value = tagValue;
  }
}

/**
 * The maximum frequency at which the AWS Config rule runs evaluations.
 */
export enum MaximumExecutionFrequency {

  /**
   * 1 hour.
   */
  ONE_HOUR = 'One_Hour',

  /**
   * 3 hours.
   */
  THREE_HOURS = 'Three_Hours',

  /**
   * 6 hours.
   */
  SIX_HOURS = 'Six_Hours',

  /**
   * 12 hours.
   */
  TWELVE_HOURS = 'Twelve_Hours',

  /**
   * 24 hours.
   */
  TWENTY_FOUR_HOURS = 'TwentyFour_Hours'
}

/**
 * Construction properties for a new rule.
 */
export interface RuleProps {
  /**
   * A name for the AWS Config rule.
   *
   * @default - CloudFormation generated name
   */
  readonly configRuleName?: string;

  /**
   * A description about this AWS Config rule.
   *
   * @default - No description
   */
  readonly description?: string;

  /**
   * Input parameter values that are passed to the AWS Config rule.
   *
   * @default - No input parameters
   */
  readonly inputParameters?: { [key: string]: any };

  /**
   * The maximum frequency at which the AWS Config rule runs evaluations.
   *
   * @default MaximumExecutionFrequency.TWENTY_FOUR_HOURS
   */
  readonly maximumExecutionFrequency?: MaximumExecutionFrequency;

  /**
   * Defines which resources trigger an evaluation for an AWS Config rule.
   *
   * @default - evaluations for the rule are triggered when any resource in the recording group changes.
   */
  readonly ruleScope?: RuleScope;
}

/**
 * Construction properties for a ManagedRule.
 */
export interface ManagedRuleProps extends RuleProps {
  /**
   * The identifier of the AWS managed rule.
   *
   * @see https://docs.aws.amazon.com/config/latest/developerguide/managed-rules-by-aws-config.html
   */
  readonly identifier: string;
}

/**
 * A new managed rule.
 *
 * @resource AWS::Config::ConfigRule
 */
export class ManagedRule extends RuleNew {
  /** @attribute */
  public readonly configRuleName: string;

  /** @attribute */
  public readonly configRuleArn: string;

  /** @attribute */
  public readonly configRuleId: string;

  /** @attribute */
  public readonly configRuleComplianceType: string;

  constructor(scope: Construct, id: string, props: ManagedRuleProps) {
    super(scope, id, {
      physicalName: props.configRuleName,
    });

    this.ruleScope = props.ruleScope;

    const rule = new CfnConfigRule(this, 'Resource', {
      configRuleName: this.physicalName,
      description: props.description,
      inputParameters: props.inputParameters,
      maximumExecutionFrequency: props.maximumExecutionFrequency,
      scope: Lazy.any({ produce: () => renderScope(this.ruleScope) }), // scope can use values such as stack id (see CloudFormationStackDriftDetectionCheck)
      source: {
        owner: 'AWS',
        sourceIdentifier: props.identifier,
      },
    });

    this.configRuleName = rule.ref;
    this.configRuleArn = rule.attrArn;
    this.configRuleId = rule.attrConfigRuleId;
    this.configRuleComplianceType = rule.attrComplianceType;

    this.isManaged = true;
  }
}

/**
 * Construction properties for a CustomRule.
 */
export interface CustomRuleProps extends RuleProps {
  /**
   * The Lambda function to run.
   */
  readonly lambdaFunction: lambda.IFunction;

  /**
   * Whether to run the rule on configuration changes.
   *
   * @default false
   */
  readonly configurationChanges?: boolean;

  /**
   * Whether to run the rule on a fixed frequency.
   *
   * @default false
   */
  readonly periodic?: boolean;
}
/**
 * A new custom rule.
 *
 * @resource AWS::Config::ConfigRule
 */
export class CustomRule extends RuleNew {
  /** @attribute */
  public readonly configRuleName: string;

  /** @attribute */
  public readonly configRuleArn: string;

  /** @attribute */
  public readonly configRuleId: string;

  /** @attribute */
  public readonly configRuleComplianceType: string;

  constructor(scope: Construct, id: string, props: CustomRuleProps) {
    super(scope, id, {
      physicalName: props.configRuleName,
    });

    if (!props.configurationChanges && !props.periodic) {
      throw new Error('At least one of `configurationChanges` or `periodic` must be set to true.');
    }

    const sourceDetails: any[] = [];
    this.ruleScope = props.ruleScope;

    if (props.configurationChanges) {
      sourceDetails.push({
        eventSource: 'aws.config',
        messageType: 'ConfigurationItemChangeNotification',
      });
      sourceDetails.push({
        eventSource: 'aws.config',
        messageType: 'OversizedConfigurationItemChangeNotification',
      });
    }

    if (props.periodic) {
      sourceDetails.push({
        eventSource: 'aws.config',
        maximumExecutionFrequency: props.maximumExecutionFrequency,
        messageType: 'ScheduledNotification',
      });
    }

    props.lambdaFunction.addPermission('Permission', {
      principal: new iam.ServicePrincipal('config.amazonaws.com'),
    });

    if (props.lambdaFunction.role) {
      props.lambdaFunction.role.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSConfigRulesExecutionRole'),
      );
    }

    // The lambda permission must be created before the rule
    this.node.addDependency(props.lambdaFunction);

    const rule = new CfnConfigRule(this, 'Resource', {
      configRuleName: this.physicalName,
      description: props.description,
      inputParameters: props.inputParameters,
      maximumExecutionFrequency: props.maximumExecutionFrequency,
      scope: Lazy.any({ produce: () => renderScope(this.ruleScope) }), // scope can use values such as stack id (see CloudFormationStackDriftDetectionCheck)
      source: {
        owner: 'CUSTOM_LAMBDA',
        sourceDetails,
        sourceIdentifier: props.lambdaFunction.functionArn,
      },
    });

    this.configRuleName = rule.ref;
    this.configRuleArn = rule.attrArn;
    this.configRuleId = rule.attrConfigRuleId;
    this.configRuleComplianceType = rule.attrComplianceType;

    if (props.configurationChanges) {
      this.isCustomWithChanges = true;
    }
  }
}

/**
 * Managed rules that are supported by AWS Config.
 * @see https://docs.aws.amazon.com/config/latest/developerguide/managed-rules-by-aws-config.html
 */
export class ManagedRuleIdentifiers {
  /**
   * Checks that the inline policies attached to your AWS Identity and Access Management users,
   * roles, and groups do not allow blocked actions on all AWS Key Management Service keys.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/iam-inline-policy-blocked-kms-actions.html
   */
  public static readonly IAM_INLINE_POLICY_BLOCKED_KMS_ACTIONS = 'IAM_INLINE_POLICY_BLOCKED_KMS_ACTIONS';
  /**
   * Checks that the managed AWS Identity and Access Management policies that you create do not
   * allow blocked actions on all AWS AWS KMS keys.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/iam-customer-policy-blocked-kms-actions.html
   */
  public static readonly IAM_CUSTOMER_POLICY_BLOCKED_KMS_ACTIONS = 'IAM_CUSTOMER_POLICY_BLOCKED_KMS_ACTIONS';
  /**
   * Checks whether the active access keys are rotated within the number of days specified in maxAccessKeyAge.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/access-keys-rotated.html
   */
  public static readonly ACCESS_KEYS_ROTATED = 'ACCESS_KEYS_ROTATED';
  /**
   * Checks whether AWS account is part of AWS Organizations.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/account-part-of-organizations.html
   */
  public static readonly ACCOUNT_PART_OF_ORGANIZATIONS = 'ACCOUNT_PART_OF_ORGANIZATIONS';
  /**
   * Checks whether ACM Certificates in your account are marked for expiration within the specified number of days.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/acm-certificate-expiration-check.html
   */
  public static readonly ACM_CERTIFICATE_EXPIRATION_CHECK = 'ACM_CERTIFICATE_EXPIRATION_CHECK';
  /**
   * Checks if rule evaluates Application Load Balancers (ALBs) to ensure they are configured to drop http headers.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/alb-http-drop-invalid-header-enabled.html
   */
  public static readonly ALB_HTTP_DROP_INVALID_HEADER_ENABLED = 'ALB_HTTP_DROP_INVALID_HEADER_ENABLED';
  /**
   * Checks whether HTTP to HTTPS redirection is configured on all HTTP listeners of Application Load Balancer.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/alb-http-to-https-redirection-check.html
   */
  public static readonly ALB_HTTP_TO_HTTPS_REDIRECTION_CHECK = 'ALB_HTTP_TO_HTTPS_REDIRECTION_CHECK';
  /**
   * Checks if Web Application Firewall (WAF) is enabled on Application Load Balancers (ALBs).
   * @see https://docs.aws.amazon.com/config/latest/developerguide/alb-waf-enabled.html
   */
  public static readonly ALB_WAF_ENABLED = 'ALB_WAF_ENABLED';
  /**
   * Checks that all methods in Amazon API Gateway stages have caching enabled and encrypted.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/api-gw-cache-enabled-and-encrypted.html
   */
  public static readonly API_GW_CACHE_ENABLED_AND_ENCRYPTED = 'API_GW_CACHE_ENABLED_AND_ENCRYPTED';
  /**
   * Checks that Amazon API Gateway APIs are of the type specified in the rule parameter endpointConfigurationType.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/api-gw-endpoint-type-check.html
   */
  public static readonly API_GW_ENDPOINT_TYPE_CHECK = 'API_GW_ENDPOINT_TYPE_CHECK';
  /**
   * Checks that all methods in Amazon API Gateway stage has logging enabled.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/api-gw-execution-logging-enabled.html
   */
  public static readonly API_GW_EXECUTION_LOGGING_ENABLED = 'API_GW_EXECUTION_LOGGING_ENABLED';
  /**
   * Checks whether running instances are using specified AMIs.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/approved-amis-by-id.html
   */
  public static readonly APPROVED_AMIS_BY_ID = 'APPROVED_AMIS_BY_ID';
  /**
   * Checks whether running instances are using specified AMIs.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/approved-amis-by-tag.html
   */
  public static readonly APPROVED_AMIS_BY_TAG = 'APPROVED_AMIS_BY_TAG';
  /**
   * Checks whether your Auto Scaling groups that are associated with a load balancer are using
   * Elastic Load Balancing health checks.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/autoscaling-group-elb-healthcheck-required.html
   */
  public static readonly AUTOSCALING_GROUP_ELB_HEALTHCHECK_REQUIRED = 'AUTOSCALING_GROUP_ELB_HEALTHCHECK_REQUIRED';
  /**
   * Checks whether an AWS CloudFormation stack's actual configuration differs, or has drifted,
   * from it's expected configuration.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/cloudformation-stack-drift-detection-check.html
   */
  public static readonly CLOUDFORMATION_STACK_DRIFT_DETECTION_CHECK = 'CLOUDFORMATION_STACK_DRIFT_DETECTION_CHECK';
  /**
   * Checks whether your CloudFormation stacks are sending event notifications to an SNS topic.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/cloudformation-stack-notification-check.html
   */
  public static readonly CLOUDFORMATION_STACK_NOTIFICATION_CHECK = 'CLOUDFORMATION_STACK_NOTIFICATION_CHECK';
  /**
   * Checks if an Amazon CloudFront distribution is configured to return a specific object that is the default root object.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/cloudfront-default-root-object-configured.html
   */
  public static readonly CLOUDFRONT_DEFAULT_ROOT_OBJECT_CONFIGURED = 'CLOUDFRONT_DEFAULT_ROOT_OBJECT_CONFIGURED';
  /**
   * Checks that Amazon CloudFront distribution with Amazon S3 Origin type has Origin Access Identity (OAI) configured.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/cloudfront-origin-access-identity-enabled.html
   */
  public static readonly CLOUDFRONT_ORIGIN_ACCESS_IDENTITY_ENABLED = 'CLOUDFRONT_ORIGIN_ACCESS_IDENTITY_ENABLED';
  /** Checks whether an origin group is configured for the distribution of at least 2 origins in the
   * origin group for Amazon CloudFront.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/cloudfront-origin-failover-enabled.html
   */
  public static readonly CLOUDFRONT_ORIGIN_FAILOVER_ENABLED = 'CLOUDFRONT_ORIGIN_FAILOVER_ENABLED';
  /**
   * Checks if Amazon CloudFront distributions are using a custom SSL certificate and are configured
   * to use SNI to serve HTTPS requests.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/cloudfront-sni-enabled.html
   */
  public static readonly CLOUDFRONT_SNI_ENABLED = 'CLOUDFRONT_SNI_ENABLED';
  /** Checks whether your Amazon CloudFront distributions use HTTPS (directly or via a redirection).
   * @see https://docs.aws.amazon.com/config/latest/developerguide/cloudfront-viewer-policy-https.html
   */
  public static readonly CLOUDFRONT_VIEWER_POLICY_HTTPS = 'CLOUDFRONT_VIEWER_POLICY_HTTPS';
  /**
   * Checks whether AWS CloudTrail trails are configured to send logs to Amazon CloudWatch Logs.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/cloud-trail-cloud-watch-logs-enabled.html
   */
  public static readonly CLOUD_TRAIL_CLOUD_WATCH_LOGS_ENABLED = 'CLOUD_TRAIL_CLOUD_WATCH_LOGS_ENABLED';
  /**
   * Checks whether AWS CloudTrail is enabled in your AWS account.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/cloudtrail-enabled.html
   */
  public static readonly CLOUD_TRAIL_ENABLED = 'CLOUD_TRAIL_ENABLED';
  /**
   * Checks whether AWS CloudTrail is configured to use the server side encryption (SSE)
   * AWS Key Management Service (AWS KMS) customer master key (CMK) encryption.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/cloud-trail-encryption-enabled.html
   */
  public static readonly CLOUD_TRAIL_ENCRYPTION_ENABLED = 'CLOUD_TRAIL_ENCRYPTION_ENABLED';
  /**
   * Checks whether AWS CloudTrail creates a signed digest file with logs.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/cloud-trail-log-file-validation-enabled.html
   */
  public static readonly CLOUD_TRAIL_LOG_FILE_VALIDATION_ENABLED = 'CLOUD_TRAIL_LOG_FILE_VALIDATION_ENABLED';
  /**
   * Checks whether at least one AWS CloudTrail trail is logging Amazon S3 data events for all S3 buckets.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/cloudtrail-s3-dataevents-enabled.html
   */
  public static readonly CLOUDTRAIL_S3_DATAEVENTS_ENABLED = 'CLOUDTRAIL_S3_DATAEVENTS_ENABLED';
  /**
   * Checks that there is at least one AWS CloudTrail trail defined with security best practices.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/cloudtrail-security-trail-enabled.html
   */
  public static readonly CLOUDTRAIL_SECURITY_TRAIL_ENABLED = 'CLOUDTRAIL_SECURITY_TRAIL_ENABLED';
  /**
   * Checks whether CloudWatch alarms have at least one alarm action, one INSUFFICIENT_DATA action,
   * or one OK action enabled.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/cloudwatch-alarm-action-check.html
   */
  public static readonly CLOUDWATCH_ALARM_ACTION_CHECK = 'CLOUDWATCH_ALARM_ACTION_CHECK';
  /**
   * Checks whether the specified resource type has a CloudWatch alarm for the specified metric.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/cloudwatch-alarm-resource-check.html
   */
  public static readonly CLOUDWATCH_ALARM_RESOURCE_CHECK = 'CLOUDWATCH_ALARM_RESOURCE_CHECK';
  /**
   * Checks whether CloudWatch alarms with the given metric name have the specified settings.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/cloudwatch-alarm-settings-check.html
   */
  public static readonly CLOUDWATCH_ALARM_SETTINGS_CHECK = 'CLOUDWATCH_ALARM_SETTINGS_CHECK';
  /**
   * Checks whether a log group in Amazon CloudWatch Logs is encrypted with
   * a AWS Key Management Service (KMS) managed Customer Master Keys (CMK).
   * @see https://docs.aws.amazon.com/config/latest/developerguide/cloudwatch-log-group-encrypted.html
   */
  public static readonly CLOUDWATCH_LOG_GROUP_ENCRYPTED = 'CLOUDWATCH_LOG_GROUP_ENCRYPTED';
  /**
   * Checks that key rotation is enabled for each key and matches to the key ID of the
   * customer created customer master key (CMK).
   * @see https://docs.aws.amazon.com/config/latest/developerguide/cmk-backing-key-rotation-enabled.html
   */
  public static readonly CMK_BACKING_KEY_ROTATION_ENABLED = 'CMK_BACKING_KEY_ROTATION_ENABLED';
  /**
   * Checks whether the project contains environment variables AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/codebuild-project-envvar-awscred-check.html
   */
  public static readonly CODEBUILD_PROJECT_ENVVAR_AWSCRED_CHECK = 'CODEBUILD_PROJECT_ENVVAR_AWSCRED_CHECK';
  /**
   * Checks whether the GitHub or Bitbucket source repository URL contains either personal access tokens
   * or user name and password.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/codebuild-project-source-repo-url-check.html
   */
  public static readonly CODEBUILD_PROJECT_SOURCE_REPO_URL_CHECK = 'CODEBUILD_PROJECT_SOURCE_REPO_URL_CHECK';
  /**
   * Checks whether the first deployment stage of the AWS CodePipeline performs more than one deployment.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/codepipeline-deployment-count-check.html
   */
  public static readonly CODEPIPELINE_DEPLOYMENT_COUNT_CHECK = 'CODEPIPELINE_DEPLOYMENT_COUNT_CHECK';
  /**
   * Checks whether each stage in the AWS CodePipeline deploys to more than N times the number of
   * the regions the AWS CodePipeline has deployed in all the previous combined stages,
   * where N is the region fanout number.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/codepipeline-region-fanout-check.html
   */
  public static readonly CODEPIPELINE_REGION_FANOUT_CHECK = 'CODEPIPELINE_REGION_FANOUT_CHECK';
  /**
   * Checks whether Amazon CloudWatch LogGroup retention period is set to specific number of days.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/cw-loggroup-retention-period-check.html
   */
  public static readonly CW_LOGGROUP_RETENTION_PERIOD_CHECK = 'CW_LOGGROUP_RETENTION_PERIOD_CHECK';
  /**
   * Checks that DynamoDB Accelerator (DAX) clusters are encrypted.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/dax-encryption-enabled.html
   */
  public static readonly DAX_ENCRYPTION_ENABLED = 'DAX_ENCRYPTION_ENABLED';
  /**
   * Checks whether RDS DB instances have backups enabled.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/db-instance-backup-enabled.html
   */
  public static readonly RDS_DB_INSTANCE_BACKUP_ENABLED = 'DB_INSTANCE_BACKUP_ENABLED';
  /**
   * Checks instances for specified tenancy.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/desired-instance-tenancy.html
   */
  public static readonly EC2_DESIRED_INSTANCE_TENANCY = 'DESIRED_INSTANCE_TENANCY';
  /**
   * Checks whether your EC2 instances are of the specified instance types.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/desired-instance-type.html
   */
  public static readonly EC2_DESIRED_INSTANCE_TYPE = 'DESIRED_INSTANCE_TYPE';
  /**
   * Checks whether AWS Database Migration Service replication instances are public.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/dms-replication-not-public.html
   */
  public static readonly DMS_REPLICATION_NOT_PUBLIC = 'DMS_REPLICATION_NOT_PUBLIC';
  /**
   * Checks whether Auto Scaling or On-Demand is enabled on your DynamoDB tables and/or global secondary indexes.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/dynamodb-autoscaling-enabled.html
   */
  public static readonly DYNAMODB_AUTOSCALING_ENABLED = 'DYNAMODB_AUTOSCALING_ENABLED';
  /**
   * Checks whether Amazon DynamoDB table is present in AWS Backup plans.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/dynamodb-in-backup-plan.html
   */
  public static readonly DYNAMODB_IN_BACKUP_PLAN = 'DYNAMODB_IN_BACKUP_PLAN';
  /**
   * Checks that point in time recovery (PITR) is enabled for Amazon DynamoDB tables.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/dynamodb-pitr-enabled.html
   */
  public static readonly DYNAMODB_PITR_ENABLED = 'DYNAMODB_PITR_ENABLED';
  /**
   * Checks whether Amazon DynamoDB table is encrypted with AWS Key Management Service (KMS).
   * @see https://docs.aws.amazon.com/config/latest/developerguide/dynamodb-table-encrypted-kms.html
   */
  public static readonly DYNAMODB_TABLE_ENCRYPTED_KMS = 'DYNAMODB_TABLE_ENCRYPTED_KMS';
  /**
   * Checks whether the Amazon DynamoDB tables are encrypted and checks their status.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/dynamodb-table-encryption-enabled.html
   */
  public static readonly DYNAMODB_TABLE_ENCRYPTION_ENABLED = 'DYNAMODB_TABLE_ENCRYPTION_ENABLED';
  /**
   * Checks whether provisioned DynamoDB throughput is approaching the maximum limit for your account.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/dynamodb-throughput-limit-check.html
   */
  public static readonly DYNAMODB_THROUGHPUT_LIMIT_CHECK = 'DYNAMODB_THROUGHPUT_LIMIT_CHECK';
  /**
   * Checks if Amazon Elastic Block Store (Amazon EBS) volumes are added in backup plans of AWS Backup.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/ebs-in-backup-plan.html
   */
  public static readonly EBS_IN_BACKUP_PLAN = 'EBS_IN_BACKUP_PLAN';
  /**
   * Checks whether Amazon Elastic File System (Amazon EFS) file systems are added
   * in the backup plans of AWS Backup.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/efs-in-backup-plan.html
   */
  public static readonly EFS_IN_BACKUP_PLAN = 'EFS_IN_BACKUP_PLAN';
  /**
   * Check that Amazon Elastic Block Store (EBS) encryption is enabled by default.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/ec2-ebs-encryption-by-default.html
   */
  public static readonly EC2_EBS_ENCRYPTION_BY_DEFAULT = 'EC2_EBS_ENCRYPTION_BY_DEFAULT';
  /**
   * Checks whether EBS optimization is enabled for your EC2 instances that can be EBS-optimized.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/ebs-optimized-instance.html
   */
  public static readonly EBS_OPTIMIZED_INSTANCE = 'EBS_OPTIMIZED_INSTANCE';
  /**
   * Checks whether Amazon Elastic Block Store snapshots are not publicly restorable.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/ebs-snapshot-public-restorable-check.html
   */
  public static readonly EBS_SNAPSHOT_PUBLIC_RESTORABLE_CHECK = 'EBS_SNAPSHOT_PUBLIC_RESTORABLE_CHECK';
  /**
   * Checks whether detailed monitoring is enabled for EC2 instances.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/ec2-instance-detailed-monitoring-enabled.html
   */
  public static readonly EC2_INSTANCE_DETAILED_MONITORING_ENABLED = 'EC2_INSTANCE_DETAILED_MONITORING_ENABLED';
  /**
   * Checks whether the Amazon EC2 instances in your account are managed by AWS Systems Manager.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/ec2-instance-managed-by-systems-manager.html
   */
  public static readonly EC2_INSTANCE_MANAGED_BY_SSM = 'EC2_INSTANCE_MANAGED_BY_SSM';
  /**
   * Checks whether Amazon Elastic Compute Cloud (Amazon EC2) instances have a public IP association.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/ec2-instance-no-public-ip.html
   */
  public static readonly EC2_INSTANCE_NO_PUBLIC_IP = 'EC2_INSTANCE_NO_PUBLIC_IP';
  /**
   * Checks whether your EC2 instances belong to a virtual private cloud (VPC).
   * @see https://docs.aws.amazon.com/config/latest/developerguide/ec2-instances-in-vpc.html
   */
  public static readonly EC2_INSTANCES_IN_VPC = 'INSTANCES_IN_VPC';
  /**
   * Checks that none of the specified applications are installed on the instance.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/ec2-managedinstance-applications-blacklisted.html
   */
  public static readonly EC2_MANAGED_INSTANCE_APPLICATIONS_BLOCKED = 'EC2_MANAGEDINSTANCE_APPLICATIONS_BLACKLISTED';
  /**
   * Checks whether all of the specified applications are installed on the instance.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/ec2-managedinstance-applications-required.html
   */
  public static readonly EC2_MANAGED_INSTANCE_APPLICATIONS_REQUIRED = 'EC2_MANAGEDINSTANCE_APPLICATIONS_REQUIRED';
  /**
   * Checks whether the compliance status of AWS Systems Manager association compliance is COMPLIANT
   * or NON_COMPLIANT after the association execution on the instance.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/ec2-managedinstance-association-compliance-status-check.html
   */
  public static readonly EC2_MANAGED_INSTANCE_ASSOCIATION_COMPLIANCE_STATUS_CHECK = 'EC2_MANAGEDINSTANCE_ASSOCIATION_COMPLIANCE_STATUS_CHECK';
  /**
   * Checks whether instances managed by AWS Systems Manager are configured to collect blocked inventory types.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/ec2-managedinstance-inventory-blacklisted.html
   */
  public static readonly EC2_MANAGED_INSTANCE_INVENTORY_BLOCKED = 'EC2_MANAGEDINSTANCE_INVENTORY_BLACKLISTED';
  /**
   * Checks whether the compliance status of the Amazon EC2 Systems Manager patch compliance is
   * COMPLIANT or NON_COMPLIANT after the patch installation on the instance.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/ec2-managedinstance-patch-compliance-status-check.html
   */
  public static readonly EC2_MANAGED_INSTANCE_PATCH_COMPLIANCE_STATUS_CHECK = 'EC2_MANAGEDINSTANCE_PATCH_COMPLIANCE_STATUS_CHECK';
  /**
   * Checks whether EC2 managed instances have the desired configurations.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/ec2-managedinstance-platform-check.html
   */
  public static readonly EC2_MANAGED_INSTANCE_PLATFORM_CHECK = 'EC2_MANAGEDINSTANCE_PLATFORM_CHECK';
  /**
   * Checks that security groups are attached to Amazon Elastic Compute Cloud (Amazon EC2) instances
   * or to an elastic network interface.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/ec2-security-group-attached-to-eni.html
   */
  public static readonly EC2_SECURITY_GROUP_ATTACHED_TO_ENI = 'EC2_SECURITY_GROUP_ATTACHED_TO_ENI';
  /**
   * Checks whether there are instances stopped for more than the allowed number of days.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/ec2-stopped-instance.html
   */
  public static readonly EC2_STOPPED_INSTANCE = 'EC2_STOPPED_INSTANCE';
  /**
   * Checks whether EBS volumes are attached to EC2 instances.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/ec2-volume-inuse-check.html
   */
  public static readonly EC2_VOLUME_INUSE_CHECK = 'EC2_VOLUME_INUSE_CHECK';
  /**
   * hecks whether Amazon Elastic File System (Amazon EFS) is configured to encrypt the file data
   * using AWS Key Management Service (AWS KMS).
   * @see https://docs.aws.amazon.com/config/latest/developerguide/efs-encrypted-check.html
   */
  public static readonly EFS_ENCRYPTED_CHECK = 'EFS_ENCRYPTED_CHECK';
  /**
   * Checks whether all Elastic IP addresses that are allocated to a VPC are attached to
   * EC2 instances or in-use elastic network interfaces (ENIs).
   * @see https://docs.aws.amazon.com/config/latest/developerguide/eip-attached.html
   */
  public static readonly EIP_ATTACHED = 'EIP_ATTACHED';
  /**
   * Checks whether Amazon Elasticsearch Service (Amazon ES) domains have encryption
   * at rest configuration enabled.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/elasticsearch-encrypted-at-rest.html
   */
  public static readonly ELASTICSEARCH_ENCRYPTED_AT_REST = 'ELASTICSEARCH_ENCRYPTED_AT_REST';
  /**
   * Checks whether Amazon Elasticsearch Service (Amazon ES) domains are in
   * Amazon Virtual Private Cloud (Amazon VPC).
   * @see https://docs.aws.amazon.com/config/latest/developerguide/elasticsearch-in-vpc-only.html
   */
  public static readonly ELASTICSEARCH_IN_VPC_ONLY = 'ELASTICSEARCH_IN_VPC_ONLY';
  /**
   * Check if the Amazon ElastiCache Redis clusters have automatic backup turned on.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/elasticache-redis-cluster-automatic-backup-check.html
   */
  public static readonly ELASTICACHE_REDIS_CLUSTER_AUTOMATIC_BACKUP_CHECK = 'ELASTICACHE_REDIS_CLUSTER_AUTOMATIC_BACKUP_CHECK';
  /**
   * Checks whether your Amazon Elastic Compute Cloud (Amazon EC2) instance metadata version
   * is configured with Instance Metadata Service Version 2 (IMDSv2).
   * @see https://docs.aws.amazon.com/config/latest/developerguide/ec2-imdsv2-check.html
   */
  public static readonly EC2_IMDSV2_CHECK = 'EC2_IMDSV2_CHECK';
  /**
   * Checks whether Amazon Elastic Kubernetes Service (Amazon EKS) endpoint is not publicly accessible.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/eks-endpoint-no-public-access.html
   */
  public static readonly EKS_ENDPOINT_NO_PUBLIC_ACCESS = 'EKS_ENDPOINT_NO_PUBLIC_ACCESS';
  /**
   * Checks whether Amazon Elastic Kubernetes Service clusters are configured to have Kubernetes
   * secrets encrypted using AWS Key Management Service (KMS) keys.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/eks-secrets-encrypted.html
   */
  public static readonly EKS_SECRETS_ENCRYPTED = 'EKS_SECRETS_ENCRYPTED';
  /**
   * Check that Amazon ElasticSearch Service nodes are encrypted end to end.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/elasticsearch-node-to-node-encryption-check.html
   */
  public static readonly ELASTICSEARCH_NODE_TO_NODE_ENCRYPTION_CHECK = 'ELASTICSEARCH_NODE_TO_NODE_ENCRYPTION_CHECK';
  /**
   * Checks if cross-zone load balancing is enabled for the Classic Load Balancers (CLBs).
   * @see https://docs.aws.amazon.com/config/latest/developerguide/elb-cross-zone-load-balancing-enabled.html
   */
  public static readonly ELB_CROSS_ZONE_LOAD_BALANCING_ENABLED = 'ELB_CROSS_ZONE_LOAD_BALANCING_ENABLED';
  /**
   * Checks whether your Classic Load Balancer is configured with SSL or HTTPS listeners.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/elb-tls-https-listeners-only.html
   */
  public static readonly ELB_TLS_HTTPS_LISTENERS_ONLY = 'ELB_TLS_HTTPS_LISTENERS_ONLY';
  /**
   * Checks whether the Classic Load Balancers use SSL certificates provided by AWS Certificate Manager.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/elb-acm-certificate-required.html
   */
  public static readonly ELB_ACM_CERTIFICATE_REQUIRED = 'ELB_ACM_CERTIFICATE_REQUIRED';
  /**
   * Checks whether your Classic Load Balancer SSL listeners are using a custom policy.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/elb-custom-security-policy-ssl-check.html
   */
  public static readonly ELB_CUSTOM_SECURITY_POLICY_SSL_CHECK = 'ELB_CUSTOM_SECURITY_POLICY_SSL_CHECK';
  /**
   * Checks whether Elastic Load Balancing has deletion protection enabled.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/elb-deletion-protection-enabled.html
   */
  public static readonly ELB_DELETION_PROTECTION_ENABLED = 'ELB_DELETION_PROTECTION_ENABLED';
  /**
   * Checks whether the Application Load Balancer and the Classic Load Balancer have logging enabled.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/elb-logging-enabled.html
   */
  public static readonly ELB_LOGGING_ENABLED = 'ELB_LOGGING_ENABLED';
  /**
   * Checks whether your Classic Load Balancer SSL listeners are using a predefined policy.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/elb-predefined-security-policy-ssl-check.html
   */
  public static readonly ELB_PREDEFINED_SECURITY_POLICY_SSL_CHECK = 'ELB_PREDEFINED_SECURITY_POLICY_SSL_CHECK';
  /**
   * Checks that Amazon EMR clusters have Kerberos enabled.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/emr-kerberos-enabled.html
   */
  public static readonly EMR_KERBEROS_ENABLED = 'EMR_KERBEROS_ENABLED';
  /**
   * Checks whether Amazon Elastic MapReduce (EMR) clusters' master nodes have public IPs.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/emr-master-no-public-ip.html
   */
  public static readonly EMR_MASTER_NO_PUBLIC_IP = 'EMR_MASTER_NO_PUBLIC_IP';
  /**
   * Checks whether the EBS volumes that are in an attached state are encrypted.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/encrypted-volumes.html
   */
  public static readonly EBS_ENCRYPTED_VOLUMES = 'ENCRYPTED_VOLUMES';
  /**
   * Checks whether the security groups associated inScope resources are compliant with the
   * master security groups at each rule level based on allowSecurityGroup and denySecurityGroup flag.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/fms-security-group-audit-policy-check.html
   */
  public static readonly FMS_SECURITY_GROUP_AUDIT_POLICY_CHECK = 'FMS_SECURITY_GROUP_AUDIT_POLICY_CHECK';
  /**
   * Checks whether AWS Firewall Manager created security groups content is the same as the master security groups.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/fms-security-group-content-check.html
   */
  public static readonly FMS_SECURITY_GROUP_CONTENT_CHECK = 'FMS_SECURITY_GROUP_CONTENT_CHECK';
  /**
   * Checks whether Amazon EC2 or an elastic network interface is associated with AWS Firewall Manager security groups.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/fms-security-group-resource-association-check.html
   */
  public static readonly FMS_SECURITY_GROUP_RESOURCE_ASSOCIATION_CHECK = 'FMS_SECURITY_GROUP_RESOURCE_ASSOCIATION_CHECK';
  /**
   * Checks whether an Application Load Balancer, Amazon CloudFront distributions,
   * Elastic Load Balancer or Elastic IP has AWS Shield protection.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/fms-shield-resource-policy-check.html
   */
  public static readonly FMS_SHIELD_RESOURCE_POLICY_CHECK = 'FMS_SHIELD_RESOURCE_POLICY_CHECK';
  /**
   * Checks whether the web ACL is associated with an Application Load Balancer, API Gateway stage,
   * or Amazon CloudFront distributions.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/fms-webacl-resource-policy-check.html
   */
  public static readonly FMS_WEBACL_RESOURCE_POLICY_CHECK = 'FMS_WEBACL_RESOURCE_POLICY_CHECK';
  /**
   * Checks that the rule groups associate with the web ACL at the correct priority.
   * The correct priority is decided by the rank of the rule groups in the ruleGroups parameter.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/fms-webacl-rulegroup-association-check.html
   */
  public static readonly FMS_WEBACL_RULEGROUP_ASSOCIATION_CHECK = 'FMS_WEBACL_RULEGROUP_ASSOCIATION_CHECK';
  /**
   * Checks whether Amazon GuardDuty is enabled in your AWS account and region. If you provide an AWS account for centralization,
   * the rule evaluates the Amazon GuardDuty results in the centralized account.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/guardduty-enabled-centralized.html
   */
  public static readonly GUARDDUTY_ENABLED_CENTRALIZED = 'GUARDDUTY_ENABLED_CENTRALIZED';
  /**
   * Checks whether the Amazon GuardDuty has findings that are non archived.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/guardduty-non-archived-findings.html
   */
  public static readonly GUARDDUTY_NON_ARCHIVED_FINDINGS = 'GUARDDUTY_NON_ARCHIVED_FINDINGS';
  /**
   * Checks that inline policy feature is not in use.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/iam-no-inline-policy-check.html
   */
  public static readonly IAM_NO_INLINE_POLICY_CHECK = 'IAM_NO_INLINE_POLICY_CHECK';
  /**
   * Checks whether IAM groups have at least one IAM user.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/iam-group-has-users-check.html
   */
  public static readonly IAM_GROUP_HAS_USERS_CHECK = 'IAM_GROUP_HAS_USERS_CHECK';
  /**
   * Checks whether the account password policy for IAM users meets the specified requirements
   * indicated in the parameters.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/iam-password-policy.html
   */
  public static readonly IAM_PASSWORD_POLICY = 'IAM_PASSWORD_POLICY';
  /**
   * Checks whether for each IAM resource, a policy ARN in the input parameter is attached to the IAM resource.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/iam-policy-blacklisted-check.html
   */
  public static readonly IAM_POLICY_BLOCKED_CHECK = 'IAM_POLICY_BLACKLISTED_CHECK';
  /**
   * Checks whether the IAM policy ARN is attached to an IAM user, or an IAM group with one or more IAM users,
   * or an IAM role with one or more trusted entity.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/iam-policy-in-use.html
   */
  public static readonly IAM_POLICY_IN_USE = 'IAM_POLICY_IN_USE';
  /**
   * Checks the IAM policies that you create for Allow statements that grant permissions to all actions on all resources.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/iam-policy-no-statements-with-admin-access.html
   */
  public static readonly IAM_POLICY_NO_STATEMENTS_WITH_ADMIN_ACCESS = 'IAM_POLICY_NO_STATEMENTS_WITH_ADMIN_ACCESS';
  /**
   * Checks that AWS Identity and Access Management (IAM) policies in a list of policies are attached to all AWS roles.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/iam-role-managed-policy-check.html
   */
  public static readonly IAM_ROLE_MANAGED_POLICY_CHECK = 'IAM_ROLE_MANAGED_POLICY_CHECK';
  /**
   * Checks whether the root user access key is available.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/iam-root-access-key-check.html
   */
  public static readonly IAM_ROOT_ACCESS_KEY_CHECK = 'IAM_ROOT_ACCESS_KEY_CHECK';
  /**
   * Checks whether IAM users are members of at least one IAM group.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/iam-user-group-membership-check.html
   */
  public static readonly IAM_USER_GROUP_MEMBERSHIP_CHECK = 'IAM_USER_GROUP_MEMBERSHIP_CHECK';
  /**
   * Checks whether the AWS Identity and Access Management users have multi-factor authentication (MFA) enabled.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/iam-user-mfa-enabled.html
   */
  public static readonly IAM_USER_MFA_ENABLED = 'IAM_USER_MFA_ENABLED';
  /**
   * Checks that none of your IAM users have policies attached. IAM users must inherit permissions from IAM groups or roles.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/iam-user-no-policies-check.html
   */
  public static readonly IAM_USER_NO_POLICIES_CHECK = 'IAM_USER_NO_POLICIES_CHECK';
  /**
   * Checks whether your AWS Identity and Access Management (IAM) users have passwords or
   * active access keys that have not been used within the specified number of days you provided.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/iam-user-unused-credentials-check.html
   */
  public static readonly IAM_USER_UNUSED_CREDENTIALS_CHECK = 'IAM_USER_UNUSED_CREDENTIALS_CHECK';
  /**
   * Checks that Internet gateways (IGWs) are only attached to an authorized Amazon Virtual Private Cloud (VPCs).
   * @see https://docs.aws.amazon.com/config/latest/developerguide/internet-gateway-authorized-vpc-only.html
   */
  public static readonly INTERNET_GATEWAY_AUTHORIZED_VPC_ONLY = 'INTERNET_GATEWAY_AUTHORIZED_VPC_ONLY';
  /**
   * Checks whether customer master keys (CMKs) are not scheduled for deletion in AWS Key Management Service (KMS).
   * @see https://docs.aws.amazon.com/config/latest/developerguide/kms-cmk-not-scheduled-for-deletion.html
   */
  public static readonly KMS_CMK_NOT_SCHEDULED_FOR_DELETION = 'KMS_CMK_NOT_SCHEDULED_FOR_DELETION';
  /**
   * Checks whether the AWS Lambda function is configured with function-level concurrent execution limit.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/lambda-concurrency-check.html
   */
  public static readonly LAMBDA_CONCURRENCY_CHECK = 'LAMBDA_CONCURRENCY_CHECK';
  /**
   * Checks whether an AWS Lambda function is configured with a dead-letter queue.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/lambda-dlq-check.html
   */
  public static readonly LAMBDA_DLQ_CHECK = 'LAMBDA_DLQ_CHECK';
  /**
   * Checks whether the AWS Lambda function policy attached to the Lambda resource prohibits public access.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/lambda-function-public-access-prohibited.html
   */
  public static readonly LAMBDA_FUNCTION_PUBLIC_ACCESS_PROHIBITED = 'LAMBDA_FUNCTION_PUBLIC_ACCESS_PROHIBITED';
  /**
   * Checks that the lambda function settings for runtime, role, timeout, and memory size match the expected values.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/lambda-function-settings-check.html
   */
  public static readonly LAMBDA_FUNCTION_SETTINGS_CHECK = 'LAMBDA_FUNCTION_SETTINGS_CHECK';
  /**
   * Checks whether an AWS Lambda function is in an Amazon Virtual Private Cloud.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/lambda-inside-vpc.html
   */
  public static readonly LAMBDA_INSIDE_VPC = 'LAMBDA_INSIDE_VPC';
  /**
   * Checks whether AWS Multi-Factor Authentication (MFA) is enabled for all IAM users that use a console password.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/mfa-enabled-for-iam-console-access.html
   */
  public static readonly MFA_ENABLED_FOR_IAM_CONSOLE_ACCESS = 'MFA_ENABLED_FOR_IAM_CONSOLE_ACCESS';
  /**
   * Checks that there is at least one multi-region AWS CloudTrail.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/multi-region-cloudtrail-enabled.html
   */
  public static readonly CLOUDTRAIL_MULTI_REGION_ENABLED = 'MULTI_REGION_CLOUD_TRAIL_ENABLED';
  /**
   * Checks if an Amazon Relational Database Service (Amazon RDS) cluster has deletion protection enabled.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/rds-cluster-deletion-protection-enabled.html
   */
  public static readonly RDS_CLUSTER_DELETION_PROTECTION_ENABLED = 'RDS_CLUSTER_DELETION_PROTECTION_ENABLED';
  /**
   * Checks if an Amazon Relational Database Service (Amazon RDS) instance has deletion protection enabled.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/rds-instance-deletion-protection-enabled.html
   */
  public static readonly RDS_INSTANCE_DELETION_PROTECTION_ENABLED = 'RDS_INSTANCE_DELETION_PROTECTION_ENABLED';
  /**
   * Checks if an Amazon RDS instance has AWS Identity and Access Management (IAM) authentication enabled.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/rds-instance-iam-authentication-enabled.html
   */
  public static readonly RDS_INSTANCE_IAM_AUTHENTICATION_ENABLED = 'RDS_INSTANCE_IAM_AUTHENTICATION_ENABLED';
  /**
   * Checks that respective logs of Amazon Relational Database Service (Amazon RDS) are enabled.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/rds-logging-enabled.html
   */
  public static readonly RDS_LOGGING_ENABLED = 'RDS_LOGGING_ENABLED';
  /**
   * Checks that Amazon Redshift automated snapshots are enabled for clusters.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/redshift-backup-enabled.html
   */
  public static readonly REDSHIFT_BACKUP_ENABLED = 'REDSHIFT_BACKUP_ENABLED';
  /**
   * Checks whether enhanced monitoring is enabled for Amazon Relational Database Service (Amazon RDS) instances.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/rds-enhanced-monitoring-enabled.html
   */
  public static readonly RDS_ENHANCED_MONITORING_ENABLED = 'RDS_ENHANCED_MONITORING_ENABLED';
  /**
   * Checks whether Amazon Relational Database Service (Amazon RDS) DB snapshots are encrypted.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/rds-snapshot-encrypted.html
   */
  public static readonly RDS_SNAPSHOT_ENCRYPTED = 'RDS_SNAPSHOT_ENCRYPTED';
  /**
   * Checks whether Amazon Redshift clusters require TLS/SSL encryption to connect to SQL clients.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/redshift-require-tls-ssl.html
   */
  public static readonly REDSHIFT_REQUIRE_TLS_SSL = 'REDSHIFT_REQUIRE_TLS_SSL';
  /**
   * Checks whether Amazon RDS database is present in back plans of AWS Backup.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/rds-in-backup-plan.html
   */
  public static readonly RDS_IN_BACKUP_PLAN = 'RDS_IN_BACKUP_PLAN';
  /**
   * Check whether the Amazon Relational Database Service instances are not publicly accessible.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/rds-instance-public-access-check.html
   */
  public static readonly RDS_INSTANCE_PUBLIC_ACCESS_CHECK = 'RDS_INSTANCE_PUBLIC_ACCESS_CHECK';
  /**
   * Checks whether high availability is enabled for your RDS DB instances.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/rds-multi-az-support.html
   */
  public static readonly RDS_MULTI_AZ_SUPPORT = 'RDS_MULTI_AZ_SUPPORT';
  /**
   * Checks if Amazon Relational Database Service (Amazon RDS) snapshots are public.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/rds-snapshots-public-prohibited.html
   */
  public static readonly RDS_SNAPSHOTS_PUBLIC_PROHIBITED = 'RDS_SNAPSHOTS_PUBLIC_PROHIBITED';
  /**
   * Checks whether storage encryption is enabled for your RDS DB instances.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/rds-storage-encrypted.html
   */
  public static readonly RDS_STORAGE_ENCRYPTED = 'RDS_STORAGE_ENCRYPTED';
  /**
   * Checks whether Amazon Redshift clusters have the specified settings.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/redshift-cluster-configuration-check.html
   */
  public static readonly REDSHIFT_CLUSTER_CONFIGURATION_CHECK = 'REDSHIFT_CLUSTER_CONFIGURATION_CHECK';
  /**
   * Checks whether Amazon Redshift clusters have the specified maintenance settings.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/redshift-cluster-maintenancesettings-check.html
   */
  public static readonly REDSHIFT_CLUSTER_MAINTENANCE_SETTINGS_CHECK = 'REDSHIFT_CLUSTER_MAINTENANCESETTINGS_CHECK';
  /**
   * Checks whether Amazon Redshift clusters are not publicly accessible.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/redshift-cluster-public-access-check.html
   */
  public static readonly REDSHIFT_CLUSTER_PUBLIC_ACCESS_CHECK = 'REDSHIFT_CLUSTER_PUBLIC_ACCESS_CHECK';
  /**
   * Checks whether your resources have the tags that you specify.
   * For example, you can check whether your Amazon EC2 instances have the CostCenter tag.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/required-tags.html
   */
  public static readonly REQUIRED_TAGS = 'REQUIRED_TAGS';
  /**
   * Checks whether the security groups in use do not allow unrestricted incoming TCP traffic to the specified ports.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/restricted-common-ports.html
   */
  public static readonly EC2_SECURITY_GROUPS_RESTRICTED_INCOMING_TRAFFIC = 'RESTRICTED_INCOMING_TRAFFIC';
  /**
   * Checks whether the incoming SSH traffic for the security groups is accessible.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/restricted-ssh.html
   */
  public static readonly EC2_SECURITY_GROUPS_INCOMING_SSH_DISABLED = 'INCOMING_SSH_DISABLED';
  /**
   * Checks whether your AWS account is enabled to use multi-factor authentication (MFA) hardware
   * device to sign in with root credentials.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/root-account-hardware-mfa-enabled.html
   */
  public static readonly ROOT_ACCOUNT_HARDWARE_MFA_ENABLED = 'ROOT_ACCOUNT_HARDWARE_MFA_ENABLED';
  /**
   * Checks whether users of your AWS account require a multi-factor authentication (MFA) device
   * to sign in with root credentials.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/root-account-mfa-enabled.html
   */
  public static readonly ROOT_ACCOUNT_MFA_ENABLED = 'ROOT_ACCOUNT_MFA_ENABLED';
  /**
   * Checks whether Amazon Simple Storage Service (Amazon S3) bucket has lock enabled, by default.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/s3-bucket-default-lock-enabled.html
   */
  public static readonly S3_BUCKET_DEFAULT_LOCK_ENABLED = 'S3_BUCKET_DEFAULT_LOCK_ENABLED';
  /**
   * Checks whether the Amazon Simple Storage Service (Amazon S3) buckets are encrypted
   * with AWS Key Management Service (AWS KMS).
   * @see https://docs.aws.amazon.com/config/latest/developerguide/s3-default-encryption-kms.html
   */
  public static readonly S3_DEFAULT_ENCRYPTION_KMS = 'S3_DEFAULT_ENCRYPTION_KMS';
  /**
   * Checks that AWS Security Hub is enabled for an AWS account.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/securityhub-enabled.html
   */
  public static readonly SECURITYHUB_ENABLED = 'SECURITYHUB_ENABLED';
  /**
   * Checks whether Amazon SNS topic is encrypted with AWS Key Management Service (AWS KMS).
   * @see https://docs.aws.amazon.com/config/latest/developerguide/sns-encrypted-kms.html
   */
  public static readonly SNS_ENCRYPTED_KMS = 'SNS_ENCRYPTED_KMS';
  /**
   * Checks whether the required public access block settings are configured from account level.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/s3-account-level-public-access-blocks.html
   */
  public static readonly S3_ACCOUNT_LEVEL_PUBLIC_ACCESS_BLOCKS = 'S3_ACCOUNT_LEVEL_PUBLIC_ACCESS_BLOCKS';
  /**
   * Checks that the Amazon Simple Storage Service bucket policy does not allow
   * blocked bucket-level and object-level actions on resources in the bucket
   * for principals from other AWS accounts.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/s3-bucket-blacklisted-actions-prohibited.html
   */
  public static readonly S3_BUCKET_BLOCKED_ACTIONS_PROHIBITED = 'S3_BUCKET_BLACKLISTED_ACTIONS_PROHIBITED';
  /**
   * Verifies that your Amazon Simple Storage Service bucket policies do not allow
   * other inter-account permissions than the control Amazon S3 bucket policy provided.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/s3-bucket-policy-not-more-permissive.html
   */
  public static readonly S3_BUCKET_POLICY_NOT_MORE_PERMISSIVE = 'S3_BUCKET_POLICY_NOT_MORE_PERMISSIVE';
  /**
   * Checks whether logging is enabled for your S3 buckets.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/s3-bucket-logging-enabled.html
   */
  public static readonly S3_BUCKET_LOGGING_ENABLED = 'S3_BUCKET_LOGGING_ENABLED';
  /**
   * Checks that the access granted by the Amazon S3 bucket is restricted by any of the AWS principals,
   * federated users, service principals, IP addresses, or VPCs that you provide.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/s3-bucket-policy-grantee-check.html
   */
  public static readonly S3_BUCKET_POLICY_GRANTEE_CHECK = 'S3_BUCKET_POLICY_GRANTEE_CHECK';
  /**
   * Checks that your Amazon S3 buckets do not allow public read access.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/s3-bucket-public-read-prohibited.html
   */
  public static readonly S3_BUCKET_PUBLIC_READ_PROHIBITED = 'S3_BUCKET_PUBLIC_READ_PROHIBITED';
  /**
   * Checks that your Amazon S3 buckets do not allow public write access.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/s3-bucket-public-write-prohibited.html
   */
  public static readonly S3_BUCKET_PUBLIC_WRITE_PROHIBITED = 'S3_BUCKET_PUBLIC_WRITE_PROHIBITED';
  /**
   * Checks whether S3 buckets have cross-region replication enabled.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/s3-bucket-replication-enabled.html
   */
  public static readonly S3_BUCKET_REPLICATION_ENABLED = 'S3_BUCKET_REPLICATION_ENABLED';
  /**
   * Checks that your Amazon S3 bucket either has Amazon S3 default encryption enabled or that the
   * S3 bucket policy explicitly denies put-object requests without server side encryption that
   * uses AES-256 or AWS Key Management Service.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/s3-bucket-server-side-encryption-enabled.html
   */
  public static readonly S3_BUCKET_SERVER_SIDE_ENCRYPTION_ENABLED = 'S3_BUCKET_SERVER_SIDE_ENCRYPTION_ENABLED';
  /**
   * Checks whether S3 buckets have policies that require requests to use Secure Socket Layer (SSL).
   * @see https://docs.aws.amazon.com/config/latest/developerguide/s3-bucket-ssl-requests-only.html
   */
  public static readonly S3_BUCKET_SSL_REQUESTS_ONLY= 'S3_BUCKET_SSL_REQUESTS_ONLY';
  /**
   * Checks whether versioning is enabled for your S3 buckets.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/s3-bucket-versioning-enabled.html
   */
  public static readonly S3_BUCKET_VERSIONING_ENABLED = 'S3_BUCKET_VERSIONING_ENABLED';
  /**
   * Checks whether AWS Key Management Service (KMS) key is configured for an Amazon SageMaker endpoint configuration.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/sagemaker-endpoint-configuration-kms-key-configured.html
   */
  public static readonly SAGEMAKER_ENDPOINT_CONFIGURATION_KMS_KEY_CONFIGURED = 'SAGEMAKER_ENDPOINT_CONFIGURATION_KMS_KEY_CONFIGURED';
  /**
   * Check whether an AWS Key Management Service (KMS) key is configured for SageMaker notebook instance.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/sagemaker-notebook-instance-kms-key-configured.html
   */
  public static readonly SAGEMAKER_NOTEBOOK_INSTANCE_KMS_KEY_CONFIGURED = 'SAGEMAKER_NOTEBOOK_INSTANCE_KMS_KEY_CONFIGURED';
  /**
   * Checks whether direct internet access is disabled for an Amazon SageMaker notebook instance.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/sagemaker-notebook-no-direct-internet-access.html
   */
  public static readonly SAGEMAKER_NOTEBOOK_NO_DIRECT_INTERNET_ACCESS = 'SAGEMAKER_NOTEBOOK_NO_DIRECT_INTERNET_ACCESS';
  /**
   * Checks whether AWS Secrets Manager secret has rotation enabled.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/secretsmanager-rotation-enabled-check.html
   */
  public static readonly SECRETSMANAGER_ROTATION_ENABLED_CHECK = 'SECRETSMANAGER_ROTATION_ENABLED_CHECK';
  /**
   * Checks whether AWS Secrets Manager secret rotation has rotated successfully as per the rotation schedule.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/secretsmanager-scheduled-rotation-success-check.html
   */
  public static readonly SECRETSMANAGER_SCHEDULED_ROTATION_SUCCESS_CHECK = 'SECRETSMANAGER_SCHEDULED_ROTATION_SUCCESS_CHECK';
  /**
   * Checks whether Service Endpoint for the service provided in rule parameter is created for each Amazon VPC.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/service-vpc-endpoint-enabled.html
   */
  public static readonly SERVICE_VPC_ENDPOINT_ENABLED = 'SERVICE_VPC_ENDPOINT_ENABLED';
  /**
   * Checks whether EBS volumes are attached to EC2 instances.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/shield-advanced-enabled-autorenew.html
   */
  public static readonly SHIELD_ADVANCED_ENABLED_AUTO_RENEW = 'SHIELD_ADVANCED_ENABLED_AUTORENEW';
  /**
   * Verify that DDoS response team (DRT) can access AWS account.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/shield-drt-access.html
   */
  public static readonly SHIELD_DRT_ACCESS = 'SHIELD_DRT_ACCESS';
  /**
   * Checks that the default security group of any Amazon Virtual Private Cloud (VPC) does not
   * allow inbound or outbound traffic. The rule returns NOT_APPLICABLE if the security group
   * is not default.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/vpc-default-security-group-closed.html
   */
  public static readonly VPC_DEFAULT_SECURITY_GROUP_CLOSED = 'VPC_DEFAULT_SECURITY_GROUP_CLOSED';
  /**
   * Checks whether Amazon Virtual Private Cloud flow logs are found and enabled for Amazon VPC.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/vpc-flow-logs-enabled.html
   */
  public static readonly VPC_FLOW_LOGS_ENABLED = 'VPC_FLOW_LOGS_ENABLED';
  /**
   * Checks whether the security group with 0.0.0.0/0 of any Amazon Virtual Private Cloud (Amazon VPC)
   * allows only specific inbound TCP or UDP traffic.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/vpc-sg-open-only-to-authorized-ports.html
   */
  public static readonly VPC_SG_OPEN_ONLY_TO_AUTHORIZED_PORTS = 'VPC_SG_OPEN_ONLY_TO_AUTHORIZED_PORTS';
  /**
   * Checks that both AWS Virtual Private Network tunnels provided by AWS Site-to-Site VPN are in
   * UP status.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/vpc-vpn-2-tunnels-up.html
   */
  public static readonly VPC_VPN_2_TUNNELS_UP = 'VPC_VPN_2_TUNNELS_UP';
  /**
   * Checks if logging is enabled on AWS Web Application Firewall (WAF) classic global web ACLs.
   * @see https://docs.aws.amazon.com/config/latest/developerguide/waf-classic-logging-enabled.html
   */
  public static readonly WAF_CLASSIC_LOGGING_ENABLED = 'WAF_CLASSIC_LOGGING_ENABLED';
  /**
   * Checks whether logging is enabled on AWS Web Application Firewall (WAFV2) regional and global
   * web access control list (ACLs).
   * @see https://docs.aws.amazon.com/config/latest/developerguide/wafv2-logging-enabled.html
   */
  public static readonly WAFV2_LOGGING_ENABLED = 'WAFV2_LOGGING_ENABLED';

  // utility class
  private constructor() { }
}

/**
 * Resources types that are supported by AWS Config
 * @see https://docs.aws.amazon.com/config/latest/developerguide/resource-config-reference.html
 */
export class ResourceType {
  /** API Gateway Stage */
  public static readonly APIGATEWAY_STAGE = new ResourceType('AWS::ApiGateway::Stage');
  /** API Gatewayv2 Stage */
  public static readonly APIGATEWAYV2_STAGE = new ResourceType('AWS::ApiGatewayV2::Stage');
  /** API Gateway REST API */
  public static readonly APIGATEWAY_REST_API = new ResourceType('AWS::ApiGateway::RestApi');
  /** API Gatewayv2 API */
  public static readonly APIGATEWAYV2_API = new ResourceType('AWS::ApiGatewayV2::Api');
  /** Amazon CloudFront Distribution */
  public static readonly CLOUDFRONT_DISTRIBUTION = new ResourceType('AWS::CloudFront::Distribution');
  /** Amazon CloudFront streaming distribution */
  public static readonly CLOUDFRONT_STREAMING_DISTRIBUTION = new ResourceType('AWS::CloudFront::StreamingDistribution');
  /** Amazon CloudWatch Alarm */
  public static readonly CLOUDWATCH_ALARM = new ResourceType('AWS::CloudWatch::Alarm');
  /** Amazon DynamoDB Table */
  public static readonly DYNAMODB_TABLE = new ResourceType('AWS::DynamoDB::Table');
  /** Elastic Block Store (EBS) volume */
  public static readonly EBS_VOLUME = new ResourceType('AWS::EC2::Volume');
  /** EC2 host */
  public static readonly EC2_HOST = new ResourceType('AWS::EC2::Host');
  /** EC2 Elastic IP */
  public static readonly EC2_EIP = new ResourceType('AWS::EC2::EIP');
  /** EC2 instance */
  public static readonly EC2_INSTANCE = new ResourceType('AWS::EC2::Instance');
  /** EC2 security group */
  public static readonly EC2_SECURITY_GROUP = new ResourceType('AWS::EC2::SecurityGroup');
  /** EC2 NAT gateway */
  public static readonly EC2_NAT_GATEWAY = new ResourceType('AWS::EC2::NatGateway');
  /** EC2 Egress only internet gateway */
  public static readonly EC2_EGRESS_ONLY_INTERNET_GATEWAY = new ResourceType('AWS::EC2::EgressOnlyInternetGateway');
  /** EC2 flow log */
  public static readonly EC2_FLOW_LOG = new ResourceType('AWS::EC2::FlowLog');
  /** EC2 VPC endpoint */
  public static readonly EC2_VPC_ENDPOINT = new ResourceType('AWS::EC2::VPCEndpoint');
  /** EC2 VPC endpoint service */
  public static readonly EC2_VPC_ENDPOINT_SERVICE = new ResourceType('AWS::EC2::VPCEndpointService');
  /** EC2 VPC peering connection */
  public static readonly EC2_VPC_PEERING_CONNECTION = new ResourceType('AWS::EC2::VPCPeeringConnection');
  /** Amazon ElasticSearch domain */
  public static readonly ELASTICSEARCH_DOMAIN = new ResourceType('AWS::Elasticsearch::Domain');
  /** Amazon QLDB ledger */
  public static readonly QLDB_LEDGER = new ResourceType('AWS::QLDB::Ledger');
  /** Amazon Redshift cluster */
  public static readonly REDSHIFT_CLUSTER = new ResourceType('AWS::Redshift::Cluster');
  /** Amazon Redshift cluster parameter group */
  public static readonly REDSHIFT_CLUSTER_PARAMETER_GROUP = new ResourceType('AWS::Redshift::ClusterParameterGroup');
  /** Amazon Redshift cluster security group */
  public static readonly REDSHIFT_CLUSTER_SECURITY_GROUP = new ResourceType('AWS::Redshift::ClusterSecurityGroup');
  /** Amazon Redshift cluster snapshot */
  public static readonly REDSHIFT_CLUSTER_SNAPSHOT = new ResourceType('AWS::Redshift::ClusterSnapshot');
  /** Amazon Redshift cluster subnet group */
  public static readonly REDSHIFT_CLUSTER_SUBNET_GROUP = new ResourceType('AWS::Redshift::ClusterSubnetGroup');
  /** Amazon Redshift event subscription */
  public static readonly REDSHIFT_EVENT_SUBSCRIPTION = new ResourceType('AWS::Redshift::EventSubscription');
  /** Amazon RDS database instance */
  public static readonly RDS_DB_INSTANCE = new ResourceType('AWS::RDS::DBInstance');
  /** Amazon RDS database security group */
  public static readonly RDS_DB_SECURITY_GROUP = new ResourceType('AWS::RDS::DBSecurityGroup');
  /** Amazon RDS database snapshot */
  public static readonly RDS_DB_SNAPSHOT = new ResourceType('AWS::RDS::DBSnapshot');
  /** Amazon RDS database subnet group */
  public static readonly RDS_DB_SUBNET_GROUP = new ResourceType('AWS::RDS::DBSubnetGroup');
  /** Amazon RDS event subscription */
  public static readonly RDS_EVENT_SUBSCRIPTION = new ResourceType('AWS::RDS::EventSubscription');
  /** Amazon RDS database cluster */
  public static readonly RDS_DB_CLUSTER = new ResourceType('AWS::RDS::DBCluster');
  /** Amazon RDS database cluster snapshot */
  public static readonly RDS_DB_CLUSTER_SNAPSHOT = new ResourceType('AWS::RDS::DBClusterSnapshot');
  /** Amazon SQS queue */
  public static readonly SQS_QUEUE = new ResourceType('AWS::SQS::Queue');
  /** Amazon SNS topic */
  public static readonly SNS_TOPIC = new ResourceType('AWS::SNS::Topic');
  /** Amazon S3 bucket */
  public static readonly S3_BUCKET = new ResourceType('AWS::S3::Bucket');
  /** Amazon S3 account public access block */
  public static readonly S3_ACCOUNT_PUBLIC_ACCESS_BLOCK = new ResourceType('AWS::S3::AccountPublicAccessBlock');
  /** Amazon EC2 customer gateway */
  public static readonly EC2_CUSTOMER_GATEWAY = new ResourceType('AWS::EC2::CustomerGateway');
  /** Amazon EC2 internet gateway */
  public static readonly EC2_INTERNET_GATEWAY = new ResourceType('AWS::EC2::CustomerGateway');
  /** Amazon EC2 network ACL */
  public static readonly EC2_NETWORK_ACL = new ResourceType('AWS::EC2::NetworkAcl');
  /** Amazon EC2 route table */
  public static readonly EC2_ROUTE_TABLE = new ResourceType('AWS::EC2::RouteTable');
  /** Amazon EC2 subnet table */
  public static readonly EC2_SUBNET = new ResourceType('AWS::EC2::Subnet');
  /** Amazon EC2 VPC */
  public static readonly EC2_VPC = new ResourceType('AWS::EC2::VPC');
  /** Amazon EC2 VPN connection */
  public static readonly EC2_VPN_CONNECTION = new ResourceType('AWS::EC2::VPNConnection');
  /** Amazon EC2 VPN gateway */
  public static readonly EC2_VPN_GATEWAY = new ResourceType('AWS::EC2::VPNGateway');
  /** AWS Auto Scaling group */
  public static readonly AUTO_SCALING_GROUP = new ResourceType('AWS::AutoScaling::AutoScalingGroup');
  /** AWS Auto Scaling launch configuration */
  public static readonly AUTO_SCALING_LAUNCH_CONFIGURATION = new ResourceType('AWS::AutoScaling::LaunchConfiguration');
  /** AWS Auto Scaling policy */
  public static readonly AUTO_SCALING_POLICY = new ResourceType('AWS::AutoScaling::ScalingPolicy');
  /** AWS Auto Scaling scheduled action */
  public static readonly AUTO_SCALING_SCHEDULED_ACTION = new ResourceType('AWS::AutoScaling::ScheduledAction');
  /** AWS Certificate manager certificate */
  public static readonly ACM_CERTIFICATE = new ResourceType('AWS::ACM::Certificate');
  /** AWS CloudFormation stack */
  public static readonly CLOUDFORMATION_STACK = new ResourceType('AWS::CloudFormation::Stack');
  /** AWS CloudTrail trail */
  public static readonly CLOUDTRAIL_TRAIL = new ResourceType('AWS::CloudTrail::Trail');
  /** AWS CodeBuild project */
  public static readonly CODEBUILD_PROJECT = new ResourceType('AWS::CodeBuild::Project');
  /** AWS CodePipeline pipeline */
  public static readonly CODEPIPELINE_PIPELINE = new ResourceType('AWS::CodePipeline::Pipeline');
  /** AWS Elastic Beanstalk (EB) application */
  public static readonly ELASTIC_BEANSTALK_APPLICATION = new ResourceType('AWS::ElasticBeanstalk::Application');
  /** AWS Elastic Beanstalk (EB) application version */
  public static readonly ELASTIC_BEANSTALK_APPLICATION_VERSION = new ResourceType('AWS::ElasticBeanstalk::ApplicationVersion');
  /** AWS Elastic Beanstalk (EB) environment */
  public static readonly ELASTIC_BEANSTALK_ENVIRONMENT = new ResourceType('AWS::ElasticBeanstalk::Environment');
  /** AWS IAM user */
  public static readonly IAM_USER = new ResourceType('AWS::IAM::User');
  /** AWS IAM group */
  public static readonly IAM_GROUP = new ResourceType('AWS::IAM::Group');
  /** AWS IAM role */
  public static readonly IAM_ROLE = new ResourceType('AWS::IAM::Role');
  /** AWS IAM policy */
  public static readonly IAM_POLICY = new ResourceType('AWS::IAM::Policy');
  /** AWS KMS Key */
  public static readonly KMS_KEY = new ResourceType('AWS::KMS::Key');
  /** AWS Lambda function */
  public static readonly LAMBDA_FUNCTION = new ResourceType('AWS::Lambda::Function');
  /**AWS Secrets Manager secret */
  public static readonly SECRETS_MANAGER_SECRET = new ResourceType('AWS::SecretsManager::Secret');
  /** AWS Service Catalog CloudFormation product */
  public static readonly SERVICE_CATALOG_CLOUDFORMATION_PRODUCT = new ResourceType('AWS::ServiceCatalog::CloudFormationProduct');
  /** AWS Service Catalog CloudFormation provisioned product */
  public static readonly SERVICE_CATALOG_CLOUDFORMATION_PROVISIONED_PRODUCT = new ResourceType(
    'AWS::ServiceCatalog::CloudFormationProvisionedProduct');
  /** AWS Service Catalog portfolio */
  public static readonly SERVICE_CATALOG_PORTFOLIO = new ResourceType('AWS::ServiceCatalog::Portfolio');
  /** AWS Shield protection */
  public static readonly SHIELD_PROTECTION = new ResourceType('AWS::Shield::Protection');
  /** AWS Shield regional protection */
  public static readonly SHIELD_REGIONAL_PROTECTION = new ResourceType('AWS::ShieldRegional::Protection');
  /** AWS Systems Manager managed instance inventory */
  public static readonly SYSTEMS_MANAGER_MANAGED_INSTANCE_INVENTORY = new ResourceType('AWS::SSM::ManagedInstanceInventory');
  /** AWS Systems Manager patch compliance */
  public static readonly SYSTEMS_MANAGER_PATCH_COMPLIANCE = new ResourceType('AWS::SSM::PatchCompliance');
  /** AWS Systems Manager association compliance */
  public static readonly SYSTEMS_MANAGER_ASSOCIATION_COMPLIANCE = new ResourceType('AWS::SSM::AssociationCompliance');
  /** AWS Systems Manager file data */
  public static readonly SYSTEMS_MANAGER_FILE_DATA = new ResourceType('AWS::SSM::FileData');
  /** AWS WAF rate based rule */
  public static readonly WAF_RATE_BASED_RULE = new ResourceType('AWS::WAF::RateBasedRule');
  /** AWS WAF rule */
  public static readonly WAF_RULE = new ResourceType('AWS::WAF::Rule');
  /** AWS WAF web ACL */
  public static readonly WAF_WEB_ACL = new ResourceType('AWS::WAF::WebACL');
  /** AWS WAF rule group */
  public static readonly WAF_RULE_GROUP = new ResourceType('AWS::WAF::RuleGroup');
  /** AWS WAF regional rate based rule */
  public static readonly WAF_REGIONAL_RATE_BASED_RULE = new ResourceType('AWS::WAFRegional::RateBasedRule');
  /** AWS WAF regional rule */
  public static readonly WAF_REGIONAL_RULE = new ResourceType('AWS::WAFRegional::Rule');
  /** AWS WAF web ACL */
  public static readonly WAF_REGIONAL_WEB_ACL = new ResourceType('AWS::WAFRegional::WebACL');
  /** AWS WAF regional rule group */
  public static readonly WAF_REGIONAL_RULE_GROUP = new ResourceType('AWS::WAFRegional::RuleGroup');
  /** AWS WAFv2 web ACL */
  public static readonly WAFV2_WEB_ACL = new ResourceType('AWS::WAFv2::WebACL');
  /** AWS WAFv2 rule group */
  public static readonly WAFV2_RULE_GROUP = new ResourceType('AWS::WAFv2::RuleGroup');
  /** AWS WAFv2 managed rule set */
  public static readonly WAFV2_MANAGED_RULE_SET = new ResourceType('AWS::WAFv2::ManagedRuleSet');
  /** AWS X-Ray encryption configuration */
  public static readonly XRAY_ENCRYPTION_CONFIGURATION = new ResourceType('AWS::XRay::EncryptionConfig');
  /** AWS ELB classic load balancer */
  public static readonly ELB_LOAD_BALANCER = new ResourceType('AWS::ElasticLoadBalancing::LoadBalancer');
  /** AWS ELBv2 network load balancer or AWS ELBv2 application load balancer */
  public static readonly ELBV2_LOAD_BALANCER = new ResourceType('AWS::ElasticLoadBalancingV2::LoadBalancer');

  /** A custom resource type to support future cases. */
  public static of(type: string): ResourceType {
    return new ResourceType(type);
  }

  /**
   * Valid value of resource type.
   */
  public readonly complianceResourceType: string;

  private constructor(type: string) {
    this.complianceResourceType = type;
  }
}

function renderScope(ruleScope?: RuleScope): CfnConfigRule.ScopeProperty | undefined {
  return ruleScope ? {
    complianceResourceId: ruleScope.resourceId,
    complianceResourceTypes: ruleScope.resourceTypes?.map(resource => resource.complianceResourceType),
    tagKey: ruleScope.key,
    tagValue: ruleScope.value,
  } : undefined;
}
