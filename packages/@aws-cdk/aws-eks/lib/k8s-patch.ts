import { CustomResource, Stack } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { ICluster } from './cluster';
import { KubectlProvider } from './kubectl-provider';

// v2 - keep this import as a separate section to reduce merge conflict when forward merging with the v2 branch.
// eslint-disable-next-line
import { Construct as CoreConstruct } from '@aws-cdk/core';

/**
 * Properties for KubernetesPatch
 */
export interface KubernetesPatchProps {
  /**
   * The cluster to apply the patch to.
   * [disable-awslint:ref-via-interface]
   */
  readonly cluster: ICluster;

  /**
   * The JSON object to pass to `kubectl patch` when the resource is created/updated.
   */
  readonly applyPatch: { [key: string]: any };

  /**
   * The JSON object to pass to `kubectl patch` when the resource is removed.
   */
  readonly restorePatch: { [key: string]: any };

  /**
   * The full name of the resource to patch (e.g. `deployment/coredns`).
   */
  readonly resourceName: string;

  /**
   * The kubernetes API namespace
   *
   * @default "default"
   */
  readonly resourceNamespace?: string;

  /**
   * The patch type to pass to `kubectl patch`.
   * The default type used by `kubectl patch` is "strategic".
   *
   * @default PatchType.STRATEGIC
   */
  readonly patchType?: PatchType;
}

/**
 * Values for `kubectl patch` --type argument
 */
export enum PatchType {
  /**
   * JSON Patch, RFC 6902
   */
  JSON = 'json',
  /**
   * JSON Merge patch
   */
  MERGE = 'merge',
  /**
   * Strategic merge patch
   */
  STRATEGIC = 'strategic'
}

/**
 * A CloudFormation resource which applies/restores a JSON patch into a
 * Kubernetes resource.
 * @see https://kubernetes.io/docs/tasks/run-application/update-api-object-kubectl-patch/
 */
export class KubernetesPatch extends CoreConstruct {
  constructor(scope: Construct, id: string, props: KubernetesPatchProps) {
    super(scope, id);

    const stack = Stack.of(this);
    const provider = KubectlProvider.getOrCreate(this, props.cluster);

    new CustomResource(this, 'Resource', {
      serviceToken: provider.serviceToken,
      resourceType: 'Custom::AWSCDK-EKS-KubernetesPatch',
      properties: {
        KubeConfig: provider.kubeConfig,
        ResourceName: props.resourceName,
        ResourceNamespace: props.resourceNamespace ?? 'default',
        ApplyPatchJson: stack.toJsonString(props.applyPatch),
        RestorePatchJson: stack.toJsonString(props.restorePatch),
        PatchType: props.patchType ?? PatchType.STRATEGIC,
      },
    });
  }
}
