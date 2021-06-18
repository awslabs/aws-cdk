import { ICertificate } from '@aws-cdk/aws-certificatemanager';
import { IResource, Resource, Stack, Token } from '@aws-cdk/core';
import { AwsCustomResource, AwsCustomResourcePolicy, AwsSdkCall, PhysicalResourceId } from '@aws-cdk/custom-resources';
import { Construct } from 'constructs';
import { CfnUserPoolDomain } from './cognito.generated';
import { IUserPool } from './user-pool';
import { UserPoolClient } from './user-pool-client';

/**
 * Represents a user pool domain.
 */
export interface IUserPoolDomain extends IResource {
  /**
   * The domain that was specified to be created.
   * If `customDomain` was selected, this holds the full domain name that was specified.
   * If the `cognitoDomain` was used, it contains the prefix to the Cognito hosted domain.
   * @attribute
   */
  readonly domainName: string;
}

/**
 * Options while specifying custom domain
 * @see https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-add-custom-domain.html
 */
export interface CustomDomainOptions {
  /**
   * The custom domain name that you would like to associate with this User Pool.
   */
  readonly domainName: string;

  /**
   * The certificate to associate with this domain.
   */
  readonly certificate: ICertificate;
}

/**
 * Options while specifying a cognito prefix domain.
 * @see https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-assign-domain-prefix.html
 */
export interface CognitoDomainOptions {
  /**
   * The prefix to the Cognito hosted domain name that will be associated with the user pool.
   */
  readonly domainPrefix: string;
}

/**
 * Options to create a UserPoolDomain
 */
export interface UserPoolDomainOptions {
  /**
   * Associate a custom domain with your user pool
   * Either `customDomain` or `cognitoDomain` must be specified.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-add-custom-domain.html
   * @default - not set if `cognitoDomain` is specified, otherwise, throws an error.
   */
  readonly customDomain?: CustomDomainOptions;

  /**
   * Associate a cognito prefix domain with your user pool
   * Either `customDomain` or `cognitoDomain` must be specified.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-assign-domain-prefix.html
   * @default - not set if `customDomain` is specified, otherwise, throws an error.
   */
  readonly cognitoDomain?: CognitoDomainOptions;
}

/**
 * Props for UserPoolDomain construct
 */
export interface UserPoolDomainProps extends UserPoolDomainOptions {
  /**
   * The user pool to which this domain should be associated.
   */
  readonly userPool: IUserPool;
}

/**
 * Define a user pool domain
 */
export class UserPoolDomain extends Resource implements IUserPoolDomain {
  /**
   * Import a UserPoolDomain given its domain name
   */
  public static fromDomainName(scope: Construct, id: string, userPoolDomainName: string): IUserPoolDomain {
    class Import extends Resource implements IUserPoolDomain {
      public readonly domainName = userPoolDomainName;
    }

    return new Import(scope, id);
  }

  public readonly domainName: string;
  private isCognitoDomain: boolean;

  private cloudFrontCustomResource?: AwsCustomResource;

  constructor(scope: Construct, id: string, props: UserPoolDomainProps) {
    super(scope, id);

    if (!!props.customDomain === !!props.cognitoDomain) {
      throw new Error('One of, and only one of, cognitoDomain or customDomain must be specified');
    }

    if (props.cognitoDomain?.domainPrefix &&
      !Token.isUnresolved(props.cognitoDomain?.domainPrefix) &&
      !/^[a-z0-9-]+$/.test(props.cognitoDomain.domainPrefix)) {
      throw new Error('domainPrefix for cognitoDomain can contain only lowercase alphabets, numbers and hyphens');
    }

    this.isCognitoDomain = !!props.cognitoDomain;

    const domainName = props.cognitoDomain?.domainPrefix || props.customDomain?.domainName!;
    const resource = new CfnUserPoolDomain(this, 'Resource', {
      userPoolId: props.userPool.userPoolId,
      domain: domainName,
      customDomainConfig: props.customDomain ? { certificateArn: props.customDomain.certificate.certificateArn } : undefined,
    });

    this.domainName = resource.ref;
  }

  /**
   * The domain name of the CloudFront distribution associated with the user pool domain.
   */
  public get cloudFrontDomainName(): string {
    if (!this.cloudFrontCustomResource) {
      const sdkCall: AwsSdkCall = {
        service: 'CognitoIdentityServiceProvider',
        action: 'describeUserPoolDomain',
        parameters: {
          Domain: this.domainName,
        },
        physicalResourceId: PhysicalResourceId.of(this.domainName),
      };
      this.cloudFrontCustomResource = new AwsCustomResource(this, 'CloudFrontDomainName', {
        resourceType: 'Custom::UserPoolCloudFrontDomainName',
        onCreate: sdkCall,
        onUpdate: sdkCall,
        policy: AwsCustomResourcePolicy.fromSdkCalls({
          // DescribeUserPoolDomain only supports access level '*'
          // https://docs.aws.amazon.com/IAM/latest/UserGuide/list_amazoncognitouserpools.html#amazoncognitouserpools-actions-as-permissions
          resources: ['*'],
        }),
      });
    }
    return this.cloudFrontCustomResource.getResponseField('DomainDescription.CloudFrontDistribution');
  }

  /**
   * The URL to the hosted UI associated with this domain
   */
  public baseUrl(): string {
    if (this.isCognitoDomain) {
      return `https://${this.domainName}.auth.${Stack.of(this).region}.amazoncognito.com`;
    }
    return `https://${this.domainName}`;
  }

  /**
   * The URL to the sign in page in this domain using a specific UserPoolClient
   * @param client [disable-awslint:ref-via-interface] the user pool client that the UI will use to interact with the UserPool
   * @param options options to customize the behaviour of this method.
   */
  public signInUrl(client: UserPoolClient, options: SignInUrlOptions): string {
    let responseType: string;
    if (client.oAuthFlows.authorizationCodeGrant) {
      responseType = 'code';
    } else if (client.oAuthFlows.implicitCodeGrant) {
      responseType = 'token';
    } else {
      throw new Error('signInUrl is not supported for clients without authorizationCodeGrant or implicitCodeGrant flow enabled');
    }
    const path = options.signInPath ?? '/login';
    return `${this.baseUrl()}${path}?client_id=${client.userPoolClientId}&response_type=${responseType}&redirect_uri=${options.redirectUri}`;
  }
}

/**
 * Options to customize the behaviour of `signInUrl()`
 */
export interface SignInUrlOptions {
  /**
   * Where to redirect to after sign in
   */
  readonly redirectUri: string;

  /**
   * The path in the URI where the sign-in page is located
   * @default '/login'
   */
  readonly signInPath?: string;
}
