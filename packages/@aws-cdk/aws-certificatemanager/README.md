# AWS Certificate Manager Construct Library
<!--BEGIN STABILITY BANNER-->

---

![cfn-resources: Stable](https://img.shields.io/badge/cfn--resources-stable-success.svg?style=for-the-badge)

![cdk-constructs: Stable](https://img.shields.io/badge/cdk--constructs-stable-success.svg?style=for-the-badge)

---

<!--END STABILITY BANNER-->


AWS Certificate Manager (ACM) handles the complexity of creating, storing, and renewing public and private SSL/TLS X.509 certificates and keys that
protect your AWS websites and applications. ACM certificates can secure singular domain names, multiple specific domain names, wildcard domains, or
combinations of these. ACM wildcard certificates can protect an unlimited number of subdomains.

This package provides Constructs for provisioning and referencing ACM certificates which can be used with CloudFront and ELB.

After requesting a certificate, you will need to prove that you own the
domain in question before the certificate will be granted. The CloudFormation
deployment will wait until this verification process has been completed.

Because of this wait time, when using manual validation methods, it's better
to provision your certificates either in a separate stack from your main
service, or provision them manually and import them into your CDK application.

**Note:** There is a limit on total number of ACM certificates that can be requested on an account and region within a year.
The default limit is 2000, but this limit may be (much) lower on new AWS accounts.
See https://docs.aws.amazon.com/acm/latest/userguide/acm-limits.html for more information.

## DNS validation

DNS validation is the preferred method to validate domain ownership, as it has a number of advantages over email validation.
See also [Validate with DNS](https://docs.aws.amazon.com/acm/latest/userguide/gs-acm-validate-dns.html)
in the AWS Certificate Manager User Guide.

If Amazon Route 53 is your DNS provider for the requested domain, the DNS record can be
created automatically:

```ts
import * as acm from '@aws-cdk/aws-certificatemanager';
import * as route53 from '@aws-cdk/aws-route53';

const myHostedZone = new route53.HostedZone(this, 'HostedZone', {
  zoneName: 'example.com',
});
new acm.Certificate(this, 'Certificate', {
  domainName: 'hello.example.com',
  validation: acm.CertificateValidation.fromDns(myHostedZone),
});
```

If Route 53 is not your DNS provider, the DNS records must be added manually and the stack will not complete
creating until the records are added.

```ts
new acm.Certificate(this, 'Certificate', {
  domainName: 'hello.example.com',
  validation: acm.CertificateValidation.fromDns(), // Records must be added manually
});
```

When working with multiple domains, use the `CertificateValidation.fromDnsMultiZone()`:

```ts
const exampleCom = new route53.HostedZone(this, 'ExampleCom', {
  zoneName: 'example.com',
});
const exampleNet = new route53.HostedZone(this, 'ExampleNet', {
  zoneName: 'example.net',
});

const cert = new acm.Certificate(this, 'Certificate', {
  domainName: 'test.example.com',
  subjectAlternativeNames: ['cool.example.com', 'test.example.net'],
  validation: acm.CertificateValidation.fromDnsMultiZone({
    'test.example.com': exampleCom,
    'cool.example.com': exampleCom,
    'test.example.net': exampleNet,
  }),
});
```

## Email validation

Email-validated certificates (the default) are validated by receiving an
email on one of a number of predefined domains and following the instructions
in the email.

See [Validate with Email](https://docs.aws.amazon.com/acm/latest/userguide/gs-acm-validate-email.html)
in the AWS Certificate Manager User Guide.

```ts
new acm.Certificate(this, 'Certificate', {
  domainName: 'hello.example.com',
  validation: acm.CertificateValidation.fromEmail(), // Optional, this is the default
});
```

## Cross-region Certificates

ACM certificates that are used with CloudFront -- or higher-level constructs which rely on CloudFront -- must be in the `us-east-1` region.
The `DnsValidatedCertificate` construct exists to facilitate creating these certificates cross-region. This resource can only be used with
Route53-based DNS validation.

```ts
new acm.DnsValidatedCertificate(this, 'CrossRegionCertificate', {
  domainName: 'hello.example.com',
  hostedZone: myHostedZone,
  region: 'us-east-1',
});
```

## Importing

If you want to import an existing certificate, you can do so from its ARN:

```ts
const arn = 'arn:aws:...';
const certificate = Certificate.fromCertificateArn(this, 'Certificate', arn);
```

## Sharing between Stacks

To share the certificate between stacks in the same CDK application, simply
pass the `Certificate` object between the stacks.

## Metrics

The `DaysToExpiry` metric is available via the `metricDaysToExpiry` method for
all certificates. This metric is emitted by AWS Certificates Manager once per
day until the certificate has effectively expired.

An alarm can be created to determine whether a certificate is soon due for
renewal ussing the following code:

```ts
const certificate = new Certificate(this, 'Certificate', { /* ... */ });
certificate.metricDaysToExpiry().createAlarm({
  comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
  evaluationPeriods: 1,
  threshold: 45, // Automatic rotation happens between 60 and 45 days before expiry
});
```
