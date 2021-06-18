import * as iam from '@aws-cdk/aws-iam';

/**
 * Authorization token to access private ECR repositories in the current environment via Docker CLI.
 *
 * @see https://docs.aws.amazon.com/AmazonECR/latest/userguide/registry_auth.html
 */
export class AuthorizationToken {
  /**
   * Grant access to retrieve an authorization token.
   */
  public static grantRead(grantee: iam.IGrantable) {
    grantee.grantPrincipal.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['ecr:GetAuthorizationToken'],
      // GetAuthorizationToken only allows '*'. See https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazonelasticcontainerregistry.html#amazonelasticcontainerregistry-actions-as-permissions
      resources: ['*'],
    }));
  }

  private constructor() {
  }
}

/**
 * Authorization token to access the global public ECR Gallery via Docker CLI.
 *
 * @see https://docs.aws.amazon.com/AmazonECR/latest/public/public-registries.html#public-registry-auth
 */
export class PublicGalleryAuthorizationToken {
  /**
   * Grant access to retrieve an authorization token.
   */
  public static grantRead(grantee: iam.IGrantable) {
    grantee.grantPrincipal.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['ecr-public:GetAuthorizationToken', 'sts:GetServiceBearerToken'],
      // GetAuthorizationToken only allows '*'. See https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazonelasticcontainerregistry.html#amazonelasticcontainerregistry-actions-as-permissions
      // GetServiceBearerToken only allows '*'. See https://docs.aws.amazon.com/service-authorization/latest/reference/list_awssecuritytokenservice.html#awssecuritytokenservice-actions-as-permissions
      resources: ['*'],
    }));
  }

  private constructor() {
  }
}
