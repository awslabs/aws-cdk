/* eslint-disable no-console */
import type { OnEventRequest } from '@aws-cdk/custom-resources/lib/provider-framework/types';
import { AWSError, CloudFormation, DynamoDB } from 'aws-sdk'; // eslint-disable-line import/no-extraneous-dependencies
const dynamodb = new DynamoDB({ apiVersion: '2012-08-10' });
const cloudFormation = new CloudFormation({ apiVersion: '2010-05-15' });

export enum TimeToLiveStatus {
  STABLE_AND_CORRECT,
  STABLE_AND_INCORRECT,
  INSTABLE_AND_CORRECT,
  INSTABLE_AND_INCORRECT
}

export async function disableTimeToLive(event: OnEventRequest) {
  await catchAwsError(async () => {
    console.log('Trying to disable time to live.');

    await dynamodb.updateTimeToLive({
      TableName: event.ResourceProperties.TableName,
      TimeToLiveSpecification: {
        AttributeName:
          event.OldResourceProperties?.TimeToLiveAttribute
          ?? event.ResourceProperties.TimeToLiveAttribute,
        Enabled: false,
      },
    }).promise();
  });
}

export async function enableTimeToLive(event: OnEventRequest) {
  await catchAwsError(async () => {
    console.log('Trying to enable time to live.');

    await dynamodb.updateTimeToLive({
      TableName: event.ResourceProperties.TableName,
      TimeToLiveSpecification: {
        AttributeName: event.ResourceProperties.TimeToLiveAttribute,
        Enabled: true,
      },
    }).promise();
  });
}

async function catchAwsError(func: () => Promise<void>) {
  try {
    await func();
  } catch (err) {
    // Catch exception so we can try enabling again at a later point in time.
    // This is necessary if the ttl was just disabled as enabling is not available right away.
    // Allows the enabled -> disabled -> enabled flow to work.
    const awsError = err as AWSError;
    if (
      awsError.code === 'ValidationException'
      && awsError.message.includes('Time to live')
      && awsError.message.includes('interval')
    ) {
      console.log('Time to live has been modified multiple times within a fixed interval. Try again later.');
      return;
    }
    throw awsError;
  }
}

export async function getTimeToLiveStatus(event: OnEventRequest): Promise<TimeToLiveStatus> {
  const currentTtl = await dynamodb.describeTimeToLive({
    TableName: event.ResourceProperties.TableName,
  }).promise();

  console.log('Describe time to live: %j', currentTtl);

  const stable =
    currentTtl.TimeToLiveDescription?.TimeToLiveStatus === 'ENABLED'
    || currentTtl.TimeToLiveDescription?.TimeToLiveStatus === 'DISABLED';

  let correct =
    currentTtl.TimeToLiveDescription?.AttributeName ===
    event.ResourceProperties.TimeToLiveAttribute;

  if ( event.RequestType === 'Delete' ) {
    correct = currentTtl.TimeToLiveDescription?.TimeToLiveStatus === 'DISABLED';
  }

  if ( stable && correct ) {
    return TimeToLiveStatus.STABLE_AND_CORRECT;
  } else if ( stable && !correct ) {
    return TimeToLiveStatus.STABLE_AND_INCORRECT;
  } else if ( !stable && correct ) {
    return TimeToLiveStatus.INSTABLE_AND_CORRECT;
  } else {
    return TimeToLiveStatus.INSTABLE_AND_INCORRECT;
  }
}

export async function keepTTL(event: OnEventRequest): Promise<boolean> {
  const stacks = (await cloudFormation.describeStacks({ StackName: event.StackId }).promise()).Stacks;
  const changeSets = await Promise.all(( stacks ?? [] ).map(async (stack): Promise<CloudFormation.DescribeChangeSetOutput> => {
    if ( stack.ChangeSetId === undefined ) {
      throw new Error('Can not describe changeset without id');
    }
    return cloudFormation.describeChangeSet({ ChangeSetName: stack.ChangeSetId, StackName: event.StackId }).promise();
  }));

  const tableRemoval = tableWillBeRemoved(changeSets, event.PhysicalResourceId);
  const tableAttributeModified = tableTimeToLiveModified(changeSets, event.PhysicalResourceId);
  return tableRemoval || !tableAttributeModified;
}

function tableWillBeRemoved(changeSets: CloudFormation.DescribeChangeSetOutput[], tablePhysicalResourceId?: string): boolean {
  const tableRemoval = changeSets?.map((changeset): boolean => {
    return changeset.Changes?.map((change): boolean => {
      return change.Type === 'Resource'
        && change.ResourceChange?.ResourceType === 'AWS::DynamoDB::Table'
        && change.ResourceChange.PhysicalResourceId === tablePhysicalResourceId
        && change.ResourceChange.Action === 'Remove';
    }).reduce( (previousValue, currentValue) => previousValue || currentValue ) ?? false;
  }).reduce( (previousValue, currentValue) => previousValue || currentValue ) ?? false;

  console.log('Table will also be removed: %j', tableRemoval);
  return tableRemoval;
}

function tableTimeToLiveModified(changeSets: CloudFormation.DescribeChangeSetOutput[], tablePhysicalResourceId?: string): boolean {
  const tableAttributeModified = changeSets?.map((changeset): boolean => {
    return changeset.Changes?.map((change): boolean => {
      return change.Type === 'Resource'
        && change.ResourceChange?.ResourceType === 'AWS::DynamoDB::Table'
        && change.ResourceChange.PhysicalResourceId === tablePhysicalResourceId
        && change.ResourceChange.Action === 'Modify'
        && ( change.ResourceChange.Details ?? [] )
          .map( (detail): boolean => detail.Target?.Attribute === 'TimeToLiveSpecification')
          .some(ttlAttribute => ttlAttribute === true);
    }).reduce( (previousValue, currentValue) => previousValue || currentValue ) ?? false;
  }).reduce( (previousValue, currentValue) => previousValue || currentValue ) ?? false;

  console.log('Table TTL is modified: %j', tableAttributeModified);
  return tableAttributeModified;
}
