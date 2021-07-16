import * as cloudformation from '@aws-cdk/aws-cloudformation';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import { Action } from '../action';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct } from '@aws-cdk/core';

/**
 * Properties common to all CloudFormation actions
 */
interface CloudFormationActionProps extends codepipeline.CommonAwsActionProps {
  /**
   * The name of the stack to apply this action to
   */
  readonly stackName: string;

  /**
   * A name for the filename in the output artifact to store the AWS CloudFormation call's result.
   *
   * The file will contain the result of the call to AWS CloudFormation (for example
   * the call to UpdateStack or CreateChangeSet).
   *
   * AWS CodePipeline adds the file to the output artifact after performing
   * the specified action.
   *
   * @default No output artifact generated
   */
  readonly outputFileName?: string;

  /**
   * The name of the output artifact to generate
   *
   * Only applied if `outputFileName` is set as well.
   *
   * @default Automatically generated artifact name.
   */
  readonly output?: codepipeline.Artifact;

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
   * The AWS account this Action is supposed to operate in.
   * **Note**: if you specify the `role` property,
   * this is ignored - the action will operate in the same region the passed role does.
   *
   * @default - action resides in the same account as the pipeline
   */
  readonly account?: string;
}

/**
 * Base class for Actions that execute CloudFormation
 */
abstract class CloudFormationAction extends Action {
  private readonly props: CloudFormationActionProps;

  constructor(props: CloudFormationActionProps, inputs: codepipeline.Artifact[] | undefined) {
    super({
      ...props,
      provider: 'CloudFormation',
      category: codepipeline.ActionCategory.DEPLOY,
      artifactBounds: {
        minInputs: 0,
        maxInputs: 10,
        minOutputs: 0,
        maxOutputs: 1,
      },
      inputs,
      outputs: props.outputFileName
        ? [props.output || new codepipeline.Artifact(`${props.actionName}_${props.stackName}_Artifact`)]
        : undefined,
    });

    this.props = props;
  }

  protected bound(_scope: Construct, _stage: codepipeline.IStage, options: codepipeline.ActionBindOptions):
  codepipeline.ActionConfig {
    const singletonPolicy = SingletonPolicy.forRole(options.role);

    if ((this.actionProperties.outputs || []).length > 0) {
      options.bucket.grantReadWrite(singletonPolicy);
    } else if ((this.actionProperties.inputs || []).length > 0) {
      options.bucket.grantRead(singletonPolicy);
    }

    return {
      configuration: {
        StackName: this.props.stackName,
        OutputFileName: this.props.outputFileName,
      },
    };
  }
}

/**
 * Properties for the CloudFormationExecuteChangeSetAction.
 */
export interface CloudFormationExecuteChangeSetActionProps extends CloudFormationActionProps {
  /**
   * Name of the change set to execute.
   */
  readonly changeSetName: string;
}

/**
 * CodePipeline action to execute a prepared change set.
 */
export class CloudFormationExecuteChangeSetAction extends CloudFormationAction {
  private readonly props2: CloudFormationExecuteChangeSetActionProps;

  constructor(props: CloudFormationExecuteChangeSetActionProps) {
    super(props, undefined);

    this.props2 = props;
  }

  protected bound(scope: Construct, stage: codepipeline.IStage, options: codepipeline.ActionBindOptions):
  codepipeline.ActionConfig {
    SingletonPolicy.forRole(options.role).grantExecuteChangeSet(this.props2);

    const actionConfig = super.bound(scope, stage, options);
    return {
      ...actionConfig,
      configuration: {
        ...actionConfig.configuration,
        ActionMode: 'CHANGE_SET_EXECUTE',
        ChangeSetName: this.props2.changeSetName,
      },
    };
  }
}

/**
 * Properties common to CloudFormation actions that stage deployments
 */
interface CloudFormationDeployActionProps extends CloudFormationActionProps {
  /**
   * IAM role to assume when deploying changes.
   *
   * If not specified, a fresh role is created. The role is created with zero
   * permissions unless `adminPermissions` is true, in which case the role will have
   * full permissions.
   *
   * @default A fresh role with full or no permissions (depending on the value of `adminPermissions`).
   */
  readonly deploymentRole?: iam.IRole;

  /**
   * Acknowledge certain changes made as part of deployment
   *
   * For stacks that contain certain resources, explicit acknowledgement that AWS CloudFormation
   * might create or update those resources. For example, you must specify `AnonymousIAM` or `NamedIAM`
   * if your stack template contains AWS Identity and Access Management (IAM) resources. For more
   * information see the link below.
   *
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-iam-template.html#using-iam-capabilities
   * @default None, unless `adminPermissions` is true
   * @deprecated use {@link cfnCapabilities} instead
   */
  readonly capabilities?: cloudformation.CloudFormationCapabilities[];

