import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import { EksRunJob } from '../../lib/eks/run-job';

describe('Run Job', () => {

  test('default settings', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const task = new EksRunJob(stack, 'Job', {
      clusterName: 'clusterName',
      certificateAuthority: 'certificateAuthority',
      endpoint: 'endpoint',
      job: {
        Job: 'job',
      },
      logOptions: {
        rawLogs: false,
        retrieveLogs: false,
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
            ':states:::eks:runJob',
          ],
        ],
      },
      End: true,
      Parameters: {
        ClusterName: 'clusterName',
        CertificateAuthority: 'certificateAuthority',
        Endpoint: 'endpoint',
        Job: {
          Job: 'job',
        },
        LogOptions: {
          RawLogs: false,
          RetrieveLogs: false,
        },
      },
    });
  });

  test('EKS runjob.sync', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    const task = new EksRunJob(stack, 'Job', {
      integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      clusterName: 'clusterName',
      certificateAuthority: 'certificateAuthority',
      endpoint: 'endpoint',
      job: {
        Job: 'job',
      },
      logOptions: {
        rawLogs: false,
        retrieveLogs: false,
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
            ':states:::eks:runJob.sync',
          ],
        ],
      },
      End: true,
      Parameters: {
        ClusterName: 'clusterName',
        CertificateAuthority: 'certificateAuthority',
        Endpoint: 'endpoint',
        Job: {
          Job: 'job',
        },
        LogOptions: {
          RawLogs: false,
          RetrieveLogs: false,
        },
      },
    });
  });
});
