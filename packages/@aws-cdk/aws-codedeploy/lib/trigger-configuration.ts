import * as cdk  from '@aws-cdk/core';

export interface TriggerConfiguration {
  readonly triggerName: string;
  readonly triggerTargetArn: cdk.Arn;
  readonly triggerEvents: TriggerEvent[];
}

export enum TriggerEvent {
  DEPLOYMENT_START = 'DeploymentStart',
  DEPLOYMENT_SUCCESS = 'DeploymentSuccess',
  DEPLOYMENT_FAILURE = 'DeploymentFailure',
  DEPLOYMENT_STOP = 'DeploymentStop',
  DEPLOYMENT_READY = 'DeploymentReady',
  DEPLOYMENT_ROLLBACK = 'DeploymentRollback',
  INSTANCE_START = 'InstanceStart',
  INSTANCE_SUCCESS = 'InstanceSuccess',
  INSTANCE_FAILURE = 'InstanceFailure',
  INSTANCE_READY = 'InstanceReady',
}
