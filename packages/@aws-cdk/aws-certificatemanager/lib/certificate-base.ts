import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import { Statistic } from '@aws-cdk/aws-cloudwatch';
import { Duration, Resource } from '@aws-cdk/core';
import { ICertificate } from './certificate';

/**
 * Shared implementation details of ICertificate implementations.
 *
 * @internal
 */
export abstract class CertificateBase extends Resource implements ICertificate {
  public abstract readonly certificateArn: string;

  /**
    * If the certificate is provisionned in a different region than the
    * containing stack, this should be the region in which the certificate lives
    * so we can correctly create `Metric` instances.
    */
  protected readonly region?: string;

  public metricDaysToExpiry(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return new cloudwatch.Metric({
      period: Duration.days(1),
      ...props,
      dimensions: { CertificateArn: this.certificateArn },
      metricName: 'DaysToExpiry',
      namespace: 'AWS/CertificateManager',
      region: this.region,
      statistic: Statistic.MINIMUM,
    });
  }
}
