import '@aws-cdk/assert-internal/jest';
// import { expect, haveResource, haveResourceLike } from '@aws-cdk/assert-internal';
import { Certificate } from '@aws-cdk/aws-certificatemanager';
import { Stack } from '@aws-cdk/core';
import { DomainName, HttpApi } from '../../lib';

const domainName = 'example.com';
const certArn = 'arn:aws:acm:us-east-1:111111111111:certificate';

describe('DomainName', () => {
  test('create domain name correctly', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new DomainName(stack, 'DomainName', {
      domainName,
      certificate: Certificate.fromCertificateArn(stack, 'cert', certArn),
    });

    // THEN
    expect(stack).toHaveResource('AWS::ApiGatewayV2::DomainName', {
      DomainName: 'example.com',
      DomainNameConfigurations: [
        {
          CertificateArn: 'arn:aws:acm:us-east-1:111111111111:certificate',
          EndpointType: 'REGIONAL',
        },
      ],
    });
  });

  test('import domain name correctly', () => {
    // GIVEN
    const stack = new Stack();

    const dn = new DomainName(stack, 'DomainName', {
      domainName,
      certificate: Certificate.fromCertificateArn(stack, 'cert', certArn),
    });

    // WHEN
    const imported = DomainName.fromDomainNameAttributes(stack, 'dn', {
      name: dn.name,
      regionalDomainName: dn.regionalDomainName,
      regionalHostedZoneId: dn.regionalHostedZoneId,
    });

    // THEN;
    expect(imported.name).toEqual(dn.name);
    expect(imported.regionalDomainName).toEqual(dn.regionalDomainName);
    expect(imported.regionalHostedZoneId).toEqual(dn.regionalHostedZoneId);
  });

  test('addStage with domainNameMapping', () => {
    // GIVEN
    const stack = new Stack();
    const api = new HttpApi(stack, 'Api', {
      createDefaultStage: true,
    });

    // WHEN
    const dn = new DomainName(stack, 'DN', {
      domainName,
      certificate: Certificate.fromCertificateArn(stack, 'cert', certArn),
    });

    api.addStage('beta', {
      stageName: 'beta',
      autoDeploy: true,
      domainMapping: {
        domainName: dn,
        mappingKey: 'beta',
      },
    });

    expect(stack).toHaveResourceLike('AWS::ApiGatewayV2::DomainName', {
      DomainName: 'example.com',
      DomainNameConfigurations: [
        {
          CertificateArn: 'arn:aws:acm:us-east-1:111111111111:certificate',
          EndpointType: 'REGIONAL',
        },
      ],
    });
    expect(stack).toHaveResourceLike('AWS::ApiGatewayV2::ApiMapping', {
      ApiId: {
        Ref: 'ApiF70053CD',
      },
      DomainName: 'example.com',
      Stage: 'beta',
      ApiMappingKey: 'beta',
    });
  });

  test('api with defaultDomainMapping', () => {
    // GIVEN
    const stack = new Stack();
    const dn = new DomainName(stack, 'DN', {
      domainName,
      certificate: Certificate.fromCertificateArn(stack, 'cert', certArn),
    });

    // WHEN
    new HttpApi(stack, 'Api', {
      createDefaultStage: true,
      defaultDomainMapping: {
        domainName: dn,
      },
    });

    // THEN
    expect(stack).toHaveResourceLike('AWS::ApiGatewayV2::DomainName', {
      DomainName: 'example.com',
      DomainNameConfigurations: [
        {
          CertificateArn: 'arn:aws:acm:us-east-1:111111111111:certificate',
          EndpointType: 'REGIONAL',
        },
      ],
    });

    expect(stack).toHaveResourceLike('AWS::ApiGatewayV2::ApiMapping', {
      ApiId: {
        Ref: 'ApiF70053CD',
      },
      DomainName: 'example.com',
      Stage: '$default',
    });
  });

  test('throws when defaultDomainMapping enabled with createDefaultStage disabled', () => {
    // GIVEN
    const stack = new Stack();
    const dn = new DomainName(stack, 'DN', {
      domainName,
      certificate: Certificate.fromCertificateArn(stack, 'cert', certArn),
    });
    const t = () => {
      new HttpApi(stack, 'Api', {
        createDefaultStage: false,
        defaultDomainMapping: {
          domainName: dn,
        },
      });
    };

    // WHEN/THEN
    expect(t).toThrow('defaultDomainMapping not supported with createDefaultStage disabled');
  });
});
