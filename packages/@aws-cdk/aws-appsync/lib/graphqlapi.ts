import { IUserPool } from '@aws-cdk/aws-cognito';
import { ManagedPolicy, Role, IRole, ServicePrincipal, Grant, IGrantable } from '@aws-cdk/aws-iam';
import { CfnResource, Duration, Expiration, IResolvable, Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnApiKey, CfnGraphQLApi, CfnGraphQLSchema } from './appsync.generated';
import { IGraphqlApi, GraphqlApiBase } from './graphqlapi-base';
import { Schema } from './schema';
import { IIntermediateType } from './schema-base';
import { ResolvableField } from './schema-field';
import { ObjectType } from './schema-intermediate';

/**
 * enum with all possible values for AppSync authorization type
 */
export enum AuthorizationType {
  /**
   * API Key authorization type
   */
  API_KEY = 'API_KEY',
  /**
   * AWS IAM authorization type. Can be used with Cognito Identity Pool federated credentials
   */
  IAM = 'AWS_IAM',
  /**
   * Cognito User Pool authorization type
   */
  USER_POOL = 'AMAZON_COGNITO_USER_POOLS',
  /**
   * OpenID Connect authorization type
   */
  OIDC = 'OPENID_CONNECT',
}

/**
 * Interface to specify default or additional authorization(s)
 */
export interface AuthorizationMode {
  /**
   * One of possible four values AppSync supports
   *
   * @see https://docs.aws.amazon.com/appsync/latest/devguide/security.html
   *
   * @default - `AuthorizationType.API_KEY`
   */
  readonly authorizationType: AuthorizationType;
  /**
   * If authorizationType is `AuthorizationType.USER_POOL`, this option is required.
   * @default - none
   */
  readonly userPoolConfig?: UserPoolConfig;
  /**
   * If authorizationType is `AuthorizationType.API_KEY`, this option can be configured.
   * @default - name: 'DefaultAPIKey' | description: 'Default API Key created by CDK'
   */
  readonly apiKeyConfig?: ApiKeyConfig;
  /**
   * If authorizationType is `AuthorizationType.OIDC`, this option is required.
   * @default - none
   */
  readonly openIdConnectConfig?: OpenIdConnectConfig;
}

/**
 * enum with all possible values for Cognito user-pool default actions
 */
export enum UserPoolDefaultAction {
  /**
   * ALLOW access to API
   */
  ALLOW = 'ALLOW',
  /**
   * DENY access to API
   */
  DENY = 'DENY',
}

/**
 * Configuration for Cognito user-pools in AppSync
 */
export interface UserPoolConfig {
  /**
   * The Cognito user pool to use as identity source
   */
  readonly userPool: IUserPool;
  /**
   * the optional app id regex
   *
   * @default -  None
   */
  readonly appIdClientRegex?: string;
  /**
   * Default auth action
   *
   * @default ALLOW
   */
  readonly defaultAction?: UserPoolDefaultAction;
}

/**
 * Configuration for API Key authorization in AppSync
 */
export interface ApiKeyConfig {
  /**
   * Unique name of the API Key
   * @default - 'DefaultAPIKey'
   */
  readonly name?: string;
  /**
   * Description of API key
   * @default - 'Default API Key created by CDK'
   */
  readonly description?: string;

  /**
   * The time from creation time after which the API key expires.
   * It must be a minimum of 1 day and a maximum of 365 days from date of creation.
   * Rounded down to the nearest hour.
   *
   * @default - 7 days rounded down to nearest hour
   */
  readonly expires?: Expiration;
}

/**
 * Configuration for OpenID Connect authorization in AppSync
 */
