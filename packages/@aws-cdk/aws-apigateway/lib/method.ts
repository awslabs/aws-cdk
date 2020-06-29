import { Construct, Resource, Stack } from '@aws-cdk/core';
import { CfnMethod, CfnMethodProps } from './apigateway.generated';
import { Authorizer, IAuthorizer } from './authorizer';
import { ConnectionType, Integration } from './integration';
import { MockIntegration } from './integrations/mock';
import { MethodResponse } from './methodresponse';
import { IModel } from './model';
import { IRequestValidator, RequestValidatorOptions } from './requestvalidator';
import { IResource } from './resource';
import { IRestApi, RestApi, RestApiBase } from './restapi';
import { validateHttpMethod } from './util';

export interface MethodOptions {
  /**
   * A friendly operation name for the method. For example, you can assign the
   * OperationName of ListPets for the GET /pets method.
   */
  readonly operationName?: string;

  /**
   * Method authorization.
   * If the value is set of `Custom`, an `authorizer` must also be specified.
   *
   * If you're using one of the authorizers that are available via the {@link Authorizer} class, such as {@link Authorizer#token()},
   * it is recommended that this option not be specified. The authorizer will take care of setting the correct authorization type.
   * However, specifying an authorization type using this property that conflicts with what is expected by the {@link Authorizer}
   * will result in an error.
   *
   * @default - open access unless `authorizer` is specified
   */
  readonly authorizationType?: AuthorizationType;

  /**
   * If `authorizationType` is `Custom`, this specifies the ID of the method
   * authorizer resource.
   * If specified, the value of `authorizationType` must be set to `Custom`
   */
  readonly authorizer?: IAuthorizer;

  /**
   * Indicates whether the method requires clients to submit a valid API key.
   * @default false
   */
  readonly apiKeyRequired?: boolean;

  /**
   * The responses that can be sent to the client who calls the method.
   * @default None
   *
   * This property is not required, but if these are not supplied for a Lambda
   * proxy integration, the Lambda function must return a value of the correct format,
   * for the integration response to be correctly mapped to a response to the client.
   * @see https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-method-settings-method-response.html
   */
  readonly methodResponses?: MethodResponse[];

  /**
   * The request parameters that API Gateway accepts. Specify request parameters
   * as key-value pairs (string-to-Boolean mapping), with a source as the key and
   * a Boolean as the value. The Boolean specifies whether a parameter is required.
   * A source must match the format method.request.location.name, where the location
   * is querystring, path, or header, and name is a valid, unique parameter name.
   * @default None
   */
  readonly requestParameters?: { [param: string]: boolean };

  /**
   * The models which describe data structure of request payload. When
   * combined with `requestValidator` or `requestValidatorOptions`, the service
   * will validate the API request payload before it reaches the API's Integration (including proxies).
   * Specify `requestModels` as key-value pairs, with a content type
   * (e.g. `'application/json'`) as the key and an API Gateway Model as the value.
   *
   * @example
   *
   *     const userModel: apigateway.Model = api.addModel('UserModel', {
   *         schema: {
   *             type: apigateway.JsonSchemaType.OBJECT
   *             properties: {
   *                 userId: {
   *                     type: apigateway.JsonSchema.STRING
   *                 },
   *                 name: {
   *                     type: apigateway.JsonSchema.STRING
   *                 }
   *             },
   *             required: ['userId']
   *         }
   *     });
   *     api.root.addResource('user').addMethod('POST',
   *         new apigateway.LambdaIntegration(userLambda), {
   *             requestModels: {
   *                 'application/json': userModel
   *             }
   *         }
   *     );
   *
   * @see https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-method-settings-method-request.html#setup-method-request-model
   */
  readonly requestModels?: { [param: string]: IModel };

  /**
   * The ID of the associated request validator.
   * Only one of `requestValidator` or `requestValidatorOptions` must be specified.
   * Works together with `requestModels` or `requestParameters` to validate
   * the request before it reaches integration like Lambda Proxy Integration.
   * @default - No default validator
   */
  readonly requestValidator?: IRequestValidator;

  /**
   * A list of authorization scopes configured on the method. The scopes are used with
   * a COGNITO_USER_POOLS authorizer to authorize the method invocation.
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-apigateway-method.html#cfn-apigateway-method-authorizationscopes
   * @default - no authorization scopes
   */
  readonly authorizationScopes?: string[];

  /**
   * Request validator options to create new validator
   * Only one of `requestValidator` or `requestValidatorOptions` must be specified.
   * Works together with `requestModels` or `requestParameters` to validate
   * the request before it reaches integration like Lambda Proxy Integration.
   * @default - No default validator
   */
  readonly requestValidatorOptions?: RequestValidatorOptions;
}

