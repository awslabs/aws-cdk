# AWS::ACMPCA Construct Library

<!--BEGIN STABILITY BANNER-->

---

![cfn-resources: Stable](https://img.shields.io/badge/cfn--resources-stable-success.svg?style=for-the-badge)

![cdk-constructs: Stable](https://img.shields.io/badge/cdk--constructs-stable-success.svg?style=for-the-badge)

---

<!--END STABILITY BANNER-->

This module is part of the [AWS Cloud Development Kit](https://github.com/aws/aws-cdk) project.

```ts
import * as acmpca from '@aws-cdk/aws-acmpca';
```

## Certificate Authority

This package contains a `CertificateAuthority` class.
At the moment, you cannot create new Authorities using it,
but you can import existing ones using the `fromCertificateAuthorityArn` static method:

```ts
const certificateAuthority = acmpca.CertificateAuthority.fromCertificateAuthorityArn(this, 'CA',
  'arn:aws:acm-pca:us-east-1:123456789012:certificate-authority/023077d8-2bfa-4eb0-8f22-05c96deade77');
```

## Low-level `Cfn*` classes

You can always use the low-level classes
(starting with `Cfn*`) to create resources like the Certificate Authority:

```ts
const cfnCertificateAuthority = new acmpca.CfnCertificateAuthority(this, 'CA', {
  type: 'ROOT',
  keyAlgorithm: 'RSA_2048',
  signingAlgorithm: 'SHA256WITHRSA',
  subject: {
    country: 'US',
    organization: 'string',
    organizationalUnit: 'string',
    distinguishedNameQualifier: 'string',
    state: 'string',
    commonName: '123',
    serialNumber: 'string',
    locality: 'string',
    title: 'string',
    surname: 'string',
    givenName: 'string',
    initials: 'DG',
    pseudonym: 'string',
    generationQualifier: 'DBG',
  },
});
```

If you need to pass the higher-level `ICertificateAuthority` somewhere,
you can get it from the lower-level `CfnCertificateAuthority` using the same `fromCertificateAuthorityArn` method:

```ts
const certificateAuthority = acmpca.CertificateAuthority.fromCertificateAuthorityArn(this, 'CertificateAuthority',
  cfnCertificateAuthority.attrArn);
```
