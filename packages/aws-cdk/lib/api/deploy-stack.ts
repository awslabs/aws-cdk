import * as cxapi from '@aws-cdk/cx-api';
import * as colors from 'colors/safe';
import * as uuid from 'uuid';
import { addMetadataAssetsToManifest } from '../assets';
import { Tag } from '../cdk-toolkit';
import { debug, error, print } from '../logging';
import { toYAML } from '../serialize';
import { AssetManifestBuilder } from '../util/asset-manifest-builder';
import { publishAssets } from '../util/asset-publishing';
import { contentHash } from '../util/content-hash';
import { ISDK, SdkProvider } from './aws-auth';
import { ToolkitInfo } from './toolkit-info';
import { changeSetHasNoChanges, CloudFormationStack, TemplateParameters, waitForChangeSet, waitForStackDeploy, waitForStackDelete } from './util/cloudformation';
import { StackActivityMonitor, StackActivityProgress } from './util/cloudformation/stack-activity-monitor';

// We need to map regions to domain suffixes, and the SDK already has a function to do this.
// It's not part of the public API, but it's also unlikely to go away.
//
// Reuse that function, and add a safety check so we don't accidentally break if they ever
// refactor that away.

/* eslint-disable @typescript-eslint/no-require-imports */
const regionUtil = require('aws-sdk/lib/region_config');
/* eslint-enable @typescript-eslint/no-require-imports */

if (!regionUtil.getEndpointSuffix) {
  throw new Error('This version of AWS SDK for JS does not have the \'getEndpointSuffix\' function!');
}

type TemplateBodyParameter = {
  TemplateBody?: string
  TemplateURL?: string
};

export interface DeployStackResult {
  readonly noOp: boolean;
  readonly outputs: { [name: string]: string };
  readonly stackArn: string;
  readonly stackArtifact: cxapi.CloudFormationStackArtifact;
}

export interface DeployStackOptions {
  /**
   * The stack to be deployed
   */
  stack: cxapi.CloudFormationStackArtifact;

  /**
   * The environment to deploy this stack in
   *
   * The environment on the stack artifact may be unresolved, this one
   * must be resolved.
   */
  resolvedEnvironment: cxapi.Environment;

  /**
   * The SDK to use for deploying the stack
   *
   * Should have been initialized with the correct role with which
   * stack operations should be performed.
   */
  sdk: ISDK;

  /**
   * SDK provider (seeded with default credentials)
   *
   * Will exclusively be used to assume publishing credentials (which must
   * start out from current credentials regardless of whether we've assumed an
   * action role to touch the stack or not).
   *
   * Used for the following purposes:
   *
   * - Publish legacy assets.
   * - Upload large CloudFormation templates to the staging bucket.
   */
  sdkProvider: SdkProvider;

  /**
   * Information about the bootstrap stack found in the target environment
   */
  toolkitInfo: ToolkitInfo;

  /**
   * Role to pass to CloudFormation to execute the change set
   *
   * @default - Role specified on stack, otherwise current
   */
  roleArn?: string;

  /**
   * Notification ARNs to pass to CloudFormation to notify when the change set has completed
   *
   * @default - No notifications
   */
  notificationArns?: string[];

  /**
   * Name to deploy the stack under
   *
   * @default - Name from assembly
   */
  deployName?: string;

  /**
   * Quiet or verbose deployment
   *
   * @default false
   */
  quiet?: boolean;

  /**
   * List of asset IDs which shouldn't be built
   *
   * @default - Build all assets
   */
  reuseAssets?: string[];

  /**
   * Tags to pass to CloudFormation to add to stack
   *
   * @default - No tags
   */
  tags?: Tag[];

  /**
   * Whether to execute the changeset or leave it in review.
   *
   * @default true
   */
  execute?: boolean;

  /**
   * Optional name to use for the CloudFormation change set.
   * If not provided, a name will be generated automatically.
   */
  changeSetName?: string;

  /**
   * The collection of extra parameters
   * (in addition to those used for assets)
   * to pass to the deployed template.
   * Note that parameters with `undefined` or empty values will be ignored,
   * and not passed to the template.
   *
   * @default - no additional parameters will be passed to the template
   */
  parameters?: { [name: string]: string | undefined };

  /**
   * Use previous values for unspecified parameters
   *
   * If not set, all parameters must be specified for every deployment.
   *
   * @default false
   */
  usePreviousParameters?: boolean;

  /**
   * Display mode for stack deployment progress.
   *
   * @default StackActivityProgress.Bar stack events will be displayed for
   *   the resource currently being deployed.
   */
  progress?: StackActivityProgress;

  /**
   * Deploy even if the deployed template is identical to the one we are about to deploy.
   * @default false
   */
  force?: boolean;

