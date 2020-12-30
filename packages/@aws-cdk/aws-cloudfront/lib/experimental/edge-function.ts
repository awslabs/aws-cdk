import * as crypto from 'crypto';
import * as path from 'path';
import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as ssm from '@aws-cdk/aws-ssm';
import {
  BootstraplessSynthesizer, CfnResource, ConstructNode,
  CustomResource, CustomResourceProvider, CustomResourceProviderRuntime,
  DefaultStackSynthesizer, IStackSynthesizer, Resource, Stack, Stage, Token,
} from '@aws-cdk/core';
import { Construct } from 'constructs';

/**
 * Properties for creating a Lambda@Edge function
 * @experimental
 */
export interface EdgeFunctionProps extends lambda.FunctionProps { }

/**
 * A Lambda@Edge function.
 *
 * Convenience resource for requesting a Lambda function in the 'us-east-1' region for use with Lambda@Edge.
 * Implements several restrictions enforced by Lambda@Edge.
 *
 * @resource AWS::Lambda::Function
 * @experimental
 */
export class EdgeFunction extends Resource implements lambda.IVersion {

  private static readonly EDGE_REGION: string = 'us-east-1';

  public readonly edgeArn: string;
  public readonly functionName: string;
  public readonly functionArn: string;
  public readonly grantPrincipal: iam.IPrincipal;
  public readonly isBoundToVpc = false;
  public readonly permissionsNode: ConstructNode;
  public readonly role?: iam.IRole;
  public readonly version: string;

