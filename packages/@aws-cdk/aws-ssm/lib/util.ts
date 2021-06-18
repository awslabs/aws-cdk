import { Stack, Token } from '@aws-cdk/core';
import { IConstruct } from 'constructs';

export const AUTOGEN_MARKER = '$$autogen$$';

export interface ArnForParameterNameOptions {
  readonly physicalName?: string;
  readonly simpleName?: boolean;
}

/**
 * Renders an ARN for an SSM parameter given a parameter name.
 * @param scope definition scope
 * @param parameterName the parameter name to include in the ARN
 * @param physicalName optional physical name specified by the user (to auto-detect separator)
 */
export function arnForParameterName(scope: IConstruct, parameterName: string, options: ArnForParameterNameOptions = { }): string {
  const physicalName = options.physicalName;
  const nameToValidate = physicalName || parameterName;

  if (!Token.isUnresolved(nameToValidate) && nameToValidate.includes('/') && !nameToValidate.startsWith('/')) {
    throw new Error(`Parameter names must be fully qualified (if they include "/" they must also begin with a "/"): ${nameToValidate}`);
  }

  return Stack.of(scope).formatArn({
    service: 'ssm',
    resource: 'parameter',
    sep: isSimpleName() ? '/' : '',
    resourceName: parameterName,
  });

  /**
   * Determines the ARN separator for this parameter: if we have a concrete
   * parameter name (or explicitly defined physical name), we will parse them
   * and decide whether a "/" is needed or not. Otherwise, users will have to
   * explicitly specify `simpleName` when they import the ARN.
   */
  function isSimpleName(): boolean {
    // look for a concrete name as a hint for determining the separator
    const concreteName = !Token.isUnresolved(parameterName) ? parameterName : physicalName;
    if (!concreteName || Token.isUnresolved(concreteName)) {
      if (options.simpleName === undefined) {
        throw new Error('Unable to determine ARN separator for SSM parameter since the parameter name is an unresolved token. Use "fromAttributes" and specify "simpleName" explicitly');
      }

      return options.simpleName;
    }

    const result = !concreteName.startsWith('/');

    // if users explicitly specify the separator and it conflicts with the one we need, it's an error.
    if (options.simpleName !== undefined && options.simpleName !== result) {
      if (concreteName === AUTOGEN_MARKER) {
        throw new Error('If "parameterName" is not explicitly defined, "simpleName" must be "true" or undefined since auto-generated parameter names always have simple names');
      }

      throw new Error(`Parameter name "${concreteName}" is ${result ? 'a simple name' : 'not a simple name'}, but "simpleName" was explicitly set to ${options.simpleName}. Either omit it or set it to ${result}`);
    }

    return result;
  }
}
