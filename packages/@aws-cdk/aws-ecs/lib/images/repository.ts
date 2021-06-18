import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import { Annotations, Token } from '@aws-cdk/core';
import { ContainerDefinition } from '../container-definition';
import { ContainerImage, ContainerImageConfig } from '../container-image';

// v2 - keep this import as a separate section to reduce merge conflict when forward merging with the v2 branch.
// eslint-disable-next-line
import { Construct as CoreConstruct } from '@aws-cdk/core';

/**
 * Regex pattern to check if it is an ECR image URL.
 *
 */
const ECR_IMAGE_REGEX = /(^[a-zA-Z0-9][a-zA-Z0-9-_]*).dkr.ecr.([a-zA-Z0-9][a-zA-Z0-9-_]*).amazonaws.com(.cn)?\/.*/;

/**
 * The properties for an image hosted in a public or private repository.
 */
export interface RepositoryImageProps {
  /**
   * The secret to expose to the container that contains the credentials for the image repository.
   * The supported value is the full ARN of an AWS Secrets Manager secret.
   */
  readonly credentials?: secretsmanager.ISecret;
}

/**
 * An image hosted in a public or private repository. For images hosted in Amazon ECR, see
 * [EcrImage](https://docs.aws.amazon.com/AmazonECR/latest/userguide/images.html).
 */
export class RepositoryImage extends ContainerImage {
  /**
   * Constructs a new instance of the RepositoryImage class.
   */
  constructor(private readonly imageName: string, private readonly props: RepositoryImageProps = {}) {
    super();
  }

  public bind(scope: CoreConstruct, containerDefinition: ContainerDefinition): ContainerImageConfig {
    // name could be a Token - in that case, skip validation altogether
    if (!Token.isUnresolved(this.imageName) && ECR_IMAGE_REGEX.test(this.imageName)) {
      Annotations.of(scope).addWarning("Proper policies need to be attached before pulling from ECR repository, or use 'fromEcrRepository'.");
    }

    if (this.props.credentials) {
      this.props.credentials.grantRead(containerDefinition.taskDefinition.obtainExecutionRole());
    }

    return {
      imageName: this.imageName,
      repositoryCredentials: this.props.credentials && {
        credentialsParameter: this.props.credentials.secretArn,
      },
    };
  }
}
