import * as cxapi from '@aws-cdk/cx-api';
import { CfnCondition } from './cfn-condition';
// import required to be here, otherwise causes a cycle when running the generated JavaScript
/* eslint-disable import/order */
import { CfnRefElement } from './cfn-element';
import { CfnCreationPolicy, CfnDeletionPolicy, CfnUpdatePolicy } from './cfn-resource-policy';
import { Construct, IConstruct, Node } from 'constructs';
import { addDependency } from './deps';
import { CfnReference } from './private/cfn-reference';
import { Reference } from './reference';
import { RemovalPolicy, RemovalPolicyOptions } from './removal-policy';
import { TagManager } from './tag-manager';
import { capitalizePropertyNames, ignoreEmpty, PostResolveToken } from './util';

export interface CfnResourceProps {
  /**
   * CloudFormation resource type (e.g. `AWS::S3::Bucket`).
   */
  readonly type: string;

  /**
   * Resource properties.
   *
   * @default - No resource properties.
   */
  readonly properties?: { [name: string]: any };
}

/**
 * Represents a CloudFormation resource.
 */
export class CfnResource extends CfnRefElement {
  /**
   * Check whether the given construct is a CfnResource
   */
  public static isCfnResource(construct: IConstruct): construct is CfnResource {
    return (construct as any).cfnResourceType !== undefined;
  }

  // MAINTAINERS NOTE: this class serves as the base class for the generated L1
  // ("CFN") resources (such as `s3.CfnBucket`). These resources will have a
  // property for each CloudFormation property of the resource. This means that
  // if at some point in the future a property is introduced with a name similar
  // to one of the properties here, it will be "masked" by the derived class. To
  // that end, we prefix all properties in this class with `cfnXxx` with the
  // hope to avoid those conflicts in the future.

  /**
   * Options for this resource, such as condition, update policy etc.
   */
  public readonly cfnOptions: ICfnResourceOptions = {};

  /**
   * AWS resource type.
   */
  public readonly cfnResourceType: string;

  /**
   * AWS CloudFormation resource properties.
   *
   * This object is returned via cfnProperties
   * @internal
   */
  protected readonly _cfnProperties: any;

  /**
   * An object to be merged on top of the entire resource definition.
   */
  private readonly rawOverrides: any = {};

  /**
   * Logical IDs of dependencies.
   *
   * Is filled during prepare().
   */
  private readonly dependsOn = new Set<CfnResource>();

  /**
   * Creates a resource construct.
   * @param cfnResourceType The CloudFormation type of this resource (e.g. AWS::DynamoDB::Table)
   */
  constructor(scope: Construct, id: string, props: CfnResourceProps) {
    super(scope, id);

    if (!props.type) {
      throw new Error('The `type` property is required');
    }

    this.cfnResourceType = props.type;
    this._cfnProperties = props.properties || {};

    // if aws:cdk:enable-path-metadata is set, embed the current construct's
    // path in the CloudFormation template, so it will be possible to trace
    // back to the actual construct path.
    if (Node.of(this).tryGetContext(cxapi.PATH_METADATA_ENABLE_CONTEXT)) {
      this.addMetadata(cxapi.PATH_METADATA_KEY, Node.of(this).path);
    }
  }

  /**
   * Sets the deletion policy of the resource based on the removal policy specified.
   */
  public applyRemovalPolicy(policy: RemovalPolicy | undefined, options: RemovalPolicyOptions = {}) {
    policy = policy || options.default || RemovalPolicy.RETAIN;

    let deletionPolicy;

    switch (policy) {
      case RemovalPolicy.DESTROY:
        deletionPolicy = CfnDeletionPolicy.DELETE;
        break;

      case RemovalPolicy.RETAIN:
        deletionPolicy = CfnDeletionPolicy.RETAIN;
        break;

      case RemovalPolicy.SNAPSHOT:
        deletionPolicy = CfnDeletionPolicy.SNAPSHOT;
        break;

      default:
        throw new Error(`Invalid removal policy: ${policy}`);
    }

    this.cfnOptions.deletionPolicy = deletionPolicy;
    if (options.applyToUpdateReplacePolicy !== false) {
      this.cfnOptions.updateReplacePolicy = deletionPolicy;
    }
  }

