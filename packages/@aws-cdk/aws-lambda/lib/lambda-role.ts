import { IManagedPolicy, ManagedPolicy, Role, RoleProps, ServicePrincipal } from '@aws-cdk/aws-iam';
import { Construct, Duration, Lazy, Resource, Stack, Token } from '@aws-cdk/core';

/**
 * Properties for defining a Lambda Role
 */
export interface LambdaRoleProps extends Omit<RoleProps, 'assumedBy'> {
  // We omit the assumedBy property because we know what it is for a Lambda Role

  /**
   * Grants permission to manage elastic network interfaces to
   * connect your function to a VPC.
   *
   * @default false
   */
  readonly vpcExecutionAccess?: boolean;

  /**
   * Grants permission to read events from a Kinesis data stream or consumer.
   *
   * @default false
   */
  readonly kinesisExecutionAccess?: boolean;

  /**
   * Grants permission to read records from a DynamoDB stream.
   *
   * @default false
   */
  readonly dynamoDBExecutionAccess?: boolean;

  /**
   * Grants permission to read a message from an
   * SQS queue.
   *
   * @default false
   */
  readonly sqsQueueExecutionAccess?: boolean;

  /**
   * Grants permission to upload trace data to X-Ray.
   *
   * @default false
   */
  readonly xrayDaemonWriteAccess: boolean;

}

/**
 * Lambda Role
 *
 * Defines an IAM role to be assumed by AWS Lambda.
 */
export class LambdaRole extends Role {

  constructor(scope: Construct, id: string, lambdaProps: LambdaRoleProps) {
    /*
    We are basically just creating a Role, with the following changes:
      - We don't require the user to provide the service principal, because we know it already
      - We add the basic execution managed policy so the Lambda function works out of the box
      - We add additional managed policies based on whether the function needs to run in a VPC,
        read Kinesis events, write to XRay, etc.

    To do that, the LambdaRoleProps extend RoleProps, so they automatically stay in sync. We omit
    the 'assumedBy' parameter because it isn't necessary, and we add new parameters for ease of
    adding additional policies to the Lambda function.

    However, we can't just pass LambdaRoleProps in the constructor for IRole, so we have to make
    a RoleProps from the LambdaRoleProps we were passed
    */

    // We start by getting the policies we're going to add to the function, based on the LambdRoleProps
    const lambdaPolicies = getExecutionRoles(lambdaProps);

    // We use the 'spread' operator to create a new RoleProps from our LambdaRoleProps
    // We have to cast it to unknown first, because LambdaRoleProps is missing the 'assumedBy' field
    const roleProps = {...(lambdaProps as unknown) as RoleProps};

    // It's missing the 'assumedBy' field, so we add it
    roleProps.assumedBy = new ServicePrincipal('lambda.amazonaws.com');

    // Now we add all the policies to the Role, keeping any provided policies
    roleProps.managedPolicies = lambdaProps.managedPolicies ?? new Array<IManagedPolicy>();
    for (const policy of lambdaPolicies) {
      roleProps.managedPolicies.push(policy);
    }

    // Finally, we create the role
    super(scope, id, roleProps);

    /**
     * This function returns a list of execution roles based on the provided parameters.
     *
     * It draws heavily from the following documentation:
     * https://docs.aws.amazon.com/lambda/latest/dg/lambda-intro-execution-role.html
     */
    function getExecutionRoles(props: LambdaRoleProps) {
      const vpcExecutionAccess = props.vpcExecutionAccess ?? false;
      const kinesisExecutionAccess = props.kinesisExecutionAccess ?? false;
      const dynamoDBExecutionAccess = props.dynamoDBExecutionAccess ?? false;
      const sqsQueueExecutionAccess = props.sqsQueueExecutionAccess ?? false;
      const xrayDaemonWriteAccess = props.xrayDaemonWriteAccess ?? false;

      const managedPolicies = new Array<IManagedPolicy>();

      // Without the basic execution policy, you can't log from the function
      managedPolicies.push(ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'));

      if (vpcExecutionAccess) {
        managedPolicies.push(ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'));
      }
      if (kinesisExecutionAccess) {
        managedPolicies.push(ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaKinesisExecutionRole'));
      }
      if (dynamoDBExecutionAccess) {
        managedPolicies.push(ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaDynamoDBExecutionRole'));
      }
      if (sqsQueueExecutionAccess) {
        managedPolicies.push(ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaSQSQueueExecutionRole'));
      }
      if (xrayDaemonWriteAccess) {
        managedPolicies.push(ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSXRayDaemonWriteAccess'));
      }
      return managedPolicies;
    }
  }
}