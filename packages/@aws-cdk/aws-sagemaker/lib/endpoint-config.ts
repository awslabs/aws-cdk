import * as ec2 from '@aws-cdk/aws-ec2';
import * as kms from '@aws-cdk/aws-kms';
import * as cdk from '@aws-cdk/core';
import { EOL } from 'os';
import { CfnEndpointConfig } from '.';
import { IModel } from './model';

/**
 * The interface for a SageMaker EndpointConfig resource.
 */
export interface IEndpointConfig extends cdk.IResource {
  /**
   * The ARN of the endpoint configuration.
   *
   * @attribute
   */
  readonly endpointConfigArn: string;
  /**
   * The name of the endpoint configuration.
   *
   * @attribute
   */
  readonly endpointConfigName: string;
}

/**
 * Construction properties for a production variant.
 */
export interface ProductionVariantProps {
  /**
   * The size of the Elastic Inference (EI) instance to use for the production variant. EI instances
   * provide on-demand GPU computing for inference.
   *
   * @default none
   */
  readonly acceleratorType?: AcceleratorType;
  /**
   * Number of instances to launch initially.
   *
   * @default 1
   */
  readonly initialInstanceCount?: number;
  /**
   * Determines initial traffic distribution among all of the models that you specify in the
   * endpoint configuration. The traffic to a production variant is determined by the ratio of the
   * variant weight to the sum of all variant weight values across all production variants.
   *
   * @default 1.0
   */
  readonly initialVariantWeight?: number;
  /**
   * Instance type of the production variant.
   *
   * @default ml.t2.medium instance type.
   */
  readonly instanceType?: ec2.InstanceType;
  /**
   * The model to host.
   */
  readonly model: IModel;
  /**
   * Name of the production variant.
   */
  readonly variantName: string;
}

/**
 * Represents a production variant that has been associated with an EndpointConfig.
 */
export interface ProductionVariant {
  /**
   * The size of the Elastic Inference (EI) instance to use for the production variant. EI instances
   * provide on-demand GPU computing for inference.
   *
   * @default none
   */
  readonly acceleratorType?: AcceleratorType;
  /**
   * Number of instances to launch initially.
   */
  readonly initialInstanceCount: number;
  /**
   * Determines initial traffic distribution among all of the models that you specify in the
   * endpoint configuration. The traffic to a production variant is determined by the ratio of the
   * variant weight to the sum of all variant weight values across all production variants.
   */
  readonly initialVariantWeight: number;
  /**
   * Instance type of the production variant.
   */
  readonly instanceType: ec2.InstanceType;
  /**
   * The name of the model to host.
   */
  readonly modelName: string;
  /**
   * The name of the production variant.
   */
  readonly variantName: string;
}

/**
 * Name tag constant
 */
const NAME_TAG: string = 'Name';

/**
 * Construction properties for a SageMaker EndpointConfig.
 */
export interface EndpointConfigProps {
  /**
   * Name of the endpoint configuration.
   *
   * @default AWS CloudFormation generates a unique physical ID and uses that ID for the endpoint
   * configuration's name.
   */
  readonly endpointConfigName?: string;

  /**
   * Optional KMS encryption key associated with this stream.
   *
   * @default none
   */
  readonly encryptionKey?: kms.IKey;

  /**
   * A ProductionVariantProps object.
   */
  readonly productionVariant: ProductionVariantProps;

  /**
   * An optional list of extra ProductionVariantProps objects.
   *
   * @default none
   */
  readonly extraProductionVariants?: ProductionVariantProps[];
}

/**
 * The size of the Elastic Inference (EI) instance to use for the production variant. EI instances
 * provide on-demand GPU computing for inference.
 */
export enum AcceleratorType {
  /**
   * Medium accelerator type.
   */
  MEDIUM = 'ml.eia1.medium',
  /**
   * Large accelerator type.
   */
  LARGE = 'ml.eia1.large ',
  /**
   * Extra large accelerator type.
   */
  XLARGE = 'ml.eia1.xlarge',
}

/**
 * Defines a SageMaker EndpointConfig.
 */
export class EndpointConfig extends cdk.Resource implements IEndpointConfig {
  /**
   * Imports an EndpointConfig defined either outside the CDK or in a different CDK stack.
   * @param scope the Construct scope.
   * @param id the resource id.
   * @param endpointConfigName the name of the endpoint configuration.
   */
  public static fromEndpointConfigName(scope: cdk.Construct, id: string, endpointConfigName: string): IEndpointConfig {
    class Import extends cdk.Resource implements IEndpointConfig {
      public endpointConfigName = endpointConfigName;
      public endpointConfigArn = cdk.Stack.of(this).formatArn({
        service: 'sagemaker',
        resource: 'endpoint-config',
        resourceName: this.endpointConfigName
      });
    }

    return new Import(scope, id);
  }

