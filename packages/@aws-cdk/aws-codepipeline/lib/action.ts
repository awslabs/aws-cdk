import * as notifications from '@aws-cdk/aws-codestarnotifications';
import * as events from '@aws-cdk/aws-events';
import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';
import { IResource, Lazy } from '@aws-cdk/core';
import { Artifact } from './artifact';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '@aws-cdk/core';

export enum ActionCategory {
  SOURCE = 'Source',
  BUILD = 'Build',
  TEST = 'Test',
  APPROVAL = 'Approval',
  DEPLOY = 'Deploy',
  INVOKE = 'Invoke'
}

/**
 * Specifies the constraints on the number of input and output
 * artifacts an action can have.
 *
 * The constraints for each action type are documented on the
 * {@link https://docs.aws.amazon.com/codepipeline/latest/userguide/reference-pipeline-structure.html Pipeline Structure Reference} page.
 */
export interface ActionArtifactBounds {
  readonly minInputs: number;
  readonly maxInputs: number;
  readonly minOutputs: number;
  readonly maxOutputs: number;
}

/**
 * The CodePipeline variables that are global,
 * not bound to a specific action.
 * This class defines a bunch of static fields that represent the different variables.
 * These can be used can be used in any action configuration.
 */
export class GlobalVariables {
  /** The identifier of the current pipeline execution. */
  public static readonly executionId = '#{codepipeline.PipelineExecutionId}';
}

export interface ActionProperties {
  readonly actionName: string;
  readonly role?: iam.IRole;

  /**
   * The AWS region the given Action resides in.
   * Note that a cross-region Pipeline requires replication buckets to function correctly.
   * You can provide their names with the {@link PipelineProps#crossRegionReplicationBuckets} property.
   * If you don't, the CodePipeline Construct will create new Stacks in your CDK app containing those buckets,
   * that you will need to `cdk deploy` before deploying the main, Pipeline-containing Stack.
   *
   * @default the Action resides in the same region as the Pipeline
   */
  readonly region?: string;

  /**
   * The account the Action is supposed to live in.
   * For Actions backed by resources,
   * this is inferred from the Stack {@link resource} is part of.
   * However, some Actions, like the CloudFormation ones,
   * are not backed by any resource, and they still might want to be cross-account.
   * In general, a concrete Action class should specify either {@link resource},
   * or {@link account} - but not both.
   */
  readonly account?: string;

  /**
   * The optional resource that is backing this Action.
   * This is used for automatically handling Actions backed by
   * resources from a different account and/or region.
   */
  readonly resource?: IResource;

  /**
   * The category of the action.
   * The category defines which action type the owner
   * (the entity that performs the action) performs.
   */
  readonly category: ActionCategory;

  /**
   * The service provider that the action calls.
   */
  readonly provider: string;
  readonly owner?: string;
  readonly version?: string;

  /**
   * The order in which AWS CodePipeline runs this action.
   * For more information, see the AWS CodePipeline User Guide.
   *
   * https://docs.aws.amazon.com/codepipeline/latest/userguide/reference-pipeline-structure.html#action-requirements
   */
  readonly runOrder?: number;
  readonly artifactBounds: ActionArtifactBounds;
  readonly inputs?: Artifact[];
  readonly outputs?: Artifact[];

  /**
   * The name of the namespace to use for variables emitted by this action.
   *
   * @default - a name will be generated, based on the stage and action names
   */
  readonly variablesNamespace?: string;
}

export interface ActionBindOptions {
  readonly role: iam.IRole;

  readonly bucket: s3.IBucket;
}

export interface ActionConfig {
  readonly configuration?: any;
}

/**
 * Additional options to pass to the notification rule.
 */
export interface PipelineNotifyOnOptions extends notifications.NotificationRuleOptions {
  /**
   * A list of event types associated with this notification rule for CodePipeline Pipeline.
   * For a complete list of event types and IDs, see Notification concepts in the Developer Tools Console User Guide.
   * @see https://docs.aws.amazon.com/dtconsole/latest/userguide/concepts.html#concepts-api
   */
  readonly events: PipelineNotificationEvents[];
}

/**
 * A Pipeline Action.
 * If you want to implement this interface,
 * consider extending the {@link Action} class,
 * which contains some common logic.
 */
export interface IAction {
  /**
   * The simple properties of the Action,
   * like its Owner, name, etc.
   * Note that this accessor will be called before the {@link bind} callback.
   */
  readonly actionProperties: ActionProperties;

