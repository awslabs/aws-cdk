import '@aws-cdk/assert-internal/jest';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import * as tasks from '../../lib';
import { SageMakerCreateTransformJob } from '../../lib/sagemaker/create-transform-job';

let stack: cdk.Stack;
let role: iam.Role;

beforeEach(() => {
  // GIVEN
  stack = new cdk.Stack();
  role = new iam.Role(stack, 'Role', {
    assumedBy: new iam.ServicePrincipal('sagemaker.amazonaws.com'),
    managedPolicies: [
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess'),
    ],
  });
});

test('create basic transform job', () => {
  // WHEN
  const task = new SageMakerCreateTransformJob(stack, 'TransformTask', {
    transformJobName: 'MyTransformJob',
    modelName: 'MyModelName',
    transformInput: {
      transformDataSource: {
        s3DataSource: {
          s3Uri: 's3://inputbucket/prefix',
        },
      },
    },
    transformOutput: {
      s3OutputPath: 's3://outputbucket/prefix',
    },
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
          ':states:::sagemaker:createTransformJob',
        ],
      ],
    },
    End: true,
    Parameters: {
      TransformJobName: 'MyTransformJob',
      ModelName: 'MyModelName',
      TransformInput: {
        DataSource: {
          S3DataSource: {
            S3Uri: 's3://inputbucket/prefix',
            S3DataType: 'S3Prefix',
          },
        },
      },
      TransformOutput: {
        S3OutputPath: 's3://outputbucket/prefix',
      },
      TransformResources: {
        InstanceCount: 1,
        InstanceType: 'ml.m4.xlarge',
      },
    },
  });
});

test('Task throws if WAIT_FOR_TASK_TOKEN is supplied as service integration pattern', () => {
  expect(() => {
    new SageMakerCreateTransformJob(stack, 'TransformTask', {
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      transformJobName: 'MyTransformJob',
      modelName: 'MyModelName',
      transformInput: {
        transformDataSource: {
          s3DataSource: {
            s3Uri: 's3://inputbucket/prefix',
          },
        },
      },
      transformOutput: {
        s3OutputPath: 's3://outputbucket/prefix',
      },
    });
  }).toThrow(/Unsupported service integration pattern. Supported Patterns: REQUEST_RESPONSE,RUN_JOB. Received: WAIT_FOR_TASK_TOKEN/);
});

test('create complex transform job', () => {
  // WHEN
  const kmsKey = new kms.Key(stack, 'Key');
  const task = new SageMakerCreateTransformJob(stack, 'TransformTask', {
    transformJobName: 'MyTransformJob',
    modelName: 'MyModelName',
    modelClientOptions: {
      invocationsMaxRetries: 1,
      invocationsTimeout: cdk.Duration.minutes(20),
    },
    integrationPattern: sfn.IntegrationPattern.RUN_JOB,
    role,
    transformInput: {
      transformDataSource: {
        s3DataSource: {
          s3Uri: 's3://inputbucket/prefix',
          s3DataType: tasks.S3DataType.S3_PREFIX,
        },
      },
    },
    transformOutput: {
      s3OutputPath: 's3://outputbucket/prefix',
      encryptionKey: kmsKey,
    },
    transformResources: {
      instanceCount: 1,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.P3, ec2.InstanceSize.XLARGE2),
      volumeEncryptionKey: kmsKey,
    },
    tags: {
      Project: 'MyProject',
    },
    batchStrategy: tasks.BatchStrategy.MULTI_RECORD,
    environment: {
      SOMEVAR: 'myvalue',
    },
    maxConcurrentTransforms: 3,
    maxPayload: cdk.Size.mebibytes(100),
    dataProcessing: {
      inputFilter: '$[1:]',
      joinSource: 'Input',
      outputFilter: '$[0,-1]',
    },
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
          ':states:::sagemaker:createTransformJob.sync',
        ],
      ],
    },
    End: true,
    Parameters: {
      TransformJobName: 'MyTransformJob',
      ModelName: 'MyModelName',
      ModelClientConfig: {
        InvocationsMaxRetries: 1,
        InvocationsTimeoutInSeconds: 1200,
      },
      TransformInput: {
        DataSource: {
          S3DataSource: {
            S3Uri: 's3://inputbucket/prefix',
            S3DataType: 'S3Prefix',
          },
        },
      },
      TransformOutput: {
        S3OutputPath: 's3://outputbucket/prefix',
        KmsKeyId: { 'Fn::GetAtt': ['Key961B73FD', 'Arn'] },
      },
      TransformResources: {
        InstanceCount: 1,
        InstanceType: 'ml.p3.2xlarge',
        VolumeKmsKeyId: { 'Fn::GetAtt': ['Key961B73FD', 'Arn'] },
      },
      Tags: [
        { Key: 'Project', Value: 'MyProject' },
      ],
      MaxConcurrentTransforms: 3,
      MaxPayloadInMB: 100,
      DataProcessing: {
        InputFilter: '$[1:]',
        JoinSource: 'Input',
        OutputFilter: '$[0,-1]',
      },
      Environment: {
        SOMEVAR: 'myvalue',
      },
      BatchStrategy: 'MultiRecord',
    },
  });
});

test('pass param to transform job', () => {
  // WHEN
  const task = new SageMakerCreateTransformJob(stack, 'TransformTask', {
    transformJobName: sfn.JsonPath.stringAt('$.TransformJobName'),
    modelName: sfn.JsonPath.stringAt('$.ModelName'),
    role,
    transformInput: {
      transformDataSource: {
        s3DataSource: {
          s3Uri: 's3://inputbucket/prefix',
          s3DataType: tasks.S3DataType.S3_PREFIX,
        },
      },
    },
    transformOutput: {
      s3OutputPath: 's3://outputbucket/prefix',
    },
    transformResources: {
      instanceCount: 1,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.P3, ec2.InstanceSize.XLARGE2),
    },
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
          ':states:::sagemaker:createTransformJob',
        ],
      ],
    },
    End: true,
    Parameters: {
      'TransformJobName.$': '$.TransformJobName',
      'ModelName.$': '$.ModelName',
      'TransformInput': {
        DataSource: {
          S3DataSource: {
            S3Uri: 's3://inputbucket/prefix',
            S3DataType: 'S3Prefix',
          },
        },
      },
      'TransformOutput': {
        S3OutputPath: 's3://outputbucket/prefix',
      },
      'TransformResources': {
        InstanceCount: 1,
        InstanceType: 'ml.p3.2xlarge',
      },
    },
  });
});