export interface OpenIdConnectConfig {
  /**
   * The number of milliseconds an OIDC token is valid after being authenticated by OIDC provider.
   * `auth_time` claim in OIDC token is required for this validation to work.
   * @default - no validation
   */
  readonly tokenExpiryFromAuth?: number;
  /**
   * The number of milliseconds an OIDC token is valid after being issued to a user.
   * This validation uses `iat` claim of OIDC token.
   * @default - no validation
   */
  readonly tokenExpiryFromIssue?: number;
  /**
   * The client identifier of the Relying party at the OpenID identity provider.
   * A regular expression can be specified so AppSync can validate against multiple client identifiers at a time.
   * @example - 'ABCD|CDEF' where ABCD and CDEF are two different clientId
   * @default - * (All)
   */
  readonly clientId?: string;
  /**
   * The issuer for the OIDC configuration. The issuer returned by discovery must exactly match the value of `iss` in the OIDC token.
   */
  readonly oidcProvider: string;
}

/**
 * Configuration of the API authorization modes.
 */
export interface AuthorizationConfig {
  /**
   * Optional authorization configuration
   *
   * @default - API Key authorization
   */
  readonly defaultAuthorization?: AuthorizationMode;

  /**
   * Additional authorization modes
   *
   * @default - No other modes
   */
  readonly additionalAuthorizationModes?: AuthorizationMode[];
}

/**
 * log-level for fields in AppSync
 */
export enum FieldLogLevel {
  /**
   * No logging
   */
  NONE = 'NONE',
  /**
   * Error logging
   */
  ERROR = 'ERROR',
  /**
   * All logging
   */
  ALL = 'ALL',
}

/**
 * Logging configuration for AppSync
 */
export interface LogConfig {
  /**
   * exclude verbose content
   *
   * @default false
   */
  readonly excludeVerboseContent?: boolean | IResolvable;
  /**
   * log level for fields
   *
   * @default - Use AppSync default
   */
  readonly fieldLogLevel?: FieldLogLevel;

  /**
   * The role for CloudWatch Logs
   *
   * @default - None
   */
  readonly role?: IRole;
}

/**
 * Properties for an AppSync GraphQL API
 */
export interface GraphqlApiProps {
  /**
   * the name of the GraphQL API
   */
  readonly name: string;

  /**
   * Optional authorization configuration
   *
   * @default - API Key authorization
   */
  readonly authorizationConfig?: AuthorizationConfig;

  /**
   * Logging configuration for this api
   *
   * @default - None
   */
  readonly logConfig?: LogConfig;

  /**
   * GraphQL schema definition. Specify how you want to define your schema.
   *
   * Schema.fromFile(filePath: string) allows schema definition through schema.graphql file
   *
   * @default - schema will be generated code-first (i.e. addType, addObjectType, etc.)
   *
   */
  readonly schema?: Schema;
  /**
   * A flag indicating whether or not X-Ray tracing is enabled for the GraphQL API.
   *
   * @default - false
   */
  readonly xrayEnabled?: boolean;
}

/**
 * A class used to generate resource arns for AppSync
 */
export class IamResource {
  /**
   * Generate the resource names given custom arns
   *
   * @param arns The custom arns that need to be permissioned
   *
   * Example: custom('/types/Query/fields/getExample')
   */
  public static custom(...arns: string[]): IamResource {
    if (arns.length === 0) {
      throw new Error('At least 1 custom ARN must be provided.');
    }
    return new IamResource(arns);
  }

  /**
   * Generate the resource names given a type and fields
   *
   * @param type The type that needs to be allowed
   * @param fields The fields that need to be allowed, if empty grant permissions to ALL fields
   *
   * Example: ofType('Query', 'GetExample')
   */
  public static ofType(type: string, ...fields: string[]): IamResource {
    const arns = fields.length ? fields.map((field) => `types/${type}/fields/${field}`) : [`types/${type}/*`];
    return new IamResource(arns);
  }

  /**
   * Generate the resource names that accepts all types: `*`
   */
  public static all(): IamResource {
    return new IamResource(['*']);
  }

  private arns: string[];

