export * from './bastion-host';
export * from './connections';
export * from './instance-types';
export * from './instance';
export * from './machine-image';
export * from './nat';
export * from './network-acl';
export * from './network-acl-types';
export * from './port';
export * from './security-group';
export * from './peer';
export * from './volume';
export * from './vpc';
export * from './vpc-lookup';
export * from './vpn';
export * from './vpc-endpoint';
export * from './vpc-endpoint-service';
export * from './vpc-peering-connection';
export * from './user-data';
export * from './windows-versions';
export * from './vpc-flow-logs';

// AWS::EC2 CloudFormation Resources:
export * from './ec2.generated';

import './ec2-augmentations.generated';