  /**
   * Acknowledge certain changes made as part of deployment.
   *
   * For stacks that contain certain resources,
   * explicit acknowledgement is required that AWS CloudFormation might create or update those resources.
   * For example, you must specify `ANONYMOUS_IAM` or `NAMED_IAM` if your stack template contains AWS
   * Identity and Access Management (IAM) resources.
   * For more information, see the link below.
   *
   * @default None, unless `adminPermissions` is true
   *
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-iam-template.html#using-iam-capabilities
   */
  readonly cfnCapabilities?: cdk.CfnCapabilities[];

  /**
   * Whether to grant full permissions to CloudFormation while deploying this template.
   *
   * Setting this to `true` affects the defaults for `role` and `capabilities`, if you
   * don't specify any alternatives.
   *
   * The default role that will be created for you will have full (i.e., `*`)
   * permissions on all resources, and the deployment will have named IAM
   * capabilities (i.e., able to create all IAM resources).
   *
   * This is a shorthand that you can use if you fully trust the templates that
   * are deployed in this pipeline. If you want more fine-grained permissions,
   * use `addToRolePolicy` and `capabilities` to control what the CloudFormation
   * deployment is allowed to do.
   */
  readonly adminPermissions: boolean;

  /**
   * Input artifact to use for template parameters values and stack policy.
   *
   * The template configuration file should contain a JSON object that should look like this:
   * `{ "Parameters": {...}, "Tags": {...}, "StackPolicy": {... }}`. For more information,
   * see [AWS CloudFormation Artifacts](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/continuous-delivery-codepipeline-cfn-artifacts.html).
   *
   * Note that if you include sensitive information, such as passwords, restrict access to this
   * file.
   *
   * @default No template configuration based on input artifacts
   */
  readonly templateConfiguration?: codepipeline.ArtifactPath;

  /**
   * Additional template parameters.
   *
   * Template parameters specified here take precedence over template parameters
   * found in the artifact specified by the `templateConfiguration` property.
   *
   * We recommend that you use the template configuration file to specify
   * most of your parameter values. Use parameter overrides to specify only
   * dynamic parameter values (values that are unknown until you run the
   * pipeline).
   *
   * All parameter names must be present in the stack template.
   *
   * Note: the entire object cannot be more than 1kB.
   *
   * @default No overrides
   */
  readonly parameterOverrides?: { [name: string]: any };

  /**
   * The list of additional input Artifacts for this Action.
   * This is especially useful when used in conjunction with the `parameterOverrides` property.
   * For example, if you have:
   *
   *   parameterOverrides: {
   *     'Param1': action1.outputArtifact.bucketName,
   *     'Param2': action2.outputArtifact.objectKey,
   *   }
   *
   * , if the output Artifacts of `action1` and `action2` were not used to
   * set either the `templateConfiguration` or the `templatePath` properties,
   * you need to make sure to include them in the `extraInputs` -
   * otherwise, you'll get an "unrecognized Artifact" error during your Pipeline's execution.
   */
  readonly extraInputs?: codepipeline.Artifact[];
}

/**
 * Base class for all CloudFormation actions that execute or stage deployments.
 */
abstract class CloudFormationDeployAction extends CloudFormationAction {
  private _deploymentRole?: iam.IRole;
  private readonly props2: CloudFormationDeployActionProps;

  constructor(props: CloudFormationDeployActionProps, inputs: codepipeline.Artifact[] | undefined) {
    super(props, (props.extraInputs || []).concat(inputs || []));

    this.props2 = props;
  }

  /**
   * Add statement to the service role assumed by CloudFormation while executing this action.
   */
  public addToDeploymentRolePolicy(statement: iam.PolicyStatement) {
    return this.getDeploymentRole('method addToRolePolicy()').addToPolicy(statement);
  }

  public get deploymentRole(): iam.IRole {
    return this.getDeploymentRole('property role()');
  }

