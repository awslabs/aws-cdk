import * as fs from 'fs';
import * as path from 'path';
import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import * as cxapi from '@aws-cdk/cx-api';
import { DockerImageAssetLocation, DockerImageAssetSource, FileAssetLocation, FileAssetPackaging, FileAssetSource } from '../assets';
import { Fn } from '../cfn-fn';
import { CfnParameter } from '../cfn-parameter';
import { CfnRule } from '../cfn-rule';
import { ISynthesisSession } from '../construct-compat';
import { Stack } from '../stack';
import { Token } from '../token';
import { assertBound, contentHash } from './_shared';
import { StackSynthesizer } from './stack-synthesizer';

export const BOOTSTRAP_QUALIFIER_CONTEXT = '@aws-cdk/core:bootstrapQualifier';

/* eslint-disable max-len */

/**
 * The minimum bootstrap stack version required by this app.
 */
const MIN_BOOTSTRAP_STACK_VERSION = 6;

/**
 * Configuration properties for DefaultStackSynthesizer
 */
export interface DefaultStackSynthesizerProps {
  /**
   * Name of the S3 bucket to hold file assets
   *
   * You must supply this if you have given a non-standard name to the staging bucket.
   *
   * The placeholders `${Qualifier}`, `${AWS::AccountId}` and `${AWS::Region}` will
   * be replaced with the values of qualifier and the stack's account and region,
   * respectively.
   *
   * @default DefaultStackSynthesizer.DEFAULT_FILE_ASSETS_BUCKET_NAME
   */
  readonly fileAssetsBucketName?: string;

  /**
   * Name of the ECR repository to hold Docker Image assets
   *
   * You must supply this if you have given a non-standard name to the ECR repository.
   *
   * The placeholders `${Qualifier}`, `${AWS::AccountId}` and `${AWS::Region}` will
   * be replaced with the values of qualifier and the stack's account and region,
   * respectively.
   *
   * @default DefaultStackSynthesizer.DEFAULT_IMAGE_ASSETS_REPOSITORY_NAME
   */
  readonly imageAssetsRepositoryName?: string;

  /**
   * The role to use to publish file assets to the S3 bucket in this environment
   *
   * You must supply this if you have given a non-standard name to the publishing role.
   *
   * The placeholders `${Qualifier}`, `${AWS::AccountId}` and `${AWS::Region}` will
   * be replaced with the values of qualifier and the stack's account and region,
   * respectively.
   *
   * @default DefaultStackSynthesizer.DEFAULT_FILE_ASSET_PUBLISHING_ROLE_ARN
   */
  readonly fileAssetPublishingRoleArn?: string;

  /**
   * External ID to use when assuming role for file asset publishing
   *
   * @default - No external ID
   */
  readonly fileAssetPublishingExternalId?: string;

  /**
   * The role to use to publish image assets to the ECR repository in this environment
   *
   * You must supply this if you have given a non-standard name to the publishing role.
   *
   * The placeholders `${Qualifier}`, `${AWS::AccountId}` and `${AWS::Region}` will
   * be replaced with the values of qualifier and the stack's account and region,
   * respectively.
   *
   * @default DefaultStackSynthesizer.DEFAULT_IMAGE_ASSET_PUBLISHING_ROLE_ARN
   */
  readonly imageAssetPublishingRoleArn?: string;

  /**
   * The role to use to look up values from the target AWS account during synthesis
   *
   * @default - None
   */
  readonly lookupRoleArn?: string;

  /**
   * External ID to use when assuming role for image asset publishing
   *
   * @default - No external ID
   */
  readonly imageAssetPublishingExternalId?: string;

  /**
   * The role to assume to initiate a deployment in this environment
   *
   * You must supply this if you have given a non-standard name to the publishing role.
   *
   * The placeholders `${Qualifier}`, `${AWS::AccountId}` and `${AWS::Region}` will
   * be replaced with the values of qualifier and the stack's account and region,
   * respectively.
   *
   * @default DefaultStackSynthesizer.DEFAULT_DEPLOY_ROLE_ARN
   */
  readonly deployRoleArn?: string;

  /**
   * The role CloudFormation will assume when deploying the Stack
   *
   * You must supply this if you have given a non-standard name to the execution role.
   *
   * The placeholders `${Qualifier}`, `${AWS::AccountId}` and `${AWS::Region}` will
   * be replaced with the values of qualifier and the stack's account and region,
   * respectively.
   *
   * @default DefaultStackSynthesizer.DEFAULT_CLOUDFORMATION_ROLE_ARN
   */
  readonly cloudFormationExecutionRole?: string;

