import * as path from 'path';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import { Duration, Stack, NestedStack, Names } from '@aws-cdk/core';
import * as cr from '@aws-cdk/custom-resources';
import { AwsCliLayer } from '@aws-cdk/lambda-layer-awscli';
import { KubectlLayer } from '@aws-cdk/lambda-layer-kubectl';
import { Construct } from 'constructs';
import { ICluster, Cluster } from './cluster';

// v2 - keep this import as a separate section to reduce merge conflict when forward merging with the v2 branch.
// eslint-disable-next-line
import { Construct as CoreConstruct } from '@aws-cdk/core';

export interface KubectlProviderProps {
  /**
   * The cluster to control.
   */
  readonly cluster: ICluster;
}

export class KubectlProvider extends NestedStack {

  public static getOrCreate(scope: Construct, cluster: ICluster) {
    // if this is an "owned" cluster, it has a provider associated with it
    if (cluster instanceof Cluster) {
      return cluster._attachKubectlResourceScope(scope);
    }

    // if this is an imported cluster, we need to provision a custom resource provider in this stack
    // we will define one per stack for each cluster based on the cluster uniqueid
    const uid = `${Names.nodeUniqueId(cluster.node)}-KubectlProvider`;
    const stack = Stack.of(scope);
    let provider = stack.node.tryFindChild(uid) as KubectlProvider;
    if (!provider) {
      provider = new KubectlProvider(stack, uid, { cluster });
    }

    return provider;
  }

  /**
   * The custom resource provider's service token.
   */
  public readonly serviceToken: string;

  /**
   * The IAM execution role of the handler.
   */
  public readonly handlerRole: iam.IRole;

  /**
   * The kubeconfig configuration used to connect to the cluster.
   */
  public readonly kubeConfig: string;

  public constructor(scope: Construct, id: string, props: KubectlProviderProps) {
    super(scope as CoreConstruct, id);

    const cluster = props.cluster;

    if (!cluster.kubectlRole) {
      throw new Error('"kubectlRole" is not defined, cannot issue kubectl commands against this cluster');
    }

    if (cluster.kubectlPrivateSubnets && !cluster.kubectlSecurityGroup) {
      throw new Error('"kubectlSecurityGroup" is required if "kubectlSubnets" is specified');
    }

    const memorySize = cluster.kubectlMemory ? cluster.kubectlMemory.toMebibytes() : 1024;

    const handler = new lambda.Function(this, 'Handler', {
      code: lambda.Code.fromAsset(path.join(__dirname, 'kubectl-handler')),
      runtime: lambda.Runtime.PYTHON_3_7,
      handler: 'index.handler',
      timeout: Duration.minutes(15),
      description: 'onEvent handler for EKS kubectl resource provider',
      memorySize,
      environment: cluster.kubectlEnvironment,

      // defined only when using private access
      vpc: cluster.kubectlPrivateSubnets ? cluster.vpc : undefined,
      securityGroups: cluster.kubectlSecurityGroup ? [cluster.kubectlSecurityGroup] : undefined,
      vpcSubnets: cluster.kubectlPrivateSubnets ? { subnets: cluster.kubectlPrivateSubnets } : undefined,
    });

    // allow user to customize the layer
    if (!props.cluster.kubectlLayer) {
      handler.addLayers(new AwsCliLayer(this, 'AwsCliLayer'));
      handler.addLayers(new KubectlLayer(this, 'KubectlLayer'));
    } else {
      handler.addLayers(props.cluster.kubectlLayer);
    }

    this.handlerRole = handler.role!;

    this.handlerRole.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['eks:DescribeCluster'],
      resources: [cluster.clusterArn],
    }));

    // allow this handler to assume the kubectl role
    cluster.kubectlRole.grant(this.handlerRole, 'sts:AssumeRole');

    const provider = new cr.Provider(this, 'Provider', {
      onEventHandler: handler,
      vpc: cluster.kubectlPrivateSubnets ? cluster.vpc : undefined,
      vpcSubnets: cluster.kubectlPrivateSubnets ? { subnets: cluster.kubectlPrivateSubnets } : undefined,
    });

    this.serviceToken = provider.serviceToken;
    this.kubeConfig = this.kubeConfigFor(cluster);
  }

  kubeConfigFor(cluster: ICluster): string {
    const stack = Stack.of(this);

    // This duplicates the result of `aws eks update-kubeconfig`, but
    // allows extension to non-EKS k8s clusters.
    // See https://docs.aws.amazon.com/eks/latest/userguide/create-kubeconfig.html#create-kubeconfig-manually
    const kubeconfig = {
      'apiVersion': 'v1',
      'kind': 'Config',
      'clusters': [{
        name: 'default',
        cluster: {
          'certificate-authority-data': cluster.clusterCertificateAuthorityData,
          'server': cluster.clusterEndpoint,
        },
      }],
      'users': [{
        name: 'default',
        user: {
          exec: {
            apiVersion: 'client.authentication.k8s.io/v1alpha1',
            command: 'aws',
            args: [
              '--region', stack.region,
              'eks',
              'get-token',
              '--cluster-name', cluster.clusterName,
              '--role', cluster.kubectlRole!.roleArn,
            ],
          },
        },
      }],
      'contexts': [{
        name: 'default',
        context: {
          cluster: 'default',
          user: 'default',
        },
      }],
      'current-context': 'default',
    };

    return stack.toJsonString(kubeconfig);
  }
}