  /**
   * Whether we are on a CI system
   *
   * @default false
   */
  readonly ci?: boolean;
}

const LARGE_TEMPLATE_SIZE_KB = 50;

export async function deployStack(options: DeployStackOptions): Promise<DeployStackResult> {
  const stackArtifact = options.stack;

  const stackEnv = options.resolvedEnvironment;

  const cfn = options.sdk.cloudFormation();
  const deployName = options.deployName || stackArtifact.stackName;
  let cloudFormationStack = await CloudFormationStack.lookup(cfn, deployName);

  if (cloudFormationStack.stackStatus.isCreationFailure) {
    debug(`Found existing stack ${deployName} that had previously failed creation. Deleting it before attempting to re-create it.`);
    await cfn.deleteStack({ StackName: deployName }).promise();
    const deletedStack = await waitForStackDelete(cfn, deployName);
    if (deletedStack && deletedStack.stackStatus.name !== 'DELETE_COMPLETE') {
      throw new Error(`Failed deleting stack ${deployName} that had previously failed creation (current state: ${deletedStack.stackStatus})`);
    }
    // Update variable to mark that the stack does not exist anymore, but avoid
    // doing an actual lookup in CloudFormation (which would be silly to do if
    // we just deleted it).
    cloudFormationStack = CloudFormationStack.doesNotExist(cfn, deployName);
  }

  // Detect "legacy" assets (which remain in the metadata) and publish them via
  // an ad-hoc asset manifest, while passing their locations via template
  // parameters.
  const legacyAssets = new AssetManifestBuilder();
  const assetParams = await addMetadataAssetsToManifest(stackArtifact, legacyAssets, options.toolkitInfo, options.reuseAssets);

  const finalParameterValues = { ...options.parameters, ...assetParams };

  const templateParams = TemplateParameters.fromTemplate(stackArtifact.template);
  const stackParams = options.usePreviousParameters
    ? templateParams.updateExisting(finalParameterValues, cloudFormationStack.parameters)
    : templateParams.supplyAll(finalParameterValues);

  if (await canSkipDeploy(options, cloudFormationStack, stackParams.hasChanges(cloudFormationStack.parameters))) {
    debug(`${deployName}: skipping deployment (use --force to override)`);
    return {
      noOp: true,
      outputs: cloudFormationStack.outputs,
      stackArn: cloudFormationStack.stackId,
      stackArtifact,
    };
  } else {
    debug(`${deployName}: deploying...`);
  }

  const executionId = uuid.v4();
  const bodyParameter = await makeBodyParameter(stackArtifact, options.resolvedEnvironment, legacyAssets, options.toolkitInfo);

  await publishAssets(legacyAssets.toManifest(stackArtifact.assembly.directory), options.sdkProvider, stackEnv);

  const changeSetName = options.changeSetName || 'cdk-deploy-change-set';
  if (cloudFormationStack.exists) {
    //Delete any existing change sets generated by CDK since change set names must be unique.
    //The delete request is successful as long as the stack exists (even if the change set does not exist).
    debug(`Removing existing change set with name ${changeSetName} if it exists`);
    await cfn.deleteChangeSet({ StackName: deployName, ChangeSetName: changeSetName }).promise();
  }

  const update = cloudFormationStack.exists && cloudFormationStack.stackStatus.name !== 'REVIEW_IN_PROGRESS';

  debug(`Attempting to create ChangeSet with name ${changeSetName} to ${update ? 'update' : 'create'} stack ${deployName}`);
  print('%s: creating CloudFormation changeset...', colors.bold(deployName));
  const changeSet = await cfn.createChangeSet({
    StackName: deployName,
    ChangeSetName: changeSetName,
    ChangeSetType: update ? 'UPDATE' : 'CREATE',
    Description: `CDK Changeset for execution ${executionId}`,
    TemplateBody: bodyParameter.TemplateBody,
    TemplateURL: bodyParameter.TemplateURL,
    Parameters: stackParams.apiParameters,
    RoleARN: options.roleArn,
    NotificationARNs: options.notificationArns,
    Capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM', 'CAPABILITY_AUTO_EXPAND'],
    Tags: options.tags,
  }).promise();
  debug('Initiated creation of changeset: %s; waiting for it to finish creating...', changeSet.Id);
  const changeSetDescription = await waitForChangeSet(cfn, deployName, changeSetName);

  // Update termination protection only if it has changed.
  const terminationProtection = stackArtifact.terminationProtection ?? false;
  if (!!cloudFormationStack.terminationProtection !== terminationProtection) {
    debug('Updating termination protection from %s to %s for stack %s', cloudFormationStack.terminationProtection, terminationProtection, deployName);
    await cfn.updateTerminationProtection({
      StackName: deployName,
      EnableTerminationProtection: terminationProtection,
    }).promise();
    debug('Termination protection updated to %s for stack %s', terminationProtection, deployName);
  }

  if (changeSetHasNoChanges(changeSetDescription)) {
    debug('No changes are to be performed on %s.', deployName);
    if (options.execute) {
      debug('Deleting empty change set %s', changeSet.Id);
      await cfn.deleteChangeSet({ StackName: deployName, ChangeSetName: changeSetName }).promise();
    }
    return { noOp: true, outputs: cloudFormationStack.outputs, stackArn: changeSet.StackId!, stackArtifact };
  }

  const execute = options.execute === undefined ? true : options.execute;
  if (execute) {
    debug('Initiating execution of changeset %s on stack %s', changeSet.Id, deployName);
    await cfn.executeChangeSet({ StackName: deployName, ChangeSetName: changeSetName }).promise();
    // eslint-disable-next-line max-len
    const monitor = options.quiet ? undefined : StackActivityMonitor.withDefaultPrinter(cfn, deployName, stackArtifact, {
      resourcesTotal: (changeSetDescription.Changes ?? []).length,
      progress: options.progress,
      changeSetCreationTime: changeSetDescription.CreationTime,
    }).start();
    debug('Execution of changeset %s on stack %s has started; waiting for the update to complete...', changeSet.Id, deployName);
    try {
      const finalStack = await waitForStackDeploy(cfn, deployName);

      // This shouldn't really happen, but catch it anyway. You never know.
      if (!finalStack) { throw new Error('Stack deploy failed (the stack disappeared while we were deploying it)'); }
      cloudFormationStack = finalStack;
    } finally {
      await monitor?.stop();
    }
    debug('Stack %s has completed updating', deployName);
  } else {
    print('Changeset %s created and waiting in review for manual execution (--no-execute)', changeSet.Id);
  }

  return { noOp: false, outputs: cloudFormationStack.outputs, stackArn: changeSet.StackId!, stackArtifact };
}

