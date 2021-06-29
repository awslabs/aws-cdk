import * as codebuild from '@aws-cdk/aws-codebuild';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import { CodeBuildBatchGetReports, CodeBuildStartBuild } from '../../lib';

/*
 * Stack verification steps:
 * * aws stepfunctions start-execution --state-machine-arn <deployed state machine arn> : should return execution arn
 * * aws codebuild list-builds-for-project --project-name <deployed project name>: should return a list of projects with size greater than 0
 * *
 * * aws codebuild batch-get-builds --ids <build id returned by list-builds-for-project> --query 'builds[0].buildStatus': wait until the status is 'SUCCEEDED'
 * * aws stepfunctions describe-execution --execution-arn <exection-arn generated before> --query 'status': should return status as SUCCEEDED
 */
class BatchGetReportsStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: cdk.StackProps = {}) {
    super(scope, id, props);

    const project = new codebuild.Project(this, 'Project', {
      projectName: 'MyTestProject',
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          build: {
            commands: [
              'touch emptyFile',
            ],
          },
        },
        reports: {
          emptyReport: {
            files: [
              '**/*',
            ],
          },
        },
      }),
    });

    const startBuild = new CodeBuildStartBuild(this, 'build-task', {
      project: project,
      integrationPattern: sfn.IntegrationPattern.RUN_JOB,
    });

    const batchGetReportsJob = new CodeBuildBatchGetReports(this, 'batch-get-reports', {
      reportArns: sfn.JsonPath.listAt('$.Build.ReportArns'),
    });

    const definition = sfn.Chain.start(startBuild).next(batchGetReportsJob);

    const stateMachine = new sfn.StateMachine(this, 'StateMachine', {
      definition,
    });

    new cdk.CfnOutput(this, 'StateMachineArn', {
      value: stateMachine.stateMachineArn,
    });
  }
}

const app = new cdk.App();
new BatchGetReportsStack(app, 'aws-stepfunctions-tasks-codebuild-batch-get-reports-integ');
app.synth();
