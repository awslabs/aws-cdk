import * as codepipeline from '@aws-cdk/aws-codepipeline';
import { IGrantable } from '@aws-cdk/aws-iam';
import * as s3assets from '@aws-cdk/aws-s3-assets';
import { Construct } from 'constructs';

/**
 * Additional files to use in a shell script
 */
export abstract class Files {
  /**
   * Use the files from a CodePipeline artifact
   */
  public static fromArtifact(artifact: codepipeline.Artifact): Files {
    if (!artifact) {
      // Typechecking may mess up
      throw new Error('Files.fromArtifact(): input artifact is required, got undefined');
    }

    return {
      bind: () => ({ artifact }),
      grantRead: () => { /* Not necessary */ },
    };
  }

  /**
   * Create a new asset to bundle up the files in a directory on disk
   */
  public static fromDirectory(directoryPath: string): Files {
    let realFiles: Files;
    return {
      bind(scope: Construct) {
        realFiles = Files.fromAsset(new s3assets.Asset(scope, directoryPath, {
          path: directoryPath,
        }));

        return realFiles.bind(scope);
      },
      grantRead(grantee: IGrantable) {
        if (!realFiles) {
          throw new Error('bind() must be called first');
        }
        realFiles.grantRead(grantee);
      },
    };
  }

  /**
   * Use an existing asset as a file source
   */
  public static fromAsset(asset: s3assets.Asset): Files {
    return {
      bind: () => ({
        commands: [
          `echo "Downloading additional files from ${asset.s3ObjectUrl}"`,
          `aws s3 cp ${asset.s3ObjectUrl} /tmp/dl.zip`,
          'unzip /tmp/dl.zip -d .',
        ],
      }),
      grantRead: (grantee) => asset.grantRead(grantee),
    };
  }

  protected constructor() {
  }

  /**
   * Bind the Files to a usage location
   */
  public abstract bind(scope: Construct): FilesConfig;

  /**
   * Grant read permissions to the file set to the given grantable
   *
   * Must be called after bind().
   */

  public abstract grantRead(grantee: IGrantable): void;
}

/**
 * Config for a Files source
 */
export interface FilesConfig {
  /**
   * CodePipeline artifact to add to the set of input artifacts for the project
   *
   * @default - No artifact
   */
  readonly artifact?: codepipeline.Artifact;

  /**
   * Commands to add to the set of commands for the project
   *
   * @default - No commands
   */
  readonly commands?: string[];
}