  /**
   * Returns a token for an runtime attribute of this resource.
   * Ideally, use generated attribute accessors (e.g. `resource.arn`), but this can be used for future compatibility
   * in case there is no generated attribute.
   * @param attributeName The name of the attribute.
   */
  public getAtt(attributeName: string): Reference {
    return CfnReference.for(this, attributeName);
  }

  /**
   * Adds an override to the synthesized CloudFormation resource. To add a
   * property override, either use `addPropertyOverride` or prefix `path` with
   * "Properties." (i.e. `Properties.TopicName`).
   *
   * If the override is nested, separate each nested level using a dot (.) in the path parameter.
   * If there is an array as part of the nesting, specify the index in the path.
   *
   * For example,
   * ```typescript
   * addOverride('Properties.GlobalSecondaryIndexes.0.Projection.NonKeyAttributes', ['myattribute'])
   * addOverride('Properties.GlobalSecondaryIndexes.1.ProjectionType', 'INCLUDE')
   * ```
   * would add the overrides
   * ```json
   * "Properties": {
   *   "GlobalSecondaryIndexes": [
   *     {
   *       "Projection": {
   *         "NonKeyAttributes": [ "myattribute" ]
   *         ...
   *       }
   *       ...
   *     },
   *     {
   *       "ProjectionType": "INCLUDE"
   *       ...
   *     },
   *   ]
   *   ...
   * }
   * ```
   *
   * @param path - The path of the property, you can use dot notation to
   *        override values in complex types. Any intermdediate keys
   *        will be created as needed.
   * @param value - The value. Could be primitive or complex.
   */
  public addOverride(path: string, value: any) {
    const parts = path.match(/([^\\\][^.]|\\.)+/g) || [""];
    for(var i=0; i < parts.length; i++) {
     parts[i] = parts[i].replace(/\\/g, '');
    }
    let curr: any = this.rawOverrides;

    while (parts.length > 1) {
      const key = parts.shift()!;

      // if we can't recurse further or the previous value is not an
      // object overwrite it with an object.
      const isObject = curr[key] != null && typeof(curr[key]) === 'object' && !Array.isArray(curr[key]);
      if (!isObject) {
        curr[key] = {};
      }

      curr = curr[key];
    }

    const lastKey = parts.shift()!;
    curr[lastKey] = value;
  }

  /**
   * Syntactic sugar for `addOverride(path, undefined)`.
   * @param path The path of the value to delete
   */
  public addDeletionOverride(path: string) {
    this.addOverride(path, undefined);
  }

  /**
   * Adds an override to a resource property.
   *
   * Syntactic sugar for `addOverride("Properties.<...>", value)`.
   *
   * @param propertyPath The path of the property
   * @param value The value
   */
  public addPropertyOverride(propertyPath: string, value: any) {
    this.addOverride(`Properties.${propertyPath}`, value);
  }

  /**
   * Adds an override that deletes the value of a property from the resource definition.
   * @param propertyPath The path to the property.
   */
  public addPropertyDeletionOverride(propertyPath: string) {
    this.addPropertyOverride(propertyPath, undefined);
  }

  /**
   * Indicates that this resource depends on another resource and cannot be
   * provisioned unless the other resource has been successfully provisioned.
   *
   * This can be used for resources across stacks (or nested stack) boundaries
   * and the dependency will automatically be transferred to the relevant scope.
   */
  public addDependsOn(target: CfnResource) {
    // skip this dependency if the target is not part of the output
    if (!target.shouldSynthesize()) {
      return;
    }

    addDependency(this, target, `"${Node.of(this).path}" depends on "${Node.of(target).path}"`);
  }

  /**
   * Add a value to the CloudFormation Resource Metadata
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/metadata-section-structure.html
   *
   * Note that this is a different set of metadata from CDK node metadata; this
   * metadata ends up in the stack template under the resource, whereas CDK
   * node metadata ends up in the Cloud Assembly.
   */
  public addMetadata(key: string, value: any) {
    if (!this.cfnOptions.metadata) {
      this.cfnOptions.metadata = {};
    }

    this.cfnOptions.metadata[key] = value;
  }