export interface MethodProps {
  /**
   * The resource this method is associated with. For root resource methods,
   * specify the `RestApi` object.
   */
  readonly resource: IResource;

  /**
   * The HTTP method ("GET", "POST", "PUT", ...) that clients use to call this method.
   */
  readonly httpMethod: string;

  /**
   * The backend system that the method calls when it receives a request.
   *
   * @default - a new `MockIntegration`.
   */
  readonly integration?: Integration;

  /**
   * Method options.
   *
   * @default - No options.
   */
  readonly options?: MethodOptions;
}

export class Method extends Resource {
  /** @attribute */
  public readonly methodId: string;

  public readonly httpMethod: string;
  public readonly resource: IResource;
  /**
   * The API Gateway RestApi associated with this method.
   */
  public readonly api: IRestApi;

  constructor(scope: Construct, id: string, props: MethodProps) {
    super(scope, id);

    this.resource = props.resource;
    this.api = props.resource.api;
    this.httpMethod = props.httpMethod.toUpperCase();

    validateHttpMethod(this.httpMethod);

    const options = props.options || {};

    const defaultMethodOptions = props.resource.defaultMethodOptions || {};
    const authorizer = options.authorizer || defaultMethodOptions.authorizer;
    let authorizerId = authorizer?.authorizerId;

    const authorizationTypeOption = options.authorizationType || defaultMethodOptions.authorizationType;
    let authorizationType = authorizer?.authorizationType || authorizationTypeOption || AuthorizationType.NONE;
    let apiKeyRequired = options.apiKeyRequired || defaultMethodOptions.apiKeyRequired;

    // if the authorizer defines an authorization type and we also have an explicit option set, check that they are the same
    if (authorizer?.authorizationType && authorizationTypeOption && authorizer?.authorizationType !== authorizationTypeOption) {
      throw new Error(`${this.resource}/${this.httpMethod} - Authorization type is set to ${authorizationTypeOption} ` +
        `which is different from what is required by the authorizer [${authorizer.authorizationType}]`);
    }

    if (Authorizer.isAuthorizer(authorizer)) {
      authorizer._attachToApi(this.api);
    }

    if (this.httpMethod === 'OPTIONS') {
      authorizerId = null;
      authorizationType = AuthorizationType.NONE
      apiKeyRequired = false
    }

     const methodProps: CfnMethodProps = {
      resourceId: props.resource.resourceId,
      restApiId: this.api.restApiId,
      httpMethod: this.httpMethod,
      operationName: options.operationName || defaultMethodOptions.operationName,
      apiKeyRequired,
      authorizationType,
      authorizerId,
      requestParameters: options.requestParameters || defaultMethodOptions.requestParameters,
      integration: this.renderIntegration(props.integration),
      methodResponses: this.renderMethodResponses(options.methodResponses),
      requestModels: this.renderRequestModels(options.requestModels),
      requestValidatorId: this.requestValidatorId(options),
      authorizationScopes: options.authorizationScopes ?? defaultMethodOptions.authorizationScopes,
    };

    const resource = new CfnMethod(this, 'Resource', methodProps);

    this.methodId = resource.ref;

    if (RestApiBase._isRestApiBase(props.resource.api)) {
      props.resource.api._attachMethod(this);
    }

    const deployment = props.resource.api.latestDeployment;
    if (deployment) {
      deployment.node.addDependency(resource);
      deployment.addToLogicalId({ method: methodProps });
    }
  }

  /**
   * The RestApi associated with this Method
   * @deprecated - Throws an error if this Resource is not associated with an instance of `RestApi`. Use `api` instead.
   */
  public get restApi(): RestApi {
    return this.resource.restApi;
  }

  /**
   * Returns an execute-api ARN for this method:
   *
   *   arn:aws:execute-api:{region}:{account}:{restApiId}/{stage}/{method}/{path}
   *
   * NOTE: {stage} will refer to the `restApi.deploymentStage`, which will
   * automatically set if auto-deploy is enabled.
   *
   * @attribute
   */
  public get methodArn(): string {
    if (!this.restApi.deploymentStage) {
      throw new Error(
        `Unable to determine ARN for method "${this.node.id}" since there is no stage associated with this API.\n` +
        'Either use the `deploy` prop or explicitly assign `deploymentStage` on the RestApi');
    }

    const stage = this.restApi.deploymentStage.stageName.toString();
    return this.restApi.arnForExecuteApi(this.httpMethod, pathForArn(this.resource.path), stage);
  }