  protected bound(scope: Construct, stage: codepipeline.IStage, options: codepipeline.ActionBindOptions):
  codepipeline.ActionConfig {
    if (this.props2.deploymentRole) {
      this._deploymentRole = this.props2.deploymentRole;
    } else {
      const roleStack = cdk.Stack.of(options.role);
      const pipelineStack = cdk.Stack.of(scope);
      if (roleStack.account !== pipelineStack.account) {
        // pass role is not allowed for cross-account access - so,
        // create the deployment Role in the other account!
        this._deploymentRole = new iam.Role(roleStack,
          `${cdk.Names.nodeUniqueId(stage.pipeline.node)}-${stage.stageName}-${this.actionProperties.actionName}-DeploymentRole`, {
            assumedBy: new iam.ServicePrincipal('cloudformation.amazonaws.com'),
            roleName: cdk.PhysicalName.GENERATE_IF_NEEDED,
          });
      } else {
        this._deploymentRole = new iam.Role(scope, 'Role', {
          assumedBy: new iam.ServicePrincipal('cloudformation.amazonaws.com'),
        });
      }

      // the deployment role might need read access to the pipeline's bucket
      // (for example, if it's deploying a Lambda function),
      // and even if it has admin permissions, it won't be enough,
      // as it needs to be added to the key's resource policy
      // (and the bucket's, if the access is cross-account)
      options.bucket.grantRead(this._deploymentRole);

      if (this.props2.adminPermissions) {
        this._deploymentRole.addToPolicy(new iam.PolicyStatement({
          actions: ['*'],
          resources: ['*'],
        }));
      }
    }

    SingletonPolicy.forRole(options.role).grantPassRole(this._deploymentRole);

    const providedCapabilities = this.props2.cfnCapabilities ??
      this.props2.capabilities?.map(c => {
        switch (c) {
          case cloudformation.CloudFormationCapabilities.NONE: return cdk.CfnCapabilities.NONE;
          case cloudformation.CloudFormationCapabilities.ANONYMOUS_IAM: return cdk.CfnCapabilities.ANONYMOUS_IAM;
          case cloudformation.CloudFormationCapabilities.NAMED_IAM: return cdk.CfnCapabilities.NAMED_IAM;
          case cloudformation.CloudFormationCapabilities.AUTO_EXPAND: return cdk.CfnCapabilities.AUTO_EXPAND;
        }
      });
    const capabilities = this.props2.adminPermissions && providedCapabilities === undefined
      ? [cdk.CfnCapabilities.NAMED_IAM]
      : providedCapabilities;

    const actionConfig = super.bound(scope, stage, options);
    return {
      ...actionConfig,
      configuration: {
        ...actionConfig.configuration,
        // None evaluates to empty string which is falsey and results in undefined
        Capabilities: parseCapabilities(capabilities),
        RoleArn: this.deploymentRole.roleArn,
        ParameterOverrides: cdk.Stack.of(scope).toJsonString(this.props2.parameterOverrides),
        TemplateConfiguration: this.props2.templateConfiguration
          ? this.props2.templateConfiguration.location
          : undefined,
        StackName: this.props2.stackName,
      },
    };
  }

  private getDeploymentRole(member: string): iam.IRole {
    if (this._deploymentRole) {
      return this._deploymentRole;
    } else {
      throw new Error(`Cannot use the ${member} before the Action has been added to a Pipeline`);
    }
  }
}

/**
 * Properties for the CloudFormationCreateReplaceChangeSetAction.
 */
export interface CloudFormationCreateReplaceChangeSetActionProps extends CloudFormationDeployActionProps {
  /**
   * Name of the change set to create or update.
   */
  readonly changeSetName: string;

  /**
   * Input artifact with the ChangeSet's CloudFormation template
   */
  readonly templatePath: codepipeline.ArtifactPath;
}

/**
 * CodePipeline action to prepare a change set.
 *
 * Creates the change set if it doesn't exist based on the stack name and template that you submit.
 * If the change set exists, AWS CloudFormation deletes it, and then creates a new one.
 */
export class CloudFormationCreateReplaceChangeSetAction extends CloudFormationDeployAction {
  private readonly props3: CloudFormationCreateReplaceChangeSetActionProps;

  constructor(props: CloudFormationCreateReplaceChangeSetActionProps) {
    super(props, props.templateConfiguration
      ? [props.templatePath.artifact, props.templateConfiguration.artifact]
      : [props.templatePath.artifact]);

    this.props3 = props;
  }

  protected bound(scope: Construct, stage: codepipeline.IStage, options: codepipeline.ActionBindOptions):
  codepipeline.ActionConfig {
    // the super call order is to preserve the existing order of statements in policies
    const actionConfig = super.bound(scope, stage, options);

    SingletonPolicy.forRole(options.role).grantCreateReplaceChangeSet(this.props3);

    return {
      ...actionConfig,
      configuration: {
        ...actionConfig.configuration,
        ActionMode: 'CHANGE_SET_REPLACE',
        ChangeSetName: this.props3.changeSetName,
        TemplatePath: this.props3.templatePath.location,
      },
    };
  }
}

/**
 * Properties for the CloudFormationCreateUpdateStackAction.
 */
export interface CloudFormationCreateUpdateStackActionProps extends CloudFormationDeployActionProps {
  /**
   * Input artifact with the CloudFormation template to deploy
   */
  readonly templatePath: codepipeline.ArtifactPath;

  /**
   * Replace the stack if it's in a failed state.
   *
   * If this is set to true and the stack is in a failed state (one of
   * ROLLBACK_COMPLETE, ROLLBACK_FAILED, CREATE_FAILED, DELETE_FAILED, or
   * UPDATE_ROLLBACK_FAILED), AWS CloudFormation deletes the stack and then
   * creates a new stack.
   *
   * If this is not set to true and the stack is in a failed state,
   * the deployment fails.
   *
   * @default false
   */
  readonly replaceOnFailure?: boolean;
}

