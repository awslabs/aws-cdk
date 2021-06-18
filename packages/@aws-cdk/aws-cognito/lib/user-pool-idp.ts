import { IResource, Resource } from '@aws-cdk/core';
import { Construct } from 'constructs';

/**
 * Represents a UserPoolIdentityProvider
 */
export interface IUserPoolIdentityProvider extends IResource {
  /**
   * The primary identifier of this identity provider
   * @attribute
   */
  readonly providerName: string;
}

/**
 * User pool third-party identity providers
 */
export class UserPoolIdentityProvider {
  /**
   * Import an existing UserPoolIdentityProvider
   */
  public static fromProviderName(scope: Construct, id: string, providerName: string): IUserPoolIdentityProvider {
    class Import extends Resource implements IUserPoolIdentityProvider {
      public readonly providerName: string = providerName;
    }

    return new Import(scope, id);
  }

  private constructor() {}
}