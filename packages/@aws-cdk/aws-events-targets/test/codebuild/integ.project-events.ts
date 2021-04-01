#!/usr/bin/env node
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codecommit from '@aws-cdk/aws-codecommit';
import * as events from '@aws-cdk/aws-events';
import * as sns from '@aws-cdk/aws-sns';
import * as subs from '@aws-cdk/aws-sns-subscriptions';
import * as sqs from '@aws-cdk/aws-sqs';
import * as cdk from '@aws-cdk/core';
import * as targets from '../../lib';

const app = new cdk.App();

const stack = new cdk.Stack(app, 'aws-cdk-codebuild-events');

const repo = new codecommit.Repository(stack, 'MyRepo', {
  repositoryName: 'aws-cdk-codebuild-events',
});
const project = new codebuild.Project(stack, 'MyProject', {
  source: codebuild.Source.codeCommit({ repository: repo }),
});

const queue = new sqs.Queue(stack, 'MyQueue');
const deadLetterQueue = new sqs.Queue(stack, 'DeadLetterQueue');

const topic = new sns.Topic(stack, 'MyTopic');
topic.addSubscription(new subs.SqsSubscription(queue));

// this will send an email with the JSON event for every state change of this
// build project.
project.onStateChange('StateChange', { target: new targets.SnsTopic(topic) });

// this will send an email with the message "Build phase changed to <phase>".
// The phase will be extracted from the "completed-phase" field of the event
// details.
project.onPhaseChange('PhaseChange', {
  target: new targets.SnsTopic(topic, {
    message: events.RuleTargetInput.fromText(`Build phase changed to ${codebuild.PhaseChangeEvent.completedPhase}`),
  }),
});

// trigger a build when a commit is pushed to the repo
const onCommitRule = repo.onCommit('OnCommit', {
  target: new targets.CodeBuildProject(project, {
    deadLetterQueue: deadLetterQueue,
    maxEventAge: cdk.Duration.hours(2),
    retryAttempts: 2,
  }),
  branches: ['master'],
});

onCommitRule.addTarget(new targets.SnsTopic(topic, {
  message: events.RuleTargetInput.fromText(
    `A commit was pushed to the repository ${codecommit.ReferenceEvent.repositoryName} on branch ${codecommit.ReferenceEvent.referenceName}`,
  ),
}));

app.synth();
