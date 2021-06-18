import { AccountRootPrincipal, Role } from '@aws-cdk/aws-iam';
import { App, Stack, StackProps } from '@aws-cdk/core';
import { ProfilingGroup } from '../lib';

class ProfilerGroupIntegrationTest extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    const profilingGroup = new ProfilingGroup(this, 'MyProfilingGroup');

    const publishAppRole = new Role(this, 'PublishAppRole', {
      assumedBy: new AccountRootPrincipal(),
    });
    profilingGroup.grantPublish(publishAppRole);

    const readAppRole = new Role(this, 'ReadAppRole', {
      assumedBy: new AccountRootPrincipal(),
    });
    profilingGroup.grantRead(readAppRole);
  }
}

const app = new App();

new ProfilerGroupIntegrationTest(app, 'ProfilerGroupIntegrationTest');

app.synth();
