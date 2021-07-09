import { SecretValue } from '@aws-cdk/core';
import { ContainerDefinition, Secret } from '../container-definition';
import { BaseLogDriverProps } from './base-log-driver';
import { LogDriver, LogDriverConfig } from './log-driver';
import { ensureInRange, renderCommonLogDriverOptions, renderLogDriverSecretOptions, stringifyOptions } from './utils';

// v2 - keep this import as a separate section to reduce merge conflict when forward merging with the v2 branch.
// eslint-disable-next-line
import { Construct as CoreConstruct } from '@aws-cdk/core';

/**
 * Log Message Format
 */
export enum SplunkLogFormat {
  INLINE = 'inline',
  JSON = 'json',
  RAW = 'raw'
}

/**
 * Specifies the splunk log driver configuration options.
 *
 * [Source](https://docs.docker.com/config/containers/logging/splunk/)
 */
export interface SplunkLogDriverProps extends BaseLogDriverProps {
  /**
   * Splunk HTTP Event Collector token.
   *
   * The splunk-token is added to the Options property of the Log Driver Configuration. So the secret value will be resolved and
   * viewable in plain text in the console.
   *
   * Please provide at least one of `token` or `secretToken`.
   * @deprecated Use {@link SplunkLogDriverProps.secretToken} instead.
   * @default - token not provided.
   */
  readonly token?: SecretValue;

  /**
   * Splunk HTTP Event Collector token (Secret).
   *
   * The splunk-token is added to the SecretOptions property of the Log Driver Configuration. So the secret value will not be
   * resolved or viewable as plain text.
   *
   * Please provide at least one of `token` or `secretToken`.
   * @default - If secret token is not provided, then the value provided in `token` will be used.
   */
  readonly secretToken?: Secret;

  /**
   * Path to your Splunk Enterprise, self-service Splunk Cloud instance, or Splunk
   * Cloud managed cluster (including port and scheme used by HTTP Event Collector)
   * in one of the following formats: https://your_splunk_instance:8088 or
   * https://input-prd-p-XXXXXXX.cloud.splunk.com:8088 or https://http-inputs-XXXXXXXX.splunkcloud.com.
   */
  readonly url: string;

  /**
   * Event source.
   *
   * @default - source not set.
   */
  readonly source?: string;

  /**
   * Event source type.
   *
   * @default - sourceType not set.
   */
  readonly sourceType?: string;

  /**
   * Event index.
   *
   * @default - index not set.
   */
  readonly index?: string;

  /**
   * Path to root certificate.
   *
   * @default - caPath not set.
   */
  readonly caPath?: string;

  /**
   * Name to use for validating server certificate.
   *
   * @default - The hostname of the splunk-url
   */
  readonly caName?: string;

  /**
   * Ignore server certificate validation.
   *
   * @default - insecureSkipVerify not set.
   */
  readonly insecureSkipVerify?: string;

  /**
   * Message format. Can be inline, json or raw.
   *
   * @default - inline
   */
  readonly format?: SplunkLogFormat;

  /**
   * Verify on start, that docker can connect to Splunk server.
   *
   * @default - true
   */
  readonly verifyConnection?: boolean;

  /**
   * Enable/disable gzip compression to send events to Splunk Enterprise or Splunk
   * Cloud instance.
   *
   * @default - false
   */
  readonly gzip?: boolean;

  /**
   * Set compression level for gzip. Valid values are -1 (default), 0 (no compression),
   * 1 (best speed) ... 9 (best compression).
   *
   * @default - -1 (Default Compression)
   */
  readonly gzipLevel?: number;
}

/**
 * A log driver that sends log information to splunk Logs.
 */
export class SplunkLogDriver extends LogDriver {
  /**
   * Constructs a new instance of the SplunkLogDriver class.
   *
   * @param props the splunk log driver configuration options.
   */
  constructor(private readonly props: SplunkLogDriverProps) {
    super();

    if (!props.token && !props.secretToken) {
      throw new Error('Please provide either token or secretToken.');
    }
    if (props.gzipLevel) {
      ensureInRange(props.gzipLevel, -1, 9);
    }
  }

  /**
   * Called when the log driver is configured on a container
   */
  public bind(_scope: CoreConstruct, _containerDefinition: ContainerDefinition): LogDriverConfig {
    const options = stringifyOptions({
      'splunk-token': this.props.token,
      'splunk-url': this.props.url,
      'splunk-source': this.props.source,
      'splunk-sourcetype': this.props.sourceType,
      'splunk-index': this.props.index,
      'splunk-capath': this.props.caPath,
      'splunk-caname': this.props.caName,
      'splunk-insecureskipverify': this.props.insecureSkipVerify,
      'splunk-format': this.props.format,
      'splunk-verify-connection': this.props.verifyConnection,
      'splunk-gzip': this.props.gzip,
      'splunk-gzip-level': this.props.gzipLevel,
      ...renderCommonLogDriverOptions(this.props),
    });

    return {
      logDriver: 'splunk',
      options,
      secretOptions: this.props.secretToken && renderLogDriverSecretOptions({ 'splunk-token': this.props.secretToken }, _containerDefinition.taskDefinition),
    };
  }
}
