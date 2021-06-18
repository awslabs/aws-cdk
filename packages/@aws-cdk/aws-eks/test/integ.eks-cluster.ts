/// !cdk-integ pragma:ignore-assets
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import { App, CfnOutput, Duration, Token, Fn } from '@aws-cdk/core';
import * as cdk8s from 'cdk8s';
import * as kplus from 'cdk8s-plus';
import * as constructs from 'constructs';
import * as eks from '../lib';
import * as hello from './hello-k8s';
import { Pinger } from './pinger/pinger';
import { TestStack } from './util';


class EksClusterStack extends TestStack {
  private cluster: eks.Cluster;
  private vpc: ec2.IVpc;

  constructor(scope: App, id: string) {
    super(scope, id);

    // allow all account users to assume this role in order to admin the cluster
    const mastersRole = new iam.Role(this, 'AdminRole', {
      assumedBy: new iam.AccountRootPrincipal(),
    });

    const secretsEncryptionKey = new kms.Key(this, 'SecretsKey');

    // just need one nat gateway to simplify the test
    this.vpc = new ec2.Vpc(this, 'Vpc', { maxAzs: 3, natGateways: 1 });

    // create the cluster with a default nodegroup capacity
    this.cluster = new eks.Cluster(this, 'Cluster', {
      vpc: this.vpc,
      mastersRole,
      defaultCapacity: 2,
      version: eks.KubernetesVersion.V1_20,
      secretsEncryptionKey,
    });

    this.assertFargateProfile();

    this.assertCapacityX86();

    this.assertCapacityArm();

    this.assertBottlerocket();

    this.assertSpotCapacity();

    this.assertInferenceInstances();

    this.assertNodeGroupX86();

    this.assertNodeGroupSpot();

    this.assertNodeGroupArm();

    this.assertNodeGroupCustomAmi();

    this.assertSimpleManifest();

    this.assertManifestWithoutValidation();

    this.assertSimpleHelmChart();

    this.assertSimpleCdk8sChart();

    this.assertCreateNamespace();

    this.assertServiceAccount();

    this.assertServiceLoadBalancerAddress();

    new CfnOutput(this, 'ClusterEndpoint', { value: this.cluster.clusterEndpoint });
    new CfnOutput(this, 'ClusterArn', { value: this.cluster.clusterArn });
    new CfnOutput(this, 'ClusterCertificateAuthorityData', { value: this.cluster.clusterCertificateAuthorityData });
    new CfnOutput(this, 'ClusterSecurityGroupId', { value: this.cluster.clusterSecurityGroupId });
    new CfnOutput(this, 'ClusterEncryptionConfigKeyArn', { value: this.cluster.clusterEncryptionConfigKeyArn });
    new CfnOutput(this, 'ClusterName', { value: this.cluster.clusterName });
  }

  private assertServiceAccount() {
    // add a service account connected to a IAM role
    this.cluster.addServiceAccount('MyServiceAccount');
  }

  private assertCreateNamespace() {
    // deploy an nginx ingress in a namespace
    const nginxNamespace = this.cluster.addManifest('nginx-namespace', {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name: 'nginx',
      },
    });

    const nginxIngress = this.cluster.addHelmChart('nginx-ingress', {
      chart: 'nginx-ingress',
      repository: 'https://helm.nginx.com/stable',
      namespace: 'nginx',
      wait: true,
      createNamespace: false,
      timeout: Duration.minutes(15),
    });

