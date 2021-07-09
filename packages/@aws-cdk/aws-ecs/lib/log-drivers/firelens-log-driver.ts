import { ContainerDefinition, Secret } from '../container-definition';
import { BaseLogDriverProps } from './base-log-driver';
import { LogDriver, LogDriverConfig } from './log-driver';
import { removeEmpty, renderLogDriverSecretOptions } from './utils';

// v2 - keep this import as a separate section to reduce merge conflict when forward merging with the v2 branch.
// eslint-disable-next-line
import { Construct as CoreConstruct } from '@aws-cdk/core';

/**
 * Specifies the firelens log driver configuration options.
 */
export interface FireLensLogDriverProps extends BaseLogDriverProps {
  /**
   * The configuration options to send to the log driver.
   * @default - the log driver options
   */
  readonly options?: { [key: string]: string };

  /**
   * The secrets to pass to the log configuration.
   * @default - No secret options provided.
   */
  readonly secretOptions?: { [key: string]: Secret };
}

/**
 * FireLens enables you to use task definition parameters to route logs to an AWS service
 *  or AWS Partner Network (APN) destination for log storage and analytics
 */
export class FireLensLogDriver extends LogDriver {
  /**
   * The configuration options to send to the log driver.
   * @default - the log driver options
   */
  private options?: { [key: string]: string };

  /**
   * The secrets to pass to the log configuration.
   * @default - No secret options provided.
   */
  private secretOptions?: { [key: string]: Secret };

  /**
   * Constructs a new instance of the FireLensLogDriver class.
   * @param props the awsfirelens log driver configuration options.
   */
  constructor(props: FireLensLogDriverProps) {
    super();

    this.options = props.options;
    this.secretOptions = props.secretOptions;
  }

  /**
   * Called when the log driver is configured on a container
   */
  public bind(_scope: CoreConstruct, _containerDefinition: ContainerDefinition): LogDriverConfig {
    return {
      logDriver: 'awsfirelens',
      ...(this.options && { options: removeEmpty(this.options) }),
      secretOptions: this.secretOptions && renderLogDriverSecretOptions(this.secretOptions, _containerDefinition.taskDefinition),
    };
  }
}
