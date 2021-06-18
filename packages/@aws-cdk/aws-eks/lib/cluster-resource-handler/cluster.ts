/* eslint-disable no-console */

import { IsCompleteResponse, OnEventResponse } from '@aws-cdk/custom-resources/lib/provider-framework/types';
// eslint-disable-next-line import/no-extraneous-dependencies
import * as aws from 'aws-sdk';
import { EksClient, ResourceEvent, ResourceHandler } from './common';

const MAX_CLUSTER_NAME_LEN = 100;

export class ClusterResourceHandler extends ResourceHandler {
  public get clusterName() {
    if (!this.physicalResourceId) {
      throw new Error('Cannot determine cluster name without physical resource ID');
    }

    return this.physicalResourceId;
  }

  private readonly newProps: aws.EKS.CreateClusterRequest;
  private readonly oldProps: Partial<aws.EKS.CreateClusterRequest>;

  constructor(eks: EksClient, event: ResourceEvent) {
    super(eks, event);

    this.newProps = parseProps(this.event.ResourceProperties);
    this.oldProps = event.RequestType === 'Update' ? parseProps(event.OldResourceProperties) : { };
  }

  // ------
  // CREATE
  // ------

  protected async onCreate(): Promise<OnEventResponse> {
    console.log('onCreate: creating cluster with options:', JSON.stringify(this.newProps, undefined, 2));
    if (!this.newProps.roleArn) {
      throw new Error('"roleArn" is required');
    }

    const clusterName = this.newProps.name || this.generateClusterName();

    const resp = await this.eks.createCluster({
      ...this.newProps,
      name: clusterName,
    });

    if (!resp.cluster) {
      throw new Error(`Error when trying to create cluster ${clusterName}: CreateCluster returned without cluster information`);
    }

    return {
      PhysicalResourceId: resp.cluster.name,
    };
  }

  protected async isCreateComplete() {
    return this.isActive();
  }

  // ------
  // DELETE
  // ------

  protected async onDelete(): Promise<OnEventResponse> {
    console.log(`onDelete: deleting cluster ${this.clusterName}`);
    try {
      await this.eks.deleteCluster({ name: this.clusterName });
    } catch (e) {
      if (e.code !== 'ResourceNotFoundException') {
        throw e;
      } else {
        console.log(`cluster ${this.clusterName} not found, idempotently succeeded`);
      }
    }
    return {
      PhysicalResourceId: this.clusterName,
    };
  }

  protected async isDeleteComplete(): Promise<IsCompleteResponse> {
    console.log(`isDeleteComplete: waiting for cluster ${this.clusterName} to be deleted`);

    try {
      const resp = await this.eks.describeCluster({ name: this.clusterName });
      console.log('describeCluster returned:', JSON.stringify(resp, undefined, 2));
    } catch (e) {
      if (e.code === 'ResourceNotFoundException') {
        console.log('received ResourceNotFoundException, this means the cluster has been deleted (or never existed)');
        return { IsComplete: true };
      }

      console.log('describeCluster error:', e);
      throw e;
    }

    return {
      IsComplete: false,
    };
  }

  // ------
  // UPDATE
  // ------

  protected async onUpdate() {
    const updates = analyzeUpdate(this.oldProps, this.newProps);
    console.log('onUpdate:', JSON.stringify({ updates }, undefined, 2));

    // updates to encryption config is not supported
    if (updates.updateEncryption) {
      throw new Error('Cannot update cluster encryption configuration');
    }

    // if there is an update that requires replacement, go ahead and just create
    // a new cluster with the new config. The old cluster will automatically be
    // deleted by cloudformation upon success.
    if (updates.replaceName || updates.replaceRole || updates.replaceVpc) {
      // if we are replacing this cluster and the cluster has an explicit
      // physical name, the creation of the new cluster will fail with "there is
      // already a cluster with that name". this is a common behavior for
      // CloudFormation resources that support specifying a physical name.
      if (this.oldProps.name === this.newProps.name && this.oldProps.name) {
        throw new Error(`Cannot replace cluster "${this.oldProps.name}" since it has an explicit physical name. Either rename the cluster or remove the "name" configuration`);
      }

      return this.onCreate();
    }

    // if a version update is required, issue the version update
    if (updates.updateVersion) {
      if (!this.newProps.version) {
        throw new Error(`Cannot remove cluster version configuration. Current version is ${this.oldProps.version}`);
      }

      return this.updateClusterVersion(this.newProps.version);
    }

    if (updates.updateLogging || updates.updateAccess) {
      const config: aws.EKS.UpdateClusterConfigRequest = {
        name: this.clusterName,
        logging: this.newProps.logging,
      };
      if (updates.updateAccess) {
        // Updating the cluster with securityGroupIds and subnetIds (as specified in the warning here:
        // https://awscli.amazonaws.com/v2/documentation/api/latest/reference/eks/update-cluster-config.html)
        // will fail, therefore we take only the access fields explicitly
        config.resourcesVpcConfig = {
          endpointPrivateAccess: this.newProps.resourcesVpcConfig.endpointPrivateAccess,
          endpointPublicAccess: this.newProps.resourcesVpcConfig.endpointPublicAccess,
          publicAccessCidrs: this.newProps.resourcesVpcConfig.publicAccessCidrs,
        };
      }
      const updateResponse = await this.eks.updateClusterConfig(config);

      return { EksUpdateId: updateResponse.update?.id };
    }

    // no updates
    return;
  }

