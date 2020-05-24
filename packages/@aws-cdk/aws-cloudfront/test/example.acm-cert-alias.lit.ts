import * as certificatemanager from '@aws-cdk/aws-certificatemanager';
import * as s3 from '@aws-cdk/aws-s3';
import { App, Construct, Stack } from '@aws-cdk/core';
import * as cloudfront from '../lib';

class AcmCertificateAliasStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    /// !show
    const s3BucketSource = new s3.Bucket(this, 'Bucket');

    const certificate = new certificatemanager.Certificate(this, 'Certificate', {
      domainName: 'example.com',
      subjectAlternativeNames: ['*.example.com'],
    });

    const distribution = new cloudfront.CloudFrontWebDistribution(this, 'AnAmazingWebsiteProbably', {
      originConfigs: [{
        s3OriginSource: { s3BucketSource },
        behaviors: [{ isDefaultBehavior: true }],
      }],
      viewerCertificate: cloudfront.ViewerCertificate.fromAcmCertificate(
        certificate,
        {
          aliases: ['example.com', 'www.example.com'],
          securityPolicy: cloudfront.SecurityPolicyProtocol.TLS_V1, // default
          sslMethod: cloudfront.SSLMethod.SNI, // default
        },
      ),
    });
    /// !hide

    Array.isArray(s3BucketSource);
    Array.isArray(certificate);
    Array.isArray(distribution);
  }
}

const app = new App();
new AcmCertificateAliasStack(app, 'AcmCertificateAliasStack');
app.synth();