/**
 * Prepares the body parameter for +CreateChangeSet+.
 *
 * If the template is small enough to be inlined into the API call, just return
 * it immediately.
 *
 * Otherwise, add it to the asset manifest to get uploaded to the staging
 * bucket and return its coordinates. If there is no staging bucket, an error
 * is thrown.
 *
 * @param stack     the synthesized stack that provides the CloudFormation template
 * @param toolkitInfo information about the toolkit stack
 */
async function makeBodyParameter(
    stack: cxapi.CloudFormationStackArtifact,
    resolvedEnvironment: cxapi.Environment,
    assetManifest: AssetManifestBuilder,
    toolkitInfo: ToolkitInfo): Promise<TemplateBodyParameter> {
  // If the template has already been uploaded to S3, just use it from there.
  if (stack.stackTemplateAssetObjectUrl) {
    return { TemplateURL: restUrlFromManifest(stack.stackTemplateAssetObjectUrl, resolvedEnvironment) };
  }

  // Otherwise, pass via API call (if small) or upload here (if large)
  const templateJson = toYAML(stack.template);

  if (templateJson.length <= LARGE_TEMPLATE_SIZE_KB * 1024) {
    return { TemplateBody: templateJson };
  }

  if (!toolkitInfo.found) {
    error(
      `The template for stack "${stack.displayName}" is ${Math.round(templateJson.length / 1024)}KiB. ` +
      `Templates larger than ${LARGE_TEMPLATE_SIZE_KB}KiB must be uploaded to S3.\n` +
      'Run the following command in order to setup an S3 bucket in this environment, and then re-deploy:\n\n',
      colors.blue(`\t$ cdk bootstrap ${resolvedEnvironment.name}\n`));

    throw new Error('Template too large to deploy ("cdk bootstrap" is required)');
  }

  const templateHash = contentHash(templateJson);
  const key = `cdk/${stack.id}/${templateHash}.yml`;

  assetManifest.addFileAsset(templateHash, {
    path: stack.templateFile,
  }, {
    bucketName: toolkitInfo.bucketName,
    objectKey: key,
  });

  const templateURL = `${toolkitInfo.bucketUrl}/${key}`;
  debug('Storing template in S3 at:', templateURL);
  return { TemplateURL: templateURL };
}

export interface DestroyStackOptions {
  /**
   * The stack to be destroyed
   */
  stack: cxapi.CloudFormationStackArtifact;

  sdk: ISDK;
  roleArn?: string;
  deployName?: string;
  quiet?: boolean;
}

