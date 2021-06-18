import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { retry, sleep } from '../helpers/aws';
import { cloneDirectory, shell, withDefaultFixture } from '../helpers/cdk';
import { integTest } from '../helpers/test-helpers';

jest.setTimeout(600 * 1000);

integTest('VPC Lookup', withDefaultFixture(async (fixture) => {
  fixture.log('Making sure we are clean before starting.');
  await fixture.cdkDestroy('define-vpc', { modEnv: { ENABLE_VPC_TESTING: 'DEFINE' } });

  fixture.log('Setting up: creating a VPC with known tags');
  await fixture.cdkDeploy('define-vpc', { modEnv: { ENABLE_VPC_TESTING: 'DEFINE' } });
  fixture.log('Setup complete!');

  fixture.log('Verifying we can now import that VPC');
  await fixture.cdkDeploy('import-vpc', { modEnv: { ENABLE_VPC_TESTING: 'IMPORT' } });
}));

integTest('Two ways of shoing the version', withDefaultFixture(async (fixture) => {
  const version1 = await fixture.cdk(['version'], { verbose: false });
  const version2 = await fixture.cdk(['--version'], { verbose: false });

  expect(version1).toEqual(version2);
}));

integTest('Termination protection', withDefaultFixture(async (fixture) => {
  const stackName = 'termination-protection';
  await fixture.cdkDeploy(stackName);

  // Try a destroy that should fail
  await expect(fixture.cdkDestroy(stackName)).rejects.toThrow('exited with error');

  // Can update termination protection even though the change set doesn't contain changes
  await fixture.cdkDeploy(stackName, { modEnv: { TERMINATION_PROTECTION: 'FALSE' } });
  await fixture.cdkDestroy(stackName);
}));

integTest('cdk synth', withDefaultFixture(async (fixture) => {
  await expect(fixture.cdk(['synth', fixture.fullStackName('test-1')], { verbose: false })).resolves.toEqual(
    `Resources:
  topic69831491:
    Type: AWS::SNS::Topic
    Metadata:
      aws:cdk:path: ${fixture.stackNamePrefix}-test-1/topic/Resource`);

  await expect(fixture.cdk(['synth', fixture.fullStackName('test-2')], { verbose: false })).resolves.toEqual(
    `Resources:
  topic152D84A37:
    Type: AWS::SNS::Topic
    Metadata:
      aws:cdk:path: ${fixture.stackNamePrefix}-test-2/topic1/Resource
  topic2A4FB547F:
    Type: AWS::SNS::Topic
    Metadata:
      aws:cdk:path: ${fixture.stackNamePrefix}-test-2/topic2/Resource`);
}));

integTest('ssm parameter provider error', withDefaultFixture(async (fixture) => {
  await expect(fixture.cdk(['synth',
    fixture.fullStackName('missing-ssm-parameter'),
    '-c', 'test:ssm-parameter-name=/does/not/exist'], {
    allowErrExit: true,
  })).resolves.toContain('SSM parameter not available in account');
}));

integTest('automatic ordering', withDefaultFixture(async (fixture) => {
  // Deploy the consuming stack which will include the producing stack
  await fixture.cdkDeploy('order-consuming');

  // Destroy the providing stack which will include the consuming stack
  await fixture.cdkDestroy('order-providing');
}));

integTest('context setting', withDefaultFixture(async (fixture) => {
  await fs.writeFile(path.join(fixture.integTestDir, 'cdk.context.json'), JSON.stringify({
    contextkey: 'this is the context value',
  }));
  try {
    await expect(fixture.cdk(['context'])).resolves.toContain('this is the context value');

    // Test that deleting the contextkey works
    await fixture.cdk(['context', '--reset', 'contextkey']);
    await expect(fixture.cdk(['context'])).resolves.not.toContain('this is the context value');

    // Test that forced delete of the context key does not throw
    await fixture.cdk(['context', '-f', '--reset', 'contextkey']);
  } finally {
    await fs.unlink(path.join(fixture.integTestDir, 'cdk.context.json'));
  }
}));

integTest('context in stage propagates to top', withDefaultFixture(async (fixture) => {
  await expect(fixture.cdkSynth({
    // This will make it error to prove that the context bubbles up, and also that we can fail on command
    options: ['--no-lookups'],
    modEnv: {
      INTEG_STACK_SET: 'stage-using-context',
    },
    allowErrExit: true,
  })).resolves.toContain('Context lookups have been disabled');
}));