  /**
   * Name of the CloudFormation Export with the asset key name
   *
   * You must supply this if you have given a non-standard name to the KMS key export
   *
   * The placeholders `${Qualifier}`, `${AWS::AccountId}` and `${AWS::Region}` will
   * be replaced with the values of qualifier and the stack's account and region,
   * respectively.
   *
   * @default DefaultStackSynthesizer.DEFAULT_FILE_ASSET_KEY_ARN_EXPORT_NAME
   * @deprecated This property is not used anymore
   */
  readonly fileAssetKeyArnExportName?: string;

  /**
   * Qualifier to disambiguate multiple environments in the same account
   *
   * You can use this and leave the other naming properties empty if you have deployed
   * the bootstrap environment with standard names but only differnet qualifiers.
   *
   * @default - Value of context key '@aws-cdk/core:bootstrapQualifier' if set, otherwise `DefaultStackSynthesizer.DEFAULT_QUALIFIER`
   */
  readonly qualifier?: string;

  /**
   * Whether to add a Rule to the stack template verifying the bootstrap stack version
   *
   * This generally should be left set to `true`, unless you explicitly
   * want to be able to deploy to an unbootstrapped environment.
   *
   * @default true
   */
  readonly generateBootstrapVersionRule?: boolean;

  /**
   * bucketPrefix to use while storing S3 Assets
   *
   *
   * @default - DefaultStackSynthesizer.DEFAULT_FILE_ASSET_PREFIX
   */
  readonly bucketPrefix?: string;

  /**
   * Bootstrap stack version SSM parameter.
   *
   * The placeholder `${Qualifier}` will be replaced with the value of qualifier.
   *
   * @default DefaultStackSynthesizer.DEFAULT_BOOTSTRAP_STACK_VERSION_SSM_PARAMETER
   */
  readonly bootstrapStackVersionSsmParameter?: string;
}

/**
 * Uses conventionally named roles and reify asset storage locations
 *
 * This synthesizer is the only StackSynthesizer that generates
 * an asset manifest, and is required to deploy CDK applications using the
 * `@aws-cdk/app-delivery` CI/CD library.
 *
 * Requires the environment to have been bootstrapped with Bootstrap Stack V2.
 */
export class DefaultStackSynthesizer extends StackSynthesizer {
  /**
   * Default ARN qualifier
   */
  public static readonly DEFAULT_QUALIFIER = 'hnb659fds';

  /**
   * Default CloudFormation role ARN.
   */
  public static readonly DEFAULT_CLOUDFORMATION_ROLE_ARN = 'arn:${AWS::Partition}:iam::${AWS::AccountId}:role/cdk-${Qualifier}-cfn-exec-role-${AWS::AccountId}-${AWS::Region}';

  /**
   * Default deploy role ARN.
   */
  public static readonly DEFAULT_DEPLOY_ROLE_ARN = 'arn:${AWS::Partition}:iam::${AWS::AccountId}:role/cdk-${Qualifier}-deploy-role-${AWS::AccountId}-${AWS::Region}';

  /**
   * Default asset publishing role ARN for file (S3) assets.
   */
  public static readonly DEFAULT_FILE_ASSET_PUBLISHING_ROLE_ARN = 'arn:${AWS::Partition}:iam::${AWS::AccountId}:role/cdk-${Qualifier}-file-publishing-role-${AWS::AccountId}-${AWS::Region}';

  /**
   * Default asset publishing role ARN for image (ECR) assets.
   */
  public static readonly DEFAULT_IMAGE_ASSET_PUBLISHING_ROLE_ARN = 'arn:${AWS::Partition}:iam::${AWS::AccountId}:role/cdk-${Qualifier}-image-publishing-role-${AWS::AccountId}-${AWS::Region}';

  /**
   * Default lookup role ARN for missing values.
   */
  public static readonly DEFAULT_LOOKUP_ROLE_ARN = 'arn:${AWS::Partition}:iam::${AWS::AccountId}:role/cdk-${Qualifier}-lookup-role-${AWS::AccountId}-${AWS::Region}';

  /**
   * Default image assets repository name
   */
  public static readonly DEFAULT_IMAGE_ASSETS_REPOSITORY_NAME = 'cdk-${Qualifier}-container-assets-${AWS::AccountId}-${AWS::Region}';

