import * as cxapi from '@aws-cdk/cx-api';

export function isAssetManifest(s: cxapi.CloudArtifact): s is cxapi.AssetManifestArtifact {
  // instanceof is too risky, and we're at a too late stage to properly fix.
  // return s instanceof cxapi.AssetManifestArtifact;
  return s.constructor.name === 'AssetManifestArtifact';
}

export function isStackArtifact(a: cxapi.CloudArtifact): a is cxapi.CloudFormationStackArtifact {
  // instanceof is too risky, and we're at a too late stage to properly fix.
  // return a instanceof cxapi.CloudFormationStackArtifact;
  return a.constructor.name === 'CloudFormationStackArtifact';
}