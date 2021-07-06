import { TemplateAssertions, Match } from '@aws-cdk/assertions';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as kms from '@aws-cdk/aws-kms';
import { App, RemovalPolicy, Size, Stack, Tags } from '@aws-cdk/core';
import * as cxapi from '@aws-cdk/cx-api';
import { testFutureBehavior, testLegacyBehavior } from 'cdk-build-tools/lib/feature-flag';
import { FileSystem, LifecyclePolicy, PerformanceMode, ThroughputMode } from '../lib';

let stack = new Stack();
let vpc = new ec2.Vpc(stack, 'VPC');

beforeEach(() => {
  stack = new Stack();
  vpc = new ec2.Vpc(stack, 'VPC');
});

testFutureBehavior(
  'when @aws-cdk/aws-efs:defaultEncryptionAtRest is enabled, encryption is enabled by default',
  { [cxapi.EFS_DEFAULT_ENCRYPTION_AT_REST]: true },
  App,
  (app) => {
    const customStack = new Stack(app);

    const customVpc = new ec2.Vpc(customStack, 'VPC');
    new FileSystem(customVpc, 'EfsFileSystem', {
      vpc: customVpc,
    });

    TemplateAssertions.fromStack(customStack).hasResourceProperties('AWS::EFS::FileSystem', {
      Encrypted: true,
    });

  });

testLegacyBehavior('when @aws-cdk/aws-efs:defaultEncryptionAtRest is missing, encryption is disabled by default', App, (app) => {
  const customStack = new Stack(app);

  const customVpc = new ec2.Vpc(customStack, 'VPC');
  new FileSystem(customVpc, 'EfsFileSystem', {
    vpc: customVpc,
  });

  TemplateAssertions.fromStack(customStack).hasResourceProperties('AWS::EFS::FileSystem', {
    Encrypted: Match.absentProperty(),
  });

});

test('default file system is created correctly', () => {
  // WHEN
  new FileSystem(stack, 'EfsFileSystem', {
    vpc,
  });
  // THEN
  const assertions = TemplateAssertions.fromStack(stack);
  assertions.hasResource('AWS::EFS::FileSystem', {
    DeletionPolicy: 'Retain',
    UpdateReplacePolicy: 'Retain',
  });
  assertions.resourceCountIs('AWS::EFS::MountTarget', 2);
  assertions.resourceCountIs('AWS::EC2::SecurityGroup', 1);
});

test('unencrypted file system is created correctly with default KMS', () => {
  // WHEN
  new FileSystem(stack, 'EfsFileSystem', {
    vpc,
    encrypted: false,
  });
  // THEN
  TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::EFS::FileSystem', {
    Encrypted: false,
  });
});

test('encrypted file system is created correctly with default KMS', () => {
  // WHEN
  new FileSystem(stack, 'EfsFileSystem', {
    vpc,
    encrypted: true,
  });
  // THEN
  TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::EFS::FileSystem', {
    Encrypted: true,
  });
});

test('encrypted file system is created correctly with custom KMS', () => {
  const key = new kms.Key(stack, 'customKeyFS');

  // WHEN
  new FileSystem(stack, 'EfsFileSystem', {
    vpc,
    encrypted: true,
    kmsKey: key,
  });
  // THEN

  /*
   * CDK appends 8-digit MD5 hash of the resource path to the logical Id of the resource in order to make sure
   * that the id is unique across multiple stacks. There isnt a direct way to identify the exact name of the resource
   * in generated CDK, hence hardcoding the MD5 hash here for assertion. Assumption is that the path of the Key wont
   * change in this UT. Checked the unique id by generating the cloud formation stack.
   */
  TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::EFS::FileSystem', {
    Encrypted: true,
    KmsKeyId: {
      'Fn::GetAtt': [
        'customKeyFSDDB87C6D',
        'Arn',
      ],
    },
  });
});

test('file system is created correctly with a life cycle property', () => {
  // WHEN
  new FileSystem(stack, 'EfsFileSystem', {
    vpc,
    lifecyclePolicy: LifecyclePolicy.AFTER_7_DAYS,
  });
  // THEN
  TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::EFS::FileSystem', {
    LifecyclePolicies: [{
      TransitionToIA: 'AFTER_7_DAYS',
    }],
  });
});

test('file system is created correctly with performance mode', () => {
  // WHEN
  new FileSystem(stack, 'EfsFileSystem', {
    vpc,
    performanceMode: PerformanceMode.MAX_IO,
  });
  // THEN
  TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::EFS::FileSystem', {
    PerformanceMode: 'maxIO',
  });
});

test('file system is created correctly with bursting throughput mode', () => {
  // WHEN
  new FileSystem(stack, 'EfsFileSystem', {
    vpc,
    throughputMode: ThroughputMode.BURSTING,
  });
  // THEN
  TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::EFS::FileSystem', {
    ThroughputMode: 'bursting',
  });
});