  /**
   * Default file assets bucket name
   */
  public static readonly DEFAULT_FILE_ASSETS_BUCKET_NAME = 'cdk-${Qualifier}-assets-${AWS::AccountId}-${AWS::Region}';

  /**
   * Name of the CloudFormation Export with the asset key name
   */
  public static readonly DEFAULT_FILE_ASSET_KEY_ARN_EXPORT_NAME = 'CdkBootstrap-${Qualifier}-FileAssetKeyArn';

  /**
   * Default file asset prefix
   */
  public static readonly DEFAULT_FILE_ASSET_PREFIX = '';

  /**
   * Default bootstrap stack version SSM parameter.
   */
  public static readonly DEFAULT_BOOTSTRAP_STACK_VERSION_SSM_PARAMETER = '/cdk-bootstrap/${Qualifier}/version';

  private _stack?: Stack;
  private bucketName?: string;
  private repositoryName?: string;
  private _deployRoleArn?: string;
  private _cloudFormationExecutionRoleArn?: string;
  private fileAssetPublishingRoleArn?: string;
  private imageAssetPublishingRoleArn?: string;
  private lookupRoleArn?: string;
  private qualifier?: string;
  private bucketPrefix?: string;
  private bootstrapStackVersionSsmParameter?: string;

  private readonly files: NonNullable<cxschema.AssetManifest['files']> = {};
  private readonly dockerImages: NonNullable<cxschema.AssetManifest['dockerImages']> = {};

  constructor(private readonly props: DefaultStackSynthesizerProps = {}) {
    super();

    for (const key in props) {
      if (props.hasOwnProperty(key)) {
        validateNoToken(key as keyof DefaultStackSynthesizerProps);
      }
    }

    function validateNoToken<A extends keyof DefaultStackSynthesizerProps>(key: A) {
      const prop = props[key];
      if (typeof prop === 'string' && Token.isUnresolved(prop)) {
        throw new Error(`DefaultSynthesizer property '${key}' cannot contain tokens; only the following placeholder strings are allowed: ` + [
          '${Qualifier}',
          cxapi.EnvironmentPlaceholders.CURRENT_REGION,
          cxapi.EnvironmentPlaceholders.CURRENT_ACCOUNT,
          cxapi.EnvironmentPlaceholders.CURRENT_PARTITION,
        ].join(', '));
      }
    }
  }

  public bind(stack: Stack): void {
    if (this._stack !== undefined) {
      throw new Error('A StackSynthesizer can only be used for one Stack: create a new instance to use with a different Stack');
    }

    this._stack = stack;

    const qualifier = this.props.qualifier ?? stack.node.tryGetContext(BOOTSTRAP_QUALIFIER_CONTEXT) ?? DefaultStackSynthesizer.DEFAULT_QUALIFIER;
    this.qualifier = qualifier;

    // Function to replace placeholders in the input string as much as possible
    //
    // We replace:
    // - ${Qualifier}: always
    // - ${AWS::AccountId}, ${AWS::Region}: only if we have the actual values available
    // - ${AWS::Partition}: never, since we never have the actual partition value.
    const specialize = (s: string) => {
      s = replaceAll(s, '${Qualifier}', qualifier);
      return cxapi.EnvironmentPlaceholders.replace(s, {
        region: resolvedOr(stack.region, cxapi.EnvironmentPlaceholders.CURRENT_REGION),
        accountId: resolvedOr(stack.account, cxapi.EnvironmentPlaceholders.CURRENT_ACCOUNT),
        partition: cxapi.EnvironmentPlaceholders.CURRENT_PARTITION,
      });
    };

    /* eslint-disable max-len */
    this.bucketName = specialize(this.props.fileAssetsBucketName ?? DefaultStackSynthesizer.DEFAULT_FILE_ASSETS_BUCKET_NAME);
    this.repositoryName = specialize(this.props.imageAssetsRepositoryName ?? DefaultStackSynthesizer.DEFAULT_IMAGE_ASSETS_REPOSITORY_NAME);
    this._deployRoleArn = specialize(this.props.deployRoleArn ?? DefaultStackSynthesizer.DEFAULT_DEPLOY_ROLE_ARN);
    this._cloudFormationExecutionRoleArn = specialize(this.props.cloudFormationExecutionRole ?? DefaultStackSynthesizer.DEFAULT_CLOUDFORMATION_ROLE_ARN);
    this.fileAssetPublishingRoleArn = specialize(this.props.fileAssetPublishingRoleArn ?? DefaultStackSynthesizer.DEFAULT_FILE_ASSET_PUBLISHING_ROLE_ARN);
    this.imageAssetPublishingRoleArn = specialize(this.props.imageAssetPublishingRoleArn ?? DefaultStackSynthesizer.DEFAULT_IMAGE_ASSET_PUBLISHING_ROLE_ARN);
    this.lookupRoleArn = specialize(this.props.lookupRoleArn ?? DefaultStackSynthesizer.DEFAULT_LOOKUP_ROLE_ARN);
    this.bucketPrefix = specialize(this.props.bucketPrefix ?? DefaultStackSynthesizer.DEFAULT_FILE_ASSET_PREFIX);
    this.bootstrapStackVersionSsmParameter = replaceAll(
      this.props.bootstrapStackVersionSsmParameter ?? DefaultStackSynthesizer.DEFAULT_BOOTSTRAP_STACK_VERSION_SSM_PARAMETER,
      '${Qualifier}',
      qualifier,
    );
    /* eslint-enable max-len */
  }