  private constructor(arns: string[]) {
    this.arns = arns;
  }

  /**
   * Return the Resource ARN
   *
   * @param api The GraphQL API to give permissions
   */
  public resourceArns(api: GraphqlApi): string[] {
    return this.arns.map((arn) => Stack.of(api).formatArn({
      service: 'appsync',
      resource: `apis/${api.apiId}`,
      sep: '/',
      resourceName: `${arn}`,
    }));
  }
}

/**
 * Attributes for GraphQL imports
 */
export interface GraphqlApiAttributes {
  /**
   * an unique AWS AppSync GraphQL API identifier
   * i.e. 'lxz775lwdrgcndgz3nurvac7oa'
   */
  readonly graphqlApiId: string,

  /**
   * the arn for the GraphQL Api
   * @default - autogenerated arn
   */
  readonly graphqlApiArn?: string,
}

/**
 * An AppSync GraphQL API
 *
 * @resource AWS::AppSync::GraphQLApi
 */
export class GraphqlApi extends GraphqlApiBase {
  /**
   * Import a GraphQL API through this function
   *
   * @param scope scope
   * @param id id
   * @param attrs GraphQL API Attributes of an API
   */
  public static fromGraphqlApiAttributes(scope: Construct, id: string, attrs: GraphqlApiAttributes): IGraphqlApi {
    const arn = attrs.graphqlApiArn ?? Stack.of(scope).formatArn({
      service: 'appsync',
      resource: `apis/${attrs.graphqlApiId}`,
    });
    class Import extends GraphqlApiBase {
      public readonly apiId = attrs.graphqlApiId;
      public readonly arn = arn;
      constructor (s: Construct, i: string) {
        super(s, i);
      }
    }
    return new Import(scope, id);
  }

  /**
   * an unique AWS AppSync GraphQL API identifier
   * i.e. 'lxz775lwdrgcndgz3nurvac7oa'
   */
  public readonly apiId: string;

  /**
   * the ARN of the API
   */
  public readonly arn: string;

  /**
   * the URL of the endpoint created by AppSync
   *
   * @attribute GraphQlUrl
   */
  public readonly graphqlUrl: string;

  /**
   * the name of the API
   */
  public readonly name: string;

  /**
   * the schema attached to this api
   */
  public readonly schema: Schema;

  /**
   * The Authorization Types for this GraphQL Api
   */
  public readonly modes: AuthorizationType[];

  /**
   * the configured API key, if present
   *
   * @default - no api key
   */
  public readonly apiKey?: string;

  private schemaResource: CfnGraphQLSchema;
  private api: CfnGraphQLApi;
  private apiKeyResource?: CfnApiKey;

  constructor(scope: Construct, id: string, props: GraphqlApiProps) {
    super(scope, id);

    const defaultMode = props.authorizationConfig?.defaultAuthorization ??
      { authorizationType: AuthorizationType.API_KEY };
    const additionalModes = props.authorizationConfig?.additionalAuthorizationModes ?? [];
    const modes = [defaultMode, ...additionalModes];

    this.modes = modes.map((mode) => mode.authorizationType );

    this.validateAuthorizationProps(modes);

    this.api = new CfnGraphQLApi(this, 'Resource', {
      name: props.name,
      authenticationType: defaultMode.authorizationType,
      logConfig: this.setupLogConfig(props.logConfig),
      openIdConnectConfig: this.setupOpenIdConnectConfig(defaultMode.openIdConnectConfig),
      userPoolConfig: this.setupUserPoolConfig(defaultMode.userPoolConfig),
      additionalAuthenticationProviders: this.setupAdditionalAuthorizationModes(additionalModes),
      xrayEnabled: props.xrayEnabled,
    });

    this.apiId = this.api.attrApiId;
    this.arn = this.api.attrArn;
    this.graphqlUrl = this.api.attrGraphQlUrl;
    this.name = this.api.name;
    this.schema = props.schema ?? Schema.fromCode();
    this.schemaResource = this.schema.bind(this);

    if (modes.some((mode) => mode.authorizationType === AuthorizationType.API_KEY)) {
      const config = modes.find((mode: AuthorizationMode) => {
        return mode.authorizationType === AuthorizationType.API_KEY && mode.apiKeyConfig;
      })?.apiKeyConfig;
      this.apiKeyResource = this.createAPIKey(config);
      this.apiKeyResource.addDependsOn(this.schemaResource);
      this.apiKey = this.apiKeyResource.attrApiKey;
    }
  }