/**
 * CodePipeline action to deploy a stack.
 *
 * Creates the stack if the specified stack doesn't exist. If the stack exists,
 * AWS CloudFormation updates the stack. Use this action to update existing
 * stacks.
 *
 * AWS CodePipeline won't replace the stack, and will fail deployment if the
 * stack is in a failed state. Use `ReplaceOnFailure` for an action that
 * will delete and recreate the stack to try and recover from failed states.
 *
 * Use this action to automatically replace failed stacks without recovering or
 * troubleshooting them. You would typically choose this mode for testing.
 */
export class CloudFormationCreateUpdateStackAction extends CloudFormationDeployAction {
  private readonly props3: CloudFormationCreateUpdateStackActionProps;

  constructor(props: CloudFormationCreateUpdateStackActionProps) {
    super(props, props.templateConfiguration
      ? [props.templatePath.artifact, props.templateConfiguration.artifact]
      : [props.templatePath.artifact]);

    this.props3 = props;
  }

  protected bound(scope: Construct, stage: codepipeline.IStage, options: codepipeline.ActionBindOptions):
  codepipeline.ActionConfig {
    // the super call order is to preserve the existing order of statements in policies
    const actionConfig = super.bound(scope, stage, options);

    SingletonPolicy.forRole(options.role).grantCreateUpdateStack(this.props3);

    return {
      ...actionConfig,
      configuration: {
        ...actionConfig.configuration,
        ActionMode: this.props3.replaceOnFailure ? 'REPLACE_ON_FAILURE' : 'CREATE_UPDATE',
        TemplatePath: this.props3.templatePath.location,
      },
    };
  }
}

/**
 * Properties for the CloudFormationDeleteStackAction.
 */
export interface CloudFormationDeleteStackActionProps extends CloudFormationDeployActionProps {
}

/**
 * CodePipeline action to delete a stack.
 *
 * Deletes a stack. If you specify a stack that doesn't exist, the action completes successfully
 * without deleting a stack.
 */
export class CloudFormationDeleteStackAction extends CloudFormationDeployAction {
  private readonly props3: CloudFormationDeleteStackActionProps;

  constructor(props: CloudFormationDeleteStackActionProps) {
    super(props, undefined);

    this.props3 = props;
  }

  protected bound(scope: Construct, stage: codepipeline.IStage, options: codepipeline.ActionBindOptions):
  codepipeline.ActionConfig {
    // the super call order is to preserve the existing order of statements in policies
    const actionConfig = super.bound(scope, stage, options);

    SingletonPolicy.forRole(options.role).grantDeleteStack(this.props3);

    return {
      ...actionConfig,
      configuration: {
        ...actionConfig.configuration,
        ActionMode: 'DELETE_ONLY',
      },
    };
  }
}

/**
 * Determines how IAM roles are created and managed.
 */
export enum StackSetPermissionModel {
  /**
   * You must create administrator and execution roles to deploy to target accounts.
   */
  SELF_MANAGED = 'SELF_MANAGED',

  /**
   * AWS CloudFormation StackSets automatically creates the IAM roles required to deploy to accounts managed by AWS Organizations.
   * This requires an account to be a member of an Organization.
   */
  SERVICE_MANAGED = 'SERVICE_MANAGED'
}

/**
 * Describes whether AWS CloudFormation StackSets automatically deploys to AWS Organizations accounts that are added to a target organization or
 * organizational unit (OU).
 */
export enum StackSetOrganizationsAutoDeployment {
  /**
   * StackSets automatically deploys additional stack instances to AWS Organizations accounts that are added to a target organization or
   * organizational unit (OU) in the specified Regions. If an account is removed from a target organization or OU, AWS CloudFormation StackSets
   * deletes stack instances from the account in the specified Regions.
   */
  ENABLED = 'Enabled',

  /**
   * StackSets does not automatically deploy additional stack instances to AWS Organizations accounts that are added to a target organization or
   * organizational unit (OU) in the specified Regions.
   */
  DISABLED = 'Disabled',

  /**
   * Stack resources are retained when an account is removed from a target organization or OU.
   */
  ENABLED_WITH_STACK_RETENTION = 'EnabledWithStackRetention'
}

/**
 * Literal StackSet parameter type. null/undefined will translate to UsePreviousValue. Other values will be used as-is.
 */
export interface StackSetLiteralParameters {
  [parameterName: string]: string | null | undefined
}

/**
 * StackSet parameters container.
 */
export class StackSetParameters {
  /**
   * A list of template parameters for your stack set that update during a deployment.
   * You can provide parameters as a dictionary:
   *
   * The following example shows a parameter named BucketName with the value my-bucket.
   *
   * {
   *     BucketName: "my-bucket"
   * }
   *
   * The following example shows an entry with multiple parameters:
   *
   * {
   *     BucketName: "my-bucket",
   *     Asset1: "true",
   *     Asset2: "true"
   * }
   *
   */
  public static fromLiteral(parameters: StackSetLiteralParameters): StackSetParameters {
    return new StackSetParameters(parameters);
  }