  /**
   * Returns an execute-api ARN for this method's "test-invoke-stage" stage.
   * This stage is used by the AWS Console UI when testing the method.
   */
  public get testMethodArn(): string {
    return this.restApi.arnForExecuteApi(this.httpMethod, pathForArn(this.resource.path), 'test-invoke-stage');
  }

  private renderIntegration(integration?: Integration): CfnMethod.IntegrationProperty {
    if (!integration) {
      // use defaultIntegration from API if defined
      if (this.resource.defaultIntegration) {
        return this.renderIntegration(this.resource.defaultIntegration);
      }

      // fallback to mock
      return this.renderIntegration(new MockIntegration());
    }

    integration.bind(this);

    const options = integration._props.options || { };

    let credentials;
    if (options.credentialsPassthrough !== undefined && options.credentialsRole !== undefined) {
      throw new Error('\'credentialsPassthrough\' and \'credentialsRole\' are mutually exclusive');
    }

    if (options.connectionType === ConnectionType.VPC_LINK && options.vpcLink === undefined) {
      throw new Error('\'connectionType\' of VPC_LINK requires \'vpcLink\' prop to be set');
    }

    if (options.connectionType === ConnectionType.INTERNET && options.vpcLink !== undefined) {
      throw new Error('cannot set \'vpcLink\' where \'connectionType\' is INTERNET');
    }

    if (options.credentialsRole) {
      credentials = options.credentialsRole.roleArn;
    } else if (options.credentialsPassthrough) {
      // arn:aws:iam::*:user/*
      // tslint:disable-next-line:max-line-length
      credentials = Stack.of(this).formatArn({ service: 'iam', region: '', account: '*', resource: 'user', sep: '/', resourceName: '*' });
    }

    return {
      type: integration._props.type,
      uri: integration._props.uri,
      cacheKeyParameters: options.cacheKeyParameters,
      cacheNamespace: options.cacheNamespace,
      contentHandling: options.contentHandling,
      integrationHttpMethod: integration._props.integrationHttpMethod,
      requestParameters: options.requestParameters,
      requestTemplates: options.requestTemplates,
      passthroughBehavior: options.passthroughBehavior,
      integrationResponses: options.integrationResponses,
      connectionType: options.connectionType,
      connectionId: options.vpcLink ? options.vpcLink.vpcLinkId : undefined,
      credentials,
    };
  }

  private renderMethodResponses(methodResponses: MethodResponse[] | undefined): CfnMethod.MethodResponseProperty[] | undefined {
    if (!methodResponses) {
      // Fall back to nothing
      return undefined;
    }

    return methodResponses.map(mr => {
      let responseModels: {[contentType: string]: string} | undefined;

      if (mr.responseModels) {
        responseModels = {};
        for (const contentType in mr.responseModels) {
          if (mr.responseModels.hasOwnProperty(contentType)) {
            responseModels[contentType] = mr.responseModels[contentType].modelId;
          }
        }
      }

      const methodResponseProp = {
        statusCode: mr.statusCode,
        responseParameters: mr.responseParameters,
        responseModels,
      };

      return methodResponseProp;
    });
  }

  private renderRequestModels(requestModels: { [param: string]: IModel } | undefined): { [param: string]: string } | undefined {
    if (!requestModels) {
      // Fall back to nothing
      return undefined;
    }

    const models: {[param: string]: string} = {};
    for (const contentType in requestModels) {
      if (requestModels.hasOwnProperty(contentType)) {
        models[contentType] = requestModels[contentType].modelId;
      }
    }

    return models;
  }

  private requestValidatorId(options: MethodOptions): string | undefined {
    if (options.requestValidator && options.requestValidatorOptions) {
      throw new Error('Only one of \'requestValidator\' or \'requestValidatorOptions\' must be specified.');
    }

    if (options.requestValidatorOptions) {
      const validator = this.restApi.addRequestValidator('validator', options.requestValidatorOptions);
      return validator.requestValidatorId;
    }

    // For backward compatibility
    return options.requestValidator?.requestValidatorId;
  }
}

export enum AuthorizationType {
  /**
   * Open access.
   */
  NONE = 'NONE',

  /**
   * Use AWS IAM permissions.
   */
  IAM = 'AWS_IAM',

  /**
   * Use a custom authorizer.
   */
  CUSTOM = 'CUSTOM',

  /**
   * Use an AWS Cognito user pool.
   */
  COGNITO = 'COGNITO_USER_POOLS',
}

function pathForArn(path: string): string {
  return path.replace(/\{[^\}]*\}/g, '*'); // replace path parameters (like '{bookId}') with asterisk
}
