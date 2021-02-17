import { expect } from '@aws-cdk/assert';
import { Stack, Duration } from '@aws-cdk/core';
import { Test } from 'nodeunit';
import * as eks from '../lib';
import { KubernetesObjectValue } from '../lib/k8s-object-value';

const CLUSTER_VERSION = eks.KubernetesVersion.V1_16;

export = {

  'creates the correct custom resource with explicit values for all properties'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const cluster = new eks.Cluster(stack, 'MyCluster', { version: CLUSTER_VERSION });

    // WHEN
    const attribute = new KubernetesObjectValue(stack, 'MyAttribute', {
      cluster: cluster,
      jsonPath: '.status',
      objectName: 'mydeployment',
      objectType: 'deployment',
      objectNamespace: 'mynamespace',
      timeout: Duration.seconds(5),
    });

    const expectedCustomResourceId = 'MyAttributeF1E9B10D';
    test.deepEqual(expect(stack).value.Resources[expectedCustomResourceId], {
      Type: 'Custom::AWSCDK-EKS-KubernetesObjectValue',
      Properties: {
        ServiceToken: {
          'Fn::GetAtt': [
            'awscdkawseksKubectlProviderNestedStackawscdkawseksKubectlProviderNestedStackResourceA7AEBA6B',
            'Outputs.awscdkawseksKubectlProviderframeworkonEvent0A650005Arn',
          ],
        },
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
        ObjectType: 'deployment',
        ObjectName: 'mydeployment',
        ObjectNamespace: 'mynamespace',
        JsonPath: '.status',
        TimeoutSeconds: 5,
      },
      DependsOn: ['MyClusterKubectlReadyBarrier7547948A'],
      UpdateReplacePolicy: 'Delete',
      DeletionPolicy: 'Delete',
    });

    test.deepEqual(stack.resolve(attribute.value), { 'Fn::GetAtt': [expectedCustomResourceId, 'Value'] });
    test.done();
  },

  'creates the correct custom resource with defaults'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const cluster = new eks.Cluster(stack, 'MyCluster', { version: CLUSTER_VERSION });

    // WHEN
    const attribute = new KubernetesObjectValue(stack, 'MyAttribute', {
      cluster: cluster,
      jsonPath: '.status',
      objectName: 'mydeployment',
      objectType: 'deployment',
    });

    const expectedCustomResourceId = 'MyAttributeF1E9B10D';
    test.deepEqual(expect(stack).value.Resources[expectedCustomResourceId], {
      Type: 'Custom::AWSCDK-EKS-KubernetesObjectValue',
      Properties: {
        ServiceToken: {
          'Fn::GetAtt': [
            'awscdkawseksKubectlProviderNestedStackawscdkawseksKubectlProviderNestedStackResourceA7AEBA6B',
            'Outputs.awscdkawseksKubectlProviderframeworkonEvent0A650005Arn',
          ],
        },
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
        ObjectType: 'deployment',
        ObjectName: 'mydeployment',
        ObjectNamespace: 'default',
        JsonPath: '.status',
        TimeoutSeconds: 300,
      },
      DependsOn: ['MyClusterKubectlReadyBarrier7547948A'],
      UpdateReplacePolicy: 'Delete',
      DeletionPolicy: 'Delete',
    });

    test.deepEqual(stack.resolve(attribute.value), { 'Fn::GetAtt': [expectedCustomResourceId, 'Value'] });
    test.done();
  },

};