  /**
   * Parameters from a CodePipeline artifact path.
   *
   * The following example shows the file contents for parameters.txt `sourceArtifact.atPath("parameters.txt")`, where sourceArtifact is a
   * CodePipeline Artifact.
   *
   * [
   *     {
   *         "ParameterKey": "KeyName",
   *         "ParameterValue": "true"
   *     },
   *     {
   *         "ParameterKey": "KeyName",
   *         "ParameterValue": "true"
   *     }
   * ]
   *
   * @default No parameters will be used (unless parameters is used)
   */
  public static fromArtifactPath(artifactPath: codepipeline.ArtifactPath): StackSetParameters {
    return new StackSetParameters(undefined, artifactPath);
  }

  private constructor(
    private readonly parameters?: StackSetLiteralParameters,
    private readonly artifactPath?: codepipeline.ArtifactPath,
  ) {
  }

  /**
   * An array of artifacts associated with these parameters.
   */
  public get artifacts(): codepipeline.Artifact[] {
    if (this.artifactPath !== undefined) {
      return [this.artifactPath.artifact];
    }

    return [];
  }

  /**
   * Converts Parameters to a string.
   */
  public toString(): string {
    if (this.artifactPath !== undefined) {
      return this.artifactPath.location;
    }

    const parameters = this.parameters || {};
    return Object.keys(parameters).map((key) => {
      const value = parameters[ key ];

      let ret = 'ParameterKey=' + key;
      if (value !== undefined && value !== null) {
        ret += ',ParameterValue=' + value;
      } else {
        ret += ',UsePreviousValue=true';
      }

      return ret;
    }).join(' ');
  }
}
/**
 * Properties for the CloudFormationStackSetAction
 */
export interface CloudFormationStackSetActionProps extends codepipeline.CommonAwsActionProps {
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
   * The name to associate with the stack set. This name must be unique in the Region where it is created.
   *
   * The name may only contain alphanumeric and hyphen characters. It must begin with an alphabetic character and be 128 characters or fewer.
   */
  readonly stackSetName: string;

  /**
   * A description of the stack set. You can use this to describe the stack set’s purpose or other relevant information.
   *
   * @default No description
   */
  readonly description?: string;

  /**
   * The location of the template that defines the resources in the stack set.
   * This must point to a template with a maximum size of 460,800 bytes.
   *
   * Enter the path to the source artifact name and template file.
   */
  readonly templatePath: codepipeline.ArtifactPath;

  /**
   * The template parameters for your stack set that update during a deployment.
   *
   * @default No parameters will be used.
   */
  readonly parameters?: StackSetParameters;

  /**
   * Indicates that the template can create and update resources, depending on the types of resources in the template.
   *
   * You must use this property if you have IAM resources in your stack template or you create a stack directly from a template containing macros.
   *
   * @default The StackSet will have no IAM capabilities.
   */
  readonly cfnCapabilities?: cdk.CfnCapabilities[];

  /**
   * Determines how IAM roles are created and managed.
   * If the field is not specified, the default is used. For information, see Permissions models for stack set operations.
   *
   * Note
   * This parameter can only be changed when no stack instances exist in the stack set.
   *
   * @default SELF_MANAGED
   */
  readonly permissionModel?: StackSetPermissionModel;

  /**
   * Note
   * Because AWS CloudFormation StackSets performs operations across multiple accounts, you must define the necessary permissions in those accounts
   * before you can create the stack set.
   *
   * Note
   * This parameter is optional for the SELF_MANAGED permissions model and is not used for the SERVICE_MANAGED permissions model.
   *
   * The IAM role in the administrator account used to perform stack set operations.
   *
   * If you do not specify the role, it is set to AWSCloudFormationStackSetAdministrationRole.
   * If you specify ServiceManaged, you must not define a role name.
   *
   * @default AWSCloudFormationStackSetAdministrationRole
   */
  readonly administrationRole?: iam.IRole;

  /**
   * Note
   * Because AWS CloudFormation StackSets performs operations across multiple accounts, you must define the necessary permissions in those accounts
   * before you can create the stack set.
   *
   * Note
   * This parameter is optional for the SELF_MANAGED permissions model and is not used for the SERVICE_MANAGED permissions model.
   *
   * The name of the IAM role in the target accounts used to perform stack set operations. The name may contain alphanumeric characters, any of the
   * following characters: _+=,.@-, and no spaces. The name is not case sensitive. This role name must be a minimum length of 1 character and maximum
   * length of 64 characters. Role names must be unique within the account. The role name specified here must be an existing role name. Do not specify
   * this role if you are using customized execution roles. If you do not specify the role name, it is set to AWSCloudFormationStackSetExecutionRole.
   * If you set Service_Managed to true, you must not define a role name.
   *
   * @default AWSCloudFormationStackSetExecutionRole
   */
  readonly executionRoleName?: string;

