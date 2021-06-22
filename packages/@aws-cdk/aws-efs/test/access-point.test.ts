import { TemplateAssertions } from '@aws-cdk/assertions';
import * as ec2 from '@aws-cdk/aws-ec2';
import { Stack } from '@aws-cdk/core';
import { AccessPoint, FileSystem } from '../lib';

let stack: Stack;
let vpc: ec2.Vpc;
let fileSystem: FileSystem;

beforeEach(() => {
  stack = new Stack();
  vpc = new ec2.Vpc(stack, 'VPC');
  fileSystem = new FileSystem(stack, 'EfsFileSystem', {
    vpc,
  });
});

test('addAccessPoint correctly', () => {
  // WHEN
  fileSystem.addAccessPoint('MyAccessPoint');
  // THEN
  TemplateAssertions.fromStack(stack).resourceCountIs('AWS::EFS::AccessPoint', 1);
});

test('new AccessPoint correctly', () => {
  // WHEN
  new AccessPoint(stack, 'MyAccessPoint', {
    fileSystem,
  });
  // THEN
  TemplateAssertions.fromStack(stack).resourceCountIs('AWS::EFS::AccessPoint', 1);
});

test('import an AccessPoint using fromAccessPointId', () => {
  // WHEN
  const ap = new AccessPoint(stack, 'MyAccessPoint', {
    fileSystem,
  });
  const imported = AccessPoint.fromAccessPointId(stack, 'ImportedAccessPoint', ap.accessPointId);
  // THEN
  expect(imported.accessPointId).toEqual(ap.accessPointId);
});

test('import an AccessPoint using fromAccessPointId throws when accessing fileSystem', () => {
  // WHEN
  const ap = new AccessPoint(stack, 'MyAccessPoint', {
    fileSystem,
  });
  const imported = AccessPoint.fromAccessPointId(stack, 'ImportedAccessPoint', ap.accessPointId);
  // THEN
  expect(() => imported.fileSystem).toThrow(/fileSystem is not available when 'fromAccessPointId\(\)' is used. Use 'fromAccessPointAttributes\(\)' instead/);
});

test('import an AccessPoint using fromAccessPointAttributes and the accessPointId', () => {
  // WHEN
  const ap = new AccessPoint(stack, 'MyAccessPoint', {
    fileSystem,
  });
  const imported = AccessPoint.fromAccessPointAttributes(stack, 'ImportedAccessPoint', {
    accessPointId: ap.accessPointId,
    fileSystem: fileSystem,
  });
  // THEN
  expect(imported.accessPointId).toEqual(ap.accessPointId);
  expect(imported.accessPointArn).toEqual(ap.accessPointArn);
  expect(imported.fileSystem).toEqual(ap.fileSystem);
});

test('import an AccessPoint using fromAccessPointAttributes and the accessPointArn', () => {
  // WHEN
  const ap = new AccessPoint(stack, 'MyAccessPoint', {
    fileSystem,
  });
  const imported = AccessPoint.fromAccessPointAttributes(stack, 'ImportedAccessPoint', {
    accessPointArn: ap.accessPointArn,
    fileSystem: fileSystem,
  });
  // THEN
  expect(imported.accessPointId).toEqual(ap.accessPointId);
  expect(imported.accessPointArn).toEqual(ap.accessPointArn);
  expect(imported.fileSystem).toEqual(ap.fileSystem);
});

test('import using accessPointArn', () => {
  // WHEN
  const ap = new AccessPoint(stack, 'MyAccessPoint', {
    fileSystem,
  });
  const imported = AccessPoint.fromAccessPointAttributes(stack, 'ImportedAccessPoint', {
    accessPointArn: ap.accessPointArn,
    fileSystem: fileSystem,
  });
  // THEN
  expect(imported.accessPointId).toEqual(ap.accessPointId);
  expect(imported.accessPointArn).toEqual(ap.accessPointArn);
  expect(imported.fileSystem).toEqual(ap.fileSystem);
});

test('throw when import using accessPointArn and accessPointId', () => {
  // WHEN
  const ap = new AccessPoint(stack, 'MyAccessPoint', {
    fileSystem,
  });

  // THEN
  expect(() => AccessPoint.fromAccessPointAttributes(stack, 'ImportedAccessPoint', {
    accessPointArn: ap.accessPointArn,
    accessPointId: ap.accessPointId,
    fileSystem: fileSystem,
  })).toThrow(/Only one of accessPointId or AccessPointArn can be provided!/);
});

test('throw when import without accessPointArn or accessPointId', () => {
  // WHEN
  new AccessPoint(stack, 'MyAccessPoint', {
    fileSystem,
  });

  // THEN
  expect(() => AccessPoint.fromAccessPointAttributes(stack, 'ImportedAccessPoint', {
    fileSystem: fileSystem,
  })).toThrow(/One of accessPointId or AccessPointArn is required!/);
});

test('custom access point is created correctly', () => {
  // WHEN
  new AccessPoint(stack, 'MyAccessPoint', {
    fileSystem,
    createAcl: {
      ownerGid: '1000',
      ownerUid: '1000',
      permissions: '755',
    },
    path: '/export/share',
    posixUser: {
      gid: '1000',
      uid: '1000',
      secondaryGids: [
        '1001',
        '1002',
      ],
    },

  });
  // THEN
  TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::EFS::AccessPoint', {
    FileSystemId: {
      Ref: 'EfsFileSystem37910666',
    },
    PosixUser: {
      Gid: '1000',
      SecondaryGids: [
        '1001',
        '1002',
      ],
      Uid: '1000',
    },
    RootDirectory: {
      CreationInfo: {
        OwnerGid: '1000',
        OwnerUid: '1000',
        Permissions: '755',
      },
      Path: '/export/share',
    },
  });
});
