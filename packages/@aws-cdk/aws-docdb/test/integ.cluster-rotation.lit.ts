import * as ec2 from '@aws-cdk/aws-ec2';
import * as cdk from '@aws-cdk/core';
import * as docdb from '../lib';

/*
 * Stack verification steps:
 * * aws secretsmanager describe-secret --secret-id <deployed secret arn>
 * * aws lambda get-function --function-name <lambda arn from "RotationLambdaARN" in previous output
 *   * verify the lambda has the tag "serverlessrepo:applicationId" with the value
 *     "arn:aws:serverlessrepo:us-east-1:297356227824:applications/SecretsManagerMongoDBRotationSingleUser"
 */

const app = new cdk.App();
const stack = new cdk.Stack(app, 'aws-cdk-docdb-cluster-rotation');

const vpc = new ec2.Vpc(stack, 'VPC');

/// !show
const cluster = new docdb.DatabaseCluster(stack, 'Database', {
  masterUser: {
    username: 'docdb',
  },
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.R5, ec2.InstanceSize.LARGE),
  vpc,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});

cluster.addRotationSingleUser();
/// !hide

app.synth();