  /**
   * Note
   * This parameter is optional for the SERVICE_MANAGED permissions model and is not used for the SELF_MANAGED permissions model.
   *
   * Describes whether AWS CloudFormation StackSets automatically deploys to AWS Organizations accounts that are added to a target organization or
   * organizational unit (OU). If OrganizationsAutoDeployment is specified, do not specify DeploymentTargets and Regions.
   *
   * Note
   * If no input is provided for OrganizationsAutoDeployment, then the default value is Disabled.
   *
   * @default Disabled
   */
  readonly organizationsAutoDeployment?: StackSetOrganizationsAutoDeployment;

  /**
   * Note
   * For the SERVICE_MANAGED permissions model, you can provide either accounts or organizational Unit IDs for deployment targets. For the
   * SELF_MANAGED permissions model, you can only provide accounts.
   *
   * Note
   * When this parameter is selected, you must also select Regions.
   *
   * A list of AWS accounts or organizational unit IDs where stack set instances should be created/updated.
   *
   * Accounts:
   *
   * Example:
   *
   * 111111222222,333333444444
   *
   *
   * OrganizationalUnitIds:
   *
   * Note
   * This parameter is optional for the SERVICE_MANAGED permissions model and is not used for the SELF_MANAGED permissions model. Do not use this if
   * you select OrganizationsAutoDeployment.
   *
   * The AWS organizational units in which to update associated stack instances.
   *
   * Example:
   *
   * ou-examplerootid111-exampleouid111,ou-examplerootid222-exampleouid222
   *
   * One of deploymentTargets or deploymentTargetsPath is required, but not both.
   *
   * @default No deployment target. This or deploymentTargetsPath is required.
   */
  readonly deploymentTargets?: string[];

  /**
   * Note
   * For the SERVICE_MANAGED permissions model, you can provide either accounts or organizational Unit IDs for deployment targets. For the
   * SELF_MANAGED permissions model, you can only provide accounts.
   *
   * Note
   * When this parameter is selected, you must also select Regions.
   *
   * A list of AWS accounts or organizational unit IDs where stack set instances should be created/updated.
   *
   * Accounts:
   *
   * The following example shows the file contents for accounts.txt `sourceArtifact.atPath("accounts.txt")`, where sourceArtifact is a
   * CodePipeline Artifact.
   *
   * [
   *     "111111222222"
   * ]
   *
   *
   *
   * OrganizationalUnitIds:
   *
   * Note
   * This parameter is optional for the SERVICE_MANAGED permissions model and is not used for the SELF_MANAGED permissions model. Do not use this if
   * you select OrganizationsAutoDeployment.
   *
   * The AWS organizational units in which to update associated stack instances.
   * You can provide organizational unit IDs as an Array, a literal list or a file path:
   *
   * The following example shows the file contents for accounts.txt `sourceArtifact.atPath("OU-IDs.txt")`, where sourceArtifact is a
   * CodePipeline Artifact.
   *
   * [
   *     "ou-examplerootid111-exampleouid111",
   *     "ou-examplerootid222-exampleouid222"
   * ]
   *
   * One of deploymentTargets or deploymentTargetsPath is required, but not both.
   *
   * @default No deployment target. This or deploymentTargets is required.
   */
  readonly deploymentTargetsPath?: codepipeline.ArtifactPath;

  /**
   * Note
   * When this parameter is selected, you must also select DeploymentTargets.
   *
   * A list of AWS Regions where stack set instances are created or updated. Regions are updated in the order in which they are entered.
   *
   * Enter a list of valid AWS Regions in the format Region1,Region2, as shown in the following example.
   *
   * [ "us-west-2", "us-east-1" ]
   */
  readonly regions: string[];

  /**
   * The percentage of accounts per Region for which this stack operation can fail before AWS CloudFormation stops the operation in that Region. If
   * the operation is stopped in a Region, AWS CloudFormation doesn't attempt the operation in subsequent Regions. When calculating the number
   * of accounts based on the specified percentage, AWS CloudFormation rounds down to the next whole number.
   *
   * @default 0
   */
  readonly failureTolerancePercentage?: number;

  /**
   * The maximum percentage of accounts in which to perform this operation at one time. When calculating the number of accounts based on the specified
   * percentage, AWS CloudFormation rounds down to the next whole number. If rounding down would result in zero, AWS CloudFormation sets the number as
   * one instead. Although you use this setting to specify the maximum, for large deployments the actual number of accounts acted upon concurrently
   * may be lower due to service throttling.
   *
   * @default 1
   */
  readonly maxConcurrentPercentage?: number;
}