  /**
   * The callback invoked when this Action is added to a Pipeline.
   *
   * @param scope the Construct tree scope the Action can use if it needs to create any resources
   * @param stage the {@link IStage} this Action is being added to
   * @param options additional options the Action can use,
   *   like the artifact Bucket of the pipeline it's being added to
   */
  bind(scope: Construct, stage: IStage, options: ActionBindOptions): ActionConfig;

  /**
   * Creates an Event that will be triggered whenever the state of this Action changes.
   *
   * @param name the name to use for the new Event
   * @param target the optional target for the Event
   * @param options additional options that can be used to customize the created Event
   */
  onStateChange(name: string, target?: events.IRuleTarget, options?: events.RuleProps): events.Rule;
}

/**
 * The abstract view of an AWS CodePipeline as required and used by Actions.
 * It extends {@link events.IRuleTarget},
 * so this interface can be used as a Target for CloudWatch Events.
 */
export interface IPipeline extends IResource, notifications.INotificationRuleSource {
  /**
   * The name of the Pipeline.
   *
   * @attribute
   */
  readonly pipelineName: string;

  /**
   * The ARN of the Pipeline.
   *
   * @attribute
   */
  readonly pipelineArn: string;

  /**
   * Define an event rule triggered by this CodePipeline.
   *
   * @param id Identifier for this event handler.
   * @param options Additional options to pass to the event rule.
   */
  onEvent(id: string, options?: events.OnEventOptions): events.Rule;

  /**
   * Define an event rule triggered by the "CodePipeline Pipeline Execution
   * State Change" event emitted from this pipeline.
   *
   * @param id Identifier for this event handler.
   * @param options Additional options to pass to the event rule.
   */
  onStateChange(id: string, options?: events.OnEventOptions): events.Rule;

  /**
   * Defines a CodeStar notification rule triggered when the pipeline
   * events emitted by you specified, it very similar to `onEvent` API.
   *
   * You can also use the methods `notifyOnExecutionStateChange`, `notifyOnAnyStageStateChange`,
   * `notifyOnAnyActionStateChange` and `notifyOnAnyManualApprovalStateChange`
   * to define rules for these specific event emitted.
   *
   * @param id The id of the CodeStar notification rule
   * @param target The target to register for the CodeStar Notifications destination.
   * @param options Customization options for CodeStar notification rule
   * @returns CodeStar notification rule associated with this build project.
   */
  notifyOn(
    id: string,
    target: notifications.INotificationRuleTarget,
    options: PipelineNotifyOnOptions,
  ): notifications.INotificationRule;

  /**
   * Define an notification rule triggered by the set of the "Pipeline execution" events emitted from this pipeline.
   * @see https://docs.aws.amazon.com/dtconsole/latest/userguide/concepts.html#events-ref-pipeline
   *
   * @param id Identifier for this notification handler.
   * @param target The target to register for the CodeStar Notifications destination.
   * @param options Additional options to pass to the notification rule.
   */
  notifyOnExecutionStateChange(
    id: string,
    target: notifications.INotificationRuleTarget,
    options?: notifications.NotificationRuleOptions,
  ): notifications.INotificationRule;

  /**
   * Define an notification rule triggered by the set of the "Stage execution" events emitted from this pipeline.
   * @see https://docs.aws.amazon.com/dtconsole/latest/userguide/concepts.html#events-ref-pipeline
   *
   * @param id Identifier for this notification handler.
   * @param target The target to register for the CodeStar Notifications destination.
   * @param options Additional options to pass to the notification rule.
   */
  notifyOnAnyStageStateChange(
    id: string,
    target: notifications.INotificationRuleTarget,
    options?: notifications.NotificationRuleOptions,
  ): notifications.INotificationRule;

  /**
   * Define an notification rule triggered by the set of the "Action execution" events emitted from this pipeline.
   * @see https://docs.aws.amazon.com/dtconsole/latest/userguide/concepts.html#events-ref-pipeline
   *
   * @param id Identifier for this notification handler.
   * @param target The target to register for the CodeStar Notifications destination.
   * @param options Additional options to pass to the notification rule.
   */
  notifyOnAnyActionStateChange(
    id: string,
    target: notifications.INotificationRuleTarget,
    options?: notifications.NotificationRuleOptions,
  ): notifications.INotificationRule;

  /**
   * Define an notification rule triggered by the set of the "Manual approval" events emitted from this pipeline.
   * @see https://docs.aws.amazon.com/dtconsole/latest/userguide/concepts.html#events-ref-pipeline
   *
   * @param id Identifier for this notification handler.
   * @param target The target to register for the CodeStar Notifications destination.
   * @param options Additional options to pass to the notification rule.
   */
  notifyOnAnyManualApprovalStateChange(
    id: string,
    target: notifications.INotificationRuleTarget,
    options?: notifications.NotificationRuleOptions,
  ): notifications.INotificationRule;
}

