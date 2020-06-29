import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import { Lazy } from '@aws-cdk/core';
import { IntegrationOptions } from '../integration';
import { Method } from '../method';
import { AwsIntegration } from './aws';

export interface LambdaIntegrationOptions extends IntegrationOptions {
  /**
   * Use proxy integration or normal (request/response mapping) integration.
   * @default true
   */
  readonly proxy?: boolean;

  /**
   * Allow invoking method from AWS Console UI (for testing purposes).
   *
   * This will add another permission to the AWS Lambda resource policy which
   * will allow the `test-invoke-stage` stage to invoke this handler. If this
   * is set to `false`, the function will only be usable from the deployment
   * endpoint.
   *
   * @default true
   */
  readonly allowTestInvoke?: boolean;
}

/**
 * Integrates an AWS Lambda function to an API Gateway method.
 *
 * @example
 *
 *    const handler = new lambda.Function(this, 'MyFunction', ...);
 *    api.addMethod('GET', new LambdaIntegration(handler));
 *
 */
export class LambdaIntegration extends AwsIntegration {
  private readonly handler: lambda.IFunction;
  private readonly enableTest: boolean;

  constructor(handler: lambda.IFunction, options: LambdaIntegrationOptions = { }) {
    const proxy = options.proxy === undefined ? true : options.proxy;

    super({
      proxy,
      service: 'lambda',
      path: `2015-03-31/functions/${handler.functionArn}/invocations`,
      options,
    });

    this.handler = handler;
    this.enableTest = options.allowTestInvoke === undefined ? true : false;
  }

  public bind(method: Method) {
    super.bind(method);
    const principal = new iam.ServicePrincipal('apigateway.amazonaws.com');

    const desc = `${method.api.node.uniqueId}.${method.httpMethod}.${method.resource.path.replace(/\//g, '.')}`;

    this.handler.addPermission(`ApiPermission.${desc}`, {
      principal,
      scope: method,
      sourceArn: Lazy.stringValue({ produce: () => method.methodArn }),
    });

    // add permission to invoke from the console
    if (this.enableTest) {
      this.handler.addPermission(`ApiPermission.Test.${desc}`, {
        principal,
        scope: method,
        sourceArn: method.testMethodArn,
      });
    }
  }
}
