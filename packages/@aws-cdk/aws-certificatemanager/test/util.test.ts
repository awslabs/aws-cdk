import '@aws-cdk/assert-internal/jest';
import { PublicHostedZone } from '@aws-cdk/aws-route53';
import { App, Aws, Stack } from '@aws-cdk/core';
import { Certificate, DnsValidatedCertificate } from '../lib';
import { apexDomain, getCertificateRegion, isDnsValidatedCertificate } from '../lib/util';

describe('apex domain', () => {
  test('returns right domain', () => {
    expect(apexDomain('domain.com')).toEqual('domain.com');
    expect(apexDomain('test.domain.com')).toEqual('domain.com');
  });

  test('understands eTLDs', () => {
    expect(apexDomain('test.domain.co.uk')).toEqual('domain.co.uk');
  });
});

describe('isDnsValidatedCertificate', () => {
  test('new DnsValidatedCertificate is a DnsValidatedCertificate', () => {
    const stack = new Stack();

    const hostedZone = new PublicHostedZone(stack, 'ExampleDotCom', {
      zoneName: 'example.com',
    });
    const cert = new DnsValidatedCertificate(stack, 'Certificate', {
      domainName: 'test.example.com',
      hostedZone,
    });

    expect(isDnsValidatedCertificate(cert)).toBeTruthy();
  });

  test('new Certificate is not a DnsValidatedCertificate', () => {
    const stack = new Stack();

    const cert = new Certificate(stack, 'Certificate', {
      domainName: 'test.example.com',
    });

    expect(isDnsValidatedCertificate(cert)).toBeFalsy();
  });

  test('fromCertificateArn is not a DnsValidatedCertificate', () => {
    const stack = new Stack();

    const cert = Certificate.fromCertificateArn(stack, 'Certificate', 'cert-arn');

    expect(isDnsValidatedCertificate(cert)).toBeFalsy();
  });
});

describe('getCertificateRegion', () => {
  test('from stack', () => {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'RegionStack', { env: { region: 'eu-west-1' } });

    const certificate = new Certificate(stack, 'TestCertificate', {
      domainName: 'www.example.com',
    });

    expect(getCertificateRegion(certificate)).toEqual('eu-west-1');
  });

  test('from DnsValidatedCertificate region', () => {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'RegionStack', { env: { region: 'eu-west-1' } });
    const hostedZone = new PublicHostedZone(stack, 'ExampleDotCom', {
      zoneName: 'example.com',
    });

    const certificate = new DnsValidatedCertificate(stack, 'TestCertificate', {
      domainName: 'www.example.com',
      hostedZone,
      region: 'eu-west-3',
    });

    expect(getCertificateRegion(certificate)).toEqual('eu-west-3');
  });

  test('fromCertificateArn', () => {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'RegionStack', { env: { region: 'eu-west-1' } });

    const certificate = Certificate.fromCertificateArn(
      stack, 'TestCertificate', 'arn:aws:acm:us-east-2:1111111:certificate/11-3336f1-44483d-adc7-9cd375c5169d',
    );

    expect(getCertificateRegion(certificate)).toEqual('us-east-2');
  });

  test('region agnostic stack', () => {
    // GIVEN
    const stack = new Stack();

    const certificate = new Certificate(stack, 'TestCertificate', {
      domainName: 'www.example.com',
    });

    expect(getCertificateRegion(certificate)).toEqual(Aws.REGION);
  });
});
