import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import { EksRunJob } from '../../lib';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'aws-stepfunctions-tasks-eks-run-job-integ');

const clusterName = sfn.JsonPath.stringAt('$.eks.Cluster.Name');
const certificateAuthority = sfn.JsonPath.stringAt('$.eks.Cluster.CertificateAuthority.Data');
const endpoint = sfn.JsonPath.stringAt('$.eks.Cluster.Endpoint');

const runJobJob = new EksRunJob(stack, 'Run a EKS Job', {
  integrationPattern: sfn.IntegrationPattern.RUN_JOB,
  clusterName: clusterName,
  certificateAuthority: certificateAuthority,
  endpoint: endpoint,
  logOptions: {
    retrieveLogs: true,
  },
  job: {
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: {
      name: 'example-job',
    },
    spec: {
      backoffLimit: 0,
      template: {
        metadata: {
          name: 'example-job',
        },
        spec: {
          containers: [
            {
              name: 'pi-20',
              image: 'perl',
              command: [
                'perl',
              ],
              args: [
                '-Mbignum=bpi',
                '-wle',
                "print '{ ' . '\"pi\": '. bpi(20) . ' }';",
              ],
            },
          ],
          restartPolicy: 'Never',
        },
      },
    },
  },
});

const chain = sfn.Chain.start(runJobJob);

const sm = new sfn.StateMachine(stack, 'StateMachine', {
  definition: chain,
  timeout: cdk.Duration.seconds(30),
});

new cdk.CfnOutput(stack, 'stateMachineArn', {
  value: sm.stateMachineArn,
});


app.synth();
