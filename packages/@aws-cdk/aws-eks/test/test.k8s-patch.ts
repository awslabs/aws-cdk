import { expect, haveResource } from '@aws-cdk/assert';
import { Names, Stack } from '@aws-cdk/core';
import { Test } from 'nodeunit';
import * as eks from '../lib';
import { KubernetesPatch, PatchType } from '../lib/k8s-patch';

const CLUSTER_VERSION = eks.KubernetesVersion.V1_16;

export = {
  'applies a patch to k8s'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const cluster = new eks.Cluster(stack, 'MyCluster', { version: CLUSTER_VERSION });

    // WHEN
    const patch = new KubernetesPatch(stack, 'MyPatch', {
      cluster,
      applyPatch: { patch: { to: 'apply' } },
      restorePatch: { restore: { patch: 123 } },
      resourceName: 'myResourceName',
    });

    // THEN
    expect(stack).to(haveResource('Custom::AWSCDK-EKS-KubernetesPatch', {
      ServiceToken: {
        'Fn::GetAtt': [
          'awscdkawseksKubectlProviderNestedStackawscdkawseksKubectlProviderNestedStackResourceA7AEBA6B',
          'Outputs.awscdkawseksKubectlProviderframeworkonEvent0A650005Arn',
        ],
      },
      ResourceName: 'myResourceName',
      ResourceNamespace: 'default',
      ApplyPatchJson: '{"patch":{"to":"apply"}}',
      RestorePatchJson: '{"restore":{"patch":123}}',
      KubeConfig: {
        'Fn::Join': [
          '',
          [
            '{"apiVersion":"v1","kind":"Config","clusters":[{"name":"default","cluster":{"certificate-authority-data":"',
            {
              'Fn::GetAtt': ['MyCluster8AD82BF8', 'CertificateAuthorityData'],
            },
            '","server":"',
            { 'Fn::GetAtt': ['MyCluster8AD82BF8', 'Endpoint'] },
            '"}}],"users":[{"name":"default","user":{"exec":{"apiVersion":"client.authentication.k8s.io/v1alpha1","command":"aws","args":["--region","',
            { Ref: 'AWS::Region' },
            '","eks","get-token","--cluster-name","',
            { Ref: 'MyCluster8AD82BF8' },
            '","--role","',
            { 'Fn::GetAtt': ['MyClusterCreationRoleB5FA4FF3', 'Arn'] },
            '"]}}}],"contexts":[{"name":"default","context":{"cluster":"default","user":"default"}}],"current-context":"default"}',
          ],
        ],
      },
    }));

    // also make sure a dependency on the barrier is added to the patch construct.
    test.deepEqual(patch.node.dependencies.map(d => Names.nodeUniqueId(d.target.node)), ['MyClusterKubectlReadyBarrier7547948A']);

    test.done();
  },
  'defaults to "strategic" patch type if no patchType is specified'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const cluster = new eks.Cluster(stack, 'MyCluster', { version: CLUSTER_VERSION });

    // WHEN
    new KubernetesPatch(stack, 'MyPatch', {
      cluster,
      applyPatch: { patch: { to: 'apply' } },
      restorePatch: { restore: { patch: 123 } },
      resourceName: 'myResourceName',
    });
    expect(stack).to(haveResource('Custom::AWSCDK-EKS-KubernetesPatch', {
      PatchType: 'strategic',
    }));
    test.done();
  },
  'uses specified to patch type if specified'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const cluster = new eks.Cluster(stack, 'MyCluster', { version: CLUSTER_VERSION });

    // WHEN
    new KubernetesPatch(stack, 'jsonPatch', {
      cluster,
      applyPatch: { patch: { to: 'apply' } },
      restorePatch: { restore: { patch: 123 } },
      resourceName: 'jsonPatchResource',
      patchType: PatchType.JSON,
    });
    new KubernetesPatch(stack, 'mergePatch', {
      cluster,
      applyPatch: { patch: { to: 'apply' } },
      restorePatch: { restore: { patch: 123 } },
      resourceName: 'mergePatchResource',
      patchType: PatchType.MERGE,
    });
    new KubernetesPatch(stack, 'strategicPatch', {
      cluster,
      applyPatch: { patch: { to: 'apply' } },
      restorePatch: { restore: { patch: 123 } },
      resourceName: 'strategicPatchResource',
      patchType: PatchType.STRATEGIC,
    });

    expect(stack).to(haveResource('Custom::AWSCDK-EKS-KubernetesPatch', {
      ResourceName: 'jsonPatchResource',
      PatchType: 'json',
    }));
    expect(stack).to(haveResource('Custom::AWSCDK-EKS-KubernetesPatch', {
      ResourceName: 'mergePatchResource',
      PatchType: 'merge',
    }));
    expect(stack).to(haveResource('Custom::AWSCDK-EKS-KubernetesPatch', {
      ResourceName: 'strategicPatchResource',
      PatchType: 'strategic',
    }));
    test.done();
  },
};
