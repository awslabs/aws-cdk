import iam = require('@aws-cdk/aws-iam');
import {
  CfnDynamicReference, CfnDynamicReferenceService, CfnParameter,
  Construct, ContextProvider, Fn, IConstruct, IResource, PhysicalName, Resource, ResourceIdentifiers, Stack, Token
} from '@aws-cdk/cdk';
import cxapi = require('@aws-cdk/cx-api');
import ssm = require('./ssm.generated');

/**
 * An SSM Parameter reference.
 */
export interface IParameter extends IResource {
  /**
   * The ARN of the SSM Parameter resource.
   * @attribute
   */
  readonly parameterArn: string;

  /**
   * The name of the SSM Parameter resource.
   * @attribute
   */
  readonly parameterName: string;

  /**
   * The type of the SSM Parameter resource.
   * @attribute
   */
  readonly parameterType: string;

  /**
   * Grants read (DescribeParameter, GetParameter, GetParameterHistory) permissions on the SSM Parameter.
   *
   * @param grantee the role to be granted read-only access to the parameter.
   */
  grantRead(grantee: iam.IGrantable): iam.Grant;

  /**
   * Grants write (PutParameter) permissions on the SSM Parameter.
   *
   * @param grantee the role to be granted write access to the parameter.
   */
  grantWrite(grantee: iam.IGrantable): iam.Grant;
}

/**
 * A String SSM Parameter.
 */
export interface IStringParameter extends IParameter {
  /**
   * The parameter value. Value must not nest another parameter. Do not use {{}} in the value.
   *
   * @attribute parameterValue
   */
  readonly stringValue: string;
}

/**
 * A StringList SSM Parameter.
 */
export interface IStringListParameter extends IParameter {
  /**
   * The parameter value. Value must not nest another parameter. Do not use {{}} in the value. Values in the array
   * cannot contain commas (``,``).
   *
   * @attribute parameterValue
   */
  readonly stringListValue: string[];
}

/**
 * Properties needed to create a new SSM Parameter.
 */
export interface ParameterOptions {
  /**
   * A regular expression used to validate the parameter value. For example, for String types with values restricted to
   * numbers, you can specify the following: ``^\d+$``
   *
   * @default no validation is performed
   */
  readonly allowedPattern?: string;

  /**
   * Information about the parameter that you want to add to the system.
   *
   * @default none
   */
  readonly description?: string;

  /**
   * The name of the parameter.
   *
   * @default - a name will be generated by CloudFormation
   */
  readonly parameterName?: PhysicalName;
}

/**
 * Properties needed to create a String SSM parameter.
 */
export interface StringParameterProps extends ParameterOptions {
  /**
   * The value of the parameter. It may not reference another parameter and ``{{}}`` cannot be used in the value.
   */
  readonly stringValue: string;
}

/**
 * Properties needed to create a StringList SSM Parameter
 */
export interface StringListParameterProps extends ParameterOptions {
  /**
   * The values of the parameter. It may not reference another parameter and ``{{}}`` cannot be used in the value.
   */
  readonly stringListValue: string[];
}

/**
 * Basic features shared across all types of SSM Parameters.
 */
abstract class ParameterBase extends Resource implements IParameter {
  public abstract readonly parameterArn: string;
  public abstract readonly parameterName: string;
  public abstract readonly parameterType: string;

  public grantRead(grantee: iam.IGrantable): iam.Grant {
    return iam.Grant.addToPrincipal({
      grantee,
      actions: ['ssm:DescribeParameters', 'ssm:GetParameter', 'ssm:GetParameterHistory'],
      resourceArns: [this.parameterArn],
    });
  }

  public grantWrite(grantee: iam.IGrantable): iam.Grant {
    return iam.Grant.addToPrincipal({
      grantee,
      actions: ['ssm:PutParameter'],
      resourceArns: [this.parameterArn],
    });
  }
}

const STRING_PARAM_TYPE = 'String';
const SECURE_STRING_PARAM_TYPE = 'SecureString';
const STRINGLIST_PARAM_TYPE = 'StringList';

export interface StringParameterAttributes {
  /**
   * The name of the parameter store value
   */
  readonly parameterName: string;