  /**
   * @returns a string representation of this resource
   */
  public toString() {
    return `${super.toString()} [${this.cfnResourceType}]`;
  }

  /**
   * Called by the `addDependency` helper function in order to realize a direct
   * dependency between two resources that are directly defined in the same
   * stacks.
   *
   * Use `resource.addDependsOn` to define the dependency between two resources,
   * which also takes stack boundaries into account.
   *
   * @internal
   */
  public _addResourceDependency(target: CfnResource) {
    this.dependsOn.add(target);
  }

  /**
   * Emits CloudFormation for this resource.
   * @internal
   */
  public _toCloudFormation(): object {
    if (!this.shouldSynthesize()) {
      return { };
    }

    try {
      const ret = {
        Resources: {
          // Post-Resolve operation since otherwise deepMerge is going to mix values into
          // the Token objects returned by ignoreEmpty.
          [this.logicalId]: new PostResolveToken({
            Type: this.cfnResourceType,
            Properties: ignoreEmpty(this.cfnProperties),
            DependsOn: ignoreEmpty(renderDependsOn(this.dependsOn)),
            CreationPolicy: capitalizePropertyNames(this, renderCreationPolicy(this.cfnOptions.creationPolicy)),
            UpdatePolicy: capitalizePropertyNames(this, this.cfnOptions.updatePolicy),
            UpdateReplacePolicy: capitalizePropertyNames(this, this.cfnOptions.updateReplacePolicy),
            DeletionPolicy: capitalizePropertyNames(this, this.cfnOptions.deletionPolicy),
            Version: this.cfnOptions.version,
            Description: this.cfnOptions.description,
            Metadata: ignoreEmpty(this.cfnOptions.metadata),
            Condition: this.cfnOptions.condition && this.cfnOptions.condition.logicalId,
          }, props => {
            const renderedProps = this.renderProperties(props.Properties || {});
            if (renderedProps) {
              const hasDefined = Object.values(renderedProps).find(v => v !== undefined);
              props.Properties = hasDefined !== undefined ? renderedProps : undefined;
            }
            return deepMerge(props, this.rawOverrides);
          }),
        },
      };
      return ret;
    } catch (e) {
      // Change message
      e.message = `While synthesizing ${this.node.path}: ${e.message}`;
      // Adjust stack trace (make it look like node built it, too...)
      const trace = this.creationStack;
      if (trace) {
        const creationStack = ['--- resource created at ---', ...trace].join('\n  at ');
        const problemTrace = e.stack.substr(e.stack.indexOf(e.message) + e.message.length);
        e.stack = `${e.message}\n  ${creationStack}\n  --- problem discovered at ---${problemTrace}`;
      }

      // Re-throw
      throw e;
    }

    // returns the set of logical ID (tokens) this resource depends on
    // sorted by construct paths to ensure test determinism
    function renderDependsOn(dependsOn: Set<CfnResource>) {
      return Array
        .from(dependsOn)
        .sort((x, y) => x.node.path.localeCompare(y.node.path))
        .map(r => r.logicalId);
    }

    function renderCreationPolicy(policy: CfnCreationPolicy | undefined): any {
      if (!policy) { return undefined; }
      const result: any = { ...policy };
      if (policy.resourceSignal && policy.resourceSignal.timeout) {
        result.resourceSignal = policy.resourceSignal;
      }
      return result;
    }
  }

  protected get cfnProperties(): { [key: string]: any } {
    const props = this._cfnProperties || {};
    if (TagManager.isTaggable(this)) {
      const tagsProp: { [key: string]: any } = {};
      tagsProp[this.tags.tagPropertyName] = this.tags.renderTags();
      return deepMerge(props, tagsProp);
    }
    return props;
  }

  protected renderProperties(props: {[key: string]: any}): { [key: string]: any } {
    return props;
  }

  /**
   * Return properties modified after initiation
   *
   * Resources that expose mutable properties should override this function to
   * collect and return the properties object for this resource.
   */
  protected get updatedProperites(): { [key: string]: any } {
    return this._cfnProperties;
  }

