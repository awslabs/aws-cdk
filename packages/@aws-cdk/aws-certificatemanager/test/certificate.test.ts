import '@aws-cdk/assert-internal/jest';
import * as route53 from '@aws-cdk/aws-route53';
import { Lazy, Stack } from '@aws-cdk/core';
import { Certificate, CertificateValidation, ValidationMethod } from '../lib';

test('apex domain selection by default', () => {
  const stack = new Stack();

  new Certificate(stack, 'Certificate', {
    domainName: 'test.example.com',
  });

  expect(stack).toHaveResource('AWS::CertificateManager::Certificate', {
    DomainName: 'test.example.com',
    DomainValidationOptions: [{
      DomainName: 'test.example.com',
      ValidationDomain: 'example.com',
    }],
  });
});

test('validation domain can be overridden', () => {
  const stack = new Stack();

  new Certificate(stack, 'Certificate', {
    domainName: 'test.example.com',
    validationDomains: {
      'test.example.com': 'test.example.com',
    },
  });

  expect(stack).toHaveResource('AWS::CertificateManager::Certificate', {
    DomainValidationOptions: [{
      DomainName: 'test.example.com',
      ValidationDomain: 'test.example.com',
    }],
  });
});

test('export and import', () => {
  // GIVEN
  const stack = new Stack();

  // WHEN
  const c = Certificate.fromCertificateArn(stack, 'Imported', 'cert-arn');

  // THEN
  expect(c.certificateArn).toBe('cert-arn');
});

test('can configure validation method', () => {
  const stack = new Stack();

  new Certificate(stack, 'Certificate', {
    domainName: 'test.example.com',
    validationMethod: ValidationMethod.DNS,
  });

  expect(stack).toHaveResource('AWS::CertificateManager::Certificate', {
    DomainName: 'test.example.com',
    ValidationMethod: 'DNS',
  });
});

test('needs validation domain supplied if domain contains a token', () => {
  const stack = new Stack();

  expect(() => {
    const domainName = Lazy.string({ produce: () => 'example.com' });
    new Certificate(stack, 'Certificate', {
      domainName,
    });
  }).toThrow(/'validationDomains' needs to be supplied/);
});

test('validationdomains can be given for a Token', () => {
  const stack = new Stack();

  const domainName = Lazy.string({ produce: () => 'my.example.com' });
  new Certificate(stack, 'Certificate', {
    domainName,
    validationDomains: {
      [domainName]: 'example.com',
    },
  });

  expect(stack).toHaveResource('AWS::CertificateManager::Certificate', {
    DomainName: 'my.example.com',
    DomainValidationOptions: [{
      DomainName: 'my.example.com',
      ValidationDomain: 'example.com',
    }],
  });
});

test('CertificateValidation.fromEmail', () => {
  const stack = new Stack();

  new Certificate(stack, 'Certificate', {
    domainName: 'test.example.com',
    subjectAlternativeNames: ['extra.example.com'],
    validation: CertificateValidation.fromEmail({
      'test.example.com': 'example.com',
    }),
  });

  expect(stack).toHaveResource('AWS::CertificateManager::Certificate', {
    DomainName: 'test.example.com',
    SubjectAlternativeNames: ['extra.example.com'],
    DomainValidationOptions: [
      {
        DomainName: 'test.example.com',
        ValidationDomain: 'example.com',
      },
      {
        DomainName: 'extra.example.com',
        ValidationDomain: 'example.com',
      },
    ],
    ValidationMethod: 'EMAIL',
  });
});

