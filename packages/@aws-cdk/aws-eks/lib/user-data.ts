import * as autoscaling from '@aws-cdk/aws-autoscaling';
import { Stack } from '@aws-cdk/core';
import { BootstrapOptions, ICluster, Cluster } from './cluster';

// eslint-disable-next-line max-len
export function renderAmazonLinuxUserData(cluster: Cluster, autoScalingGroup: autoscaling.AutoScalingGroup, options: BootstrapOptions = {}): string[] {
  const stack = Stack.of(autoScalingGroup);

  // determine logical id of ASG so we can signal cloudformation
  const cfn = autoScalingGroup.node.defaultChild as autoscaling.CfnAutoScalingGroup;
  const asgLogicalId = cfn.logicalId;

  const extraArgs = new Array<string>();

  extraArgs.push(`--apiserver-endpoint '${cluster.clusterEndpoint}'`);
  extraArgs.push(`--b64-cluster-ca '${cluster.clusterCertificateAuthorityData}'`);

  extraArgs.push(`--use-max-pods ${options.useMaxPods ?? true}`);

  if (options.awsApiRetryAttempts) {
    extraArgs.push(`--aws-api-retry-attempts ${options.awsApiRetryAttempts}`);
  }

  if (options.enableDockerBridge) {
    extraArgs.push('--enable-docker-bridge true');
  }

  if (options.dockerConfigJson) {
    extraArgs.push(`--docker-config-json '${options.dockerConfigJson}'`);
  }

  if (options.dnsClusterIp) {
    extraArgs.push(`--dns-cluster-ip ${options.dnsClusterIp}`);
  }

  if (options.additionalArgs) {
    extraArgs.push(options.additionalArgs);
  }

  const commandLineSuffix = extraArgs.join(' ');
  const kubeletExtraArgsSuffix = options.kubeletExtraArgs || '';

  // determine lifecycle label based on whether the ASG has a spot price.
  const lifecycleLabel = autoScalingGroup.spotPrice ? LifecycleLabel.SPOT : LifecycleLabel.ON_DEMAND;
  const withTaints = autoScalingGroup.spotPrice ? '--register-with-taints=spotInstance=true:PreferNoSchedule' : '';
  const kubeletExtraArgs = `--node-labels lifecycle=${lifecycleLabel} ${withTaints} ${kubeletExtraArgsSuffix}`.trim();

  return [
    'set -o xtrace',
    `/etc/eks/bootstrap.sh ${cluster.clusterName} --kubelet-extra-args "${kubeletExtraArgs}" ${commandLineSuffix}`.trim(),
    `/opt/aws/bin/cfn-signal --exit-code $? --stack ${stack.stackName} --resource ${asgLogicalId} --region ${stack.region}`,
  ];
}

export function renderBottlerocketUserData(cluster: ICluster): string[] {
  return [
    '[settings.kubernetes]',
    `api-server="${cluster.clusterEndpoint}"`,
    `cluster-certificate="${cluster.clusterCertificateAuthorityData}"`,
    `cluster-name="${cluster.clusterName}"`,
  ];
}

/**
 * The lifecycle label for node selector
 */
export enum LifecycleLabel {
  /**
   * on-demand instances
   */
  ON_DEMAND = 'OnDemand',
  /**
   * spot instances
   */
  SPOT = 'Ec2Spot'
}