  /**
   * The version number of the value you wish to retrieve.
   *
   * @default The latest version will be retrieved.
   */
  readonly version?: number;
}

export interface SecureStringParameterAttributes {
  /**
   * The name of the parameter store value
   */
  readonly parameterName: string;

  /**
   * The version number of the value you wish to retrieve. This is required for secure strings.
   */
  readonly version: number;
}

/**
 * Creates a new String SSM Parameter.
 * @resource AWS::SSM::Parameter
 */
export class StringParameter extends ParameterBase implements IStringParameter {

  /**
   * Imports an external string parameter by name.
   */
  public static fromStringParameterName(scope: Construct, id: string, stringParameterName: string): IStringParameter {
    return this.fromStringParameterAttributes(scope, id, { parameterName: stringParameterName });
  }

  /**
   * Imports an external string parameter with name and optional version.
   */
  public static fromStringParameterAttributes(scope: Construct, id: string, attrs: StringParameterAttributes): IStringParameter {
    if (!attrs.parameterName) {
      throw new Error(`parameterName cannot be an empty string`);
    }

    const stringValue = attrs.version
      ? new CfnDynamicReference(CfnDynamicReferenceService.Ssm, `${attrs.parameterName}:${attrs.version}`).toString()
      : new CfnParameter(scope, `${id}.Parameter`, { type: 'AWS::SSM::Parameter::Value<String>', default: attrs.parameterName }).valueAsString;

    class Import extends ParameterBase {
      public readonly parameterName = attrs.parameterName;
      public readonly parameterArn = arnForParameterName(this, this.parameterName);
      public readonly parameterType = STRING_PARAM_TYPE;
      public readonly stringValue = stringValue;
    }

    return new Import(scope, id);
  }

  /**
   * Imports a secure string parameter from the SSM parameter store.
   */
  public static fromSecureStringParameterAttributes(scope: Construct, id: string, attrs: SecureStringParameterAttributes): IStringParameter {
    const stringValue = new CfnDynamicReference(CfnDynamicReferenceService.SsmSecure, `${attrs.parameterName}:${attrs.version}`).toString();

    class Import extends ParameterBase {
      public readonly parameterName = attrs.parameterName;
      public readonly parameterArn = arnForParameterName(this, this.parameterName);
      public readonly parameterType = SECURE_STRING_PARAM_TYPE;
      public readonly stringValue = stringValue;
    }

    return new Import(scope, id);
  }

  /**
   * Reads the value of an SSM parameter during synthesis through an
   * environmental context provider.
   *
   * Requires that the stack this scope is defined in will have explicit
   * account/region information. Otherwise, it will fail during synthesis.
   */
  public static valueFromLookup(scope: Construct, parameterName: string): string {
    const value = ContextProvider.getValue(scope, {
      provider: cxapi.SSM_PARAMETER_PROVIDER,
      props: { parameterName },
      dummyValue: `dummy-value-for-${parameterName}`
    });

    return value;
  }

  /**
   * Returns a token that will resolve (during deployment) to the string value of an SSM string parameter.
   * @param scope Some scope within a stack
   * @param parameterName The name of the SSM parameter.
   * @param version The parameter version (recommended in order to ensure that the value won't change during deployment)
   */
  public static valueForStringParameter(scope: Construct, parameterName: string, version?: number): string {
    const stack = Stack.of(scope);
    const id = makeIdentityForImportedValue(parameterName);
    const exists = stack.node.tryFindChild(id) as IStringParameter;
    if (exists) { return exists.stringValue; }

    return this.fromStringParameterAttributes(stack, id, { parameterName, version }).stringValue;
  }

  /**
   * Returns a token that will resolve (during deployment)
   * @param scope Some scope within a stack
   * @param parameterName The name of the SSM parameter
   * @param version The parameter version (required for secure strings)
   */
  public static valueForSecureStringParameter(scope: Construct, parameterName: string, version: number): string {
    const stack = Stack.of(scope);
    const id = makeIdentityForImportedValue(parameterName);
    const exists = stack.node.tryFindChild(id) as IStringParameter;
    if (exists) { return exists.stringValue; }

    return this.fromSecureStringParameterAttributes(stack, id, { parameterName, version }).stringValue;
  }

