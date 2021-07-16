import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import { Aws } from '@aws-cdk/core';
import { CfnDeploymentGroup } from './codedeploy.generated';
import { AutoRollbackConfig } from './rollback-config';
import {TriggerConfiguration, TriggerEvent} from './trigger-configuration';

export function arnForApplication(applicationName: string): string {
  return `arn:${Aws.PARTITION}:codedeploy:${Aws.REGION}:${Aws.ACCOUNT_ID}:application:${applicationName}`;
}

export function arnForDeploymentGroup(applicationName: string, deploymentGroupName: string): string {
  return `arn:${Aws.PARTITION}:codedeploy:${Aws.REGION}:${Aws.ACCOUNT_ID}:deploymentgroup:${applicationName}/${deploymentGroupName}`;
}

export function arnForDeploymentConfig(name: string): string {
  return `arn:${Aws.PARTITION}:codedeploy:${Aws.REGION}:${Aws.ACCOUNT_ID}:deploymentconfig:${name}`;
}

export function renderAlarmConfiguration(alarms: cloudwatch.IAlarm[], ignorePollAlarmFailure?: boolean):
CfnDeploymentGroup.AlarmConfigurationProperty | undefined {
  return alarms.length === 0
    ? undefined
    : {
      alarms: alarms.map(a => ({ name: a.alarmName })),
      enabled: true,
      ignorePollAlarmFailure,
    };
}

enum AutoRollbackEvent {
  DEPLOYMENT_FAILURE = 'DEPLOYMENT_FAILURE',
  DEPLOYMENT_STOP_ON_ALARM = 'DEPLOYMENT_STOP_ON_ALARM',
  DEPLOYMENT_STOP_ON_REQUEST = 'DEPLOYMENT_STOP_ON_REQUEST'
}

export function renderAutoRollbackConfiguration(alarms: cloudwatch.IAlarm[], autoRollbackConfig: AutoRollbackConfig = {}):
CfnDeploymentGroup.AutoRollbackConfigurationProperty | undefined {
  const events = new Array<string>();

  // we roll back failed deployments by default
  if (autoRollbackConfig.failedDeployment !== false) {
    events.push(AutoRollbackEvent.DEPLOYMENT_FAILURE);
  }

  // we _do not_ roll back stopped deployments by default
  if (autoRollbackConfig.stoppedDeployment === true) {
    events.push(AutoRollbackEvent.DEPLOYMENT_STOP_ON_REQUEST);
  }

  // we _do not_ roll back alarm-triggering deployments by default
  // unless the Deployment Group has at least one alarm
  if (autoRollbackConfig.deploymentInAlarm !== false) {
    if (alarms.length > 0) {
      events.push(AutoRollbackEvent.DEPLOYMENT_STOP_ON_ALARM);
    } else if (autoRollbackConfig.deploymentInAlarm === true) {
      throw new Error(
        "The auto-rollback setting 'deploymentInAlarm' does not have any effect unless you associate " +
        'at least one CloudWatch alarm with the Deployment Group');
    }
  }

  return events.length > 0
    ? {
      enabled: true,
      events,
    }
    : undefined;
}

export function renderTriggerConfiguration(triggerConfiguration: TriggerConfiguration): CfnDeploymentGroup.TriggerConfigProperty {
  return {
    triggerEvents: triggerConfiguration.triggerEvents === undefined
      ? []
      : triggerConfiguration.triggerEvents.map((te: TriggerEvent) => te.toString()),
    triggerName: triggerConfiguration.triggerName,
    triggerTargetArn: triggerConfiguration.triggerTargetArn ? triggerConfiguration.triggerTargetArn.toString() : '',
  };
}
