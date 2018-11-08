import iam = require('@aws-cdk/aws-iam');
import cdk = require('@aws-cdk/cdk');

/**
 * An ECR repository
 */
export abstract class RepositoryRef extends cdk.Construct {
  /**
   * Import a repository
   */
  public static import(parent: cdk.Construct, id: string, props: RepositoryRefProps): RepositoryRef {
    return new ImportedRepository(parent, id, props);
  }

  /**
   * The name of the repository
   */
  public abstract readonly repositoryName: string;

  /**
   * The ARN of the repository
   */
  public abstract readonly repositoryArn: string;

  /**
   * Add a policy statement to the repository's resource policy
   */
  public abstract addToResourcePolicy(statement: iam.PolicyStatement): void;

  /**
   * Export this repository from the stack
   */
  public export(): RepositoryRefProps {
    return {
      repositoryArn: new cdk.Output(this, 'RepositoryArn', { value: this.repositoryArn }).makeImportValue().toString(),
    };
  }

  /**
   * The URI of the repository, for use in Docker/image references
   */
  public get repositoryUri(): string {
    // Calculate this from the ARN
    const parts = cdk.ArnUtils.parse(this.repositoryArn);
    return `${parts.account}.dkr.ecr.${parts.region}.amazonaws.com/${parts.resourceName}`;
  }

  /**
   * Grant the given principal identity permissions to perform the actions on this repository
   */
  public grant(identity?: iam.IPrincipal, ...actions: string[]) {
    if (!identity) {
      return;
    }
    identity.addToPolicy(new iam.PolicyStatement()
      .addResource(this.repositoryArn)
      .addActions(...actions));
  }

  /**
   * Grant the given identity permissions to use the images in this repository
   */
  public grantUseImage(identity?: iam.IPrincipal) {
    this.grant(identity, "ecr:BatchCheckLayerAvailability", "ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage");

    if (identity) {
      identity.addToPolicy(new iam.PolicyStatement()
        .addActions("ecr:GetAuthorizationToken", "logs:CreateLogStream", "logs:PutLogEvents")
        .addAllResources());
    }
  }
}

export interface RepositoryRefProps {
  repositoryArn: string;
}

/**
 * An already existing repository
 */
class ImportedRepository extends RepositoryRef {
  public readonly repositoryName: string;
  public readonly repositoryArn: string;

  constructor(parent: cdk.Construct, id: string, props: RepositoryRefProps) {
    super(parent, id);
    this.repositoryArn = props.repositoryArn;
    this.repositoryName = cdk.ArnUtils.parse(props.repositoryArn).resourceName!;
  }

  public addToResourcePolicy(_statement: iam.PolicyStatement) {
    // FIXME: Add annotation about policy we dropped on the floor
  }
}