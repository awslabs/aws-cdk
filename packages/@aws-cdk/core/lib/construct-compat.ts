/**
 * Constructs compatibility layer.
 *
 * This file includes types that shadow types in the "constructs" module in
 * order to allow backwards-compatiblity in the AWS CDK v1.0 release line.
 *
 * There are pretty ugly hacks here, which mostly involve downcasting types to
 * adhere to legacy AWS CDK APIs.
 *
 * This file, in its entirety, is expected to be removed in v2.0.
 */

import * as cxapi from '@aws-cdk/cx-api';
import * as constructs from 'constructs';
import { Annotations } from './annotations';
import { IAspect, Aspects } from './aspect';
import { IDependable } from './dependency';
import { Token } from './token';

const ORIGINAL_CONSTRUCT_NODE_SYMBOL = Symbol.for('@aws-cdk/core.ConstructNode');
const CONSTRUCT_SYMBOL = Symbol.for('@aws-cdk/core.Construct');

/**
 * Represents a construct.
 */
export interface IConstruct extends constructs.IConstruct, IDependable {
  /**
   * The construct tree node for this construct.
   */
  readonly node: ConstructNode;
}

/**
 * Represents a single session of synthesis. Passed into `Construct.synthesize()` methods.
 */
export interface ISynthesisSession {
  /**
   * The output directory for this synthesis session.
   */
  outdir: string;

  /**
   * Cloud assembly builder.
   */
  assembly: cxapi.CloudAssemblyBuilder;
}

/**
 * Represents the building block of the construct graph.
 *
 * All constructs besides the root construct must be created within the scope of
 * another construct.
 */
export class Construct extends constructs.Construct implements IConstruct {
  /**
   * Return whether the given object is a Construct
   */
  public static isConstruct(x: any): x is Construct {
    return typeof x === 'object' && x !== null && CONSTRUCT_SYMBOL in x;
  }

  /**
   * The construct tree node associated with this construct.
   */
  public readonly node: ConstructNode;

  constructor(scope: constructs.Construct, id: string) {
    super(scope, id, {
      nodeFactory: {
        createNode: (h: constructs.Construct, s: constructs.IConstruct, i: string) =>
          new ConstructNode(h as Construct, s as IConstruct, i)._actualNode,
      },
    });

    if (Token.isUnresolved(id)) {
      throw new Error(`Cannot use tokens in construct ID: ${id}`);
    }

    Object.defineProperty(this, CONSTRUCT_SYMBOL, { value: true });
    this.node = ConstructNode._unwrap(constructs.Node.of(this));

    const disableTrace =
      this.node.tryGetContext(cxapi.DISABLE_METADATA_STACK_TRACE) ||
      this.node.tryGetContext(constructs.ConstructMetadata.DISABLE_STACK_TRACE_IN_METADATA) ||
      process.env.CDK_DISABLE_STACK_TRACE;

    if (disableTrace) {
      this.node.setContext(cxapi.DISABLE_METADATA_STACK_TRACE, true);
      this.node.setContext(constructs.ConstructMetadata.DISABLE_STACK_TRACE_IN_METADATA, true);
      process.env.CDK_DISABLE_STACK_TRACE = '1';
    }
  }

  /**
   * Validate the current construct.
   *
   * This method can be implemented by derived constructs in order to perform
   * validation logic. It is called on all constructs before synthesis.
   *
   * @returns An array of validation error messages, or an empty array if the construct is valid.
   */
  protected onValidate(): string[] {
    return this.validate();
  }

  /**
   * Perform final modifications before synthesis
   *
   * This method can be implemented by derived constructs in order to perform
   * final changes before synthesis. prepare() will be called after child
   * constructs have been prepared.
   *
   * This is an advanced framework feature. Only use this if you
   * understand the implications.
   */
  protected onPrepare(): void {
    this.prepare();
  }

  /**
   * Allows this construct to emit artifacts into the cloud assembly during synthesis.
   *
   * This method is usually implemented by framework-level constructs such as `Stack` and `Asset`
   * as they participate in synthesizing the cloud assembly.
   *
   * @param session The synthesis session.
   */
  protected onSynthesize(session: constructs.ISynthesisSession): void {
    this.synthesize({
      outdir: session.outdir,
      assembly: session.assembly!,
    });
  }

