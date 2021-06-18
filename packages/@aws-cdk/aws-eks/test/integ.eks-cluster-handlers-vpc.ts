/// !cdk-integ pragma:ignore-assets
import { App } from '@aws-cdk/core';
import * as eks from '../lib';
import { TestStack } from './util';

const CLUSTER_VERSION = eks.KubernetesVersion.V1_20;


class EksAllHandlersInVpcStack extends TestStack {
  constructor(scope: App, id: string) {
    super(scope, id);

    new eks.Cluster(this, 'EksAllHandlersInVpcStack', {
      version: CLUSTER_VERSION,
      placeClusterHandlerInVpc: true,
    });
  }
}

const app = new App();

new EksAllHandlersInVpcStack(app, 'aws-cdk-eks-handlers-in-vpc-test');

app.synth();
