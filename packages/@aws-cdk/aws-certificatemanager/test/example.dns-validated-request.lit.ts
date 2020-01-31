import * as route53 from '@aws-cdk/aws-route53';
import { App, Construct, Stack } from '@aws-cdk/core';
import * as certmgr from '../lib';

class CertStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    /// !show
    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: 'example.com',
      privateZone: false
    });

    const certificate = new certmgr.DnsValidatedCertificate(this, 'TestCertificate', {
        domainName: 'test.example.com',
        hostedZone: hostedZone,
    });
    /// !hide

    Array.isArray(certificate);
  }
}

const app = new App();
new CertStack(app, 'MyStack4');
app.synth();
