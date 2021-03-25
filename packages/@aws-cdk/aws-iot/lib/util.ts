export { generatePolicyName } from '@aws-cdk/aws-iam/lib/util';
import { Stack } from '@aws-cdk/core';
import { IConstruct } from 'constructs';
import { CertificateAttributes } from './certificate';
import { ThingAttributes } from './thing';

export function parsePolicyArn(construct: IConstruct, policyName: string): string {
  return parseArn(construct, 'policy', policyName);
}

export function parseCertificateArn(construct: IConstruct, props: CertificateAttributes): string {
  if (props.certificateArn) {
    return props.certificateArn;
  }

  if (props.certificateId) {
    return parseArn(construct, 'cert', props.certificateId);
  }

  throw new Error('Cannot determine certifiate ARN. At least `certificateArn` or `certifiateId` is needed');
}

export function parseCertificateId(construct: IConstruct, props: CertificateAttributes): string {
  if (props.certificateId) {
    return props.certificateId;
  }

  // extract certificate id from certificate arn
  if (props.certificateArn) {
    return Stack.of(construct).parseArn(props.certificateArn).resourceName?.replace('cert/', '') || '';
  }

  throw new Error('Cannot determine certifiate ID. At least `certificateArn` or `certifiateId` is needed');
}

export function parseThingArn(construct: IConstruct, props: ThingAttributes): string {
  if (props.thingArn) {
    return props.thingArn;
  }

  if (props.thingName) {
    return parseArn(construct, 'thing', props.thingName);
  }

  throw new Error('Cannot determine thing ARN. At least `thingArn` or `thingName` is needed');
}

export function parseThingName(construct: IConstruct, props: ThingAttributes): string {
  if (props.thingName) {
    return props.thingName;
  }

  // extract certificate id from certificate arn
  if (props.thingArn) {
    return Stack.of(construct).parseArn(props.thingArn).resourceName?.replace('thing/', '') || '';
  }

  throw new Error('Cannot determine thing ID. At least `thingArn` or `thingName` is needed');
}

function parseArn(construct: IConstruct, resource: string, resourceName: string): string {
  return Stack.of(construct).formatArn({
    region: Stack.of(construct).region,
    account: Stack.of(construct).account,
    service: 'iot',
    resource: resource,
    resourceName: resourceName,
  });
}
