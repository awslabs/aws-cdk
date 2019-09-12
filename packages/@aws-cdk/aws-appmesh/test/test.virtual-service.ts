import ec2 = require('@aws-cdk/aws-ec2');
import cloudmap = require('@aws-cdk/aws-servicediscovery');
import cdk = require('@aws-cdk/core');
import { Test } from 'nodeunit';

import appmesh = require('../lib');

export = {
  'Can export existing virtual-service and re-import'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const mesh = new appmesh.Mesh(stack, 'mesh', {
      meshName: 'test-mesh',
    });

    const router = new appmesh.VirtualRouter(stack, 'router', { mesh });

    const vpc = new ec2.Vpc(stack, 'vpc');
    const namespace = new cloudmap.PrivateDnsNamespace(stack, 'test-namespace', {
      vpc,
      name: 'domain.local',
    });

    const service = new appmesh.VirtualService(stack, 'service-1', {
      mesh,
      virtualServiceName: `service.${namespace.namespaceName}`,
      virtualRouter: router,
    });

    const stack2 = new cdk.Stack();
    appmesh.VirtualService.fromVirtualServiceName(stack2, 'imported-virtual-service', mesh.meshName, service.virtualServiceName);

    // Nothing to do with imported virtual service yet

    test.done();
  },
};