integTest('deploy', withDefaultFixture(async (fixture) => {
  const stackArn = await fixture.cdkDeploy('test-2', { captureStderr: false });

  // verify the number of resources in the stack
  const response = await fixture.aws.cloudFormation('describeStackResources', {
    StackName: stackArn,
  });
  expect(response.StackResources?.length).toEqual(2);
}));

integTest('deploy all', withDefaultFixture(async (fixture) => {
  const arns = await fixture.cdkDeploy('test-*', { captureStderr: false });

  // verify that we only deployed a single stack (there's a single ARN in the output)
  expect(arns.split('\n').length).toEqual(2);
}));

integTest('nested stack with parameters', withDefaultFixture(async (fixture) => {
  // STACK_NAME_PREFIX is used in MyTopicParam to allow multiple instances
  // of this test to run in parallel, othewise they will attempt to create the same SNS topic.
  const stackArn = await fixture.cdkDeploy('with-nested-stack-using-parameters', {
    options: ['--parameters', `MyTopicParam=${fixture.stackNamePrefix}ThereIsNoSpoon`],
    captureStderr: false,
  });

  // verify that we only deployed a single stack (there's a single ARN in the output)
  expect(stackArn.split('\n').length).toEqual(1);

  // verify the number of resources in the stack
  const response = await fixture.aws.cloudFormation('describeStackResources', {
    StackName: stackArn,
  });
  expect(response.StackResources?.length).toEqual(1);
}));

integTest('deploy without execute a named change set', withDefaultFixture(async (fixture) => {
  const changeSetName = 'custom-change-set-name';
  const stackArn = await fixture.cdkDeploy('test-2', {
    options: ['--no-execute', '--change-set-name', changeSetName],
    captureStderr: false,
  });
  // verify that we only deployed a single stack (there's a single ARN in the output)
  expect(stackArn.split('\n').length).toEqual(1);

  const response = await fixture.aws.cloudFormation('describeStacks', {
    StackName: stackArn,
  });
  expect(response.Stacks?.[0].StackStatus).toEqual('REVIEW_IN_PROGRESS');

  //verify a change set was created with the provided name
  const changeSetResponse = await fixture.aws.cloudFormation('listChangeSets', {
    StackName: stackArn,
  });
  const changeSets = changeSetResponse.Summaries || [];
  expect(changeSets.length).toEqual(1);
  expect(changeSets[0].ChangeSetName).toEqual(changeSetName);
  expect(changeSets[0].Status).toEqual('CREATE_COMPLETE');
}));

integTest('security related changes without a CLI are expected to fail', withDefaultFixture(async (fixture) => {
  // redirect /dev/null to stdin, which means there will not be tty attached
  // since this stack includes security-related changes, the deployment should
  // immediately fail because we can't confirm the changes
  const stackName = 'iam-test';
  await expect(fixture.cdkDeploy(stackName, {
    options: ['<', '/dev/null'], // H4x, this only works because I happen to know we pass shell: true.
    neverRequireApproval: false,
  })).rejects.toThrow('exited with error');

  // Ensure stack was not deployed
  await expect(fixture.aws.cloudFormation('describeStacks', {
    StackName: fixture.fullStackName(stackName),
  })).rejects.toThrow('does not exist');
}));

integTest('deploy wildcard with outputs', withDefaultFixture(async (fixture) => {
  const outputsFile = path.join(fixture.integTestDir, 'outputs', 'outputs.json');
  await fs.mkdir(path.dirname(outputsFile), { recursive: true });

  await fixture.cdkDeploy(['outputs-test-*'], {
    options: ['--outputs-file', outputsFile],
  });

  const outputs = JSON.parse((await fs.readFile(outputsFile, { encoding: 'utf-8' })).toString());
  expect(outputs).toEqual({
    [`${fixture.stackNamePrefix}-outputs-test-1`]: {
      TopicName: `${fixture.stackNamePrefix}-outputs-test-1MyTopic`,
    },
    [`${fixture.stackNamePrefix}-outputs-test-2`]: {
      TopicName: `${fixture.stackNamePrefix}-outputs-test-2MyOtherTopic`,
    },
  });
}));