/**
 * CodePipeline action to deploy a stackset.
 *
 * CodePipeline offers the ability to perform AWS CloudFormation StackSets operations as part of your CI/CD process. You use a stack set to create
 * stacks in AWS accounts across AWS Regions by using a single AWS CloudFormation template. All the resources included in each stack are defined by
 * the stack set’s AWS CloudFormation template. When you create the stack set, you specify the template to use, as well as any parameters and
 * capabilities that the template requires.
 *
 * For more information about concepts for AWS CloudFormation StackSets, see StackSets concepts in the AWS CloudFormation User Guide.
 */
export class CloudFormationStackSetAction extends Action {
  private static getArtifacts(props: CloudFormationStackSetActionProps) {
    const artifacts: codepipeline.Artifact[] = [props.templatePath.artifact];

    if (props.parameters !== undefined) {
      artifacts.push(...props.parameters.artifacts);
    }
    if (props.deploymentTargetsPath !== undefined) {
      artifacts.push(props.deploymentTargetsPath.artifact);
    }

    return artifacts;
  }

  private readonly props: CloudFormationStackSetActionProps;

  constructor(props: CloudFormationStackSetActionProps) {
    super({
      ...props,
      provider: 'CloudFormationStackSet',
      category: codepipeline.ActionCategory.DEPLOY,
      artifactBounds: {
        minInputs: 1,
        maxInputs: 3,
        minOutputs: 0,
        maxOutputs: 0,
      },
      inputs: CloudFormationStackSetAction.getArtifacts(props),
    });

    this.props = props;
  }

  protected bound(scope: Construct, _stage: codepipeline.IStage, options: codepipeline.ActionBindOptions): codepipeline.ActionConfig {
    const singletonPolicy = SingletonPolicy.forRole(options.role);
    singletonPolicy.grantCreateUpdateStackSet(this.props);

    if (this.props.administrationRole !== undefined) {
      singletonPolicy.grantPassRole(this.props.administrationRole);
    } else if (this.props.permissionModel !== StackSetPermissionModel.SERVICE_MANAGED) {
      singletonPolicy.grantPassRole(cdk.Stack.of(scope).formatArn({
        region: '',
        service: 'iam',
        resource: 'role',
        resourceName: 'AWSCloudFormationStackSetAdministrationRole',
      }));
    }

    if ((this.actionProperties.inputs || []).length > 0) {
      options.bucket.grantRead(singletonPolicy);
    }

    const templatePath = this.props.templatePath.location;

    const parameters = this.props.parameters;

    const regions = this.props.regions.join(',');

    const deploymentTargets = this.deploymentTargets;

    const adminRoleArn = this.props.administrationRole !== undefined ? this.props.administrationRole.roleArn : undefined;

    return {
      configuration: {
        StackSetName: this.props.stackSetName,
        Description: this.props.description,
        TemplatePath: templatePath,
        Parameters: parameters !== undefined ? parameters.toString() : undefined,
        Capabilities: parseCapabilities(this.props.cfnCapabilities),
        PermissionModel: this.props.permissionModel,
        AdministrationRoleArn: adminRoleArn,
        ExecutionRoleName: this.props.executionRoleName,
        OrganizationsAutoDeployment: this.props.organizationsAutoDeployment,
        DeploymentTargets: deploymentTargets,
        FailureTolerancePercentage: this.props.failureTolerancePercentage,
        MaxConcurrentPercentage: this.props.maxConcurrentPercentage,
        Regions: regions,
      },
    };
  }

  private get deploymentTargets(): string {
    const deploymentTargets = this.props.deploymentTargets;
    const deploymentTargetsPath = this.props.deploymentTargetsPath;

    if (deploymentTargets === undefined && deploymentTargetsPath === undefined) {
      throw new Error('One of deploymentTargets xor deploymentTargetsPath is required.');
    }

    if (deploymentTargets !== undefined && deploymentTargetsPath !== undefined) {
      throw new Error('deploymentTargets or deploymentTargetsPath is required.');
    }

    if (deploymentTargetsPath !== undefined) {
      return deploymentTargetsPath.location;
    }

    return (deploymentTargets || []).join(',');
  }
}

/**
 * Manages a bunch of singleton-y statements on the policy of an IAM Role.
 * Dedicated methods can be used to add specific permissions to the role policy
 * using as few statements as possible (adding resources to existing compatible
 * statements instead of adding new statements whenever possible).
 *
 * Statements created outside of this class are not considered when adding new
 * permissions.
 */
class SingletonPolicy extends Construct implements iam.IGrantable {
  /**
   * Obtain a SingletonPolicy for a given role.
   * @param role the Role this policy is bound to.
   * @returns the SingletonPolicy for this role.
   */
  public static forRole(role: iam.IRole): SingletonPolicy {
    const found = role.node.tryFindChild(SingletonPolicy.UUID);
    return (found as SingletonPolicy) || new SingletonPolicy(role);
  }

  private static readonly UUID = '8389e75f-0810-4838-bf64-d6f85a95cf83';

  public readonly grantPrincipal: iam.IPrincipal;

