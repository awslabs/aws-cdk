import * as ec2 from '@aws-cdk/aws-ec2';
import * as cdk from '@aws-cdk/core';
import * as rds from '../lib';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'aws-cdk-rds-instance-rotation');

const vpc = new ec2.Vpc(stack, 'VPC');

/// !show
const instance = new rds.DatabaseInstance(stack, 'Database', {
  engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_12 }),
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.SMALL),
  vpc,
});

instance.addRotationSingleUser({ secret: instance.secret });

const secret1 = new rds.DatabaseSecret(stack, 'MySecret1', { username: 'user1' });
secret1.attach(instance);
instance.addRotationSingleUser({ secret: secret1 });

const secret2 = new rds.DatabaseSecret(stack, 'MySecret2', { username: 'user2' });
secret2.attach(instance);
instance.addRotationSingleUser({ secret: secret2 });
/// !hide

app.synth();