export async function destroyStack(options: DestroyStackOptions) {
  const deployName = options.deployName || options.stack.stackName;
  const cfn = options.sdk.cloudFormation();

  const currentStack = await CloudFormationStack.lookup(cfn, deployName);
  if (!currentStack.exists) {
    return;
  }
  const monitor = options.quiet ? undefined : StackActivityMonitor.withDefaultPrinter(cfn, deployName, options.stack).start();

  try {
    await cfn.deleteStack({ StackName: deployName, RoleARN: options.roleArn }).promise();
    const destroyedStack = await waitForStackDelete(cfn, deployName);
    if (destroyedStack && destroyedStack.stackStatus.name !== 'DELETE_COMPLETE') {
      throw new Error(`Failed to destroy ${deployName}: ${destroyedStack.stackStatus}`);
    }
  } finally {
    if (monitor) { await monitor.stop(); }
  }
}

/**
 * Checks whether we can skip deployment
 *
 * We do this in a complicated way by preprocessing (instead of just
 * looking at the changeset), because if there are nested stacks involved
 * the changeset will always show the nested stacks as needing to be
 * updated, and the deployment will take a long time to in effect not
 * do anything.
 */
async function canSkipDeploy(
    deployStackOptions: DeployStackOptions,
    cloudFormationStack: CloudFormationStack,
    parameterChanges: boolean): Promise<boolean> {
  const deployName = deployStackOptions.deployName || deployStackOptions.stack.stackName;
  debug(`${deployName}: checking if we can skip deploy`);

  // Forced deploy
  if (deployStackOptions.force) {
    debug(`${deployName}: forced deployment`);
    return false;
  }

  // Creating changeset only (default true), never skip
  if (deployStackOptions.execute === false) {
    debug(`${deployName}: --no-execute, always creating change set`);
    return false;
  }

  // No existing stack
  if (!cloudFormationStack.exists) {
    debug(`${deployName}: no existing stack`);
    return false;
  }

  // Template has changed (assets taken into account here)
  if (JSON.stringify(deployStackOptions.stack.template) !== JSON.stringify(await cloudFormationStack.template())) {
    debug(`${deployName}: template has changed`);
    return false;
  }

  // Tags have changed
  if (!compareTags(cloudFormationStack.tags, deployStackOptions.tags ?? [])) {
    debug(`${deployName}: tags have changed`);
    return false;
  }

  // Termination protection has been updated
  if (!!deployStackOptions.stack.terminationProtection !== !!cloudFormationStack.terminationProtection) {
    debug(`${deployName}: termination protection has been updated`);
    return false;
  }

  // Parameters have changed
  if (parameterChanges) {
    debug(`${deployName}: parameters have changed`);
    return false;
  }

  // Existing stack is in a failed state
  if (cloudFormationStack.stackStatus.isFailure) {
    debug(`${deployName}: stack is in a failure state`);
    return false;
  }

  // We can skip deploy
  return true;
}

/**
 * Compares two list of tags, returns true if identical.
 */
function compareTags(a: Tag[], b: Tag[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (const aTag of a) {
    const bTag = b.find(tag => tag.Key === aTag.Key);

    if (!bTag || bTag.Value !== aTag.Value) {
      return false;
    }
  }

  return true;
}

/**
 * Format an S3 URL in the manifest for use with CloudFormation
 *
 * Replaces environment placeholders (which this field may contain),
 * and reformats s3://.../... urls into S3 REST URLs (which CloudFormation
 * expects)
 */
function restUrlFromManifest(url: string, environment: cxapi.Environment): string {
  const doNotUseMarker = '**DONOTUSE**';
  // This URL may contain placeholders, so still substitute those.
  url = cxapi.EnvironmentPlaceholders.replace(url, {
    accountId: environment.account,
    region: environment.region,
    partition: doNotUseMarker,
  });

  // Yes, this is extremely crude, but we don't actually need this so I'm not inclined to spend
  // a lot of effort trying to thread the right value to this location.
  if (url.indexOf(doNotUseMarker) > -1) {
    throw new Error('Cannot use \'${AWS::Partition}\' in the \'stackTemplateAssetObjectUrl\' field');
  }

  const s3Url = url.match(/s3:\/\/([^/]+)\/(.*)$/);
  if (!s3Url) { return url; }

  // We need to pass an 'https://s3.REGION.amazonaws.com[.cn]/bucket/object' URL to CloudFormation, but we
  // got an 's3://bucket/object' URL instead. Construct the rest API URL here.
  const bucketName = s3Url[1];
  const objectKey = s3Url[2];

  const urlSuffix: string = regionUtil.getEndpointSuffix(environment.region);
  return `https://s3.${environment.region}.${urlSuffix}/${bucketName}/${objectKey}`;
}