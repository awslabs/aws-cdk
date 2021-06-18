import * as crypto from 'crypto';
import * as lambda from '@aws-cdk/aws-lambda';
import { CfnResource, Resource, Stack, Token } from '@aws-cdk/core';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '@aws-cdk/core';

const KUBECTL_APP_ARN = 'arn:aws:serverlessrepo:us-east-1:903779448426:applications/lambda-layer-kubectl';
const KUBECTL_APP_VERSION = '1.13.7';

export interface KubectlLayerProps {
  /**
   * The semantic version of the kubectl AWS Lambda Layer SAR app to use.
   *
   * @default '1.13.7'
   */
  readonly version?: string;
}

/**
 * An AWS Lambda layer that includes kubectl and the AWS CLI.
 *
 * @see https://github.com/aws-samples/aws-lambda-layer-kubectl
 */
export class KubectlLayer extends Resource implements lambda.ILayerVersion {
  /**
   * Gets or create a singleton instance of this construct.
   */
  public static getOrCreate(scope: Construct, props: KubectlLayerProps = {}): KubectlLayer {
    const stack = Stack.of(scope);
    const id = 'kubectl-layer-' + (props.version ? props.version : '8C2542BC-BF2B-4DFE-B765-E181FD30A9A0');
    const exists = stack.node.tryFindChild(id) as KubectlLayer;
    if (exists) {
      return exists;
    }

    return new KubectlLayer(stack, id, props);
  }

  /**
   * The ARN of the AWS Lambda layer version.
   */
  public readonly layerVersionArn: string;

  /**
   * All runtimes are compatible.
   */
  public readonly compatibleRuntimes?: lambda.Runtime[] = undefined;

  constructor(scope: Construct, id: string, props: KubectlLayerProps = {}) {
    super(scope, id);

    const uniqueId = crypto.createHash('md5').update(this.node.path).digest('hex');
    const version = props.version || KUBECTL_APP_VERSION;

    this.stack.templateOptions.transforms = ['AWS::Serverless-2016-10-31']; // required for AWS::Serverless
    const resource = new CfnResource(this, 'Resource', {
      type: 'AWS::Serverless::Application',
      properties: {
        Location: {
          ApplicationId: KUBECTL_APP_ARN,
          SemanticVersion: version,
        },
        Parameters: {
          LayerName: `kubectl-${uniqueId}`,
        },
      },
    });

    this.layerVersionArn = Token.asString(resource.getAtt('Outputs.LayerVersionArn'));
  }

  public addPermission(_id: string, _permission: lambda.LayerVersionPermission): void {
    return;
  }
}