  protected async isUpdateComplete() {
    console.log('isUpdateComplete');

    // if this is an EKS update, we will monitor the update event itself
    if (this.event.EksUpdateId) {
      const complete = await this.isEksUpdateComplete(this.event.EksUpdateId);
      if (!complete) {
        return { IsComplete: false };
      }

      // fall through: if the update is done, we simply delegate to isActive()
      // in order to extract attributes and state from the cluster itself, which
      // is supposed to be in an ACTIVE state after the update is complete.
    }

    return this.isActive();
  }

  private async updateClusterVersion(newVersion: string) {
    console.log(`updating cluster version to ${newVersion}`);

    // update-cluster-version will fail if we try to update to the same version,
    // so skip in this case.
    const cluster = (await this.eks.describeCluster({ name: this.clusterName })).cluster;
    if (cluster?.version === newVersion) {
      console.log(`cluster already at version ${cluster.version}, skipping version update`);
      return;
    }

    const updateResponse = await this.eks.updateClusterVersion({ name: this.clusterName, version: newVersion });
    return { EksUpdateId: updateResponse.update?.id };
  }

  private async isActive(): Promise<IsCompleteResponse> {
    console.log('waiting for cluster to become ACTIVE');
    const resp = await this.eks.describeCluster({ name: this.clusterName });
    console.log('describeCluster result:', JSON.stringify(resp, undefined, 2));
    const cluster = resp.cluster;

    // if cluster is undefined (shouldnt happen) or status is not ACTIVE, we are
    // not complete. note that the custom resource provider framework forbids
    // returning attributes (Data) if isComplete is false.
    if (cluster?.status === 'FAILED') {
      // not very informative, unfortunately the response doesn't contain any error
      // information :\
      throw new Error('Cluster is in a FAILED status');
    } else if (cluster?.status !== 'ACTIVE') {
      return {
        IsComplete: false,
      };
    } else {
      return {
        IsComplete: true,
        Data: {
          Name: cluster.name,
          Endpoint: cluster.endpoint,
          Arn: cluster.arn,

          // IMPORTANT: CFN expects that attributes will *always* have values,
          // so return an empty string in case the value is not defined.
          // Otherwise, CFN will throw with `Vendor response doesn't contain
          // XXXX key`.

          CertificateAuthorityData: cluster.certificateAuthority?.data ?? '',
          ClusterSecurityGroupId: cluster.resourcesVpcConfig?.clusterSecurityGroupId ?? '',
          OpenIdConnectIssuerUrl: cluster.identity?.oidc?.issuer ?? '',
          OpenIdConnectIssuer: cluster.identity?.oidc?.issuer?.substring(8) ?? '', // Strips off https:// from the issuer url

          // We can safely return the first item from encryption configuration array, because it has a limit of 1 item
          // https://docs.aws.amazon.com/eks/latest/APIReference/API_CreateCluster.html#AmazonEKS-CreateCluster-request-encryptionConfig
          EncryptionConfigKeyArn: cluster.encryptionConfig?.shift()?.provider?.keyArn ?? '',
        },
      };
    }
  }

