import * as crypto from 'crypto';
import * as cdk from '@aws-cdk/core';
import { IAttributeGroup } from './attribute-group';
import { InputValidator } from './private/validation';
import { CfnApplication, CfnAttributeGroupAssociation, CfnResourceAssociation } from './servicecatalogappregistry.generated';

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

  /**
   * Associate thisapplication with an attribute group.
   * @param attributeGroup AppRegistry attribute group
   */
  associateAttributeGroup(attributeGroup: IAttributeGroup): void;

  /**
   * Associate this application with a CloudFormation stack.
   * @param stack a CFN stack
   */
  associateStack(stack: cdk.Stack): void;
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
  private readonly associatedAttributeGroups: Set<string> = new Set();
  private readonly associatedResources: Set<string> = new Set();

  /**
   * Associate an attribute group with application
   * If the attribute group is already associated, it will ignore duplicate request.
   */
  public associateAttributeGroup(attributeGroup: IAttributeGroup): void {
    if (!this.associatedAttributeGroups.has(attributeGroup.node.addr)) {
      const hashId = this.generateUniqueHash(attributeGroup.node.addr);
      new CfnAttributeGroupAssociation(this, `AttributeGroupAssociation${hashId}`, {
        application: this.applicationId,
        attributeGroup: attributeGroup.attributeGroupId,
      });
      this.associatedAttributeGroups.add(attributeGroup.node.addr);
    }
  }

  /**
   * Associate a stack with the application
   * If the resource is already associated, it will ignore duplicate request.
   * A stack can only be associated with one application.
   */
  public associateStack(stack: cdk.Stack): void {
    if (!this.associatedResources.has(stack.node.addr)) {
      const hashId = this.generateUniqueHash(stack.node.addr);
      new CfnResourceAssociation(this, `ResourceAssociation${hashId}`, {
        application: this.applicationId,
        resource: stack.stackId,
        resourceType: 'CFN_STACK',
      });
      this.associatedResources.add(stack.node.addr);
    }
  }

  /**
   * Create a unique id
   */
  protected abstract generateUniqueHash(resourceAddress: string): string;
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

      protected generateUniqueHash(resourceAddress: string): string {
        return hashValues(this.applicationArn, resourceAddress);
      }
    }

    return new Import(scope, id, {
      environmentFromArn: applicationArn,
    });
  }

  public readonly applicationArn: string;
  public readonly applicationId: string;
  private readonly nodeAddress: string;

  constructor(scope: Construct, id: string, props: ApplicationProps) {
    super(scope, id);

    this.validateApplicationProps(props);

    const application = new CfnApplication(this, 'Resource', {
      name: props.applicationName,
      description: props.description,
    });

    this.applicationArn = application.attrArn;
    this.applicationId = application.attrId;
    this.nodeAddress = cdk.Names.nodeUniqueId(application.node);
  }

  protected generateUniqueHash(resourceAddress: string): string {
    return hashValues(this.nodeAddress, resourceAddress);
  }

  private validateApplicationProps(props: ApplicationProps) {
    InputValidator.validateLength(this.node.path, 'application name', 1, 256, props.applicationName);
    InputValidator.validateRegex(this.node.path, 'application name', /^[a-zA-Z0-9-_]+$/, props.applicationName);
    InputValidator.validateLength(this.node.path, 'application description', 0, 1024, props.description);
  }
}

/**
 * Generates a unique hash identfifer using SHA256 encryption algorithm
 */
function hashValues(...values: string[]): string {
  const sha256 = crypto.createHash('sha256');
  values.forEach(val => sha256.update(val));
  return sha256.digest('hex').slice(0, 12);
}