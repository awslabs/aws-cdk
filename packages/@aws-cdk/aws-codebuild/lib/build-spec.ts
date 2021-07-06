import { IResolveContext, Lazy, Stack } from '@aws-cdk/core';
import * as yaml_cfn from './private/yaml-cfn';

/**
 * BuildSpec for CodeBuild projects
 */
export abstract class BuildSpec {
  public static fromObject(value: { [key: string]: any }): BuildSpec {
    return new ObjectBuildSpec(value);
  }

  /**
   * Create a buildspec from an object that will be rendered as YAML in the resulting CloudFormation template.
   *
   * @param value the object containing the buildspec that will be rendered as YAML
   */
  public static fromObjectToYaml(value: { [key: string]: any }): BuildSpec {
    return new YamlBuildSpec(value);
  }

  /**
   * Use a file from the source as buildspec
   *
   * Use this if you want to use a file different from 'buildspec.yml'`
   */
  public static fromSourceFilename(filename: string): BuildSpec {
    return new FilenameBuildSpec(filename);
  }

  /**
   * Whether the buildspec is directly available or deferred until build-time
   */
  public abstract readonly isImmediate: boolean;

  protected constructor() {
  }

  /**
   * Render the represented BuildSpec
   */
  public abstract toBuildSpec(): string;
}

/**
 * BuildSpec that just returns the input unchanged
 */
class FilenameBuildSpec extends BuildSpec {
  public readonly isImmediate: boolean = false;

  constructor(private readonly filename: string) {
    super();
  }

  public toBuildSpec(): string {
    return this.filename;
  }

  public toString() {
    return `<buildspec file: ${this.filename}>`;
  }
}

/**
 * BuildSpec that understands about structure
 */
class ObjectBuildSpec extends BuildSpec {
  public readonly isImmediate: boolean = true;

  constructor(public readonly spec: { [key: string]: any }) {
    super();
  }

  public toBuildSpec(): string {
    // We have to pretty-print the buildspec, otherwise
    // CodeBuild will not recognize it as an inline buildspec.
    return Lazy.uncachedString({
      produce: (ctx: IResolveContext) =>
        Stack.of(ctx.scope).toJsonString(this.spec, 2),
    });
  }
}

/**
 * BuildSpec that exports into YAML format
 */
class YamlBuildSpec extends BuildSpec {
  public readonly isImmediate: boolean = true;

  constructor(public readonly spec: { [key: string]: any }) {
    super();
  }

  public toBuildSpec(): string {
    return yaml_cfn.serialize(this.spec);
  }
}

/**
 * Merge two buildspecs into a new BuildSpec by doing a deep merge
 *
 * We decided to disallow merging of artifact specs, which is
 * actually impossible since we can't merge two buildspecs with a
 * single primary output into a buildspec with multiple outputs.
 * In case of multiple outputs they must have identifiers but we won't have that information.
 *
 * In case of test reports we replace the whole object with the RHS (instead of recursively merging)
*/
export function mergeBuildSpecs(lhs: BuildSpec, rhs: BuildSpec): BuildSpec {
  if (!(lhs instanceof ObjectBuildSpec) || !(rhs instanceof ObjectBuildSpec)) {
    throw new Error('Can only merge buildspecs created using BuildSpec.fromObject()');
  }

  if (lhs.spec.version === '0.1') {
    throw new Error('Cannot extend buildspec at version "0.1". Set the version to "0.2" or higher instead.');
  }
  if (lhs.spec.artifacts && rhs.spec.artifacts) {
    // We decided to disallow merging of artifact specs, which is
    // actually impossible since we can't merge two buildspecs with a
    // single primary output into a buildspec with multiple outputs.
    // In case of multiple outputs they must have identifiers but we won't have that information.
    throw new Error('Only one build spec is allowed to specify artifacts.');
  }

  const lhsSpec = JSON.parse(JSON.stringify(lhs.spec));
  const rhsSpec = JSON.parse(JSON.stringify(rhs.spec));

  const merged = mergeDeep(lhsSpec, rhsSpec);

  // In case of test reports we replace the whole object with the RHS (instead of recursively merging)
  if (lhsSpec.reports && rhsSpec.reports) {
    merged.reports = { ...lhsSpec.reports, ...rhsSpec.reports };
  }

  return new ObjectBuildSpec(merged);
}

function mergeDeep(lhs: any, rhs: any): any {
  if (Array.isArray(lhs) && Array.isArray(rhs)) {
    return [...lhs, ...rhs];
  }
  if (Array.isArray(lhs) || Array.isArray(rhs)) {
    return rhs;
  }

  const isObject = (obj: any) => obj && typeof obj === 'object';

  if (isObject(lhs) && isObject(rhs)) {
    const ret: any = { ...lhs };
    for (const k of Object.keys(rhs)) {
      ret[k] = k in lhs ? mergeDeep(lhs[k], rhs[k]) : rhs[k];
    }
    return ret;
  }

  return rhs;
};