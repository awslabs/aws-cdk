import * as codebuild from '@aws-cdk/aws-codebuild';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import { CodeBuildStopBuild, CodeBuildStartBuild, CodeBuildBatchDeleteBuilds } from '../../lib';

/*
 * Create a state machine with a task state to create a code build project, stop the build, and after the build is stopped
 * delete the build.
 *
 * Stack verification steps:
 * * aws stepfunctions start-execution --state-machine-arn <deployed state machine arn> : should return execution arn
 * * aws codebuild list-builds-for-project --project-name <deployed project name>: should return a list of projects with size greater than 0
 * *
 * * aws codebuild batch-get-builds --ids <build id returned by list-builds-for-project> --query 'builds[0].buildStatus': wait until the status is 'SUCCEEDED'
 * * aws stepfunctions describe-execution --execution-arn <exection-arn generated before> --query 'status': should return status as SUCCEEDED
 */
class BatchDeleteBuildsStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: cdk.StackProps = {}) {
    super(scope, id, props);

    const project = new codebuild.Project(this, 'Project', {
      projectName: 'MyTestProject',
      grantReportGroupPermissions: true,
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          build: {
            commands: [
              'echo "Hello, CodeBuild!"',
            ],
          },
        },
      }),
    });

    const startBuild = new CodeBuildStartBuild(this, 'build-task', {
      project: project,
      integrationPattern: sfn.IntegrationPattern.RUN_JOB,
    });

    const stopBuildJob = new CodeBuildStopBuild(this, 'stop-build', {
      buildId: sfn.JsonPath.stringAt('$.Build.Arn'),
    });

    const wait = new sfn.Wait(this, 'wait', {
      time: sfn.WaitTime.duration(cdk.Duration.seconds(30)),
    });

    const batchDeleteBuildsJob = new CodeBuildBatchDeleteBuilds(this, 'batch-delete-builds', {
      ids: sfn.JsonPath.listAt('$.Build..Arn'),
    });

    const definition = sfn.Chain.start(startBuild).next(stopBuildJob).next(wait).next(batchDeleteBuildsJob);

    const stateMachine = new sfn.StateMachine(this, 'StateMachine', {
      definition,
    });

    new cdk.CfnOutput(this, 'StateMachineArn', {
      value: stateMachine.stateMachineArn,
    });
  }
}

const app = new cdk.App();
new BatchDeleteBuildsStack(app, 'aws-stepfunctions-tasks-codebuild-batch-delete-builds-integ');
app.synth();
