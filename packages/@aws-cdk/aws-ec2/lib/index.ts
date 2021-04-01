export * from './bastion-host';
export * from './connections';
export * from './cfn-init';
export * from './cfn-init-elements';
export * from './instance-types';
export * from './instance';
export * from './launch-template';
export * from './machine-image';
export * from './nat';
export * from './network-acl';
export * from './network-acl-types';
export * from './port';
export * from './security-group';
export * from './subnet';
export * from './peer';
export * from './volume';
export * from './vpc';
export * from './vpc-lookup';
export * from './vpn';
export * from './vpc-endpoint';
export * from './vpc-endpoint-service';
export * from './user-data';
export * from './windows-versions';
export * from './vpc-flow-logs';
export * from './client-vpn-endpoint-types';
export * from './client-vpn-endpoint';
export * from './client-vpn-authorization-rule';
export * from './client-vpn-route';

// AWS::EC2 CloudFormation Resources:
export * from './ec2.generated';

import './ec2-augmentations.generated';