  // functionStack needed for `addAlias`.
  private readonly functionStack: Stack;
  private readonly _edgeFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: EdgeFunctionProps) {
    super(scope, id);

    // Create a simple Function if we're already in us-east-1; otherwise create a cross-region stack.
    const regionIsUsEast1 = !Token.isUnresolved(this.stack.region) && this.stack.region === 'us-east-1';
    const { functionStack, edgeFunction, edgeArn } = regionIsUsEast1
      ? this.createInRegionFunction(props)
      : this.createCrossRegionFunction(id, props);

    this.functionStack = functionStack;
    this.edgeArn = edgeArn;

    this.functionArn = edgeArn;
    this._edgeFunction = edgeFunction;
    this.functionName = this._edgeFunction.functionName;
    this.grantPrincipal = this._edgeFunction.role!;
    this.permissionsNode = this._edgeFunction.permissionsNode;
    this.version = lambda.extractQualifierFromArn(this.functionArn);

    this.node.defaultChild = this._edgeFunction;
  }

  public get lambda(): lambda.IFunction {
    return this._edgeFunction;
  }

  /**
   * Convenience method to make `EdgeFunction` conform to the same interface as `Function`.
   */
  public get currentVersion(): lambda.IVersion {
    return this;
  }

  public addAlias(aliasName: string, options: lambda.AliasOptions = {}): lambda.Alias {
    return new lambda.Alias(this.functionStack, `Alias${aliasName}`, {
      aliasName,
      version: this._edgeFunction.currentVersion,
      ...options,
    });
  }

  /**
   * Not supported. Connections are only applicable to VPC-enabled functions.
   */
  public get connections(): ec2.Connections {
    throw new Error('Lambda@Edge does not support connections');
  }
  public get latestVersion(): lambda.IVersion {
    throw new Error('$LATEST function version cannot be used for Lambda@Edge');
  }

  public addEventSourceMapping(id: string, options: lambda.EventSourceMappingOptions): lambda.EventSourceMapping {
    return this.lambda.addEventSourceMapping(id, options);
  }
  public addPermission(id: string, permission: lambda.Permission): void {
    return this.lambda.addPermission(id, permission);
  }
  public addToRolePolicy(statement: iam.PolicyStatement): void {
    return this.lambda.addToRolePolicy(statement);
  }
  public grantInvoke(identity: iam.IGrantable): iam.Grant {
    return this.lambda.grantInvoke(identity);
  }
  public metric(metricName: string, props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.lambda.metric(metricName, { ...props, region: EdgeFunction.EDGE_REGION });
  }
  public metricDuration(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.lambda.metricDuration({ ...props, region: EdgeFunction.EDGE_REGION });
  }
  public metricErrors(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.lambda.metricErrors({ ...props, region: EdgeFunction.EDGE_REGION });
  }
  public metricInvocations(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.lambda.metricInvocations({ ...props, region: EdgeFunction.EDGE_REGION });
  }
  public metricThrottles(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.lambda.metricThrottles({ ...props, region: EdgeFunction.EDGE_REGION });
  }
  /** Adds an event source to this function. */
  public addEventSource(source: lambda.IEventSource): void {
    return this.lambda.addEventSource(source);
  }
  public configureAsyncInvoke(options: lambda.EventInvokeConfigOptions): void {
    return this.lambda.configureAsyncInvoke(options);
  }

  /** Create a function in-region */
  private createInRegionFunction(props: lambda.FunctionProps): FunctionConfig {
    const edgeFunction = new lambda.Function(this, 'Fn', props);
    addEdgeLambdaToRoleTrustStatement(edgeFunction.role!);

    return { edgeFunction, edgeArn: edgeFunction.currentVersion.edgeArn, functionStack: this.stack };
  }

  /** Create a support stack and function in us-east-1, and a SSM reader in-region */
  private createCrossRegionFunction(id: string, props: lambda.FunctionProps): FunctionConfig {
    const parameterNamePrefix = 'EdgeFunctionArn';
    const parameterName = `${parameterNamePrefix}${id}`;
    const functionStack = this.edgeStack();

    const edgeFunction = new lambda.Function(functionStack, id, props);
    addEdgeLambdaToRoleTrustStatement(edgeFunction.role!);

    // Store the current version's ARN to be retrieved by the cross region reader below.
    new ssm.StringParameter(edgeFunction, 'Parameter', {
      parameterName,
      stringValue: edgeFunction.currentVersion.edgeArn,
    });

    const edgeArn = this.createCrossRegionArnReader(parameterNamePrefix, parameterName, edgeFunction);

    return { edgeFunction, edgeArn, functionStack };
  }

  private createCrossRegionArnReader(parameterNamePrefix: string, parameterName: string, edgeFunction: lambda.Function): string {
    // Prefix of the parameter ARN that applies to all EdgeFunctions.
    // This is necessary because the `CustomResourceProvider` is a singleton, and the `policyStatement`
    // must work for multiple EdgeFunctions.
    const parameterArnPrefix = this.stack.formatArn({
      service: 'ssm',
      region: EdgeFunction.EDGE_REGION,
      resource: 'parameter',
      resourceName: parameterNamePrefix + '*',
    });

    const resourceType = 'Custom::CrossRegionStringParameterReader';
    const serviceToken = CustomResourceProvider.getOrCreate(this, resourceType, {
      codeDirectory: path.join(__dirname, 'edge-function'),
      runtime: CustomResourceProviderRuntime.NODEJS_12,
      policyStatements: [{
        Effect: 'Allow',
        Resource: parameterArnPrefix,
        Action: ['ssm:GetParameter'],
      }],
    });
    const resource = new CustomResource(this, 'ArnReader', {
      resourceType: resourceType,
      serviceToken,
      properties: {
        Region: EdgeFunction.EDGE_REGION,
        ParameterName: parameterName,
        // This is used to determine when the function has changed, to refresh the ARN from the custom resource.
        RefreshToken: calculateFunctionHash(edgeFunction),
      },
    });

    return resource.getAttString('FunctionArn');
  }

  private edgeStack(): Stack {
    const stage = this.node.root;
    if (!stage || !Stage.isStage(stage)) {
      throw new Error('stacks which use EdgeFunctions must be part of a CDK app or stage');
    }
    const region = this.env.region;
    if (Token.isUnresolved(region)) {
      throw new Error('stacks which use EdgeFunctions must have an explicitly set region');
    }

    const edgeStackId = `edge-lambda-stack-${region}`;
    let edgeStack = stage.node.tryFindChild(edgeStackId) as Stack;
    if (!edgeStack) {
      edgeStack = new Stack(stage, edgeStackId, {
        synthesizer: crossRegionSupportSynthesizer(this.stack),
        env: { region: EdgeFunction.EDGE_REGION },
      });
    }
    this.stack.addDependency(edgeStack);
    return edgeStack;
  }
}

