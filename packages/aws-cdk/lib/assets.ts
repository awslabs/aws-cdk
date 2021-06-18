// eslint-disable-next-line max-len
import * as path from 'path';
import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import * as cxapi from '@aws-cdk/cx-api';
import * as colors from 'colors';
import { ToolkitInfo } from './api/toolkit-info';
import { debug } from './logging';
import { AssetManifestBuilder } from './util/asset-manifest-builder';

/**
 * Take the metadata assets from the given stack and add them to the given asset manifest
 *
 * Returns the CloudFormation parameters that need to be sent to the template to
 * pass Asset coordinates.
 */
// eslint-disable-next-line max-len
export async function addMetadataAssetsToManifest(stack: cxapi.CloudFormationStackArtifact, assetManifest: AssetManifestBuilder, toolkitInfo: ToolkitInfo, reuse?: string[]): Promise<Record<string, string>> {
  reuse = reuse || [];
  const assets = stack.assets;

  if (assets.length === 0) {
    return {};
  }

  if (!toolkitInfo.found) {
    // eslint-disable-next-line max-len
    throw new Error(`This stack uses assets, so the toolkit stack must be deployed to the environment (Run "${colors.blue('cdk bootstrap ' + stack.environment!.name)}")`);
  }

  const params: Record<string, string> = {};

  for (const asset of assets) {
    // FIXME: Should have excluded by construct path here instead of by unique ID, preferably using
    // minimatch so we can support globs. Maybe take up during artifact refactoring.
    const reuseAsset = reuse.indexOf(asset.id) > -1;

    if (reuseAsset) {
      debug(`Reusing asset ${asset.id}: ${JSON.stringify(asset)}`);
      continue;
    }

    debug(`Preparing asset ${asset.id}: ${JSON.stringify(asset)}`);
    if (!stack.assembly) {
      throw new Error('Unexpected: stack assembly is required in order to find assets in assemly directory');
    }

    Object.assign(params, await prepareAsset(asset, assetManifest, toolkitInfo));
  }

  return params;
}

// eslint-disable-next-line max-len
async function prepareAsset(asset: cxschema.AssetMetadataEntry, assetManifest: AssetManifestBuilder, toolkitInfo: ToolkitInfo): Promise<Record<string, string>> {
  switch (asset.packaging) {
    case 'zip':
    case 'file':
      return prepareFileAsset(
        asset,
        assetManifest,
        toolkitInfo,
        asset.packaging === 'zip' ? cxschema.FileAssetPackaging.ZIP_DIRECTORY : cxschema.FileAssetPackaging.FILE);
    case 'container-image':
      return prepareDockerImageAsset(asset, assetManifest, toolkitInfo);
    default:
      // eslint-disable-next-line max-len
      throw new Error(`Unsupported packaging type: ${(asset as any).packaging}. You might need to upgrade your aws-cdk toolkit to support this asset type.`);
  }
}

function prepareFileAsset(
    asset: cxschema.FileAssetMetadataEntry,
    assetManifest: AssetManifestBuilder,
    toolkitInfo: ToolkitInfo,
    packaging: cxschema.FileAssetPackaging): Record<string, string> {
  const extension = packaging === cxschema.FileAssetPackaging.ZIP_DIRECTORY ? '.zip' : path.extname(asset.path);
  const baseName = `${asset.sourceHash}${extension}`;
  // Simplify key: assets/abcdef/abcdef.zip is kinda silly and unnecessary, so if they're the same just pick one component.
  const s3Prefix = asset.id === asset.sourceHash ? 'assets/' : `assets/${asset.id}/`;
  const key = `${s3Prefix}${baseName}`;
  const s3url = `s3://${toolkitInfo.bucketName}/${key}`;

  debug(`Storing asset ${asset.path} at ${s3url}`);

  assetManifest.addFileAsset(asset.sourceHash, {
    path: asset.path,
    packaging,
  }, {
    bucketName: toolkitInfo.bucketName,
    objectKey: key,
  });

  return {
    [asset.s3BucketParameter]: toolkitInfo.bucketName,
    [asset.s3KeyParameter]: `${s3Prefix}${cxapi.ASSET_PREFIX_SEPARATOR}${baseName}`,
    [asset.artifactHashParameter]: asset.sourceHash,
  };
}

async function prepareDockerImageAsset(
    asset: cxschema.ContainerImageAssetMetadataEntry,
    assetManifest: AssetManifestBuilder,
    toolkitInfo: ToolkitInfo): Promise<Record<string, string>> {
  // Pre-1.21.0, repositoryName can be specified by the user or can be left out, in which case we make
  // a per-asset repository which will get adopted and cleaned up along with the stack.
  // Post-1.21.0, repositoryName will always be specified and it will be a shared repository between
  // all assets, and asset will have imageTag specified as well. Validate the combination.
  if (!asset.imageNameParameter && (!asset.repositoryName || !asset.imageTag)) {
    throw new Error('Invalid Docker image asset configuration: "repositoryName" and "imageTag" are required when "imageNameParameter" is left out');
  }

  const repositoryName = asset.repositoryName ?? 'cdk/' + asset.id.replace(/[:/]/g, '-').toLowerCase();

  // Make sure the repository exists, since the 'cdk-assets' tool will not create it for us.
  const { repositoryUri } = await toolkitInfo.prepareEcrRepository(repositoryName);
  const imageTag = asset.imageTag ?? asset.sourceHash;

  assetManifest.addDockerImageAsset(asset.sourceHash, {
    directory: asset.path,
    dockerBuildArgs: asset.buildArgs,
    dockerBuildTarget: asset.target,
    dockerFile: asset.file,
  }, {
    repositoryName,
    imageTag,
  });

  if (!asset.imageNameParameter) { return {}; }
  return { [asset.imageNameParameter]: `${repositoryUri}:${imageTag}` };
}