  private statements: { [key: string]: iam.PolicyStatement } = {};

  private constructor(private readonly role: iam.IRole) {
    super(role as unknown as cdk.Construct, SingletonPolicy.UUID);
    this.grantPrincipal = role;
  }

  public grantExecuteChangeSet(props: { stackName: string, changeSetName: string, region?: string }): void {
    this.statementFor({
      actions: [
        'cloudformation:DescribeStacks',
        'cloudformation:DescribeChangeSet',
        'cloudformation:ExecuteChangeSet',
      ],
      conditions: { StringEqualsIfExists: { 'cloudformation:ChangeSetName': props.changeSetName } },
    }).addResources(this.stackArnFromProps(props));
  }

  public grantCreateReplaceChangeSet(props: { stackName: string, changeSetName: string, region?: string }): void {
    this.statementFor({
      actions: [
        'cloudformation:CreateChangeSet',
        'cloudformation:DeleteChangeSet',
        'cloudformation:DescribeChangeSet',
        'cloudformation:DescribeStacks',
      ],
      conditions: { StringEqualsIfExists: { 'cloudformation:ChangeSetName': props.changeSetName } },
    }).addResources(this.stackArnFromProps(props));
  }

  public grantCreateUpdateStack(props: { stackName: string, replaceOnFailure?: boolean, region?: string }): void {
    const actions = [
      'cloudformation:DescribeStack*',
      'cloudformation:CreateStack',
      'cloudformation:UpdateStack',
      'cloudformation:GetTemplate*',
      'cloudformation:ValidateTemplate',
      'cloudformation:GetStackPolicy',
      'cloudformation:SetStackPolicy',
    ];
    if (props.replaceOnFailure) {
      actions.push('cloudformation:DeleteStack');
    }
    this.statementFor({ actions }).addResources(this.stackArnFromProps(props));
  }

  public grantCreateUpdateStackSet(props: { stackSetName: string, region?: string }): void {
    const actions = [
      'cloudformation:CreateStackSet',
      'cloudformation:UpdateStackSet',
      'cloudformation:DescribeStackSet',
      'cloudformation:DescribeStackSetOperation',
      'cloudformation:ListStackInstances',
      'cloudformation:CreateStackInstances',
    ];
    this.statementFor({ actions }).addResources(this.stackSetArnFromProps(props));
  }

  public grantDeleteStack(props: { stackName: string, region?: string }): void {
    this.statementFor({
      actions: [
        'cloudformation:DescribeStack*',
        'cloudformation:DeleteStack',
      ],
    }).addResources(this.stackArnFromProps(props));
  }

  public grantPassRole(role: iam.IRole | string): void {
    this.statementFor({ actions: ['iam:PassRole'] }).addResources(typeof role === 'string' ? role : role.roleArn);
  }

  private statementFor(template: StatementTemplate): iam.PolicyStatement {
    const key = keyFor(template);
    if (!(key in this.statements)) {
      this.statements[key] = new iam.PolicyStatement({ actions: template.actions });
      if (template.conditions) {
        this.statements[key].addConditions(template.conditions);
      }
      this.role.addToPolicy(this.statements[key]);
    }
    return this.statements[key];

    function keyFor(props: StatementTemplate): string {
      const actions = `${props.actions.sort().join('\x1F')}`;
      const conditions = formatConditions(props.conditions);
      return `${actions}\x1D${conditions}`;

      function formatConditions(cond?: StatementCondition): string {
        if (cond == null) { return ''; }
        let result = '';
        for (const op of Object.keys(cond).sort()) {
          result += `${op}\x1E`;
          const condition = cond[op];
          for (const attribute of Object.keys(condition).sort()) {
            const value = condition[attribute];
            result += `${value}\x1F`;
          }
        }
        return result;
      }
    }
  }

  private stackArnFromProps(props: { stackName: string, region?: string }): string {
    return cdk.Stack.of(this).formatArn({
      region: props.region,
      service: 'cloudformation',
      resource: 'stack',
      resourceName: `${props.stackName}/*`,
    });
  }

  private stackSetArnFromProps(props: { stackSetName: string, region?: string }): string {
    return cdk.Stack.of(this).formatArn({
      region: props.region,
      service: 'cloudformation',
      resource: 'stackset',
      resourceName: `${props.stackSetName}:*`,
    });
  }
}

interface StatementTemplate {
  actions: string[];
  conditions?: StatementCondition;
}

type StatementCondition = { [op: string]: { [attribute: string]: string } };

function parseCapabilities(capabilities: cdk.CfnCapabilities[] | undefined): string | undefined {
  if (capabilities === undefined) {
    return undefined;
  } else if (capabilities.length === 1) {
    const capability = capabilities.toString();
    return (capability === '') ? undefined : capability;
  } else if (capabilities.length > 1) {
    return capabilities.join(',');
  }

  return undefined;
}
