import * as crypto from 'crypto';
import { DnsValidatedCertificate, ICertificate } from '@aws-cdk/aws-certificatemanager';
import { CloudFrontWebDistribution, OriginProtocolPolicy, PriceClass, ViewerProtocolPolicy } from '@aws-cdk/aws-cloudfront';
import { ARecord, IHostedZone, RecordTarget } from '@aws-cdk/aws-route53';
import { CloudFrontTarget } from '@aws-cdk/aws-route53-targets';
import { Bucket, RedirectProtocol } from '@aws-cdk/aws-s3';
import { Construct, RemovalPolicy, Stack, Token } from '@aws-cdk/core';

/**
 * Properties to configure an HTTPS Redirect
 */
export interface HttpsRedirectProps {
  /**
   * Hosted zone of the domain which will be used to create alias record(s) from
   * domain names in the hosted zone to the target domain. The hosted zone must
   * contain entries for the domain name(s) supplied through `recordNames` that
   * will redirect to the target domain.
   *
   * Domain names in the hosted zone can include a specific domain (example.com)
   * and its subdomains (acme.example.com, zenith.example.com).
   *
   */
  readonly zone: IHostedZone;

  /**
   * The redirect target fully qualified domain name (FQDN). An alias record
   * will be created that points to your CloudFront distribution. Root domain
   * or sub-domain can be supplied.
   */
  readonly targetDomain: string;

  /**
   * The domain names that will redirect to `targetDomain`
   *
   * @default - the domain name of the hosted zone
   */
  readonly recordNames?: string[];

  /**
   * The AWS Certificate Manager (ACM) certificate that will be associated with
   * the CloudFront distribution that will be created. If provided, the certificate must be
   * stored in us-east-1 (N. Virginia)
   *
   * @default - A new certificate is created in us-east-1 (N. Virginia)
   */
  readonly certificate?: ICertificate;
}

/**
 * Allows creating a domainA -> domainB redirect using CloudFront and S3.
 * You can specify multiple domains to be redirected.
 */
export class HttpsRedirect extends Construct {
  constructor(scope: Construct, id: string, props: HttpsRedirectProps) {
    super(scope, id);

    const domainNames = props.recordNames ?? [props.zone.zoneName];

    if (props.certificate) {
      const certificateRegion = Stack.of(this).parseArn(props.certificate.certificateArn).region;
      if (!Token.isUnresolved(certificateRegion) && certificateRegion !== 'us-east-1') {
        throw new Error(`Distribution certificates must be in the us-east-1 region and the certificate you provided is in ${certificateRegion}.`);
      }
    }

    const redirectCertArn = props.certificate ? props.certificate.certificateArn : new DnsValidatedCertificate(this, 'RedirectCertificate', {
      domainName: domainNames[0],
      subjectAlternativeNames: domainNames,
      hostedZone: props.zone,
      region: 'us-east-1',
    }).certificateArn;

    const redirectBucket = new Bucket(this, 'RedirectBucket', {
      websiteRedirect: {
        hostName: props.targetDomain,
        protocol: RedirectProtocol.HTTPS,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const redirectDist = new CloudFrontWebDistribution(this, 'RedirectDistribution', {
      defaultRootObject: '',
      originConfigs: [{
        behaviors: [{ isDefaultBehavior: true }],
        customOriginSource: {
          domainName: redirectBucket.bucketWebsiteDomainName,
          originProtocolPolicy: OriginProtocolPolicy.HTTP_ONLY,
        },
      }],
      aliasConfiguration: {
        acmCertRef: redirectCertArn,
        names: domainNames,
      },
      comment: `Redirect to ${props.targetDomain} from ${domainNames.join(', ')}`,
      priceClass: PriceClass.PRICE_CLASS_ALL,
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    });

    domainNames.forEach((domainName) => {
      const hash = crypto.createHash('md5').update(domainName).digest('hex').substr(0, 6);
      new ARecord(this, `RedirectAliasRecord${hash}`, {
        recordName: domainName,
        zone: props.zone,
        target: RecordTarget.fromAlias(new CloudFrontTarget(redirectDist)),
      });
    });
  }
}