integTest('deploy with parameters', withDefaultFixture(async (fixture) => {
  const stackArn = await fixture.cdkDeploy('param-test-1', {
    options: [
      '--parameters', `TopicNameParam=${fixture.stackNamePrefix}bazinga`,
    ],
    captureStderr: false,
  });

  const response = await fixture.aws.cloudFormation('describeStacks', {
    StackName: stackArn,
  });

  expect(response.Stacks?.[0].Parameters).toEqual([
    {
      ParameterKey: 'TopicNameParam',
      ParameterValue: `${fixture.stackNamePrefix}bazinga`,
    },
  ]);
}));

integTest('update to stack in ROLLBACK_COMPLETE state will delete stack and create a new one', withDefaultFixture(async (fixture) => {
  // GIVEN
  await expect(fixture.cdkDeploy('param-test-1', {
    options: [
      '--parameters', `TopicNameParam=${fixture.stackNamePrefix}@aww`,
    ],
    captureStderr: false,
  })).rejects.toThrow('exited with error');

  const response = await fixture.aws.cloudFormation('describeStacks', {
    StackName: fixture.fullStackName('param-test-1'),
  });

  const stackArn = response.Stacks?.[0].StackId;
  expect(response.Stacks?.[0].StackStatus).toEqual('ROLLBACK_COMPLETE');

  // WHEN
  const newStackArn = await fixture.cdkDeploy('param-test-1', {
    options: [
      '--parameters', `TopicNameParam=${fixture.stackNamePrefix}allgood`,
    ],
    captureStderr: false,
  });

  const newStackResponse = await fixture.aws.cloudFormation('describeStacks', {
    StackName: newStackArn,
  });

  // THEN
  expect (stackArn).not.toEqual(newStackArn); // new stack was created
  expect(newStackResponse.Stacks?.[0].StackStatus).toEqual('CREATE_COMPLETE');
  expect(newStackResponse.Stacks?.[0].Parameters).toEqual([
    {
      ParameterKey: 'TopicNameParam',
      ParameterValue: `${fixture.stackNamePrefix}allgood`,
    },
  ]);
}));

integTest('stack in UPDATE_ROLLBACK_COMPLETE state can be updated', withDefaultFixture(async (fixture) => {
  // GIVEN
  const stackArn = await fixture.cdkDeploy('param-test-1', {
    options: [
      '--parameters', `TopicNameParam=${fixture.stackNamePrefix}nice`,
    ],
    captureStderr: false,
  });

  let response = await fixture.aws.cloudFormation('describeStacks', {
    StackName: stackArn,
  });

  expect(response.Stacks?.[0].StackStatus).toEqual('CREATE_COMPLETE');

  // bad parameter name with @ will put stack into UPDATE_ROLLBACK_COMPLETE
  await expect(fixture.cdkDeploy('param-test-1', {
    options: [
      '--parameters', `TopicNameParam=${fixture.stackNamePrefix}@aww`,
    ],
    captureStderr: false,
  })).rejects.toThrow('exited with error');;

  response = await fixture.aws.cloudFormation('describeStacks', {
    StackName: stackArn,
  });

  expect(response.Stacks?.[0].StackStatus).toEqual('UPDATE_ROLLBACK_COMPLETE');

  // WHEN
  await fixture.cdkDeploy('param-test-1', {
    options: [
      '--parameters', `TopicNameParam=${fixture.stackNamePrefix}allgood`,
    ],
    captureStderr: false,
  });

  response = await fixture.aws.cloudFormation('describeStacks', {
    StackName: stackArn,
  });

  // THEN
  expect(response.Stacks?.[0].StackStatus).toEqual('UPDATE_COMPLETE');
  expect(response.Stacks?.[0].Parameters).toEqual([
    {
      ParameterKey: 'TopicNameParam',
      ParameterValue: `${fixture.stackNamePrefix}allgood`,
    },
  ]);
}));

integTest('deploy with wildcard and parameters', withDefaultFixture(async (fixture) => {
  await fixture.cdkDeploy('param-test-*', {
    options: [
      '--parameters', `${fixture.stackNamePrefix}-param-test-1:TopicNameParam=${fixture.stackNamePrefix}bazinga`,
      '--parameters', `${fixture.stackNamePrefix}-param-test-2:OtherTopicNameParam=${fixture.stackNamePrefix}ThatsMySpot`,
      '--parameters', `${fixture.stackNamePrefix}-param-test-3:DisplayNameParam=${fixture.stackNamePrefix}HeyThere`,
      '--parameters', `${fixture.stackNamePrefix}-param-test-3:OtherDisplayNameParam=${fixture.stackNamePrefix}AnotherOne`,
    ],
  });
}));