  /**
   * Validate the current construct.
   *
   * This method can be implemented by derived constructs in order to perform
   * validation logic. It is called on all constructs before synthesis.
   *
   * @returns An array of validation error messages, or an empty array if the construct is valid.
   */
  protected validate(): string[] {
    return [];
  }

  /**
   * Perform final modifications before synthesis
   *
   * This method can be implemented by derived constructs in order to perform
   * final changes before synthesis. prepare() will be called after child
   * constructs have been prepared.
   *
   * This is an advanced framework feature. Only use this if you
   * understand the implications.
   */
  protected prepare(): void {
    return;
  }

  /**
   * Allows this construct to emit artifacts into the cloud assembly during synthesis.
   *
   * This method is usually implemented by framework-level constructs such as `Stack` and `Asset`
   * as they participate in synthesizing the cloud assembly.
   *
   * @param session The synthesis session.
   */
  protected synthesize(session: ISynthesisSession): void {
    ignore(session);
  }
}

/**
 * In what order to return constructs
 */
export enum ConstructOrder {
  /**
   * Depth-first, pre-order
   */
  PREORDER,

  /**
   * Depth-first, post-order (leaf nodes first)
   */
  POSTORDER
}

/**
 * Options for synthesis.
 *
 * @deprecated use `app.synth()` or `stage.synth()` instead
 */
export interface SynthesisOptions extends cxapi.AssemblyBuildOptions {
  /**
   * The output directory into which to synthesize the cloud assembly.
   * @default - creates a temporary directory
   */
  readonly outdir?: string;

  /**
   * Whether synthesis should skip the validation phase.
   * @default false
   */
  readonly skipValidation?: boolean;
}

/**
 * Represents the construct node in the scope tree.
 */
export class ConstructNode {
  /**
   * Separator used to delimit construct path components.
   */
  public static readonly PATH_SEP = '/';

  /**
   * Returns the wrapping `@aws-cdk/core.ConstructNode` instance from a `constructs.ConstructNode`.
   *
   * @internal
   */
  public static _unwrap(c: constructs.Node): ConstructNode {
    const x = (c as any)[ORIGINAL_CONSTRUCT_NODE_SYMBOL];
    if (!x) {
      throw new Error('invalid ConstructNode type');
    }

    return x;
  }

  /**
   * Synthesizes a CloudAssembly from a construct tree.
   * @param node The root of the construct tree.
   * @param options Synthesis options.
   * @deprecated Use `app.synth()` or `stage.synth()` instead
   */
  public static synth(node: ConstructNode, options: SynthesisOptions = { }): cxapi.CloudAssembly {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const a: typeof import('././private/synthesis') = require('./private/synthesis');
    return a.synthesize(node.root, options);
  }

