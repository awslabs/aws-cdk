import iam = require('@aws-cdk/aws-iam');
import cdk = require('@aws-cdk/cdk');
import ssm = require('./ssm.generated');

/**
 * An SSM Parameter reference.
 */
export interface IParameter extends cdk.IConstruct {
  /**
   * The ARN of the SSM Parameter resource.
   */
  readonly parameterArn: string;

  /**
   * The name of the SSM Parameter resource.
   */
  readonly parameterName: string;

  /**
   * The type of the SSM Parameter resource.
   */
  readonly parameterType: string;

  /**
   * Grants read (DescribeParameter, GetParameter, GetParameterHistory) permissions on the SSM Parameter.
   *
   * @param grantee the role to be granted read-only access to the parameter.
   */
  grantRead(grantee: iam.IPrincipal): void;

  /**
   * Grants write (PutParameter) permissions on the SSM Parameter.
   *
   * @param grantee the role to be granted write access to the parameter.
   */
  grantWrite(grantee: iam.IPrincipal): void;
}

/**
 * A String SSM Parameter.
 */
export interface IStringParameter extends IParameter {
  /**
   * The parameter value. Value must not nest another parameter. Do not use {{}} in the value.
   */
  readonly parameterValue: string;
}

/**
 * A StringList SSM Parameter.
 */
export interface IStringListParameter extends IParameter {
  /**
   * The parameter value. Value must not nest another parameter. Do not use {{}} in the value. Values in the array
   * cannot contain commas (``,``).
   */
  readonly parameterValue: string[];
}

/**
 * Properties needed to create a new SSM Parameter.
 */
export interface ParameterProps {
  /**
   * A regular expression used to validate the parameter value. For example, for String types with values restricted to
   * numbers, you can specify the following: ``^\d+$``
   *
   * @default no validation is performed
   */
  allowedPattern?: string;

  /**
   * Information about the parameter that you want to add to the system.
   *
   * @default none
   */
  description?: string;

  /**
   * The name of the parameter.
   *
   * @default a name will be generated by CloudFormation
   */
  name?: string;
}

/**
 * Properties needed to create a String SSM parameter.
 */
export interface StringParameterProps extends ParameterProps {
  /**
   * The value of the parameter. It may not reference another parameter and ``{{}}`` cannot be used in the value.
   */
  value: string;
}

/**
 * Properties needed to create a StringList SSM Parameter
 */
export interface StringListParameterProps extends ParameterProps {
  /**
   * The values of the parameter. It may not reference another parameter and ``{{}}`` cannot be used in the value.
   */
  value: string[];
}

/**
 * Basic features shared across all types of SSM Parameters.
 */
export abstract class ParameterBase extends cdk.Construct implements IParameter {
  public abstract readonly parameterName: string;
  public abstract readonly parameterType: string;

  constructor(scope: cdk.Construct, id: string, _props: ParameterProps) {
    super(scope, id);
  }

  public get parameterArn(): string {
    return cdk.Stack.find(this).formatArn({
      service: 'ssm',
      resource: 'parameter',
      resourceName: this.parameterName,
    });
  }

  public grantRead(grantee: iam.IPrincipal): void {
    grantee.addToPolicy(new iam.PolicyStatement()
      .allow()
      .addActions('ssm:DescribeParameters', 'ssm:GetParameter', 'ssm:GetParameterHistory')
      .addResource(this.parameterArn));
  }

  public grantWrite(grantee: iam.IPrincipal): void {
    grantee.addToPolicy(new iam.PolicyStatement()
      .allow()
      .addAction('ssm:PutParameter')
      .addResource(this.parameterArn));
  }
}

/**
 * Creates a new String SSM Parameter.
 */
export class StringParameter extends ParameterBase implements IStringParameter {
  public readonly parameterName: string;
  public readonly parameterType: string;
  public readonly parameterValue: string;

  constructor(scope: cdk.Construct, id: string, props: StringParameterProps) {
    super(scope, id, props);

    if (props.allowedPattern) {
      _assertValidValue(props.value, props.allowedPattern);
    }

    const resource = new ssm.CfnParameter(this, 'Resource', {
      allowedPattern: props.allowedPattern,
      description: props.description,
      name: props.name,
      type: 'String',
      value: props.value,
    });

    this.parameterName = resource.parameterName;
    this.parameterType = resource.parameterType;
    this.parameterValue = resource.parameterValue;
  }
}

/**
 * Creates a new StringList SSM Parameter.
 */
export class StringListParameter extends ParameterBase implements IStringListParameter {
  public readonly parameterName: string;
  public readonly parameterType: string;
  public readonly parameterValue: string[];

  constructor(scope: cdk.Construct, id: string, props: StringListParameterProps) {
    super(scope, id, props);

    if (props.value.find(str => !cdk.unresolved(str) && str.indexOf(',') !== -1)) {
      throw new Error('Values of a StringList SSM Parameter cannot contain the \',\' character. Use a string parameter instead.');
    }

    if (props.allowedPattern && !cdk.unresolved(props.value)) {
      props.value.forEach(str => _assertValidValue(str, props.allowedPattern!));
    }

    const resource = new ssm.CfnParameter(this, 'Resource', {
      allowedPattern: props.allowedPattern,
      description: props.description,
      name: props.name,
      type: 'StringList',
      value: props.value.join(','),
    });

    this.parameterName = resource.parameterName;
    this.parameterType = resource.parameterType;
    this.parameterValue = cdk.Fn.split(',', resource.parameterValue);
  }
}

/**
 * Validates whether a supplied value conforms to the allowedPattern, granted neither is an unresolved token.
 *
 * @param value          the value to be validated.
 * @param allowedPattern the regular expression to use for validation.
 *
 * @throws if the ``value`` does not conform to the ``allowedPattern`` and neither is an unresolved token (per
 *         ``cdk.unresolved``).
 */
function _assertValidValue(value: string, allowedPattern: string): void {
  if (cdk.unresolved(value) || cdk.unresolved(allowedPattern)) {
    // Unable to perform validations against unresolved tokens
    return;
  }
  if (!new RegExp(allowedPattern).test(value)) {
    throw new Error(`The supplied value (${value}) does not match the specified allowedPattern (${allowedPattern})`);
  }
}