integTest('deploy with parameters multi', withDefaultFixture(async (fixture) => {
  const paramVal1 = `${fixture.stackNamePrefix}bazinga`;
  const paramVal2 = `${fixture.stackNamePrefix}=jagshemash`;

  const stackArn = await fixture.cdkDeploy('param-test-3', {
    options: [
      '--parameters', `DisplayNameParam=${paramVal1}`,
      '--parameters', `OtherDisplayNameParam=${paramVal2}`,
    ],
    captureStderr: false,
  });

  const response = await fixture.aws.cloudFormation('describeStacks', {
    StackName: stackArn,
  });

  expect(response.Stacks?.[0].Parameters).toEqual([
    {
      ParameterKey: 'DisplayNameParam',
      ParameterValue: paramVal1,
    },
    {
      ParameterKey: 'OtherDisplayNameParam',
      ParameterValue: paramVal2,
    },
  ]);
}));

integTest('deploy with notification ARN', withDefaultFixture(async (fixture) => {
  const topicName = `${fixture.stackNamePrefix}-test-topic`;

  const response = await fixture.aws.sns('createTopic', { Name: topicName });
  const topicArn = response.TopicArn!;
  try {
    await fixture.cdkDeploy('test-2', {
      options: ['--notification-arns', topicArn],
    });

    // verify that the stack we deployed has our notification ARN
    const describeResponse = await fixture.aws.cloudFormation('describeStacks', {
      StackName: fixture.fullStackName('test-2'),
    });
    expect(describeResponse.Stacks?.[0].NotificationARNs).toEqual([topicArn]);
  } finally {
    await fixture.aws.sns('deleteTopic', {
      TopicArn: topicArn,
    });
  }
}));

integTest('deploy with role', withDefaultFixture(async (fixture) => {
  const roleName = `${fixture.stackNamePrefix}-test-role`;

  await deleteRole();

  const createResponse = await fixture.aws.iam('createRole', {
    RoleName: roleName,
    AssumeRolePolicyDocument: JSON.stringify({
      Version: '2012-10-17',
      Statement: [{
        Action: 'sts:AssumeRole',
        Principal: { Service: 'cloudformation.amazonaws.com' },
        Effect: 'Allow',
      }, {
        Action: 'sts:AssumeRole',
        Principal: { AWS: (await fixture.aws.sts('getCallerIdentity', {})).Arn },
        Effect: 'Allow',
      }],
    }),
  });
  const roleArn = createResponse.Role.Arn;
  try {
    await fixture.aws.iam('putRolePolicy', {
      RoleName: roleName,
      PolicyName: 'DefaultPolicy',
      PolicyDocument: JSON.stringify({
        Version: '2012-10-17',
        Statement: [{
          Action: '*',
          Resource: '*',
          Effect: 'Allow',
        }],
      }),
    });

    await retry(fixture.output, 'Trying to assume fresh role', retry.forSeconds(300), async () => {
      await fixture.aws.sts('assumeRole', {
        RoleArn: roleArn,
        RoleSessionName: 'testing',
      });
    });

    // In principle, the role has replicated from 'us-east-1' to wherever we're testing.
    // Give it a little more sleep to make sure CloudFormation is not hitting a box
    // that doesn't have it yet.
    await sleep(5000);

    await fixture.cdkDeploy('test-2', {
      options: ['--role-arn', roleArn],
    });

    // Immediately delete the stack again before we delete the role.
    //
    // Since roles are sticky, if we delete the role before the stack, subsequent DeleteStack
    // operations will fail when CloudFormation tries to assume the role that's already gone.
    await fixture.cdkDestroy('test-2');
  } finally {
    await deleteRole();
  }

  async function deleteRole() {
    try {
      for (const policyName of (await fixture.aws.iam('listRolePolicies', { RoleName: roleName })).PolicyNames) {
        await fixture.aws.iam('deleteRolePolicy', {
          RoleName: roleName,
          PolicyName: policyName,
        });
      }
      await fixture.aws.iam('deleteRole', { RoleName: roleName });
    } catch (e) {
      if (e.message.indexOf('cannot be found') > -1) { return; }
      throw e;
    }
  }
}));