  /**
   * Adds an IAM policy statement associated with this GraphQLApi to an IAM
   * principal's policy.
   *
   * @param grantee The principal
   * @param resources The set of resources to allow (i.e. ...:[region]:[accountId]:apis/GraphQLId/...)
   * @param actions The actions that should be granted to the principal (i.e. appsync:graphql )
   */
  public grant(grantee: IGrantable, resources: IamResource, ...actions: string[]): Grant {
    return Grant.addToPrincipal({
      grantee,
      actions,
      resourceArns: resources.resourceArns(this),
      scope: this,
    });
  }

  /**
   * Adds an IAM policy statement for Mutation access to this GraphQLApi to an IAM
   * principal's policy.
   *
   * @param grantee The principal
   * @param fields The fields to grant access to that are Mutations (leave blank for all)
   */
  public grantMutation(grantee: IGrantable, ...fields: string[]): Grant {
    return this.grant(grantee, IamResource.ofType('Mutation', ...fields), 'appsync:GraphQL');
  }

  /**
   * Adds an IAM policy statement for Query access to this GraphQLApi to an IAM
   * principal's policy.
   *
   * @param grantee The principal
   * @param fields The fields to grant access to that are Queries (leave blank for all)
   */
  public grantQuery(grantee: IGrantable, ...fields: string[]): Grant {
    return this.grant(grantee, IamResource.ofType('Query', ...fields), 'appsync:GraphQL');
  }

  /**
   * Adds an IAM policy statement for Subscription access to this GraphQLApi to an IAM
   * principal's policy.
   *
   * @param grantee The principal
   * @param fields The fields to grant access to that are Subscriptions (leave blank for all)
   */
  public grantSubscription(grantee: IGrantable, ...fields: string[]): Grant {
    return this.grant(grantee, IamResource.ofType('Subscription', ...fields), 'appsync:GraphQL');
  }

  private validateAuthorizationProps(modes: AuthorizationMode[]) {
    modes.map((mode) => {
      if (mode.authorizationType === AuthorizationType.OIDC && !mode.openIdConnectConfig) {
        throw new Error('Missing default OIDC Configuration');
      }
      if (mode.authorizationType === AuthorizationType.USER_POOL && !mode.userPoolConfig) {
        throw new Error('Missing default OIDC Configuration');
      }
    });
    if (modes.filter((mode) => mode.authorizationType === AuthorizationType.API_KEY).length > 1) {
      throw new Error('You can\'t duplicate API_KEY configuration. See https://docs.aws.amazon.com/appsync/latest/devguide/security.html');
    }
    if (modes.filter((mode) => mode.authorizationType === AuthorizationType.IAM).length > 1) {
      throw new Error('You can\'t duplicate IAM configuration. See https://docs.aws.amazon.com/appsync/latest/devguide/security.html');
    }
  }

  /**
   * Add schema dependency to a given construct
   *
   * @param construct the dependee
   */
  public addSchemaDependency(construct: CfnResource): boolean {
    construct.addDependsOn(this.schemaResource);
    return true;
  }