    // make sure namespace is deployed before the chart
    nginxIngress.node.addDependency(nginxNamespace);
  }

  private assertSimpleCdk8sChart() {
    class Chart extends cdk8s.Chart {
      constructor(scope: constructs.Construct, ns: string, cluster: eks.ICluster) {
        super(scope, ns);

        new kplus.ConfigMap(this, 'config-map', {
          data: {
            clusterName: cluster.clusterName,
          },
        });
      }
    }
    const app = new cdk8s.App();
    const chart = new Chart(app, 'Chart', this.cluster);

    this.cluster.addCdk8sChart('cdk8s-chart', chart);
  }
  private assertSimpleHelmChart() {
    // deploy the Kubernetes dashboard through a helm chart
    this.cluster.addHelmChart('dashboard', {
      chart: 'kubernetes-dashboard',
      repository: 'https://kubernetes.github.io/dashboard/',
    });
  }
  private assertSimpleManifest() {
    // apply a kubernetes manifest
    this.cluster.addManifest('HelloApp', ...hello.resources);
  }
  private assertManifestWithoutValidation() {
    // apply a kubernetes manifest
    new eks.KubernetesManifest(this, 'HelloAppWithoutValidation', {
      cluster: this.cluster,
      manifest: [{
        apiVersion: 'v1',
        kind: 'ConfigMap',
        data: { hello: 'world' },
        metadata: { name: 'config-map' },
        unknown: { key: 'value' },
      }],
      skipValidation: true,
    });
  }
  private assertNodeGroupX86() {
    // add a extra nodegroup
    this.cluster.addNodegroupCapacity('extra-ng', {
      instanceType: new ec2.InstanceType('t3.small'),
      minSize: 1,
      // reusing the default capacity nodegroup instance role when available
      nodeRole: this.cluster.defaultCapacity ? this.cluster.defaultCapacity.role : undefined,
    });
  }
  private assertNodeGroupSpot() {
    // add a extra nodegroup
    this.cluster.addNodegroupCapacity('extra-ng-spot', {
      instanceTypes: [
        new ec2.InstanceType('c5.large'),
        new ec2.InstanceType('c5a.large'),
        new ec2.InstanceType('c5d.large'),
      ],
      minSize: 3,
      // reusing the default capacity nodegroup instance role when available
      nodeRole: this.cluster.defaultCapacity ? this.cluster.defaultCapacity.role : undefined,
      capacityType: eks.CapacityType.SPOT,
    });
  }
  private assertNodeGroupCustomAmi() {
    // add a extra nodegroup
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'set -o xtrace',
      `/etc/eks/bootstrap.sh ${this.cluster.clusterName}`,
    );
    const lt = new ec2.CfnLaunchTemplate(this, 'LaunchTemplate', {
      launchTemplateData: {
        imageId: new eks.EksOptimizedImage({
          kubernetesVersion: eks.KubernetesVersion.V1_20.version,
        }).getImage(this).imageId,
        instanceType: new ec2.InstanceType('t3.small').toString(),
        userData: Fn.base64(userData.render()),
      },
    });
    this.cluster.addNodegroupCapacity('extra-ng2', {
      minSize: 1,
      // reusing the default capacity nodegroup instance role when available
      nodeRole: this.cluster.defaultNodegroup?.role || this.cluster.defaultCapacity?.role,
      launchTemplateSpec: {
        id: lt.ref,
        version: lt.attrDefaultVersionNumber,
      },
    });
  }
  private assertNodeGroupArm() {
    // add a extra nodegroup
    this.cluster.addNodegroupCapacity('extra-ng-arm', {
      instanceType: new ec2.InstanceType('m6g.medium'),
      minSize: 1,
      // reusing the default capacity nodegroup instance role when available
      nodeRole: this.cluster.defaultCapacity ? this.cluster.defaultCapacity.role : undefined,
    });
  }
  private assertInferenceInstances() {
    // inference instances
    this.cluster.addAutoScalingGroupCapacity('InferenceInstances', {
      instanceType: new ec2.InstanceType('inf1.2xlarge'),
      minCapacity: 1,
    });
  }
  private assertSpotCapacity() {
    // spot instances (up to 10)
    this.cluster.addAutoScalingGroupCapacity('spot', {
      spotPrice: '0.1094',
      instanceType: new ec2.InstanceType('t3.large'),
      maxCapacity: 10,
      bootstrapOptions: {
        kubeletExtraArgs: '--node-labels foo=bar,goo=far',
        awsApiRetryAttempts: 5,
      },
    });
  }
  private assertBottlerocket() {
    // add bottlerocket nodes
    this.cluster.addAutoScalingGroupCapacity('BottlerocketNodes', {
      instanceType: new ec2.InstanceType('t3.small'),
      minCapacity: 2,
      machineImageType: eks.MachineImageType.BOTTLEROCKET,
    });
  }
  private assertCapacityX86() {
    // add some x86_64 capacity to the cluster. The IAM instance role will
    // automatically be mapped via aws-auth to allow nodes to join the cluster.
    this.cluster.addAutoScalingGroupCapacity('Nodes', {
      instanceType: new ec2.InstanceType('t2.medium'),
      minCapacity: 3,
    });
  }

  private assertCapacityArm() {
    // add some arm64 capacity to the cluster. The IAM instance role will
    // automatically be mapped via aws-auth to allow nodes to join the cluster.
    this.cluster.addAutoScalingGroupCapacity('NodesArm', {
      instanceType: new ec2.InstanceType('m6g.medium'),
      minCapacity: 1,
    });
  }

  private assertFargateProfile() {
    // fargate profile for resources in the "default" namespace
    this.cluster.addFargateProfile('default', {
      selectors: [{ namespace: 'default' }],
    });
  }

  private assertServiceLoadBalancerAddress() {
    const serviceName = 'webservice';
    const labels = { app: 'simple-web' };
    const containerPort = 80;
    const servicePort = 9000;

    const pingerSecurityGroup = new ec2.SecurityGroup(this, 'WebServiceSecurityGroup', {
      vpc: this.vpc,
    });

    pingerSecurityGroup.addIngressRule(pingerSecurityGroup, ec2.Port.tcp(servicePort), `allow http ${servicePort} access from myself`);

    this.cluster.addManifest('simple-web-pod', {
      kind: 'Pod',
      apiVersion: 'v1',
      metadata: { name: 'webpod', labels: labels },
      spec: {
        containers: [{
          name: 'simplewebcontainer',
          image: 'nginx',
          ports: [{ containerPort: containerPort }],
        }],
      },
    });

    this.cluster.addManifest('simple-web-service', {
      kind: 'Service',
      apiVersion: 'v1',
      metadata: {
        name: serviceName,
        annotations: {
          // this is furtile soil for cdk8s-plus! :)
          'service.beta.kubernetes.io/aws-load-balancer-internal': 'true',
          'service.beta.kubernetes.io/aws-load-balancer-extra-security-groups': pingerSecurityGroup.securityGroupId,
        },
      },
      spec: {
        type: 'LoadBalancer',
        ports: [{ port: servicePort, targetPort: containerPort }],
        selector: labels,
      },
    });

    const loadBalancerAddress = this.cluster.getServiceLoadBalancerAddress(serviceName);

    // create a resource that hits the load balancer to make sure
    // everything is wired properly.
    const pinger = new Pinger(this, 'ServicePinger', {
      url: `http://${loadBalancerAddress}:${servicePort}`,
      securityGroup: pingerSecurityGroup,
      vpc: this.vpc,
    });

    // this should display a proper nginx response
    // <title>Welcome to nginx!</title>...
    new CfnOutput(this, 'Response', {
      value: pinger.response,
    });
  }
}

// this test uses both the bottlerocket image and the inf1 instance, which are only supported in these
// regions. see https://github.com/aws/aws-cdk/tree/master/packages/%40aws-cdk/aws-eks#bottlerocket
// and https://aws.amazon.com/about-aws/whats-new/2019/12/introducing-amazon-ec2-inf1-instances-high-performance-and-the-lowest-cost-machine-learning-inference-in-the-cloud/
const supportedRegions = [
  'us-east-1',
  'us-west-2',
];

const app = new App();

// since the EKS optimized AMI is hard-coded here based on the region,
// we need to actually pass in a specific region.
const stack = new EksClusterStack(app, 'aws-cdk-eks-cluster-test');

if (process.env.CDK_INTEG_ACCOUNT !== '12345678') {
  // only validate if we are about to actually deploy.
  // TODO: better way to determine this, right now the 'CDK_INTEG_ACCOUNT' seems like the only way.

  if (Token.isUnresolved(stack.region)) {
    throw new Error(`region (${stack.region}) cannot be a token and must be configured to one of: ${supportedRegions}`);
  }

  if (!supportedRegions.includes(stack.region)) {
    throw new Error(`region (${stack.region}) must be configured to one of: ${supportedRegions}`);
  }
}


app.synth();