  public readonly parameterArn: string;
  public readonly parameterName: string;
  public readonly parameterType: string;
  public readonly stringValue: string;

  constructor(scope: Construct, id: string, props: StringParameterProps) {
    super(scope, id, {
      physicalName: props.parameterName,
    });

    if (props.allowedPattern) {
      _assertValidValue(props.stringValue, props.allowedPattern);
    }

    const resource = new ssm.CfnParameter(this, 'Resource', {
      allowedPattern: props.allowedPattern,
      description: props.description,
      name: this.physicalName,
      type: STRING_PARAM_TYPE,
      value: props.stringValue,
    });

    const resourceIdentifiers = new ResourceIdentifiers(this, {
      arn: arnForParameterName(this, resource.ref),
      name: resource.ref,
      arnComponents: {
        service: 'ssm',
        resource: 'parameter',
        resourceName: this.physicalName,
        sep: '', // `sep` is empty because parameterName starts with a / already!
      },
    });
    this.parameterArn = resourceIdentifiers.arn;
    this.parameterName = resourceIdentifiers.name;

    this.parameterType = resource.attrType;
    this.stringValue = resource.attrValue;
  }
}

/**
 * Creates a new StringList SSM Parameter.
 * @resource AWS::SSM::Parameter
 */
export class StringListParameter extends ParameterBase implements IStringListParameter {

  /**
   * Imports an external parameter of type string list.
   */
  public static fromStringListParameterName(scope: Construct, id: string, stringListParameterName: string): IStringListParameter {
    class Import extends ParameterBase {
      public readonly parameterName = stringListParameterName;
      public readonly parameterArn = arnForParameterName(this, this.parameterName);
      public readonly parameterType = STRINGLIST_PARAM_TYPE;
      public readonly stringListValue = Fn.split(',', new CfnDynamicReference(CfnDynamicReferenceService.Ssm, stringListParameterName).toString());
    }

    return new Import(scope, id);
  }

  public readonly parameterArn: string;
  public readonly parameterName: string;
  public readonly parameterType: string;
  public readonly stringListValue: string[];

  constructor(scope: Construct, id: string, props: StringListParameterProps) {
    super(scope, id, {
      physicalName: props.parameterName,
    });

    if (props.stringListValue.find(str => !Token.isUnresolved(str) && str.indexOf(',') !== -1)) {
      throw new Error('Values of a StringList SSM Parameter cannot contain the \',\' character. Use a string parameter instead.');
    }

    if (props.allowedPattern && !Token.isUnresolved(props.stringListValue)) {
      props.stringListValue.forEach(str => _assertValidValue(str, props.allowedPattern!));
    }

    const resource = new ssm.CfnParameter(this, 'Resource', {
      allowedPattern: props.allowedPattern,
      description: props.description,
      name: this.physicalName,
      type: STRINGLIST_PARAM_TYPE,
      value: props.stringListValue.join(','),
    });
    const resourceIdentifiers = new ResourceIdentifiers(this, {
      arn: arnForParameterName(this, resource.ref),
      name: resource.ref,
      arnComponents: {
        service: 'ssm',
        resource: 'parameter',
        resourceName: this.physicalName,
        sep: '', // `sep` is empty because parameterName starts with a / already!
      },
    });
    this.parameterArn = resourceIdentifiers.arn;
    this.parameterName = resourceIdentifiers.name;

    this.parameterType = resource.attrType;
    this.stringListValue = Fn.split(',', resource.attrValue);
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
  if (Token.isUnresolved(value) || Token.isUnresolved(allowedPattern)) {
    // Unable to perform validations against unresolved tokens
    return;
  }
  if (!new RegExp(allowedPattern).test(value)) {
    throw new Error(`The supplied value (${value}) does not match the specified allowedPattern (${allowedPattern})`);
  }
}

function makeIdentityForImportedValue(parameterName: string) {
  return `SsmParameterValue:${parameterName}:C96584B6-F00A-464E-AD19-53AFF4B05118`;
}

function arnForParameterName(scope: IConstruct, parameterName: string): string {
  return Stack.of(scope).formatArn({
    service: 'ssm',
    resource: 'parameter',
    sep: '', // Sep is empty because this.parameterName starts with a / already!
    resourceName: parameterName,
  });
}