  public addFileAsset(asset: FileAssetSource): FileAssetLocation {
    assertBound(this.stack);
    assertBound(this.bucketName);
    validateFileAssetSource(asset);

    const extension = asset.fileName != undefined ? path.extname(asset.fileName) : '';
    const objectKey = this.bucketPrefix + asset.sourceHash + (asset.packaging === FileAssetPackaging.ZIP_DIRECTORY ? '.zip' : extension);

    // Add to manifest
    this.files[asset.sourceHash] = {
      source: {
        path: asset.fileName,
        executable: asset.executable,
        packaging: asset.packaging,
      },
      destinations: {
        [this.manifestEnvName]: {
          bucketName: this.bucketName,
          objectKey,
          region: resolvedOr(this.stack.region, undefined),
          assumeRoleArn: this.fileAssetPublishingRoleArn,
          assumeRoleExternalId: this.props.fileAssetPublishingExternalId,
        },
      },
    };

    const { region, urlSuffix } = stackLocationOrInstrinsics(this.stack);
    const httpUrl = cfnify(`https://s3.${region}.${urlSuffix}/${this.bucketName}/${objectKey}`);
    const s3ObjectUrl = cfnify(`s3://${this.bucketName}/${objectKey}`);

    // Return CFN expression
    return {
      bucketName: cfnify(this.bucketName),
      objectKey,
      httpUrl,
      s3ObjectUrl,
      s3Url: httpUrl,
    };
  }

  public addDockerImageAsset(asset: DockerImageAssetSource): DockerImageAssetLocation {
    assertBound(this.stack);
    assertBound(this.repositoryName);
    validateDockerImageAssetSource(asset);

    const imageTag = asset.sourceHash;

    // Add to manifest
    this.dockerImages[asset.sourceHash] = {
      source: {
        executable: asset.executable,
        directory: asset.directoryName,
        dockerBuildArgs: asset.dockerBuildArgs,
        dockerBuildTarget: asset.dockerBuildTarget,
        dockerFile: asset.dockerFile,
      },
      destinations: {
        [this.manifestEnvName]: {
          repositoryName: this.repositoryName,
          imageTag,
          region: resolvedOr(this.stack.region, undefined),
          assumeRoleArn: this.imageAssetPublishingRoleArn,
          assumeRoleExternalId: this.props.imageAssetPublishingExternalId,
        },
      },
    };

    const { account, region, urlSuffix } = stackLocationOrInstrinsics(this.stack);

    // Return CFN expression
    return {
      repositoryName: cfnify(this.repositoryName),
      imageUri: cfnify(`${account}.dkr.ecr.${region}.${urlSuffix}/${this.repositoryName}:${imageTag}`),
    };
  }

  protected synthesizeStackTemplate(stack: Stack, session: ISynthesisSession): void {
    stack._synthesizeTemplate(session, this.lookupRoleArn);
  }