/**
 * The abstract interface of a Pipeline Stage that is used by Actions.
 */
export interface IStage {
  /**
   * The physical, human-readable name of this Pipeline Stage.
   */
  readonly stageName: string;

  readonly pipeline: IPipeline;

  /**
   * The actions belonging to this stage.
   */
  readonly actions: IAction[];

  addAction(action: IAction): void;

  onStateChange(name: string, target?: events.IRuleTarget, options?: events.RuleProps): events.Rule;
}

/**
 * Common properties shared by all Actions.
 */
export interface CommonActionProps {
  /**
   * The physical, human-readable name of the Action.
   * Note that Action names must be unique within a single Stage.
   */
  readonly actionName: string;

  /**
   * The runOrder property for this Action.
   * RunOrder determines the relative order in which multiple Actions in the same Stage execute.
   *
   * @default 1
   * @see https://docs.aws.amazon.com/codepipeline/latest/userguide/reference-pipeline-structure.html
   */
  readonly runOrder?: number;

  /**
   * The name of the namespace to use for variables emitted by this action.
   *
   * @default - a name will be generated, based on the stage and action names,
   *   if any of the action's variables were referenced - otherwise,
   *   no namespace will be set
   */
  readonly variablesNamespace?: string;
}

/**
 * Common properties shared by all Actions whose {@link ActionProperties.owner} field is 'AWS'
 * (or unset, as 'AWS' is the default).
 */
export interface CommonAwsActionProps extends CommonActionProps {
  /**
   * The Role in which context's this Action will be executing in.
   * The Pipeline's Role will assume this Role
   * (the required permissions for that will be granted automatically)
   * right before executing this Action.
   * This Action will be passed into your {@link IAction.bind}
   * method in the {@link ActionBindOptions.role} property.
   *
   * @default a new Role will be generated
   */
  readonly role?: iam.IRole;
}

/**
 * Low-level class for generic CodePipeline Actions implementing the {@link IAction} interface.
 * Contains some common logic that can be re-used by all {@link IAction} implementations.
 * If you're writing your own Action class,
 * feel free to extend this class.
 */
export abstract class Action implements IAction {
  /**
   * This is a renamed version of the {@link IAction.actionProperties} property.
   */
  protected abstract readonly providedActionProperties: ActionProperties;

  private __actionProperties?: ActionProperties;
  private __pipeline?: IPipeline;
  private __stage?: IStage;
  private __scope?: Construct;
  private readonly _namespaceToken: string;
  private _customerProvidedNamespace?: string;
  private _actualNamespace?: string;

  private _variableReferenced = false;

  protected constructor() {
    this._namespaceToken = Lazy.string({
      produce: () => {
        // make sure the action was bound (= added to a pipeline)
        if (this._actualNamespace === undefined) {
          throw new Error(`Cannot reference variables of action '${this.actionProperties.actionName}', ` +
            'as that action was never added to a pipeline');
        } else {
          return this._customerProvidedNamespace !== undefined
            // if a customer passed a namespace explicitly, always use that
            ? this._customerProvidedNamespace
            // otherwise, only return a namespace if any variable was referenced
            : (this._variableReferenced ? this._actualNamespace : undefined);
        }
      },
    });
  }

  public get actionProperties(): ActionProperties {
    if (this.__actionProperties === undefined) {
      const actionProperties = this.providedActionProperties;
      this._customerProvidedNamespace = actionProperties.variablesNamespace;
      this.__actionProperties = {
        ...actionProperties,
        variablesNamespace: this._customerProvidedNamespace === undefined
          ? this._namespaceToken
          : this._customerProvidedNamespace,
      };
    }
    return this.__actionProperties;
  }

  public bind(scope: Construct, stage: IStage, options: ActionBindOptions): ActionConfig {
    this.__pipeline = stage.pipeline;
    this.__stage = stage;
    this.__scope = scope;

    this._actualNamespace = this._customerProvidedNamespace === undefined
      // default a namespace name, based on the stage and action names
      ? `${stage.stageName}_${this.actionProperties.actionName}_NS`
      : this._customerProvidedNamespace;

    return this.bound(scope, stage, options);
  }

  public onStateChange(name: string, target?: events.IRuleTarget, options?: events.RuleProps) {
    const rule = new events.Rule(this._scope, name, options);
    rule.addTarget(target);
    rule.addEventPattern({
      detailType: ['CodePipeline Action Execution State Change'],
      source: ['aws.codepipeline'],
      resources: [this._pipeline.pipelineArn],
      detail: {
        stage: [this._stage.stageName],
        action: [this.actionProperties.actionName],
      },
    });
    return rule;
  }

