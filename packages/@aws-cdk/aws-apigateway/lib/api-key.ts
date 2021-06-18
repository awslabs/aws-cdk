import * as iam from '@aws-cdk/aws-iam';
import { IResource as IResourceBase, Resource, Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnApiKey } from './apigateway.generated';
import { ResourceOptions } from './resource';
import { IRestApi } from './restapi';
import { QuotaSettings, ThrottleSettings, UsagePlan, UsagePlanPerApiStage } from './usage-plan';

/**
 * API keys are alphanumeric string values that you distribute to
 * app developer customers to grant access to your API
 */
export interface IApiKey extends IResourceBase {
  /**
   * The API key ID.
   * @attribute
   */
  readonly keyId: string;

  /**
   * The API key ARN.
   */
  readonly keyArn: string;
}

/**
 * The options for creating an API Key.
 */
export interface ApiKeyOptions extends ResourceOptions {
  /**
   * A name for the API key. If you don't specify a name, AWS CloudFormation generates a unique physical ID and uses that ID for the API key name.
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-apigateway-apikey.html#cfn-apigateway-apikey-name
   * @default automically generated name
   */
  readonly apiKeyName?: string;

  /**
   * The value of the API key. Must be at least 20 characters long.
   * @link https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-apigateway-apikey.html#cfn-apigateway-apikey-value
   * @default none
   */
  readonly value?: string;
}

/**
 * ApiKey Properties.
 */
export interface ApiKeyProps extends ApiKeyOptions {
  /**
   * A list of resources this api key is associated with.
   * @default none
   */
  readonly resources?: IRestApi[];

  /**
   * An AWS Marketplace customer identifier to use when integrating with the AWS SaaS Marketplace.
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-apigateway-apikey.html#cfn-apigateway-apikey-customerid
   * @default none
   */
  readonly customerId?: string;

  /**
   * A description of the purpose of the API key.
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-apigateway-apikey.html#cfn-apigateway-apikey-description
   * @default none
   */
  readonly description?: string;

  /**
   * Indicates whether the API key can be used by clients.
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-apigateway-apikey.html#cfn-apigateway-apikey-enabled
   * @default true
   */
  readonly enabled?: boolean;

  /**
   * Specifies whether the key identifier is distinct from the created API key value.
   * @link http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-apigateway-apikey.html#cfn-apigateway-apikey-generatedistinctid
   * @default false
   */
  readonly generateDistinctId?: boolean;
}

/**
 * Base implementation that is common to the various implementations of IApiKey
 */
abstract class ApiKeyBase extends Resource implements IApiKey {
  public abstract readonly keyId: string;
  public abstract readonly keyArn: string;

  /**
   * Permits the IAM principal all read operations through this key
   *
   * @param grantee The principal to grant access to
   */
  public grantRead(grantee: iam.IGrantable): iam.Grant {
    return iam.Grant.addToPrincipal({
      grantee,
      actions: readPermissions,
      resourceArns: [this.keyArn],
    });
  }

  /**
   * Permits the IAM principal all write operations through this key
   *
   * @param grantee The principal to grant access to
   */
  public grantWrite(grantee: iam.IGrantable): iam.Grant {
    return iam.Grant.addToPrincipal({
      grantee,
      actions: writePermissions,
      resourceArns: [this.keyArn],
    });
  }

  /**
   * Permits the IAM principal all read and write operations through this key
   *
   * @param grantee The principal to grant access to
   */
  public grantReadWrite(grantee: iam.IGrantable): iam.Grant {
    return iam.Grant.addToPrincipal({
      grantee,
      actions: [...readPermissions, ...writePermissions],
      resourceArns: [this.keyArn],
    });
  }
}

/**
 * An API Gateway ApiKey.
 *
 * An ApiKey can be distributed to API clients that are executing requests
 * for Method resources that require an Api Key.
 */
export class ApiKey extends ApiKeyBase {
  /**
   * Import an ApiKey by its Id
   */
  public static fromApiKeyId(scope: Construct, id: string, apiKeyId: string): IApiKey {
    class Import extends ApiKeyBase {
      public keyId = apiKeyId;
      public keyArn = Stack.of(this).formatArn({
        service: 'apigateway',
        account: '',
        resource: '/apikeys',
        sep: '/',
        resourceName: apiKeyId,
      });
    }

    return new Import(scope, id);
  }

  public readonly keyId: string;
  public readonly keyArn: string;

  constructor(scope: Construct, id: string, props: ApiKeyProps = { }) {
    super(scope, id, {
      physicalName: props.apiKeyName,
    });

    const resource = new CfnApiKey(this, 'Resource', {
      customerId: props.customerId,
      description: props.description,
      enabled: props.enabled || true,
      generateDistinctId: props.generateDistinctId,
      name: this.physicalName,
      stageKeys: this.renderStageKeys(props.resources),
      value: props.value,
    });

    this.keyId = resource.ref;
    this.keyArn = Stack.of(this).formatArn({
      service: 'apigateway',
      account: '',
      resource: '/apikeys',
      sep: '/',
      resourceName: this.keyId,
    });
  }

  private renderStageKeys(resources: IRestApi[] | undefined): CfnApiKey.StageKeyProperty[] | undefined {
    if (!resources) {
      return undefined;
    }

    return resources.map((resource: IRestApi) => {
      const restApi = resource;
      const restApiId = restApi.restApiId;
      const stageName = restApi.deploymentStage!.stageName.toString();
      return { restApiId, stageName };
    });
  }
}

/**
 * RateLimitedApiKey properties.
 */
export interface RateLimitedApiKeyProps extends ApiKeyProps {
  /**
   * API Stages to be associated with the RateLimitedApiKey.
   * @default none
   */
  readonly apiStages?: UsagePlanPerApiStage[];

  /**
   * Number of requests clients can make in a given time period.
   * @default none
   */
  readonly quota?: QuotaSettings;

  /**
   * Overall throttle settings for the API.
   * @default none
   */
  readonly throttle?: ThrottleSettings;
}

/**
 * An API Gateway ApiKey, for which a rate limiting configuration can be specified.
 *
 * @resource AWS::ApiGateway::ApiKey
 */
export class RateLimitedApiKey extends ApiKeyBase {
  public readonly keyId: string;
  public readonly keyArn: string;

  constructor(scope: Construct, id: string, props: RateLimitedApiKeyProps = { }) {
    super(scope, id, {
      physicalName: props.apiKeyName,
    });

    const resource = new ApiKey(this, 'Resource', props);

    if (props.apiStages || props.quota || props.throttle) {
      new UsagePlan(this, 'UsagePlanResource', {
        apiKey: resource,
        apiStages: props.apiStages,
        quota: props.quota,
        throttle: props.throttle,
      });
    }

    this.keyId = resource.keyId;
    this.keyArn = resource.keyArn;
  }
}

const readPermissions = [
  'apigateway:GET',
];

const writePermissions = [
  'apigateway:POST',
  'apigateway:PUT',
  'apigateway:PATCH',
  'apigateway:DELETE',
];