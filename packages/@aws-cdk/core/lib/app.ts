import * as cxapi from '@aws-cdk/cx-api';
import { Construct } from 'constructs';
import { addCustomSynthesis, ICustomSynthesis } from './private/synthesis';
import { TreeMetadata } from './private/tree-metadata';
import { Stage } from './stage';

const APP_SYMBOL = Symbol.for('@aws-cdk/core.App');

/**
 * Initialization props for apps.
 */
export interface AppProps {
  /**
   * Automatically call `synth()` before the program exits.
   *
   * If you set this, you don't have to call `synth()` explicitly. Note that
   * this feature is only available for certain programming languages, and
   * calling `synth()` is still recommended.
   *
   * @default true if running via CDK CLI (`CDK_OUTDIR` is set), `false`
   * otherwise
   */
  readonly autoSynth?: boolean;

  /**
   * The output directory into which to emit synthesized artifacts.
   *
   * @default - If this value is _not_ set, considers the environment variable `CDK_OUTDIR`.
   *            If `CDK_OUTDIR` is not defined, uses a temp directory.
   */
  readonly outdir?: string;

  /**
   * Include construct creation stack trace in the `aws:cdk:trace` metadata key of all constructs.
   * @default true stack traces are included unless `aws:cdk:disable-stack-trace` is set in the context.
   */
  readonly stackTraces?: boolean;

  /**
   * Include runtime versioning information in the Stacks of this app
   *
   * @deprecated use `versionReporting` instead
   * @default Value of 'aws:cdk:version-reporting' context key
   */
  readonly runtimeInfo?: boolean;

  /**
   * Include runtime versioning information in the Stacks of this app
   *
   * @default Value of 'aws:cdk:version-reporting' context key
   */
  readonly analyticsReporting?: boolean;

  /**
   * Additional context values for the application.
   *
   * Context set by the CLI or the `context` key in `cdk.json` has precedence.
   *
   * Context can be read from any construct using `node.getContext(key)`.
   *
   * @default - no additional context
   */
  readonly context?: { [key: string]: any };

  /**
   * Include construct tree metadata as part of the Cloud Assembly.
   *
   * @default true
   */
  readonly treeMetadata?: boolean;
}

/**
 * A construct which represents an entire CDK app. This construct is normally
 * the root of the construct tree.
 *
 * You would normally define an `App` instance in your program's entrypoint,
 * then define constructs where the app is used as the parent scope.
 *
 * After all the child constructs are defined within the app, you should call
 * `app.synth()` which will emit a "cloud assembly" from this app into the
 * directory specified by `outdir`. Cloud assemblies includes artifacts such as
 * CloudFormation templates and assets that are needed to deploy this app into
 * the AWS cloud.
 *
 * @see https://docs.aws.amazon.com/cdk/latest/guide/apps.html
 */
export class App extends Stage {
  /**
   * Checks if an object is an instance of the `App` class.
   * @returns `true` if `obj` is an `App`.
   * @param obj The object to evaluate
   */
  public static isApp(obj: any): obj is App {
    return APP_SYMBOL in obj;
  }

  /**
   * Initializes a CDK application.
   * @param props initialization properties
   */
  constructor(props: AppProps = {}) {
    super(undefined as any, '', {
      outdir: props.outdir ?? process.env[cxapi.OUTDIR_ENV],
    });

    Object.defineProperty(this, APP_SYMBOL, { value: true });

    this.loadContext(props.context);

    if (props.stackTraces === false) {
      this.node.setContext(cxapi.DISABLE_METADATA_STACK_TRACE, true);
    }

    const analyticsReporting = props.analyticsReporting ?? props.runtimeInfo;

    if (analyticsReporting !== undefined) {
      this.node.setContext(cxapi.ANALYTICS_REPORTING_ENABLED_CONTEXT, analyticsReporting);
    }

    const autoSynth = props.autoSynth ?? cxapi.OUTDIR_ENV in process.env;
    if (autoSynth) {
      // synth() guarantuees it will only execute once, so a default of 'true'
      // doesn't bite manual calling of the function.
      process.once('beforeExit', () => this.synth());
    }

    if (props.treeMetadata === undefined || props.treeMetadata) {
      new TreeMetadata(this);
    }
  }

  private loadContext(defaults: { [key: string]: string } = { }) {
    // prime with defaults passed through constructor
    for (const [k, v] of Object.entries(defaults)) {
      this.node.setContext(k, v);
    }

    // read from environment
    const contextJson = process.env[cxapi.CONTEXT_ENV];
    const contextFromEnvironment = contextJson
      ? JSON.parse(contextJson)
      : { };

    for (const [k, v] of Object.entries(contextFromEnvironment)) {
      this.node.setContext(k, v);
    }
  }
}

/**
 * Add a custom synthesis for the given construct
 *
 * When the construct is being synthesized, this allows it to add additional items
 * into the Cloud Assembly output.
 *
 * This feature is intended for use by official AWS CDK libraries only; 3rd party
 * library authors and CDK users should not use this function. That's why it's not
 * exposed via jsii.
 */
export function attachCustomSynthesis(construct: Construct, synthesis: ICustomSynthesis): void {
  // synthesis.ts where the implementation lives is not exported. So
  // this function is just a re-export of that function.
  addCustomSynthesis(construct, synthesis);
}
