import lambda = require('@aws-cdk/aws-lambda');
import cdk = require('@aws-cdk/cdk');
import { LambdaIntegration } from './integrations';
import { Method } from './method';
import { Resource } from './resource';
import { RestApi, RestApiProps } from './restapi';

export interface LambdaRestApiProps {
  /**
   * The default Lambda function that handles all requests from this API.
   *
   * This handler will be used as a the default integration for all methods in
   * this API, unless specified otherwise in `addMethod`.
   */
  handler: lambda.Function;

  /**
   * If true, route all requests to the Lambda Function
   *
   * If not set to true, you will need to explicitly define the API model using
   * `addResource` and `addMethod` (or `addProxy`).
   *
   * @default false
   */
  proxyAll?: boolean;

  /**
   * Further customization of the REST API.
   *
   * @default defaults
   */
  options?: RestApiProps;
}

/**
 * Defines an API Gateway REST API with AWS Lambda proxy integration.
 *
 * Use the `proxyPath` property to define a greedy proxy ("{proxy+}") and "ANY"
 * method from the specified path. If not defined, you will need to explicity
 * add resources and methods to the API.
 */
export class LambdaRestApi extends RestApi {
  constructor(parent: cdk.Construct, id: string, props: LambdaRestApiProps) {
    if (props.options && props.options.defaultIntegration) {
      throw new Error(`Cannot specify "options.defaultIntegration" since Lambda integration is automatically defined`);
    }

    super(parent, id, {
      defaultIntegration: new LambdaIntegration(props.handler),
      ...props.options
    });

    if (props.proxyAll) {
      this.root.addProxy();
      this.root.addMethod('ANY');

      // Make sure users cannot call any other resource adding function
      this.root.addResource = addResourceThrows;
      this.root.addMethod = addMethodThrows;
      this.root.addProxy = addProxyThrows;
    }
  }
}

function addResourceThrows(): Resource {
  throw new Error(`Cannot call 'addResource' on a proyxing LambdaRestApi; set 'proxyAll' to false`);
}

function addMethodThrows(): Method {
  throw new Error(`Cannot call 'addMethod' on a proyxing LambdaRestApi; set 'proxyAll' to false`);
}

function addProxyThrows(): Resource {
  throw new Error(`Cannot call 'addProxy' on a proyxing LambdaRestApi; set 'proxyAll' to false`);
}