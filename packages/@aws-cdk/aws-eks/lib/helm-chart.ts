import { Policy, PolicyStatement } from '@aws-cdk/aws-iam';
import { Asset } from '@aws-cdk/aws-s3-assets';
import { CustomResource, Duration, Names, Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { ICluster } from './cluster';
import { KubectlProvider } from './kubectl-provider';

// v2 - keep this import as a separate section to reduce merge conflict when forward merging with the v2 branch.
// eslint-disable-next-line
import { Construct as CoreConstruct } from '@aws-cdk/core';

/**
 * Helm Chart options.
 */

export interface HelmChartOptions {
  /**
   * The name of the chart or an Asset.
   */
  readonly chart: string | Asset;

  /**
   * The name of the release.
   * @default - If no release name is given, it will use the last 53 characters of the node's unique id.
   */
  readonly release?: string;

  /**
   * The chart version to install.
   * @default - If this is not specified, the latest version is installed
   */
  readonly version?: string;

  /**
   * The repository which contains the chart. For example: https://kubernetes-charts.storage.googleapis.com/
   * @default - No repository will be used, which means that the chart needs to be an absolute URL.
   */
  readonly repository?: string;

  /**
   * The Kubernetes namespace scope of the requests.
   * @default default
   */
  readonly namespace?: string;

  /**
   * The values to be used by the chart.
   * @default - No values are provided to the chart.
   */
  readonly values?: {[key: string]: any};

  /**
   * Whether or not Helm should wait until all Pods, PVCs, Services, and minimum number of Pods of a
   * Deployment, StatefulSet, or ReplicaSet are in a ready state before marking the release as successful.
   * @default - Helm will not wait before marking release as successful
   */
  readonly wait?: boolean;

  /**
   * Amount of time to wait for any individual Kubernetes operation. Maximum 15 minutes.
   * @default Duration.minutes(5)
   */
  readonly timeout?: Duration;

  /**
   * create namespace if not exist
   * @default true
   */
  readonly createNamespace?: boolean;
}

/**
 * Helm Chart properties.
 */
export interface HelmChartProps extends HelmChartOptions {
  /**
   * The EKS cluster to apply this configuration to.
   *
   * [disable-awslint:ref-via-interface]
   */
  readonly cluster: ICluster;
}

/**
 * Represents a helm chart within the Kubernetes system.
 *
 * Applies/deletes the resources using `kubectl` in sync with the resource.
 */
export class HelmChart extends CoreConstruct {
  /**
   * The CloudFormation resource type.
   */
  public static readonly RESOURCE_TYPE = 'Custom::AWSCDK-EKS-HelmChart';

  constructor(scope: Construct, id: string, props: HelmChartProps) {
    super(scope, id);

    const stack = Stack.of(this);

    const provider = KubectlProvider.getOrCreate(this, props.cluster);

    const timeout = props.timeout?.toSeconds();
    if (timeout && timeout > 900) {
      throw new Error('Helm chart timeout cannot be higher than 15 minutes.');
    }

    // default not to wait
    const wait = props.wait ?? false;
    // default to create new namespace
    const createNamespace = props.createNamespace ?? true;


    let chartAssetPolicy: Policy | undefined = undefined;

    if (typeof props.chart !== 'string') {
      // Use of props.chart.grantRead(provider.handlerRole) causes a
      // dependency loop as it causes the cluster to depend on the
      // asset.
      chartAssetPolicy = new Policy(this, 'ChartAssetPolicy', {
        roles: [provider.handlerRole],
        statements: [new PolicyStatement({
          actions: [
            's3:GetObject*',
            's3:GetBucket*',
            's3:List*',
          ],
          resources: [
            props.chart.bucket.bucketArn,
            props.chart.bucket.arnForObjects('*'),
          ],
        })],
      });
    }

    const cr = new CustomResource(this, 'Resource', {
      serviceToken: provider.serviceToken,
      resourceType: HelmChart.RESOURCE_TYPE,
      properties: {
        ClusterName: props.cluster.clusterName,
        RoleArn: provider.roleArn, // TODO: bake into the provider's environment
        Release: props.release ?? Names.uniqueId(this).slice(-53).toLowerCase(), // Helm has a 53 character limit for the name
        Chart: typeof props.chart === 'string' ? props.chart : props.chart.s3ObjectUrl,
        Version: props.version,
        Wait: wait || undefined, // props are stringified so we encode “false” as undefined
        Timeout: timeout ? `${timeout.toString()}s` : undefined, // Helm v3 expects duration instead of integer
        Values: (props.values ? stack.toJsonString(props.values) : undefined),
        Namespace: props.namespace ?? 'default',
        Repository: props.repository,
        CreateNamespace: createNamespace || undefined,
      },
    });

    if (chartAssetPolicy) {
      cr.node.addDependency(chartAssetPolicy);
    }
  }
}
