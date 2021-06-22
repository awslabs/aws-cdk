import * as cdk from '@aws-cdk/core';
import { InputValidator } from './private/validation';
import { CfnApplication } from './servicecatalogappregistry.generated';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from 'constructs';

/**
 * A Service Catalog AppRegistry Application.
 */
export interface IApplication extends cdk.IResource {
  /**
   * The ARN of the application.
   * @attribute
   */
  readonly applicationArn: string;

  /**
   * The ID of the application.
   * @attribute
   */
  readonly applicationId: string;
}

/**
 * Properties for a Service Catalog AppRegistry Application
 */
export interface ApplicationProps {
  /**
   * Enforces a particular physical application name.
   */
  readonly applicationName: string;

  /**
   * Description for application.
   * @default - No description provided
   */
  readonly description?: string;
}

abstract class ApplicationBase extends cdk.Resource implements IApplication {
  public abstract readonly applicationArn: string;
  public abstract readonly applicationId: string;
}

/**
 * A Service Catalog AppRegistry Application.
 */
export class Application extends ApplicationBase {
  /**
   * Imports an Application construct that represents an external application.
   *
   * @param scope The parent creating construct (usually `this`).
   * @param id The construct's name.
   * @param applicationArn the Amazon Resource Name of the existing AppRegistry Application
   */
  public static fromApplicationArn(scope: Construct, id: string, applicationArn: string): IApplication {
    const arn = cdk.Stack.of(scope).splitArn(applicationArn, cdk.ArnFormat.SLASH_RESOURCE_SLASH_RESOURCE_NAME);
    const applicationId = arn.resourceName;

    if (!applicationId) {
      throw new Error('Missing required Application ID from Application ARN: ' + applicationArn);
    }

    class Import extends ApplicationBase {
      public readonly applicationArn = applicationArn;
      public readonly applicationId = applicationId!;
    }

    return new Import(scope, id, {
      environmentFromArn: applicationArn,
    });
  }

  public readonly applicationArn: string;
  public readonly applicationId: string;

  constructor(scope: Construct, id: string, props: ApplicationProps) {
    super(scope, id);

    this.validateApplicationProps(props);

    const application = new CfnApplication(this, 'Resource', {
      name: props.applicationName,
      description: props.description,
    });

    this.applicationArn = application.attrArn;
    this.applicationId = application.attrId;
  }

  private validateApplicationProps(props: ApplicationProps) {
    InputValidator.validateLength(this.node.path, 'application name', 1, 256, props.applicationName);
    InputValidator.validateRegex(this.node.path, 'application name', /^[a-zA-Z0-9-_]+$/, props.applicationName);
    InputValidator.validateLength(this.node.path, 'application description', 0, 1024, props.description);
  }
}
