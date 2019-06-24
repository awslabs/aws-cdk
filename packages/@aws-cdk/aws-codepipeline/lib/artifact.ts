import s3 = require("@aws-cdk/aws-s3");
import { Lazy, Token } from "@aws-cdk/core";
import validation = require('./validation');

/**
 * An output artifact of an action. Artifacts can be used as input by some actions.
 */
export class Artifact {
  /**
   * A static factory method used to create instances of the Artifact class.
   * Mainly meant to be used from `decdk`.
   *
   * @param name the (required) name of the Artifact
   */
  public static artifact(name: string): Artifact {
    return new Artifact(name);
  }

  private _artifactName?: string;

  constructor(artifactName?: string) {
    validation.validateArtifactName(artifactName);

    this._artifactName = artifactName;
  }

  public get artifactName(): string | undefined {
    return this._artifactName;
  }

  /**
   * Returns an ArtifactPath for a file within this artifact.
   * CfnOutput is in the form "<artifact-name>::<file-name>"
   * @param fileName The name of the file
   */
  public atPath(fileName: string): ArtifactPath {
    return new ArtifactPath(this, fileName);
  }

  /**
   * The artifact attribute for the name of the S3 bucket where the artifact is stored.
   */
  public get bucketName() {
    return artifactAttribute(this, 'BucketName');
  }

  /**
   * The artifact attribute for The name of the .zip file that contains the artifact that is
   * generated by AWS CodePipeline, such as 1ABCyZZ.zip.
   */
  public get objectKey() {
    return artifactAttribute(this, 'ObjectKey');
  }

  /**
   * The artifact attribute of the Amazon Simple Storage Service (Amazon S3) URL of the artifact,
   * such as https://s3-us-west-2.amazonaws.com/artifactstorebucket-yivczw8jma0c/test/TemplateSo/1ABCyZZ.zip.
   */
  public get url() {
    return artifactAttribute(this, 'URL');
  }

  /**
   * Returns a token for a value inside a JSON file within this artifact.
   * @param jsonFile The JSON file name.
   * @param keyName The hash key.
   */
  public getParam(jsonFile: string, keyName: string) {
    return artifactGetParam(this, jsonFile, keyName);
  }

  /**
   * Returns the location of the .zip file in S3 that this Artifact represents.
   * Used by Lambda's `CfnParametersCode` when being deployed in a CodePipeline.
   */
  public get s3Location(): s3.Location {
    return {
      bucketName: this.bucketName,
      objectKey: this.objectKey,
    };
  }

  public toString() {
    return this.artifactName;
  }

  /** @internal */
  protected _setName(name: string) {
    if (this._artifactName) {
      throw new Error(`Artifact already has name '${this._artifactName}', cannot override it`);
    } else {
      this._artifactName = name;
    }
  }
}

/**
 * A specific file within an output artifact.
 *
 * The most common use case for this is specifying the template file
 * for a CloudFormation action.
 */
export class ArtifactPath {
  public static artifactPath(artifactName: string, fileName: string): ArtifactPath {
    return new ArtifactPath(Artifact.artifact(artifactName), fileName);
  }

  constructor(readonly artifact: Artifact, readonly fileName: string) {

  }

  public get location() {
    const artifactName = this.artifact.artifactName
      ? this.artifact.artifactName
      : Lazy.stringValue({ produce: () => this.artifact.artifactName });
    return `${artifactName}::${this.fileName}`;
  }
}

function artifactAttribute(artifact: Artifact, attributeName: string) {
  const lazyArtifactName = Lazy.stringValue({ produce: () => artifact.artifactName });
  return Token.asString({ 'Fn::GetArtifactAtt': [lazyArtifactName, attributeName] });
}

function artifactGetParam(artifact: Artifact, jsonFile: string, keyName: string) {
  const lazyArtifactName = Lazy.stringValue({ produce: () => artifact.artifactName });
  return Token.asString({ 'Fn::GetParam': [lazyArtifactName, jsonFile, keyName] });
}
