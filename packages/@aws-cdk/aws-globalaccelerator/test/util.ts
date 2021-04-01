import * as ec2 from '@aws-cdk/aws-ec2';
import { App, Stack } from '@aws-cdk/core';

export function testFixture() {
  const app = new App();
  const stack = new Stack(app, 'Stack');
  const vpc = new ec2.Vpc(stack, 'VPC');

  return { stack, vpc, app };
}