  protected variableExpression(variableName: string): string {
    this._variableReferenced = true;
    return `#{${this._namespaceToken}.${variableName}}`;
  }

  /**
   * This is a renamed version of the {@link IAction.bind} method.
   */
  protected abstract bound(scope: Construct, stage: IStage, options: ActionBindOptions): ActionConfig;

  private get _pipeline(): IPipeline {
    if (this.__pipeline) {
      return this.__pipeline;
    } else {
      throw new Error('Action must be added to a stage that is part of a pipeline before using onStateChange');
    }
  }

  private get _stage(): IStage {
    if (this.__stage) {
      return this.__stage;
    } else {
      throw new Error('Action must be added to a stage that is part of a pipeline before using onStateChange');
    }
  }

  /**
   * Retrieves the Construct scope of this Action.
   * Only available after the Action has been added to a Stage,
   * and that Stage to a Pipeline.
   */
  private get _scope(): Construct {
    if (this.__scope) {
      return this.__scope;
    } else {
      throw new Error('Action must be added to a stage that is part of a pipeline first');
    }
  }
}

/**
 * The list of event types for AWS Codepipeline Pipeline
 * @see https://docs.aws.amazon.com/dtconsole/latest/userguide/concepts.html#events-ref-pipeline
 */
export enum PipelineNotificationEvents {
  /**
   * Trigger notification when pipeline execution failed
   */
  PIPELINE_EXECUTION_FAILED = 'codepipeline-pipeline-pipeline-execution-failed',

  /**
   * Trigger notification when pipeline execution canceled
   */
  PIPELINE_EXECUTION_CANCELED = 'codepipeline-pipeline-pipeline-execution-canceled',

  /**
   * Trigger notification when pipeline execution started
   */
  PIPELINE_EXECUTION_STARTED = 'codepipeline-pipeline-pipeline-execution-started',

  /**
   * Trigger notification when pipeline execution resumed
   */
  PIPELINE_EXECUTION_RESUMED = 'codepipeline-pipeline-pipeline-execution-resumed',

  /**
   * Trigger notification when pipeline execution succeeded
   */
  PIPELINE_EXECUTION_SUCCEEDED = 'codepipeline-pipeline-pipeline-execution-succeeded',

  /**
   * Trigger notification when pipeline execution superseded
   */
  PIPELINE_EXECUTION_SUPERSEDED = 'codepipeline-pipeline-pipeline-execution-superseded',

  /**
   * Trigger notification when pipeline stage execution started
   */
  STAGE_EXECUTION_STARTED = 'codepipeline-pipeline-stage-execution-started',

  /**
  * Trigger notification when pipeline stage execution succeeded
  */
  STAGE_EXECUTION_SUCCEEDED = 'codepipeline-pipeline-stage-execution-succeeded',

  /**
  * Trigger notification when pipeline stage execution resumed
  */
  STAGE_EXECUTION_RESUMED = 'codepipeline-pipeline-stage-execution-resumed',

  /**
  * Trigger notification when pipeline stage execution canceled
  */
  STAGE_EXECUTION_CANCELED = 'codepipeline-pipeline-stage-execution-canceled',

  /**
  * Trigger notification when pipeline stage execution failed
  */
  STAGE_EXECUTION_FAILED = 'codepipeline-pipeline-stage-execution-failed',

  /**
   * Trigger notification when pipeline action execution succeeded
   */
  ACTION_EXECUTION_SUCCEEDED = 'codepipeline-pipeline-action-execution-succeeded',

  /**
   * Trigger notification when pipeline action execution failed
   */
  ACTION_EXECUTION_FAILED = 'codepipeline-pipeline-action-execution-failed',

  /**
   * Trigger notification when pipeline action execution canceled
   */
  ACTION_EXECUTION_CANCELED = 'codepipeline-pipeline-action-execution-canceled',

  /**
   * Trigger notification when pipeline action execution started
   */
  ACTION_EXECUTION_STARTED = 'codepipeline-pipeline-action-execution-started',

  /**
   * Trigger notification when pipeline manual approval failed
   */
  MANUAL_APPROVAL_FAILED = 'codepipeline-pipeline-manual-approval-failed',

  /**
   * Trigger notification when pipeline manual approval needed
   */
  MANUAL_APPROVAL_NEEDED = 'codepipeline-pipeline-manual-approval-needed',

  /**
   * Trigger notification when pipeline manual approval succeeded
   */
  MANUAL_APPROVAL_SUCCEEDED = 'codepipeline-pipeline-manual-approval-succeeded',
}
