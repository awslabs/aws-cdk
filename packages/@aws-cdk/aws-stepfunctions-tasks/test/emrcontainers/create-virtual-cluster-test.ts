import '@aws-cdk/assert-internal/jest';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Stack } from '@aws-cdk/core';
import { EMRContainersCreateVirtualCluster, ContainerProviderTypes } from '../../lib/emrcontainers/create-virtual-cluster';

const emrContainersVirtualClusterName = 'EMR Containers Virtual Cluster';
let stack: Stack;
let clusterId: string;
/**
 * To do for testing
 * 1. Needs to test with(default) and without EksInfo and ContainerInfo, make sure it works without it - FINISHED
 * 2. Needs to test ALL supported integration patterns and throw errors when needed - Finished
 * 3. Need to finish testing for all policy statements - Finished
 */

beforeEach(() => {
  stack = new Stack();
  clusterId = 'test-eks';
});

test('Invoke emr-containers CreateVirtualCluster without EksInfo and ContainerInfo properties', () => {
  // WHEN
  const task = new EMRContainersCreateVirtualCluster(stack, 'Task', {
    name: emrContainersVirtualClusterName,
    containerProvider: {
      id: clusterId,
      type: ContainerProviderTypes.EKS,
    },
    integrationPattern: sfn.IntegrationPattern.REQUEST_RESPONSE,
  });

  new sfn.StateMachine(stack, 'SM', {
    definition: task,
  });

  // THEN
  expect(stack.resolve(task.toStateJson())).toEqual({
    Type: 'Task',
    Resource: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':states:::emr-containers:createVirtualCluster',
        ],
      ],
    },
    End: true,
    Parameters: {
      Name: emrContainersVirtualClusterName,
      ContainerProvider: {
        Id: clusterId,
        Type: ContainerProviderTypes.EKS,
      },
    },
  });
});

test('Invoke emr-containers CreateVirtualCluster with all properties', () => {
  // WHEN
  const task = new EMRContainersCreateVirtualCluster(stack, 'Task', {
    name: emrContainersVirtualClusterName,
    containerProvider: {
      id: clusterId,
      info: {
        eksInfo: {
          namespace: 'kube-system',
        },
      },
      type: ContainerProviderTypes.EKS,
    },
    integrationPattern: sfn.IntegrationPattern.REQUEST_RESPONSE,
  });

  new sfn.StateMachine(stack, 'SM', {
    definition: task,
  });

  // THEN
  expect(stack.resolve(task.toStateJson())).toEqual({
    Type: 'Task',
    Resource: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':states:::emr-containers:createVirtualCluster',
        ],
      ],
    },
    End: true,
    Parameters: {
      Name: emrContainersVirtualClusterName,
      ContainerProvider: {
        Id: clusterId,
        Info: {
          EksInfo: {
            Namespace: 'kube-system',
          },
        },
        Type: ContainerProviderTypes.EKS,
      },
    },
  });
});

test('Create virtual cluster with Id from payload', () => {
  // WHEN
  const task = new EMRContainersCreateVirtualCluster(stack, 'Task', {
    name: emrContainersVirtualClusterName,
    containerProvider: {
      id: sfn.TaskInput.fromDataAt('$.Id').value,
      type: ContainerProviderTypes.EKS,
    },
    integrationPattern: sfn.IntegrationPattern.REQUEST_RESPONSE,
  });

  // THEN
  expect(stack.resolve(task.toStateJson())).toEqual({
    Type: 'Task',
    Resource: {
      'Fn::Join': [
        '',
        [
          'arn:',
          {
            Ref: 'AWS::Partition',
          },
          ':states:::emr-containers:createVirtualCluster',
        ],
      ],
    },
    End: true,
    Parameters: {
      Name: emrContainersVirtualClusterName,
      ContainerProvider: {
        'Id.$': '$.Id',
        'Type': ContainerProviderTypes.EKS,
      },
    },
  });
});

test('Permitted role actions included for CreateVirtualCluster if service integration pattern is REQUEST_RESPONSE', () => {
  // WHEN
  const task = new EMRContainersCreateVirtualCluster(stack, 'Task', {
    name: emrContainersVirtualClusterName,
    containerProvider: {
      id: clusterId,
      info: {
        eksInfo: {
          namespace: 'kube-system',
        },
      },
      type: ContainerProviderTypes.EKS,
    },
    integrationPattern: sfn.IntegrationPattern.REQUEST_RESPONSE,
  });

  new sfn.StateMachine(stack, 'SM', {
    definition: task,
  });

  // THEN
  expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: [{
        Action: [
          'emr-containers:CreateVirtualCluster',
        ],
      }],
    },
  });
});

test('Task throws if WAIT_FOR_TASK_TOKEN is supplied as service integration pattern', () => {
  expect(() => {
    new EMRContainersCreateVirtualCluster(stack, 'EMR Containers CreateVirtualCluster Job', {
      name: emrContainersVirtualClusterName,
      containerProvider: {
        id: clusterId,
        info: {
          eksInfo: {
            namespace: 'kube-system',
          },
        },
        type: ContainerProviderTypes.EKS,
      },
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
    });
  }).toThrow(/Unsupported service integration pattern. Supported Patterns: REQUEST_RESPONSE. Received: WAIT_FOR_TASK_TOKEN/);
});

test('Task throws if RUN_JOB is supplied as service integration pattern', () => {
  expect(() => {
    new EMRContainersCreateVirtualCluster(stack, 'EMR Containers CreateVirtualCluster Job', {
      name: emrContainersVirtualClusterName,
      containerProvider: {
        id: clusterId,
        info: {
          eksInfo: {
            namespace: 'kube-system',
          },
        },
        type: ContainerProviderTypes.EKS,
      },
      integrationPattern: sfn.IntegrationPattern.RUN_JOB,
    });
  }).toThrow(/Unsupported service integration pattern. Supported Patterns: REQUEST_RESPONSE. Received: RUN_JOB/);
});