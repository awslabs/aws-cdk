import * as codebuild from '@aws-cdk/aws-codebuild';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import { ShellStep, ShellStepProps } from '../blueprint';

/**
 * Construction props for SimpleSynthAction
 */
export interface CodeBuildStepProps extends ShellStepProps {
  /**
   * Name for the generated CodeBuild project
   *
   * @default - Automatically generated
   */
  readonly projectName?: string;

  /**
   * Additional configuration that can only be configured via BuildSpec
   *
   * You should not use this to specify output artifacts; those
   * should be supplied via the other properties of this class, otherwise
   * CDK Pipelines won't be able to inspect the artifacts.
   *
   * Set the `commands` to an empty array if you want to fully specify
   * the BuildSpec using this field.
   *
   * The BuildSpec must be available inline--it cannot reference a file
   * on disk.
   *
   * @default - BuildSpec completely derived from other properties
   */
  readonly partialBuildSpec?: codebuild.BuildSpec;

  /**
   * The VPC where to execute the SimpleSynth.
   *
   * @default - No VPC
   */
  readonly vpc?: ec2.IVpc;

  /**
   * Which subnets to use.
   *
   * Only used if 'vpc' is supplied.
   *
   * @default - All private subnets.
   */
  readonly subnetSelection?: ec2.SubnetSelection;

  /**
   * Policy statements to add to role used during the synth
   *
   * Can be used to add acces to a CodeArtifact repository etc.
   *
   * @default - No policy statements added to CodeBuild Project Role
   */
  readonly rolePolicyStatements?: iam.PolicyStatement[];

  /**
   * Custom execution role to be used for the CodeBuild project
   *
   * @default - A role is automatically created
   */
  readonly role?: iam.IRole;

  /**
   * Changes to environment
   *
   * This environment will be combined with the pipeline's default
   * environment.
   *
   * @default - Use the pipeline's default build environment
   */
  readonly buildEnvironment?: codebuild.BuildEnvironment;

  /**
   * Which security group to associate with the script's project network interfaces.
   * If no security group is identified, one will be created automatically.
   *
   * Only used if 'vpc' is supplied.
   *
   * @default - Security group will be automatically created.
   */
  readonly securityGroups?: ec2.ISecurityGroup[];
}

/**
 * Run a script as a CodeBuild Project
 */
export class CodeBuildStep extends ShellStep {
  /**
   * Name for the generated CodeBuild project
   *
   * @default - No value specified at construction time, use defaults
   */
  public readonly projectName?: string;

  /**
   * Additional configuration that can only be configured via BuildSpec
   *
   * @default - No value specified at construction time, use defaults
   */
  public readonly partialBuildSpec?: codebuild.BuildSpec;

  /**
   * The VPC where to execute the SimpleSynth.
   *
   * @default - No value specified at construction time, use defaults
   */
  public readonly vpc?: ec2.IVpc;

  /**
   * Which subnets to use.
   *
   * @default - No value specified at construction time, use defaults
   */
  public readonly subnetSelection?: ec2.SubnetSelection;

  /**
   * Policy statements to add to role used during the synth
   *
   * @default - No value specified at construction time, use defaults
   */
  public readonly rolePolicyStatements?: iam.PolicyStatement[];

  /**
   * Custom execution role to be used for the CodeBuild project
   *
   * @default - No value specified at construction time, use defaults
   */
  public readonly role?: iam.IRole;

  /**
   * Build environment
   *
   * @default - No value specified at construction time, use defaults
   */
  readonly buildEnvironment?: codebuild.BuildEnvironment;

  /**
   * Which security group to associate with the script's project network interfaces.
   *
   * @default - No value specified at construction time, use defaults
   */
  readonly securityGroups?: ec2.ISecurityGroup[];

  private _project?: codebuild.IProject;

  constructor(id: string, props: CodeBuildStepProps) {
    super(id, props);

    this.projectName = props.projectName;
    this.buildEnvironment = props.buildEnvironment;
    this.partialBuildSpec = props.partialBuildSpec;
    this.vpc = props.vpc;
    this.subnetSelection = props.subnetSelection;
    this.role = props.role;
    this.rolePolicyStatements = props.rolePolicyStatements;
    this.securityGroups = props.securityGroups;
  }

  /**
   * CodeBiuld Project generated for the pipeline
   *
   * Will only be available after the pipeline has been built.
   */
  public get project(): codebuild.IProject {
    if (!this._project) {
      throw new Error('Project becomes available after the pipeline has been built');
    }
    return this._project;
  }

  /**
   * The CodeBuild Project's principal
   */
  public get grantPrincipal(): iam.IPrincipal {
    return this.project.grantPrincipal;
  }

  /**
   * Set the internal project value
   *
   * @internal
   */
  public _setProject(project: codebuild.IProject) {
    this._project = project;
  }
}