  /**
   * Synthesize the associated stack to the session
   */
  public synthesize(session: ISynthesisSession): void {
    assertBound(this.stack);
    assertBound(this.qualifier);

    // Must be done here -- if it's done in bind() (called in the Stack's constructor)
    // then it will become impossible to set context after that.
    //
    // If it's done AFTER _synthesizeTemplate(), then the template won't contain the
    // right constructs.
    if (this.props.generateBootstrapVersionRule ?? true) {
      addBootstrapVersionRule(this.stack, MIN_BOOTSTRAP_STACK_VERSION, <string> this.bootstrapStackVersionSsmParameter);
    }

    this.synthesizeStackTemplate(this.stack, session);

    // Add the stack's template to the artifact manifest
    const templateManifestUrl = this.addStackTemplateToAssetManifest(session);

    const artifactId = this.writeAssetManifest(session);

    this.emitStackArtifact(this.stack, session, {
      assumeRoleArn: this._deployRoleArn,
      cloudFormationExecutionRoleArn: this._cloudFormationExecutionRoleArn,
      stackTemplateAssetObjectUrl: templateManifestUrl,
      requiresBootstrapStackVersion: MIN_BOOTSTRAP_STACK_VERSION,
      bootstrapStackVersionSsmParameter: this.bootstrapStackVersionSsmParameter,
      additionalDependencies: [artifactId],
    });
  }

  /**
   * Returns the ARN of the deploy Role.
   */
  public get deployRoleArn(): string {
    if (!this._deployRoleArn) {
      throw new Error('deployRoleArn getter can only be called after the synthesizer has been bound to a Stack');
    }
    return this._deployRoleArn;
  }

  /**
   * Returns the ARN of the CFN execution Role.
   */
  public get cloudFormationExecutionRoleArn(): string {
    if (!this._cloudFormationExecutionRoleArn) {
      throw new Error('cloudFormationExecutionRoleArn getter can only be called after the synthesizer has been bound to a Stack');
    }
    return this._cloudFormationExecutionRoleArn;
  }

  protected get stack(): Stack | undefined {
    return this._stack;
  }

  /**
   * Add the stack's template as one of the manifest assets
   *
   * This will make it get uploaded to S3 automatically by S3-assets. Return
   * the manifest URL.
   *
   * (We can't return the location returned from `addFileAsset`, as that
   * contains CloudFormation intrinsics which can't go into the manifest).
   */
  private addStackTemplateToAssetManifest(session: ISynthesisSession) {
    assertBound(this.stack);

    const templatePath = path.join(session.assembly.outdir, this.stack.templateFile);
    const template = fs.readFileSync(templatePath, { encoding: 'utf-8' });

    const sourceHash = contentHash(template);

    this.addFileAsset({
      fileName: this.stack.templateFile,
      packaging: FileAssetPackaging.FILE,
      sourceHash,
    });

    // We should technically return an 'https://s3.REGION.amazonaws.com[.cn]/name/hash' URL here,
    // because that is what CloudFormation expects to see.
    //
    // However, there's no way for us to actually know the UrlSuffix a priori, so we can't construct it here.
    //
    // Instead, we'll have a protocol with the CLI that we put an 's3://.../...' URL here, and the CLI
    // is going to resolve it to the correct 'https://.../' URL before it gives it to CloudFormation.
    //
    // ALSO: it would be great to reuse the return value of `addFileAsset()` here, except those contain
    // CloudFormation REFERENCES to locations, not actual locations (can contain `{ Ref: AWS::Region }` and
    // `{ Ref: SomeParameter }` etc). We therefore have to duplicate some logic here :(.
    const extension = path.extname(this.stack.templateFile);
    return `s3://${this.bucketName}/${this.bucketPrefix}${sourceHash}${extension}`;
  }

  /**
   * Write an asset manifest to the Cloud Assembly, return the artifact IDs written
   */
  private writeAssetManifest(session: ISynthesisSession): string {
    assertBound(this.stack);

    const artifactId = `${this.stack.artifactId}.assets`;
    const manifestFile = `${artifactId}.json`;
    const outPath = path.join(session.assembly.outdir, manifestFile);

    const manifest: cxschema.AssetManifest = {
      version: cxschema.Manifest.version(),
      files: this.files,
      dockerImages: this.dockerImages,
    };

    fs.writeFileSync(outPath, JSON.stringify(manifest, undefined, 2));
    session.assembly.addArtifact(artifactId, {
      type: cxschema.ArtifactType.ASSET_MANIFEST,
      properties: {
        file: manifestFile,
        requiresBootstrapStackVersion: MIN_BOOTSTRAP_STACK_VERSION,
        bootstrapStackVersionSsmParameter: this.bootstrapStackVersionSsmParameter,
      },
    });

    return artifactId;
  }

  private get manifestEnvName(): string {
    assertBound(this.stack);

    return [
      resolvedOr(this.stack.account, 'current_account'),
      resolvedOr(this.stack.region, 'current_region'),
    ].join('-');
  }
}