integTest('cdk diff', withDefaultFixture(async (fixture) => {
  const diff1 = await fixture.cdk(['diff', fixture.fullStackName('test-1')]);
  expect(diff1).toContain('AWS::SNS::Topic');

  const diff2 = await fixture.cdk(['diff', fixture.fullStackName('test-2')]);
  expect(diff2).toContain('AWS::SNS::Topic');

  // We can make it fail by passing --fail
  await expect(fixture.cdk(['diff', '--fail', fixture.fullStackName('test-1')]))
    .rejects.toThrow('exited with error');
}));

integTest('cdk diff --fail on multiple stacks exits with error if any of the stacks contains a diff', withDefaultFixture(async (fixture) => {
  // GIVEN
  const diff1 = await fixture.cdk(['diff', fixture.fullStackName('test-1')]);
  expect(diff1).toContain('AWS::SNS::Topic');

  await fixture.cdkDeploy('test-2');
  const diff2 = await fixture.cdk(['diff', fixture.fullStackName('test-2')]);
  expect(diff2).toContain('There were no differences');

  // WHEN / THEN
  await expect(fixture.cdk(['diff', '--fail', fixture.fullStackName('test-1'), fixture.fullStackName('test-2')])).rejects.toThrow('exited with error');
}));

integTest('cdk diff --fail with multiple stack exits with if any of the stacks contains a diff', withDefaultFixture(async (fixture) => {
  // GIVEN
  await fixture.cdkDeploy('test-1');
  const diff1 = await fixture.cdk(['diff', fixture.fullStackName('test-1')]);
  expect(diff1).toContain('There were no differences');

  const diff2 = await fixture.cdk(['diff', fixture.fullStackName('test-2')]);
  expect(diff2).toContain('AWS::SNS::Topic');

  // WHEN / THEN
  await expect(fixture.cdk(['diff', '--fail', fixture.fullStackName('test-1'), fixture.fullStackName('test-2')])).rejects.toThrow('exited with error');
}));

integTest('deploy stack with docker asset', withDefaultFixture(async (fixture) => {
  await fixture.cdkDeploy('docker');
}));

integTest('deploy and test stack with lambda asset', withDefaultFixture(async (fixture) => {
  const stackArn = await fixture.cdkDeploy('lambda', { captureStderr: false });

  const response = await fixture.aws.cloudFormation('describeStacks', {
    StackName: stackArn,
  });
  const lambdaArn = response.Stacks?.[0].Outputs?.[0].OutputValue;
  if (lambdaArn === undefined) {
    throw new Error('Stack did not have expected Lambda ARN output');
  }

  const output = await fixture.aws.lambda('invoke', {
    FunctionName: lambdaArn,
  });

  expect(JSON.stringify(output.Payload)).toContain('dear asset');
}));

integTest('cdk ls', withDefaultFixture(async (fixture) => {
  const listing = await fixture.cdk(['ls'], { captureStderr: false });

  const expectedStacks = [
    'conditional-resource',
    'docker',
    'docker-with-custom-file',
    'failed',
    'iam-test',
    'lambda',
    'missing-ssm-parameter',
    'order-providing',
    'outputs-test-1',
    'outputs-test-2',
    'param-test-1',
    'param-test-2',
    'param-test-3',
    'termination-protection',
    'test-1',
    'test-2',
    'with-nested-stack',
    'with-nested-stack-using-parameters',
    'order-consuming',
  ];

  for (const stack of expectedStacks) {
    expect(listing).toContain(fixture.fullStackName(stack));
  }
}));

integTest('synthing a stage with errors leads to failure', withDefaultFixture(async (fixture) => {
  const output = await fixture.cdk(['synth'], {
    allowErrExit: true,
    modEnv: {
      INTEG_STACK_SET: 'stage-with-errors',
    },
  });

  expect(output).toContain('This is an error');
}));

integTest('synthing a stage with errors can be suppressed', withDefaultFixture(async (fixture) => {
  await fixture.cdk(['synth', '--no-validation'], {
    modEnv: {
      INTEG_STACK_SET: 'stage-with-errors',
    },
  });
}));