  private async isEksUpdateComplete(eksUpdateId: string) {
    this.log({ isEksUpdateComplete: eksUpdateId });

    const describeUpdateResponse = await this.eks.describeUpdate({
      name: this.clusterName,
      updateId: eksUpdateId,
    });

    this.log({ describeUpdateResponse });

    if (!describeUpdateResponse.update) {
      throw new Error(`unable to describe update with id "${eksUpdateId}"`);
    }

    switch (describeUpdateResponse.update.status) {
      case 'InProgress':
        return false;
      case 'Successful':
        return true;
      case 'Failed':
      case 'Cancelled':
        throw new Error(`cluster update id "${eksUpdateId}" failed with errors: ${JSON.stringify(describeUpdateResponse.update.errors)}`);
      default:
        throw new Error(`unknown status "${describeUpdateResponse.update.status}" for update id "${eksUpdateId}"`);
    }
  }

  private generateClusterName() {
    const suffix = this.requestId.replace(/-/g, ''); // 32 chars
    const prefix = this.logicalResourceId.substr(0, MAX_CLUSTER_NAME_LEN - suffix.length - 1);
    return `${prefix}-${suffix}`;
  }
}

function parseProps(props: any): aws.EKS.CreateClusterRequest {
  const parsed = props?.Config ?? { };

  // this is weird but these boolean properties are passed by CFN as a string, and we need them to be booleanic for the SDK.
  // Otherwise it fails with 'Unexpected Parameter: params.resourcesVpcConfig.endpointPrivateAccess is expected to be a boolean'

  if (typeof(parsed.resourcesVpcConfig?.endpointPrivateAccess) === 'string') {
    parsed.resourcesVpcConfig.endpointPrivateAccess = parsed.resourcesVpcConfig.endpointPrivateAccess === 'true';
  }

  if (typeof(parsed.resourcesVpcConfig?.endpointPublicAccess) === 'string') {
    parsed.resourcesVpcConfig.endpointPublicAccess = parsed.resourcesVpcConfig.endpointPublicAccess === 'true';
  }

  return parsed;
}

interface UpdateMap {
  replaceName: boolean; // name
  replaceVpc: boolean; // resourcesVpcConfig.subnetIds and securityGroupIds
  replaceRole: boolean; // roleArn

  updateVersion: boolean; // version
  updateLogging: boolean; // logging
  updateEncryption: boolean; // encryption (cannot be updated)
  updateAccess: boolean; // resourcesVpcConfig.endpointPrivateAccess and endpointPublicAccess
}

function analyzeUpdate(oldProps: Partial<aws.EKS.CreateClusterRequest>, newProps: aws.EKS.CreateClusterRequest): UpdateMap {
  console.log('old props: ', JSON.stringify(oldProps));
  console.log('new props: ', JSON.stringify(newProps));

  const newVpcProps = newProps.resourcesVpcConfig || { };
  const oldVpcProps = oldProps.resourcesVpcConfig || { };

  const oldPublicAccessCidrs = new Set(oldVpcProps.publicAccessCidrs ?? []);
  const newPublicAccessCidrs = new Set(newVpcProps.publicAccessCidrs ?? []);
  const newEnc = newProps.encryptionConfig || { };
  const oldEnc = oldProps.encryptionConfig || { };

  return {
    replaceName: newProps.name !== oldProps.name,
    replaceVpc:
      JSON.stringify(newVpcProps.subnetIds) !== JSON.stringify(oldVpcProps.subnetIds) ||
      JSON.stringify(newVpcProps.securityGroupIds) !== JSON.stringify(oldVpcProps.securityGroupIds),
    updateAccess:
      newVpcProps.endpointPrivateAccess !== oldVpcProps.endpointPrivateAccess ||
      newVpcProps.endpointPublicAccess !== oldVpcProps.endpointPublicAccess ||
      !setsEqual(newPublicAccessCidrs, oldPublicAccessCidrs),
    replaceRole: newProps.roleArn !== oldProps.roleArn,
    updateVersion: newProps.version !== oldProps.version,
    updateEncryption: JSON.stringify(newEnc) !== JSON.stringify(oldEnc),
    updateLogging: JSON.stringify(newProps.logging) !== JSON.stringify(oldProps.logging),
  };
}

function setsEqual(first: Set<string>, second: Set<string>) {
  return first.size === second.size || [...first].every((e: string) => second.has(e));
}