test('Exception when throughput mode is set to PROVISIONED, but provisioned throughput is not set', () => {
  expect(() => {
    new FileSystem(stack, 'EfsFileSystem', {
      vpc,
      throughputMode: ThroughputMode.PROVISIONED,
    });
  }).toThrowError(/Property provisionedThroughputPerSecond is required when throughputMode is PROVISIONED/);
});

test('fails when provisioned throughput is less than the valid range', () => {
  expect(() => new FileSystem(stack, 'EfsFileSystem', {
    vpc,
    throughputMode: ThroughputMode.PROVISIONED,
    provisionedThroughputPerSecond: Size.kibibytes(10),
  })).toThrow(/cannot be converted into a whole number/);
});

test('fails when provisioned throughput is not a whole number of mebibytes', () => {
  expect(() => {
    new FileSystem(stack, 'EfsFileSystem2', {
      vpc,
      throughputMode: ThroughputMode.PROVISIONED,
      provisionedThroughputPerSecond: Size.kibibytes(2050),
    });
  }).toThrowError(/cannot be converted into a whole number/);
});

test('file system is created correctly with provisioned throughput mode', () => {
  // WHEN
  new FileSystem(stack, 'EfsFileSystem', {
    vpc,
    throughputMode: ThroughputMode.PROVISIONED,
    provisionedThroughputPerSecond: Size.mebibytes(5),
  });
  // THEN
  TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::EFS::FileSystem', {
    ThroughputMode: 'provisioned',
    ProvisionedThroughputInMibps: 5,
  });
});

test('existing file system is imported correctly', () => {
  // WHEN
  const fs = FileSystem.fromFileSystemAttributes(stack, 'existingFS', {
    fileSystemId: 'fs123',
    securityGroup: ec2.SecurityGroup.fromSecurityGroupId(stack, 'SG', 'sg-123456789', {
      allowAllOutbound: false,
    }),
  });

  fs.connections.allowToAnyIpv4(ec2.Port.tcp(443));

  // THEN
  TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::EC2::SecurityGroupEgress', {
    GroupId: 'sg-123456789',
  });
});

test('support tags', () => {
  // WHEN
  const fileSystem = new FileSystem(stack, 'EfsFileSystem', {
    vpc,
  });
  Tags.of(fileSystem).add('Name', 'LookAtMeAndMyFancyTags');

  // THEN
  TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::EFS::FileSystem', {
    FileSystemTags: [
      { Key: 'Name', Value: 'LookAtMeAndMyFancyTags' },
    ],
  });
});

test('file system is created correctly when given a name', () => {
  // WHEN
  new FileSystem(stack, 'EfsFileSystem', {
    fileSystemName: 'MyNameableFileSystem',
    vpc,
  });

  // THEN
  TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::EFS::FileSystem', {
    FileSystemTags: [
      { Key: 'Name', Value: 'MyNameableFileSystem' },
    ],
  });
});

test('auto-named if none provided', () => {
  // WHEN
  const fileSystem = new FileSystem(stack, 'EfsFileSystem', {
    vpc,
  });

  // THEN
  TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::EFS::FileSystem', {
    FileSystemTags: [
      { Key: 'Name', Value: fileSystem.node.path },
    ],
  });
});

test('removalPolicy is DESTROY', () => {
  // WHEN
  new FileSystem(stack, 'EfsFileSystem', { vpc, removalPolicy: RemovalPolicy.DESTROY });

  // THEN
  TemplateAssertions.fromStack(stack).hasResource('AWS::EFS::FileSystem', {
    DeletionPolicy: 'Delete',
    UpdateReplacePolicy: 'Delete',
  });
});

test('can specify backup policy', () => {
  // WHEN
  new FileSystem(stack, 'EfsFileSystem', { vpc, enableAutomaticBackups: true });

  // THEN
  TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::EFS::FileSystem', {
    BackupPolicy: {
      Status: 'ENABLED',
    },
  });
});

test('can create when using a VPC with multiple subnets per availability zone', () => {
  // create a vpc with two subnets in the same availability zone.
  const oneAzVpc = new ec2.Vpc(stack, 'Vpc', {
    maxAzs: 1,
    subnetConfiguration: [{ name: 'One', subnetType: ec2.SubnetType.ISOLATED }, { name: 'Two', subnetType: ec2.SubnetType.ISOLATED }],
    natGateways: 0,
  });
  new FileSystem(stack, 'EfsFileSystem', {
    vpc: oneAzVpc,
  });
  // make sure only one mount target is created.
  TemplateAssertions.fromStack(stack).resourceCountIs('AWS::EFS::MountTarget', 1);
});
