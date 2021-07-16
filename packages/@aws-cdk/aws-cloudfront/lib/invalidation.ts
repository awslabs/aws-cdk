import { IResource, Names, Resource, Lazy } from '@aws-cdk/core';
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from '@aws-cdk/custom-resources';
import { Construct } from 'constructs';

/**
 * Represents a Cloudfront Invalidation
 */
export interface IInvalidation extends IResource {
  /**
   * The ID of the invalidation.
   * @attribute
   */
  readonly invalidationId: string;

  /**
   * Id of the CloudFront Distribution to associate
   * @attribute
   */
  readonly distributionId:string;

  /**
   * A value that you specify to uniquely identify an invalidation request
   *  CloudFront uses the value to prevent you from accidentally resubmitting
   * an identical request.
   * @attribute
   */
  readonly callerReference:string;

  /**
   * The fully qualified URI of the distribution and invalidation batch
   * request, including the Invalidation ID.
   * @attribute
   */
  readonly location:string;

  /**
   * A list of the paths in the distribution to invalidate
   * @attribute
   */
  readonly invalidationPaths:string[];
}

/**
 * Properties for creating an Invalidation
 */
export interface InvalidationProps {
  /**
   * Id of the CloudFront Distribution to associate
   */
  readonly distributionId: string;

  /**
   * A list of the paths in the distribution to invalidate
   * @default - invalidate all paths: ['/*']
   */
  readonly invalidationPaths?: string[];

  /**
   * A name to identify the invalidation.
   * @default - generated from the `id`
   */
  readonly invalidationName?: string;
}

/**
 * A CloudFront Invalidation configuration
 *
 * @resource Aws::CloudFormation::CustomResource
 */
export class Invalidation extends Resource implements IInvalidation {

  public readonly invalidationId: string;
  public readonly distributionId: string;
  public readonly invalidationPaths: string[];
  public readonly callerReference: string;
  public readonly location: string;
  constructor(scope: Construct, id: string, props: InvalidationProps) {
    super(scope, id, {
      physicalName: props.invalidationName || Lazy.string({ produce: () => this.node.uniqueId }),
    });

    this.distributionId = props.distributionId;
    this.invalidationPaths = props.invalidationPaths && props.invalidationPaths.length ? props.invalidationPaths : ['/*'];

    const resource = new AwsCustomResource(this, 'InvalidationResource', {
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
      installLatestAwsSdk: true,
      resourceType: 'Custom::CloudFrontInvalidation',
      onUpdate: {
        service: 'CloudFront',
        action: 'createInvalidation',
        physicalResourceId: PhysicalResourceId.fromResponse('Invalidation.Id'),
        parameters: {
          DistributionId: props.distributionId,
          InvalidationBatch: {
            CallerReference: this.generateName(),
            Paths: {
              Quantity: this.invalidationPaths.length,
              Items: this.invalidationPaths,
            },
          },
        },
      },
    });

    this.invalidationId = resource.getResponseField('Invalidation.Id');
    this.callerReference = resource.getResponseField('Invalidation.InvalidationBatch.CallerReference');
    this.location = resource.getResponseField('Location');
  }

  private generateName(): string {
    const name = Names.uniqueId(this);
    if (name.length > 20) {
      return name.substring(0, 20);
    }
    return name;
  }
}