  /**
   * The ARN of the endpoint configuration.
   */
  public readonly endpointConfigArn: string;
  /**
   * The name of the endpoint configuration.
   */
  public readonly endpointConfigName: string;

  private readonly _productionVariants: { [key: string]: ProductionVariant; } = {};

  constructor(scope: cdk.Construct, id: string, props: EndpointConfigProps) {
    super(scope, id, {
      physicalName: props.endpointConfigName
    });

    // apply a name tag to the endpoint config resource
    this.node.applyAspect(new cdk.Tag(NAME_TAG, this.node.path));

    [props.productionVariant, ...props.extraProductionVariants || []].map(p => this.addProductionVariant(p));

    // create the endpoint configuration resource
    const endpointConfig = new CfnEndpointConfig(this, 'EndpointConfig', {
      kmsKeyId: (props.encryptionKey) ? props.encryptionKey.keyArn : undefined,
      endpointConfigName: this.physicalName,
      productionVariants: cdk.Lazy.anyValue({ produce: () => this.renderProductionVariants() })
    });
    this.endpointConfigName = this.getResourceNameAttribute(endpointConfig.attrEndpointConfigName);
    this.endpointConfigArn = this.getResourceArnAttribute(endpointConfig.ref, {
      service: 'sagemaker',
      resource: 'endpoint-config',
      resourceName: this.physicalName,
    });
  }

  /**
   * Add production variant to the endpoint configuration.
   *
   * @param props The properties of a production variant to add.
   */
  public addProductionVariant(props: ProductionVariantProps): void {
    if (props.variantName in this._productionVariants) {
      throw new Error(`There is already a Production Variant with name '${props.variantName}'`);
    }
    this.validateProps(props);
    this._productionVariants[props.variantName] = {
      acceleratorType: props.acceleratorType,
      initialInstanceCount: props.initialInstanceCount || 1,
      initialVariantWeight: props.initialVariantWeight || 1.0,
      instanceType: props.instanceType || ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MEDIUM),
      modelName: props.model.modelName,
      variantName: props.variantName
    };
  }

  /**
   * Get production variants associated with endpoint configuration.
   */
  public get productionVariants(): ProductionVariant[] {
    return Object.values(this._productionVariants);
  }

  /**
   * Find production variant based on variant name
   * @param name Variant name from production variant
   */
  public findProductionVariant(name: string): ProductionVariant {
    const ret = this._productionVariants[name];
    if (!ret) {
      throw new Error(`No variant with name: '${name}'`);
    }
    return ret;
  }

  protected validate(): string[] {
    const result = super.validate();
    // check we have 10 or fewer production variants
    if (this.productionVariants.length > 10) {
      result.push('Can\'t have more than 10 Production Variants');
    }

    return result;
  }

  private validateProps(props: ProductionVariantProps): void {
    const errors: string[] = [];
    // check instance count is greater than zero
    if (props.initialInstanceCount !== undefined && props.initialInstanceCount < 1) {
      errors.push('Must have at least one instance');
    }

    // check variant weight is not negative
    if (props.initialVariantWeight && props.initialVariantWeight < 0) {
      errors.push('Cannot have negative variant weight');
    }

    // validate the instance type
    if (props.instanceType) {
      // check if a valid SageMaker instance type
      const instanceType = props.instanceType.toString();
      if (!['c4', 'c5', 'c5d', 'g4dn', 'inf1', 'm4', 'm5', 'm5d', 'p2', 'p3', 'r5', 'r5d', 't2']
        .some(instanceClass => instanceType.indexOf(instanceClass) >= 0)) {
        errors.push(`Invalid instance type for a SageMaker Endpoint Production Variant: ${instanceType}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Invalid Production Variant Props: ${errors.join(EOL)}`);
    }
  }

  /**
   * Render the list of production variants.
   */
  private renderProductionVariants(): CfnEndpointConfig.ProductionVariantProperty[] {
    return this.productionVariants.map( v => ({
      acceleratorType: v.acceleratorType,
      initialInstanceCount: v.initialInstanceCount,
      initialVariantWeight: v.initialVariantWeight,
      instanceType: 'ml.' + v.instanceType.toString(),
      modelName: v.modelName,
      variantName: v.variantName,
    }) );
  }

}