/**
 * Return the given value if resolved or fall back to a default
 */
function resolvedOr<A>(x: string, def: A): string | A {
  return Token.isUnresolved(x) ? def : x;
}

/**
 * A "replace-all" function that doesn't require us escaping a literal string to a regex
 */
function replaceAll(s: string, search: string, replace: string) {
  return s.split(search).join(replace);
}

/**
 * If the string still contains placeholders, wrap it in a Fn::Sub so they will be substituted at CFN deployment time
 *
 * (This happens to work because the placeholders we picked map directly onto CFN
 * placeholders. If they didn't we'd have to do a transformation here).
 */
function cfnify(s: string): string {
  return s.indexOf('${') > -1 ? Fn.sub(s) : s;
}

/**
 * Return the stack locations if they're concrete, or the original CFN intrisics otherwise
 *
 * We need to return these instead of the tokenized versions of the strings,
 * since we must accept those same ${AWS::AccountId}/${AWS::Region} placeholders
 * in bucket names and role names (in order to allow environment-agnostic stacks).
 *
 * We'll wrap a single {Fn::Sub} around the final string in order to replace everything,
 * but we can't have the token system render part of the string to {Fn::Join} because
 * the CFN specification doesn't allow the {Fn::Sub} template string to be an arbitrary
 * expression--it must be a string literal.
 */
function stackLocationOrInstrinsics(stack: Stack) {
  return {
    account: resolvedOr(stack.account, '${AWS::AccountId}'),
    region: resolvedOr(stack.region, '${AWS::Region}'),
    urlSuffix: resolvedOr(stack.urlSuffix, '${AWS::URLSuffix}'),
  };
}

/**
 * Add a CfnRule to the Stack which checks the current version of the bootstrap stack this template is targeting
 *
 * The CLI normally checks this, but in a pipeline the CLI is not involved
 * so we encode this rule into the template in a way that CloudFormation will check it.
 */
function addBootstrapVersionRule(stack: Stack, requiredVersion: number, bootstrapStackVersionSsmParameter: string) {
  // Because of https://github.com/aws/aws-cdk/blob/master/packages/assert-internal/lib/synth-utils.ts#L74
  // synthesize() may be called more than once on a stack in unit tests, and the below would break
  // if we execute it a second time. Guard against the constructs already existing.
  if (stack.node.tryFindChild('BootstrapVersion')) { return; }

  const param = new CfnParameter(stack, 'BootstrapVersion', {
    type: 'AWS::SSM::Parameter::Value<String>',
    description: 'Version of the CDK Bootstrap resources in this environment, automatically retrieved from SSM Parameter Store.',
    default: bootstrapStackVersionSsmParameter,
  });

  // There is no >= check in CloudFormation, so we have to check the number
  // is NOT in [1, 2, 3, ... <required> - 1]
  const oldVersions = range(1, requiredVersion).map(n => `${n}`);

  new CfnRule(stack, 'CheckBootstrapVersion', {
    assertions: [
      {
        assert: Fn.conditionNot(Fn.conditionContains(oldVersions, param.valueAsString)),
        assertDescription: `CDK bootstrap stack version ${requiredVersion} required. Please run 'cdk bootstrap' with a recent version of the CDK CLI.`,
      },
    ],
  });
}

function range(startIncl: number, endExcl: number) {
  const ret = new Array<number>();
  for (let i = startIncl; i < endExcl; i++) {
    ret.push(i);
  }
  return ret;
}


function validateFileAssetSource(asset: FileAssetSource) {
  if (!!asset.executable === !!asset.fileName) {
    throw new Error(`Exactly one of 'fileName' or 'executable' is required, got: ${JSON.stringify(asset)}`);
  }

  if (!!asset.packaging !== !!asset.fileName) {
    throw new Error(`'packaging' is expected in combination with 'fileName', got: ${JSON.stringify(asset)}`);
  }
}

function validateDockerImageAssetSource(asset: DockerImageAssetSource) {
  if (!!asset.executable === !!asset.directoryName) {
    throw new Error(`Exactly one of 'directoryName' or 'executable' is required, got: ${JSON.stringify(asset)}`);
  }

  check('dockerBuildArgs');
  check('dockerBuildTarget');
  check('dockerFile');

  function check<K extends keyof DockerImageAssetSource>(key: K) {
    if (asset[key] && !asset.directoryName) {
      throw new Error(`'${key}' is only allowed in combination with 'directoryName', got: ${JSON.stringify(asset)}`);
    }
  }
}
