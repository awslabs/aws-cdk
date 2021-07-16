import { HttpAuthorizer, HttpAuthorizerType, HttpRouteAuthorizerBindOptions, HttpRouteAuthorizerConfig, IHttpRouteAuthorizer } from '@aws-cdk/aws-apigatewayv2';
import { IUserPool, IUserPoolClient } from '@aws-cdk/aws-cognito';
import { Stack } from '@aws-cdk/core';

/**
 * Properties to initialize UserPoolAuthorizer.
 */
export interface UserPoolAuthorizerProps {
  /**
   * The user pool client that should be used to authorize requests with the user pool.
   */
  readonly userPoolClient: IUserPoolClient;

  /**
   * The associated user pool
   */
  readonly userPool: IUserPool;

  /**
   * The AWS region in which the user pool is present
   * @default - same region as the Route the authorizer is attached to.
   */
  readonly userPoolRegion?: string;

  /**
   * The name of the authorizer
   */
  readonly authorizerName: string;

  /**
   * The identity source for which authorization is requested.
   *
   * @default ['$request.header.Authorization']
   */
  readonly identitySource?: string[],
}

/**
 * Authorize Http Api routes on whether the requester is registered as part of
 * an AWS Cognito user pool.
 */
export class HttpUserPoolAuthorizer implements IHttpRouteAuthorizer {
  private authorizer?: HttpAuthorizer;

  constructor(private readonly props: UserPoolAuthorizerProps) {
  }

  public bind(options: HttpRouteAuthorizerBindOptions): HttpRouteAuthorizerConfig {
    if (!this.authorizer) {
      const id = this.props.authorizerName;
      const region = this.props.userPoolRegion ?? Stack.of(options.scope).region;
      this.authorizer = new HttpAuthorizer(options.scope, id, {
        httpApi: options.route.httpApi,
        identitySource: this.props.identitySource ?? ['$request.header.Authorization'],
        type: HttpAuthorizerType.JWT,
        authorizerName: this.props.authorizerName,
        jwtAudience: [this.props.userPoolClient.userPoolClientId],
        jwtIssuer: `https://cognito-idp.${region}.amazonaws.com/${this.props.userPool.userPoolId}`,
      });
    }

    return {
      authorizerId: this.authorizer.authorizerId,
      authorizationType: 'JWT',
    };
  }
}