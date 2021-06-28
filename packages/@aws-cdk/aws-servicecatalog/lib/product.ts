import { ArnFormat, IResource, Resource, Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CloudFormationTemplate } from './cloudformation-template';
import { AcceptLanguage } from './common';
import { InputValidator } from './private/validation';
import { CfnCloudFormationProduct } from './servicecatalog.generated';

/**
 * A Service Catalog product, currently only supports type CloudFormationProduct
 */
export interface IProduct extends IResource {
  /**
   * The ARN of the product.
   * @attribute
   */
  readonly productArn: string;

  /**
   * The id of the product
   * @attribute
   */
  readonly productId: string;
}

abstract class ProductBase extends Resource implements IProduct {
  public abstract readonly productArn: string;
  public abstract readonly productId: string;
}

/**
 * Properties of product version (also known as a provisioning artifact).
 */
export interface CloudFormationProductVersion {
  /**
   * The description of the product version
   * @default - No description provided
   */
  readonly description?: string;

  /**
   * Whether the specified product template will be validated by CloudFormation.
   * If turned off, an invalid template configuration can be stored.
   * @default true
   */
  readonly validateTemplate?: boolean;

  /**
   * The S3 template that points to the provisioning version template
   */
  readonly cloudFormationTemplate: CloudFormationTemplate;

  /**
   * The name of the product version.
   * @default - No product version name provided
   */
  readonly productVersionName?: string;
}

/**
 * Properties for a Cloudformation Product
 */
export interface CloudFormationProductProps {
  /**
   * The owner of the product.
   */
  readonly owner: string;

  /**
   * The name of the product.
   */
  readonly productName: string;

  /**
   * The configuration of the product version.
   */
  readonly productVersions: CloudFormationProductVersion[];

  /**
   * The language code.
   * @default - No accept language provided
   */
  readonly acceptLanguage?: AcceptLanguage;

  /**
   * The description of the product.
   * @default - No description provided
   */
  readonly description?: string;

  /**
   * The distributor of the product.
   * @default - No distributor provided
   */
  readonly distributor?: string;

  /**
   * Whether to give provisioning artifacts a new unique identifier when the product attributes or provisioning artifacts is updated
   * @default false
   */
  readonly replaceProductVersionIds?: boolean;

  /**
   * The support information about the product
   * @default - No support description provided
   */
  readonly supportDescription?: string;

  /**
   * The contact email for product support.
   * @default - No support email provided
   */
  readonly supportEmail?: string;

  /**
   * The contact URL for product support.
   * @default - No support URL provided
   */
  readonly supportUrl?: string;
}

/**
 * Abstract class for Service Catalog Product.
 */
export abstract class Product extends ProductBase {
  /**
   * Creates a Product construct that represents an external product.
   * @param scope The parent creating construct (usually `this`).
   * @param id The construct's name.
   * @param productArn Product Arn
   */
  public static fromProductArn(scope: Construct, id: string, productArn: string): IProduct {
    const arn = Stack.of(scope).splitArn(productArn, ArnFormat.SLASH_RESOURCE_NAME);
    const productId = arn.resourceName;

    if (!productId) {
      throw new Error('Missing required Portfolio ID from Portfolio ARN: ' + productArn);
    }

    return new class extends ProductBase {
      public readonly productId = productId!;
      public readonly productArn = productArn;
    }(scope, id);
  }
}

/**
 * A Service Catalog Cloudformation Product.
 */
export class CloudFormationProduct extends Product {
  public readonly productArn: string;
  public readonly productId: string;

  constructor(scope: Construct, id: string, props: CloudFormationProductProps) {
    super(scope, id);

    this.validateProductProps(props);

    const product = new CfnCloudFormationProduct(this, 'Resource', {
      acceptLanguage: props.acceptLanguage,
      description: props.description,
      distributor: props.distributor,
      name: props.productName,
      owner: props.owner,
      provisioningArtifactParameters: this.renderProvisioningArtifacts(props),
      replaceProvisioningArtifacts: props.replaceProductVersionIds,
      supportDescription: props.supportDescription,
      supportEmail: props.supportEmail,
      supportUrl: props.supportUrl,
    });

    this.productArn = Stack.of(this).formatArn({
      service: 'catalog',
      resource: 'product',
      resourceName: product.ref,
    });

    this.productId = product.ref;
  }

  private renderProvisioningArtifacts(
    props: CloudFormationProductProps): CfnCloudFormationProduct.ProvisioningArtifactPropertiesProperty[] {
    return props.productVersions.map(productVersion => {
      const template = productVersion.cloudFormationTemplate.bind(this);
      InputValidator.validateUrl(this.node.path, 'provisioning template url', template.httpUrl);
      return {
        name: productVersion.productVersionName,
        description: productVersion.description,
        disableTemplateValidation: productVersion.validateTemplate === false ? true : false,
        info: {
          LoadTemplateFromURL: template.httpUrl,
        },
      };
    });
  };

  private validateProductProps(props: CloudFormationProductProps) {
    InputValidator.validateLength(this.node.path, 'product product name', 1, 100, props.productName);
    InputValidator.validateLength(this.node.path, 'product owner', 1, 8191, props.owner);
    InputValidator.validateLength(this.node.path, 'product description', 0, 8191, props.description);
    InputValidator.validateLength(this.node.path, 'product distributor', 0, 8191, props.distributor);
    InputValidator.validateEmail(this.node.path, 'support email', props.supportEmail);
    InputValidator.validateUrl(this.node.path, 'support url', props.supportUrl);
    InputValidator.validateLength(this.node.path, 'support description', 0, 8191, props.supportDescription);
    if (props.productVersions.length == 0) {
      throw new Error(`Invalid product versions for resource ${this.node.path}, must contain at least 1 product version`);
    }
    props.productVersions.forEach(productVersion => {
      InputValidator.validateLength(this.node.path, 'provisioning artifact name', 0, 100, productVersion.productVersionName);
      InputValidator.validateLength(this.node.path, 'provisioning artifact description', 0, 8191, productVersion.description);
    });
  }
}