/** Result of creating an in-region or cross-region function */
interface FunctionConfig {
  readonly edgeFunction: lambda.Function;
  readonly edgeArn: string;
  readonly functionStack: Stack;
}

// Stolen (and modified) from `@aws-cdk/aws-codepipeline`'s `Pipeline`.
function crossRegionSupportSynthesizer(stack: Stack): IStackSynthesizer | undefined {
  // If we have the new synthesizer we need a bootstrapless copy of it,
  // because we don't want to require bootstrapping the environment
  // of the account in this replication region.
  // Otherwise, return undefined to use the default.
  const scopeStackSynthesizer = stack.synthesizer;
  return (scopeStackSynthesizer instanceof DefaultStackSynthesizer)
    ? new BootstraplessSynthesizer({
      deployRoleArn: scopeStackSynthesizer.deployRoleArn,
      cloudFormationExecutionRoleArn: scopeStackSynthesizer.cloudFormationExecutionRoleArn,
    })
    : undefined;
}

function addEdgeLambdaToRoleTrustStatement(role: iam.IRole) {
  if (role instanceof iam.Role && role.assumeRolePolicy) {
    const statement = new iam.PolicyStatement();
    const edgeLambdaServicePrincipal = new iam.ServicePrincipal('edgelambda.amazonaws.com');
    statement.addPrincipals(edgeLambdaServicePrincipal);
    statement.addActions(edgeLambdaServicePrincipal.assumeRoleAction);
    role.assumeRolePolicy.addStatements(statement);
  }
}

// Stolen from @aws-lambda/lib/function-hash.ts, which isn't currently exported.
// This should be DRY'ed up (exported by @aws-lambda) before this is marked as stable.
function calculateFunctionHash(fn: lambda.Function) {
  const stack = Stack.of(fn);

  const functionResource = fn.node.defaultChild as CfnResource;

  // render the cloudformation resource from this function
  const config = stack.resolve((functionResource as any)._toCloudFormation());
  // config is of the shape: { Resources: { LogicalId: { Type: 'Function', Properties: { ... } }}}
  const resources = config.Resources;
  const logicalId = Object.keys(resources)[0];
  const resourceAttributes = resources[logicalId];
  // sort the keys, so that the order in the string returned from JSON.stringify() is stable
  // as new properties are added to the CfnFunction class
  const stringifiedConfig = JSON.stringify(config, [
    'Resources', logicalId,
    // 'Type' and 'Properties' are before 'DependsOn' today, so leave it that way
    'Type', 'Properties',
    // sort the resource attributes
    // 'Environment' winds up at the end today, so preserve that
    ...allKeysRecursively(resourceAttributes, ['Environment']).sort(),
    'Environment',
    // for legacy reasons, we do _not_ sort the env variable keys
    ...allKeysRecursively(resourceAttributes?.Properties?.Environment),
  ]);

  const hash = crypto.createHash('md5');
  hash.update(stringifiedConfig);
  return hash.digest('hex');
}

function allKeysRecursively(input: any, blacklist: string[] = []): string[] {
  if (typeof(input) !== 'object') {
    return [];
  }
  const ret = new Array<string>();
  for (const [key, val] of Object.entries(input)) {
    if (val != null && blacklist.indexOf(key) === -1) {
      ret.push(key);
      ret.push(...allKeysRecursively(val, blacklist));
    }
  }
  return ret;
}
