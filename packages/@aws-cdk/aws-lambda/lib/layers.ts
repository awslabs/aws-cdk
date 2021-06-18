import { IResource, RemovalPolicy, Resource } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { Code } from './code';
import { CfnLayerVersion, CfnLayerVersionPermission } from './lambda.generated';
import { Runtime } from './runtime';

/**
 * Non runtime options
 */
export interface LayerVersionOptions {
  /**
   * The description the this Lambda Layer.
   *
   * @default - No description.
   */
  readonly description?: string;

  /**
   * The SPDX licence identifier or URL to the license file for this layer.
   *
   * @default - No license information will be recorded.
   */
  readonly license?: string;

  /**
   * The name of the layer.
   *
   * @default - A name will be generated.
   */
  readonly layerVersionName?: string;

  /**
   * Whether to retain this version of the layer when a new version is added
   * or when the stack is deleted.
   *
   * @default RemovalPolicy.DESTROY
   */
  readonly removalPolicy?: RemovalPolicy;
}

export interface LayerVersionProps extends LayerVersionOptions {
  /**
   * The runtimes compatible with this Layer.
   *
   * @default - All runtimes are supported.
   */
  readonly compatibleRuntimes?: Runtime[];

  /**
   * The content of this Layer.
   *
   * Using `Code.fromInline` is not supported.
   */
  readonly code: Code;
}

export interface ILayerVersion extends IResource {
  /**
   * The ARN of the Lambda Layer version that this Layer defines.
   * @attribute
   */
  readonly layerVersionArn: string;

  /**
   * The runtimes compatible with this Layer.
   *
   * @default Runtime.All
   */
  readonly compatibleRuntimes?: Runtime[];

  /**
   * Add permission for this layer version to specific entities. Usage within
   * the same account where the layer is defined is always allowed and does not
   * require calling this method. Note that the principal that creates the
   * Lambda function using the layer (for example, a CloudFormation changeset
   * execution role) also needs to have the ``lambda:GetLayerVersion``
   * permission on the layer version.
   *
   * @param id the ID of the grant in the construct tree.
   * @param permission the identification of the grantee.
   */
  addPermission(id: string, permission: LayerVersionPermission): void;
}

/**
 * A reference to a Lambda Layer version.
 */
abstract class LayerVersionBase extends Resource implements ILayerVersion {
  public abstract readonly layerVersionArn: string;
  public abstract readonly compatibleRuntimes?: Runtime[];

  public addPermission(id: string, permission: LayerVersionPermission) {
    if (permission.organizationId != null && permission.accountId !== '*') {
      throw new Error(`OrganizationId can only be specified if AwsAccountId is '*', but it is ${permission.accountId}`);
    }

    new CfnLayerVersionPermission(this, id, {
      action: 'lambda:GetLayerVersion',
      layerVersionArn: this.layerVersionArn,
      principal: permission.accountId,
      organizationId: permission.organizationId,
    });
  }
}

/**
 * Identification of an account (or organization) that is allowed to access a Lambda Layer Version.
 */
export interface LayerVersionPermission {
  /**
   * The AWS Account id of the account that is authorized to use a Lambda Layer Version. The wild-card ``'*'`` can be
   * used to grant access to "any" account (or any account in an organization when ``organizationId`` is specified).
   */
  readonly accountId: string;

  /**
   * The ID of the AWS Organization to which the grant is restricted.
   *
   * Can only be specified if ``accountId`` is ``'*'``
   */
  readonly organizationId?: string;
}

/**
 * Properties necessary to import a LayerVersion.
 */
export interface LayerVersionAttributes {
  /**
   * The ARN of the LayerVersion.
   */
  readonly layerVersionArn: string;

  /**
   * The list of compatible runtimes with this Layer.
   */
  readonly compatibleRuntimes?: Runtime[];
}

/**
 * Defines a new Lambda Layer version.
 */
export class LayerVersion extends LayerVersionBase {
  /**
   * Imports a layer version by ARN. Assumes it is compatible with all Lambda runtimes.
   */
  public static fromLayerVersionArn(scope: Construct, id: string, layerVersionArn: string): ILayerVersion {
    return LayerVersion.fromLayerVersionAttributes(scope, id, {
      layerVersionArn,
      compatibleRuntimes: Runtime.ALL,
    });
  }

  /**
   * Imports a Layer that has been defined externally.
   *
   * @param scope the parent Construct that will use the imported layer.
   * @param id    the id of the imported layer in the construct tree.
   * @param attrs the properties of the imported layer.
   */
  public static fromLayerVersionAttributes(scope: Construct, id: string, attrs: LayerVersionAttributes): ILayerVersion {
    if (attrs.compatibleRuntimes && attrs.compatibleRuntimes.length === 0) {
      throw new Error('Attempted to import a Lambda layer that supports no runtime!');
    }

    class Import extends LayerVersionBase {
      public readonly layerVersionArn = attrs.layerVersionArn;
      public readonly compatibleRuntimes = attrs.compatibleRuntimes;
    }

    return new Import(scope, id);
  }

  public readonly layerVersionArn: string;
  public readonly compatibleRuntimes?: Runtime[];

  constructor(scope: Construct, id: string, props: LayerVersionProps) {
    super(scope, id, {
      physicalName: props.layerVersionName,
    });

    if (props.compatibleRuntimes && props.compatibleRuntimes.length === 0) {
      throw new Error('Attempted to define a Lambda layer that supports no runtime!');
    }
    if (props.code.isInline) {
      throw new Error('Lambda layers cannot be created from inline code');
    }
    // Allow usage of the code in this context...
    const code = props.code.bind(this);
    if (code.inlineCode) {
      throw new Error('Inline code is not supported for AWS Lambda layers');
    }
    if (!code.s3Location) {
      throw new Error('Code must define an S3 location');
    }

    const resource: CfnLayerVersion = new CfnLayerVersion(this, 'Resource', {
      compatibleRuntimes: props.compatibleRuntimes && props.compatibleRuntimes.map(r => r.name),
      content: {
        s3Bucket: code.s3Location.bucketName,
        s3Key: code.s3Location.objectKey,
        s3ObjectVersion: code.s3Location.objectVersion,
      },
      description: props.description,
      layerName: this.physicalName,
      licenseInfo: props.license,
    });

    if (props.removalPolicy) {
      resource.applyRemovalPolicy(props.removalPolicy);
    }

    props.code.bindToResource(resource, {
      resourceProperty: 'Content',
    });

    this.layerVersionArn = resource.ref;
    this.compatibleRuntimes = props.compatibleRuntimes;
  }
}