  private setupLogConfig(config?: LogConfig) {
    if (!config) return undefined;
    const logsRoleArn: string = config.role?.roleArn ?? new Role(this, 'ApiLogsRole', {
      assumedBy: new ServicePrincipal('appsync.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSAppSyncPushToCloudWatchLogs'),
      ],
    }).roleArn;
    return {
      cloudWatchLogsRoleArn: logsRoleArn,
      excludeVerboseContent: config.excludeVerboseContent,
      fieldLogLevel: config.fieldLogLevel,
    };
  }

  private setupOpenIdConnectConfig(config?: OpenIdConnectConfig) {
    if (!config) return undefined;
    return {
      authTtl: config.tokenExpiryFromAuth,
      clientId: config.clientId,
      iatTtl: config.tokenExpiryFromIssue,
      issuer: config.oidcProvider,
    };
  }

  private setupUserPoolConfig(config?: UserPoolConfig) {
    if (!config) return undefined;
    return {
      userPoolId: config.userPool.userPoolId,
      awsRegion: config.userPool.stack.region,
      appIdClientRegex: config.appIdClientRegex,
      defaultAction: config.defaultAction || UserPoolDefaultAction.ALLOW,
    };
  }

  private setupAdditionalAuthorizationModes(modes?: AuthorizationMode[]) {
    if (!modes || modes.length === 0) return undefined;
    return modes.reduce<CfnGraphQLApi.AdditionalAuthenticationProviderProperty[]>((acc, mode) => [
      ...acc, {
        authenticationType: mode.authorizationType,
        userPoolConfig: this.setupUserPoolConfig(mode.userPoolConfig),
        openIdConnectConfig: this.setupOpenIdConnectConfig(mode.openIdConnectConfig),
      },
    ], []);
  }

  private createAPIKey(config?: ApiKeyConfig) {
    if (config?.expires?.isBefore(Duration.days(1)) || config?.expires?.isAfter(Duration.days(365))) {
      throw Error('API key expiration must be between 1 and 365 days.');
    }
    const expires = config?.expires ? config?.expires.toEpoch() : undefined;
    return new CfnApiKey(this, `${config?.name || 'Default'}ApiKey`, {
      expires,
      description: config?.description,
      apiId: this.apiId,
    });
  }

  /**
   * Escape hatch to append to Schema as desired. Will always result
   * in a newline.
   *
   * @param addition the addition to add to schema
   * @param delimiter the delimiter between schema and addition
   * @default - ''
   *
   */
  public addToSchema(addition: string, delimiter?: string): void {
    this.schema.addToSchema(addition, delimiter);
  }

  /**
   * Add type to the schema
   *
   * @param type the intermediate type to add to the schema
   *
   */
  public addType(type: IIntermediateType): IIntermediateType {
    return this.schema.addType(type);
  }

  /**
   * Add a query field to the schema's Query. CDK will create an
   * Object Type called 'Query'. For example,
   *
   * type Query {
   *   fieldName: Field.returnType
   * }
   *
   * @param fieldName the name of the query
   * @param field the resolvable field to for this query
   */
  public addQuery(fieldName: string, field: ResolvableField): ObjectType {
    return this.schema.addQuery(fieldName, field);
  }

  /**
   * Add a mutation field to the schema's Mutation. CDK will create an
   * Object Type called 'Mutation'. For example,
   *
   * type Mutation {
   *   fieldName: Field.returnType
   * }
   *
   * @param fieldName the name of the Mutation
   * @param field the resolvable field to for this Mutation
   */
  public addMutation(fieldName: string, field: ResolvableField): ObjectType {
    return this.schema.addMutation(fieldName, field);
  }

  /**
   * Add a subscription field to the schema's Subscription. CDK will create an
   * Object Type called 'Subscription'. For example,
   *
   * type Subscription {
   *   fieldName: Field.returnType
   * }
   *
   * @param fieldName the name of the Subscription
   * @param field the resolvable field to for this Subscription
   */
  public addSubscription(fieldName: string, field: ResolvableField): ObjectType {
    return this.schema.addSubscription(fieldName, field);
  }
}
