import { expect, haveResource, SynthUtils } from '@aws-cdk/assert';
import { Stack } from '@aws-cdk/core';
import { Test } from 'nodeunit';
import { Cluster, KubernetesManifest, KubernetesVersion, HelmChart } from '../lib';
import { testFixtureNoVpc, testFixtureCluster } from './util';

/* eslint-disable max-len */

const CLUSTER_VERSION = KubernetesVersion.V1_16;

export = {
  'basic usage'(test: Test) {
    // GIVEN
    const { stack } = testFixtureNoVpc();
    const cluster = new Cluster(stack, 'cluster', { version: CLUSTER_VERSION });

    const manifest = [
      {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
          name: 'hello-kubernetes',
        },
        spec: {
          type: 'LoadBalancer',
          ports: [
            { port: 80, targetPort: 8080 },
          ],
          selector: {
            app: 'hello-kubernetes',
          },
        },
      },
      {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: 'hello-kubernetes',
        },
        spec: {
          replicas: 2,
          selector: {
            matchLabels: {
              app: 'hello-kubernetes',
            },
          },
          template: {
            metadata: {
              labels: {
                app: 'hello-kubernetes',
              },
            },
            spec: {
              containers: [
                {
                  name: 'hello-kubernetes',
                  image: 'paulbouwer/hello-kubernetes:1.5',
                  ports: [
                    { containerPort: 8080 },
                  ],
                },
              ],
            },
          },
        },
      },
    ];

    // WHEN
    new KubernetesManifest(stack, 'manifest', {
      cluster,
      manifest,
    });

    expect(stack).to(haveResource(KubernetesManifest.RESOURCE_TYPE, {
      Manifest: JSON.stringify(manifest),
    }));
    test.done();
  },

  'can be added to an imported cluster with minimal config'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const cluster = Cluster.fromClusterAttributes(stack, 'MyCluster', {
      clusterName: 'my-cluster-name',
      kubectlRoleArn: 'arn:aws:iam::1111111:role/iam-role-that-has-masters-access',
      clusterEndpoint: 'https://mycluster',
      clusterCertificateAuthorityData: 'CADATA',
    });

    // WHEN
    cluster.addManifest('foo', { bar: 2334 });
    cluster.addHelmChart('helm', { chart: 'hello-world' });

    // THEN
    expect(stack).to(haveResource(KubernetesManifest.RESOURCE_TYPE, {
      Manifest: '[{"bar":2334}]',
      KubeConfig: {
        'Fn::Join': [
          '',
          [
            '{"apiVersion":"v1","kind":"Config","clusters":[{"name":"default","cluster":{"certificate-authority-data":"CADATA","server":"https://mycluster"}}],"users":[{"name":"default","user":{"exec":{"apiVersion":"client.authentication.k8s.io/v1alpha1","command":"aws","args":["--region","',
            {
              Ref: 'AWS::Region',
            },
            '","eks","get-token","--cluster-name","my-cluster-name","--role","arn:aws:iam::1111111:role/iam-role-that-has-masters-access"]}}}],"contexts":[{"name":"default","context":{"cluster":"default","user":"default"}}],"current-context":"default"}',
          ],
        ],
      },
    }));

    expect(stack).to(haveResource(HelmChart.RESOURCE_TYPE, {
      Release: 'myclustercharthelm78d2c26a',
      Chart: 'hello-world',
      Namespace: 'default',
      CreateNamespace: true,
      KubeConfig: {
        'Fn::Join': [
          '',
          [
            '{"apiVersion":"v1","kind":"Config","clusters":[{"name":"default","cluster":{"certificate-authority-data":"CADATA","server":"https://mycluster"}}],"users":[{"name":"default","user":{"exec":{"apiVersion":"client.authentication.k8s.io/v1alpha1","command":"aws","args":["--region","',
            {
              Ref: 'AWS::Region',
            },
            '","eks","get-token","--cluster-name","my-cluster-name","--role","arn:aws:iam::1111111:role/iam-role-that-has-masters-access"]}}}],"contexts":[{"name":"default","context":{"cluster":"default","user":"default"}}],"current-context":"default"}',
          ],
        ],
      },
    }));

    test.done();
  },

  'prune labels': {

    'base case'(test: Test) {
      // GIVEN
      const { stack } = testFixtureNoVpc();

      // prune is enabled by default
      const cluster = new Cluster(stack, 'Cluster', {
        version: KubernetesVersion.V1_16,
      });

      test.equal(cluster.prune, true, '"prune" is enabled by default');

      // WHEN
      cluster.addManifest('m1', {
        apiVersion: 'v1beta1',
        kind: 'Foo',
      });

      // THEN
      expect(stack).to(haveResource(KubernetesManifest.RESOURCE_TYPE, {
        Manifest: JSON.stringify([{
          apiVersion: 'v1beta1',
          kind: 'Foo',
          metadata: {
            labels: {
              'aws.cdk.eks/prune-c89a5983505f58231ac2a9a86fd82735ccf2308eac': '',
            },
          },
        }]),
        PruneLabel: 'aws.cdk.eks/prune-c89a5983505f58231ac2a9a86fd82735ccf2308eac',
      }));

      test.done();
    },

    'multiple resources in the same manifest'(test: Test) {
      // GIVEN
      const { stack, cluster } = testFixtureCluster({ prune: true });

      // WHEN
      cluster.addManifest('m1',
        {
          apiVersion: 'v1beta',
          kind: 'Foo',
        },
        {
          apiVersion: 'v1',
          kind: 'Pod',
          metadata: {
            name: 'foo',
            labels: {
              bar: 1234,
            },
          },
          spec: {
            containers: [{ name: 'main', image: 'main' }],
          },
        },
      );

      // THEN
      expect(stack).to(haveResource(KubernetesManifest.RESOURCE_TYPE, {
        Manifest: JSON.stringify([
          {
            apiVersion: 'v1beta',
            kind: 'Foo',
            metadata: {
              labels: {
                'aws.cdk.eks/prune-c89a5983505f58231ac2a9a86fd82735ccf2308eac': '',
              },
            },
          },
          {
            apiVersion: 'v1',
            kind: 'Pod',
            metadata: {
              name: 'foo',
              labels: {
                'aws.cdk.eks/prune-c89a5983505f58231ac2a9a86fd82735ccf2308eac': '',
                'bar': 1234,
              },
            },
            spec: {
              containers: [
                {
                  name: 'main',
                  image: 'main',
                },
              ],
            },
          },
        ]),
        PruneLabel: 'aws.cdk.eks/prune-c89a5983505f58231ac2a9a86fd82735ccf2308eac',
      }));

      test.done();
    },

    'different KubernetesManifest resource use different prune labels'(test: Test) {
      // GIVEN
      const { stack, cluster } = testFixtureCluster({ prune: true });

      // WHEN
      cluster.addManifest('m1', {
        apiVersion: 'v1beta',
        kind: 'Foo',
      });

      cluster.addManifest('m2', {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: {
          name: 'foo',
          labels: {
            bar: 1234,
          },
        },
        spec: {
          containers: [{ name: 'main', image: 'main' }],
        },
      });

      // THEN
      expect(stack).to(haveResource(KubernetesManifest.RESOURCE_TYPE, {
        Manifest: JSON.stringify([
          {
            apiVersion: 'v1beta',
            kind: 'Foo',
            metadata: {
              labels: {
                'aws.cdk.eks/prune-c89a5983505f58231ac2a9a86fd82735ccf2308eac': '',
              },
            },
          },
        ]),
        PruneLabel: 'aws.cdk.eks/prune-c89a5983505f58231ac2a9a86fd82735ccf2308eac',
      }));

      expect(stack).to(haveResource(KubernetesManifest.RESOURCE_TYPE, {
        Manifest: JSON.stringify([
          {
            apiVersion: 'v1',
            kind: 'Pod',
            metadata: {
              name: 'foo',
              labels: {
                'aws.cdk.eks/prune-c8aff6ac817006dd4d644e9d99b2cdbb8c8cd036d9': '',
                'bar': 1234,
              },
            },
            spec: {
              containers: [
                {
                  name: 'main',
                  image: 'main',
                },
              ],
            },
          },
        ]),
        PruneLabel: 'aws.cdk.eks/prune-c8aff6ac817006dd4d644e9d99b2cdbb8c8cd036d9',
      }));

      test.done();
    },

    'ignores resources without "kind"'(test: Test) {
      // GIVEN
      const { stack, cluster } = testFixtureCluster({ prune: true });

      // WHEN
      cluster.addManifest('m1', {
        malformed: { resource: 'yes' },
      });

      // THEN
      expect(stack).to(haveResource(KubernetesManifest.RESOURCE_TYPE, {
        Manifest: JSON.stringify([{ malformed: { resource: 'yes' } }]),
        PruneLabel: 'aws.cdk.eks/prune-c89a5983505f58231ac2a9a86fd82735ccf2308eac',
      }));

      test.done();
    },

    'ignores entries that are not objects (invalid type)'(test: Test) {
      // GIVEN
      const { stack, cluster } = testFixtureCluster({ prune: true });
      test.equal(cluster.prune, true);

      // WHEN
      cluster.addManifest('m1', ['foo']);

      // THEN
      expect(stack).to(haveResource(KubernetesManifest.RESOURCE_TYPE, {
        Manifest: JSON.stringify([['foo']]),
        PruneLabel: 'aws.cdk.eks/prune-c89a5983505f58231ac2a9a86fd82735ccf2308eac',
      }));

      test.done();
    },

    'no prune labels when "prune" is disabled'(test: Test) {
      // GIVEN
      const { stack } = testFixtureNoVpc();
      const cluster = new Cluster(stack, 'Cluster', {
        version: KubernetesVersion.V1_16,
        prune: false,
      });

      // WHEN
      cluster.addManifest('m1', { apiVersion: 'v1beta', kind: 'Foo' });

      // if "prune" is not specified at the manifest level, it is derived from the cluster settings.
      new KubernetesManifest(stack, 'm2', {
        cluster,
        manifest: [{ apiVersion: 'v1', kind: 'Pod' }],
      });

      // can be overridden at the manifest level
      new KubernetesManifest(stack, 'm3', {
        cluster,
        manifest: [{ apiVersion: 'v1', kind: 'Deployment' }],
        prune: true,
      });

      // THEN
      const template = SynthUtils.synthesize(stack).template;

      const m1 = template.Resources.Clustermanifestm1E5FBE3C1.Properties;
      const m2 = template.Resources.m201F909C5.Properties;
      const m3 = template.Resources.m3B0AF9264.Properties;

      test.deepEqual(m1.Manifest, JSON.stringify([{ apiVersion: 'v1beta', kind: 'Foo' }]));
      test.deepEqual(m2.Manifest, JSON.stringify([{ apiVersion: 'v1', kind: 'Pod' }]));
      test.deepEqual(m3.Manifest, JSON.stringify([
        {
          apiVersion: 'v1',
          kind: 'Deployment',
          metadata: {
            labels: {
              'aws.cdk.eks/prune-c8971972440c5bb3661e468e4cb8069f7ee549414c': '',
            },
          },
        },
      ]));
      test.ok(!m1.PruneLabel);
      test.ok(!m2.PruneLabel);
      test.equal(m3.PruneLabel, 'aws.cdk.eks/prune-c8971972440c5bb3661e468e4cb8069f7ee549414c');
      test.done();
    },
  },
};