describe('CertificateValidation.fromDns', () => {
  test('without a hosted zone', () => {
    const stack = new Stack();

    new Certificate(stack, 'Certificate', {
      domainName: 'test.example.com',
      subjectAlternativeNames: ['extra.example.com'],
      validation: CertificateValidation.fromDns(),
    });

    expect(stack).toHaveResource('AWS::CertificateManager::Certificate', {
      DomainName: 'test.example.com',
      SubjectAlternativeNames: ['extra.example.com'],
      ValidationMethod: 'DNS',
    });
  });

  test('with a hosted zone', () => {
    const stack = new Stack();

    const exampleCom = new route53.HostedZone(stack, 'ExampleCom', {
      zoneName: 'example.com',
    });

    new Certificate(stack, 'Certificate', {
      domainName: 'test.example.com',
      validation: CertificateValidation.fromDns(exampleCom),
    });

    expect(stack).toHaveResource('AWS::CertificateManager::Certificate', {
      DomainName: 'test.example.com',
      DomainValidationOptions: [
        {
          DomainName: 'test.example.com',
          HostedZoneId: {
            Ref: 'ExampleCom20E1324B',
          },
        },
      ],
      ValidationMethod: 'DNS',
    });
  });

  test('with hosted zone and a wildcard name', () => {
    const stack = new Stack();

    const exampleCom = new route53.HostedZone(stack, 'ExampleCom', {
      zoneName: 'example.com',
    });

    new Certificate(stack, 'Certificate', {
      domainName: 'test.example.com',
      validation: CertificateValidation.fromDns(exampleCom),
      subjectAlternativeNames: ['*.test.example.com'],
    });

    //Wildcard domain names are de-duped.
    expect(stack).toHaveResource('AWS::CertificateManager::Certificate', {
      DomainName: 'test.example.com',
      DomainValidationOptions: [
        {
          DomainName: 'test.example.com',
          HostedZoneId: {
            Ref: 'ExampleCom20E1324B',
          },
        },
      ],
      ValidationMethod: 'DNS',
    });
  });

  test('with hosted zone and multiple wildcard names', () => {
    const stack = new Stack();

    const exampleCom = new route53.HostedZone(stack, 'ExampleCom', {
      zoneName: 'example.com',
    });

    new Certificate(stack, 'Certificate', {
      domainName: 'test.example.com',
      validation: CertificateValidation.fromDns(exampleCom),
      subjectAlternativeNames: ['*.test.example.com', '*.foo.test.example.com', 'bar.test.example.com'],
    });

    //Wildcard domain names are de-duped.
    expect(stack).toHaveResource('AWS::CertificateManager::Certificate', {
      DomainName: 'test.example.com',
      DomainValidationOptions: [
        {
          DomainName: 'test.example.com',
          HostedZoneId: {
            Ref: 'ExampleCom20E1324B',
          },
        },
        {
          DomainName: '*.foo.test.example.com',
          HostedZoneId: {
            Ref: 'ExampleCom20E1324B',
          },
        },
        {
          DomainName: 'bar.test.example.com',
          HostedZoneId: {
            Ref: 'ExampleCom20E1324B',
          },
        },
      ],
      ValidationMethod: 'DNS',
    });
  });
});

test('CertificateValidation.fromDnsMultiZone', () => {
  const stack = new Stack();

  const exampleCom = new route53.HostedZone(stack, 'ExampleCom', {
    zoneName: 'example.com',
  });

  const exampleNet = new route53.HostedZone(stack, 'ExampleNet', {
    zoneName: 'example.com',
  });

  new Certificate(stack, 'Certificate', {
    domainName: 'test.example.com',
    subjectAlternativeNames: ['cool.example.com', 'test.example.net'],
    validation: CertificateValidation.fromDnsMultiZone({
      'test.example.com': exampleCom,
      'cool.example.com': exampleCom,
      'test.example.net': exampleNet,
    }),
  });

  expect(stack).toHaveResource('AWS::CertificateManager::Certificate', {
    DomainName: 'test.example.com',
    DomainValidationOptions: [
      {
        DomainName: 'test.example.com',
        HostedZoneId: {
          Ref: 'ExampleCom20E1324B',
        },
      },
      {
        DomainName: 'cool.example.com',
        HostedZoneId: {
          Ref: 'ExampleCom20E1324B',
        },
      },
      {
        DomainName: 'test.example.net',
        HostedZoneId: {
          Ref: 'ExampleNetF7CA40C9',
        },
      },
    ],
    ValidationMethod: 'DNS',
  });
});