integTest('deploy stack without resource', withDefaultFixture(async (fixture) => {
  // Deploy the stack without resources
  await fixture.cdkDeploy('conditional-resource', { modEnv: { NO_RESOURCE: 'TRUE' } });

  // This should have succeeded but not deployed the stack.
  await expect(fixture.aws.cloudFormation('describeStacks', { StackName: fixture.fullStackName('conditional-resource') }))
    .rejects.toThrow('conditional-resource does not exist');

  // Deploy the stack with resources
  await fixture.cdkDeploy('conditional-resource');

  // Then again WITHOUT resources (this should destroy the stack)
  await fixture.cdkDeploy('conditional-resource', { modEnv: { NO_RESOURCE: 'TRUE' } });

  await expect(fixture.aws.cloudFormation('describeStacks', { StackName: fixture.fullStackName('conditional-resource') }))
    .rejects.toThrow('conditional-resource does not exist');
}));

integTest('IAM diff', withDefaultFixture(async (fixture) => {
  const output = await fixture.cdk(['diff', fixture.fullStackName('iam-test')]);

  // Roughly check for a table like this:
  //
  // ┌───┬─────────────────┬────────┬────────────────┬────────────────────────────-──┬───────────┐
  // │   │ Resource        │ Effect │ Action         │ Principal                     │ Condition │
  // ├───┼─────────────────┼────────┼────────────────┼───────────────────────────────┼───────────┤
  // │ + │ ${SomeRole.Arn} │ Allow  │ sts:AssumeRole │ Service:ec2.amazonaws.com     │           │
  // └───┴─────────────────┴────────┴────────────────┴───────────────────────────────┴───────────┘

  expect(output).toContain('${SomeRole.Arn}');
  expect(output).toContain('sts:AssumeRole');
  expect(output).toContain('ec2.amazonaws.com');
}));

integTest('fast deploy', withDefaultFixture(async (fixture) => {
  // we are using a stack with a nested stack because CFN will always attempt to
  // update a nested stack, which will allow us to verify that updates are actually
  // skipped unless --force is specified.
  const stackArn = await fixture.cdkDeploy('with-nested-stack', { captureStderr: false });
  const changeSet1 = await getLatestChangeSet();

  // Deploy the same stack again, there should be no new change set created
  await fixture.cdkDeploy('with-nested-stack');
  const changeSet2 = await getLatestChangeSet();
  expect(changeSet2.ChangeSetId).toEqual(changeSet1.ChangeSetId);

  // Deploy the stack again with --force, now we should create a changeset
  await fixture.cdkDeploy('with-nested-stack', { options: ['--force'] });
  const changeSet3 = await getLatestChangeSet();
  expect(changeSet3.ChangeSetId).not.toEqual(changeSet2.ChangeSetId);

  // Deploy the stack again with tags, expected to create a new changeset
  // even though the resources didn't change.
  await fixture.cdkDeploy('with-nested-stack', { options: ['--tags', 'key=value'] });
  const changeSet4 = await getLatestChangeSet();
  expect(changeSet4.ChangeSetId).not.toEqual(changeSet3.ChangeSetId);

  async function getLatestChangeSet() {
    const response = await fixture.aws.cloudFormation('describeStacks', { StackName: stackArn });
    if (!response.Stacks?.[0]) { throw new Error('Did not get a ChangeSet at all'); }
    fixture.log(`Found Change Set ${response.Stacks?.[0].ChangeSetId}`);
    return response.Stacks?.[0];
  }
}));

integTest('failed deploy does not hang', withDefaultFixture(async (fixture) => {
  // this will hang if we introduce https://github.com/aws/aws-cdk/issues/6403 again.
  await expect(fixture.cdkDeploy('failed')).rejects.toThrow('exited with error');
}));