  /**
   * Invokes "prepare" on all constructs (depth-first, post-order) in the tree under `node`.
   * @param node The root node
   * @deprecated Use `app.synth()` instead
   */
  public static prepare(node: ConstructNode) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const p: typeof import('./private/prepare-app') = require('./private/prepare-app');
    p.prepareApp(node.root); // resolve cross refs and nested stack assets.
    return node._actualNode.prepare();
  }

  /**
   * Invokes "validate" on all constructs in the tree (depth-first, pre-order) and returns
   * the list of all errors. An empty list indicates that there are no errors.
   *
   * @param node The root node
   */
  public static validate(node: ConstructNode): ValidationError[] {
    return node._actualNode.validate().map(e => ({ source: e.source as Construct, message: e.message }));
  }

  /**
   * @internal
   */
  public readonly _actualNode: constructs.Node;

  /**
   * The Construct class that hosts this API.
   */
  private readonly host: Construct;

  constructor(host: Construct, scope: IConstruct, id: string) {
    this.host = host;
    this._actualNode = new constructs.Node(host, scope, id);

    // store a back reference on _actualNode so we can our ConstructNode from it
    Object.defineProperty(this._actualNode, ORIGINAL_CONSTRUCT_NODE_SYMBOL, {
      value: this,
      configurable: false,
      enumerable: false,
    });
  }

  /**
   * Returns the scope in which this construct is defined.
   *
   * The value is `undefined` at the root of the construct scope tree.
   */
  public get scope(): IConstruct | undefined {
    return this._actualNode.scope as IConstruct;
  }

  /**
   * The id of this construct within the current scope.
   *
   * This is a a scope-unique id. To obtain an app-unique id for this construct, use `uniqueId`.
   */
  public get id() { return this._actualNode.id; }

  /**
   * The full, absolute path of this construct in the tree.
   *
   * Components are separated by '/'.
   */
  public get path(): string { return this._actualNode.path; }

  /**
   * A tree-global unique alphanumeric identifier for this construct. Includes
   * all components of the tree.
   *
   * @deprecated use `node.addr` to obtain a consistent 42 character address for
   * this node (see https://github.com/aws/constructs/pull/314)
   */
  public get uniqueId(): string { return this._actualNode.uniqueId; }

  /**
   * Returns an opaque tree-unique address for this construct.
   *
   * Addresses are 42 characters hexadecimal strings. They begin with "c8"
   * followed by 40 lowercase hexadecimal characters (0-9a-f).
   *
   * Addresses are calculated using a SHA-1 of the components of the construct
   * path.
   *
   * To enable refactorings of construct trees, constructs with the ID `Default`
   * will be excluded from the calculation. In those cases constructs in the
   * same tree may have the same addreess.
   *
   * @example c83a2846e506bcc5f10682b564084bca2d275709ee
   */
  public get addr(): string { return this._actualNode.addr; }

  /**
   * Return a direct child by id, or undefined
   *
   * @param id Identifier of direct child
   * @returns the child if found, or undefined
   */
  public tryFindChild(id: string): IConstruct | undefined { return this._actualNode.tryFindChild(id) as IConstruct; }

  /**
   * Return a direct child by id
   *
   * Throws an error if the child is not found.
   *
   * @param id Identifier of direct child
   * @returns Child with the given id.
   */
  public findChild(id: string): IConstruct { return this._actualNode.findChild(id) as IConstruct; }

  /**
   * Returns the child construct that has the id `Default` or `Resource"`.
   * This is usually the construct that provides the bulk of the underlying functionality.
   * Useful for modifications of the underlying construct that are not available at the higher levels.
   *
   * @throws if there is more than one child
   * @returns a construct or undefined if there is no default child
   */
  public get defaultChild(): IConstruct | undefined { return this._actualNode.defaultChild as IConstruct; }

  /**
   * Override the defaultChild property.
   *
   * This should only be used in the cases where the correct
   * default child is not named 'Resource' or 'Default' as it
   * should be.
   *
   * If you set this to undefined, the default behavior of finding
   * the child named 'Resource' or 'Default' will be used.
   */
  public set defaultChild(value: IConstruct | undefined) { this._actualNode.defaultChild = value; }

  /**
   * All direct children of this construct.
   */
  public get children(): IConstruct[] { return this._actualNode.children as IConstruct[]; }

  /**
   * Return this construct and all of its children in the given order
   */
  public findAll(order: ConstructOrder = ConstructOrder.PREORDER): IConstruct[] { return this._actualNode.findAll(order) as IConstruct[]; }

  /**
   * This can be used to set contextual values.
   * Context must be set before any children are added, since children may consult context info during construction.
   * If the key already exists, it will be overridden.
   * @param key The context key
   * @param value The context value
   */
  public setContext(key: string, value: any) {
    if (Token.isUnresolved(key)) {
      throw new Error('Invalid context key: context keys can\'t include tokens');
    }
    this._actualNode.setContext(key, value);
  }

  /**
   * Retrieves a value from tree context.
   *
   * Context is usually initialized at the root, but can be overridden at any point in the tree.
   *
   * @param key The context key
   * @returns The context value or `undefined` if there is no context value for the key.
   */
  public tryGetContext(key: string): any {
    if (Token.isUnresolved(key)) {
      throw new Error('Invalid context key: context keys can\'t include tokens');
    }
    return this._actualNode.tryGetContext(key);
  }

  /**
   * DEPRECATED
   * @deprecated use `metadataEntry`
   */
  public get metadata() { return this._actualNode.metadata as cxapi.MetadataEntry[]; }

  /**
   * An immutable array of metadata objects associated with this construct.
   * This can be used, for example, to implement support for deprecation notices, source mapping, etc.
   */
  public get metadataEntry() { return this._actualNode.metadata; }

  /**
   * Adds a metadata entry to this construct.
   * Entries are arbitrary values and will also include a stack trace to allow tracing back to
   * the code location for when the entry was added. It can be used, for example, to include source
   * mapping in CloudFormation templates to improve diagnostics.
   *
   * @param type a string denoting the type of metadata
   * @param data the value of the metadata (can be a Token). If null/undefined, metadata will not be added.
   * @param fromFunction a function under which to restrict the metadata entry's stack trace (defaults to this.addMetadata)
   */
  public addMetadata(type: string, data: any, fromFunction?: any): void { this._actualNode.addMetadata(type, data, fromFunction); }

  /**
   * DEPRECATED: Adds a { "info": <message> } metadata entry to this construct.
   * The toolkit will display the info message when apps are synthesized.
   * @param message The info message.
   * @deprecated use `Annotations.of(construct).addInfo()`
   */
  public addInfo(message: string): void {
    Annotations.of(this.host).addInfo(message);
  }

  /**
   * DEPRECATED: Adds a { "warning": <message> } metadata entry to this construct.
   * The toolkit will display the warning when an app is synthesized, or fail
   * if run in --strict mode.
   * @param message The warning message.
   * @deprecated use `Annotations.of(construct).addWarning()`
   */
  public addWarning(message: string): void {
    Annotations.of(this.host).addWarning(message);
  }

  /**
   * DEPRECATED: Adds an { "error": <message> } metadata entry to this construct.
   * The toolkit will fail synthesis when errors are reported.
   * @param message The error message.
   * @deprecated use `Annotations.of(construct).addError()`
   */
  public addError(message: string) {
    Annotations.of(this.host).addError(message);
  }

  /**
   * DEPRECATED: Applies the aspect to this Constructs node
   *
   * @deprecated This API is going to be removed in the next major version of
   * the AWS CDK. Please use `Aspects.of(scope).add()` instead.
   */
  public applyAspect(aspect: IAspect): void {
    Annotations.of(this.host).addDeprecation('@aws-cdk/core.ConstructNode.applyAspect', 'Use "Aspects.of(construct).add(aspect)" instead');
    Aspects.of(this.host).add(aspect);
  }

  /**
   * Add a validator to this construct Node
   */
  public addValidation(validation: constructs.IValidation) {
    this._actualNode.addValidation(validation);
  }

  /**
   * All parent scopes of this construct.
   *
   * @returns a list of parent scopes. The last element in the list will always
   * be the current construct and the first element will be the root of the
   * tree.
   */
  public get scopes(): IConstruct[] { return this._actualNode.scopes as IConstruct[]; }

  /**
   * @returns The root of the construct tree.
   */
  public get root(): IConstruct { return this._actualNode.root as IConstruct; }

  /**
   * Returns true if this construct or the scopes in which it is defined are
   * locked.
   */
  public get locked() { return this._actualNode.locked; }

  /**
   * Add an ordering dependency on another Construct.
   *
   * All constructs in the dependency's scope will be deployed before any
   * construct in this construct's scope.
   */
  public addDependency(...dependencies: IDependable[]) { this._actualNode.addDependency(...dependencies); }

  /**
   * Return all dependencies registered on this node or any of its children
   */
  public get dependencies(): Dependency[] { return this._actualNode.dependencies as Dependency[]; }

  /**
   * Remove the child with the given name, if present.
   *
   * @returns Whether a child with the given name was deleted.
   * @experimental
   */
  public tryRemoveChild(childName: string): boolean { return this._actualNode.tryRemoveChild(childName); }
}

/**
 * An error returned during the validation phase.
 */
export interface ValidationError {
  /**
   * The construct which emitted the error.
   */
  readonly source: Construct;

  /**
   * The error message.
   */
  readonly message: string;
}

/**
 * A single dependency
 */
export interface Dependency {
  /**
   * Source the dependency
   */
  readonly source: IConstruct;

  /**
   * Target of the dependency
   */
  readonly target: IConstruct;
}

function ignore(_x: any) {
  return;
}