  protected validateProperties(_properties: any) {
    // Nothing
  }

  /**
   * Can be overridden by subclasses to determine if this resource will be rendered
   * into the cloudformation template.
   *
   * @returns `true` if the resource should be included or `false` is the resource
   * should be omitted.
   */
  protected shouldSynthesize() {
    return true;
  }
}

export enum TagType {
  STANDARD = 'StandardTag',
  AUTOSCALING_GROUP = 'AutoScalingGroupTag',
  MAP = 'StringToStringMap',
  KEY_VALUE = 'KeyValue',
  NOT_TAGGABLE = 'NotTaggable',
}

export interface ICfnResourceOptions {
  /**
   * A condition to associate with this resource. This means that only if the condition evaluates to 'true' when the stack
   * is deployed, the resource will be included. This is provided to allow CDK projects to produce legacy templates, but noramlly
   * there is no need to use it in CDK projects.
   */
  condition?: CfnCondition;

  /**
   * Associate the CreationPolicy attribute with a resource to prevent its status from reaching create complete until
   * AWS CloudFormation receives a specified number of success signals or the timeout period is exceeded. To signal a
   * resource, you can use the cfn-signal helper script or SignalResource API. AWS CloudFormation publishes valid signals
   * to the stack events so that you track the number of signals sent.
   */
  creationPolicy?: CfnCreationPolicy;

  /**
   * With the DeletionPolicy attribute you can preserve or (in some cases) backup a resource when its stack is deleted.
   * You specify a DeletionPolicy attribute for each resource that you want to control. If a resource has no DeletionPolicy
   * attribute, AWS CloudFormation deletes the resource by default. Note that this capability also applies to update operations
   * that lead to resources being removed.
   */
  deletionPolicy?: CfnDeletionPolicy;

  /**
   * Use the UpdatePolicy attribute to specify how AWS CloudFormation handles updates to the AWS::AutoScaling::AutoScalingGroup
   * resource. AWS CloudFormation invokes one of three update policies depending on the type of change you make or whether a
   * scheduled action is associated with the Auto Scaling group.
   */
  updatePolicy?: CfnUpdatePolicy;

  /**
   * Use the UpdateReplacePolicy attribute to retain or (in some cases) backup the existing physical instance of a resource
   * when it is replaced during a stack update operation.
   */
  updateReplacePolicy?: CfnDeletionPolicy;

  /**
   * The version of this resource.
   * Used only for custom CloudFormation resources.
   *
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-cfn-customresource.html
   */
  version?: string;

  /**
   * The description of this resource.
   * Used for informational purposes only, is not processed in any way
   * (and stays with the CloudFormation template, is not passed to the underlying resource,
   * even if it does have a 'description' property).
   */
  description?: string;

  /**
   * Metadata associated with the CloudFormation resource. This is not the same as the construct metadata which can be added
   * using construct.addMetadata(), but would not appear in the CloudFormation template automatically.
   */
  metadata?: { [key: string]: any };
}

/**
 * Merges `source` into `target`, overriding any existing values.
 * `null`s will cause a value to be deleted.
 */
function deepMerge(target: any, ...sources: any[]) {
  for (const source of sources) {
    if (typeof(source) !== 'object' || typeof(target) !== 'object') {
      throw new Error(`Invalid usage. Both source (${JSON.stringify(source)}) and target (${JSON.stringify(target)}) must be objects`);
    }

    for (const key of Object.keys(source)) {
      const value = source[key];
      if (typeof(value) === 'object' && value != null && !Array.isArray(value)) {
        // if the value at the target is not an object, override it with an
        // object so we can continue the recursion
        if (typeof(target[key]) !== 'object') {
          target[key] = {};
        }

        deepMerge(target[key], value);

        // if the result of the merge is an empty object, it's because the
        // eventual value we assigned is `undefined`, and there are no
        // sibling concrete values alongside, so we can delete this tree.
        const output = target[key];
        if (typeof(output) === 'object' && Object.keys(output).length === 0) {
          delete target[key];
        }
      } else if (value === undefined) {
        delete target[key];
      } else {
        target[key] = value;
      }
    }
  }

  return target;
}