integTest('can still load old assemblies', withDefaultFixture(async (fixture) => {
  const cxAsmDir = path.join(os.tmpdir(), 'cdk-integ-cx');

  const testAssembliesDirectory = path.join(__dirname, 'cloud-assemblies');
  for (const asmdir of await listChildDirs(testAssembliesDirectory)) {
    fixture.log(`ASSEMBLY ${asmdir}`);
    await cloneDirectory(asmdir, cxAsmDir);

    // Some files in the asm directory that have a .js extension are
    // actually treated as templates. Evaluate them using NodeJS.
    const templates = await listChildren(cxAsmDir, fullPath => Promise.resolve(fullPath.endsWith('.js')));
    for (const template of templates) {
      const targetName = template.replace(/.js$/, '');
      await shell([process.execPath, template, '>', targetName], {
        cwd: cxAsmDir,
        output: fixture.output,
        modEnv: {
          TEST_ACCOUNT: await fixture.aws.account(),
          TEST_REGION: fixture.aws.region,
        },
      });
    }

    // Use this directory as a Cloud Assembly
    const output = await fixture.cdk([
      '--app', cxAsmDir,
      '-v',
      'synth',
    ]);

    // Assert that there was no providerError in CDK's stderr
    // Because we rely on the app/framework to actually error in case the
    // provider fails, we inspect the logs here.
    expect(output).not.toContain('$providerError');
  }
}));

integTest('generating and loading assembly', withDefaultFixture(async (fixture) => {
  const asmOutputDir = `${fixture.integTestDir}-cdk-integ-asm`;
  await fixture.shell(['rm', '-rf', asmOutputDir]);

  // Synthesize a Cloud Assembly tothe default directory (cdk.out) and a specific directory.
  await fixture.cdk(['synth']);
  await fixture.cdk(['synth', '--output', asmOutputDir]);

  // cdk.out in the current directory and the indicated --output should be the same
  await fixture.shell(['diff', 'cdk.out', asmOutputDir]);

  // Check that we can 'ls' the synthesized asm.
  // Change to some random directory to make sure we're not accidentally loading cdk.json
  const list = await fixture.cdk(['--app', asmOutputDir, 'ls'], { cwd: os.tmpdir() });
  // Same stacks we know are in the app
  expect(list).toContain(`${fixture.stackNamePrefix}-lambda`);
  expect(list).toContain(`${fixture.stackNamePrefix}-test-1`);
  expect(list).toContain(`${fixture.stackNamePrefix}-test-2`);

  // Check that we can use '.' and just synth ,the generated asm
  const stackTemplate = await fixture.cdk(['--app', '.', 'synth', fixture.fullStackName('test-2')], {
    cwd: asmOutputDir,
  });
  expect(stackTemplate).toContain('topic152D84A37');

  // Deploy a Lambda from the copied asm
  await fixture.cdkDeploy('lambda', { options: ['-a', '.'], cwd: asmOutputDir });

  // Remove (rename) the original custom docker file that was used during synth.
  // this verifies that the assemly has a copy of it and that the manifest uses
  // relative paths to reference to it.
  const customDockerFile = path.join(fixture.integTestDir, 'docker', 'Dockerfile.Custom');
  await fs.rename(customDockerFile, `${customDockerFile}~`);
  try {
    // deploy a docker image with custom file without synth (uses assets)
    await fixture.cdkDeploy('docker-with-custom-file', { options: ['-a', '.'], cwd: asmOutputDir });
  } finally {
    // Rename back to restore fixture to original state
    await fs.rename(`${customDockerFile}~`, customDockerFile);
  }
}));

integTest('templates on disk contain metadata resource, also in nested assemblies', withDefaultFixture(async (fixture) => {
  // Synth first, and switch on version reporting because cdk.json is disabling it
  await fixture.cdk(['synth', '--version-reporting=true']);

  // Load template from disk from root assembly
  const templateContents = await fixture.shell(['cat', 'cdk.out/*-lambda.template.json']);

  expect(JSON.parse(templateContents).Resources.CDKMetadata).toBeTruthy();

  // Load template from nested assembly
  const nestedTemplateContents = await fixture.shell(['cat', 'cdk.out/assembly-*-stage/*-stage-StackInStage.template.json']);

  expect(JSON.parse(nestedTemplateContents).Resources.CDKMetadata).toBeTruthy();
}));

async function listChildren(parent: string, pred: (x: string) => Promise<boolean>) {
  const ret = new Array<string>();
  for (const child of await fs.readdir(parent, { encoding: 'utf-8' })) {
    const fullPath = path.join(parent, child.toString());
    if (await pred(fullPath)) {
      ret.push(fullPath);
    }
  }
  return ret;
}

async function listChildDirs(parent: string) {
  return listChildren(parent, async (fullPath: string) => (await fs.stat(fullPath)).isDirectory());
}
