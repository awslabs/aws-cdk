import { TemplateAssertions } from '@aws-cdk/assertions';
import { Certificate } from '@aws-cdk/aws-certificatemanager';
import { CfnParameter, Stack } from '@aws-cdk/core';
import { UserPool, UserPoolDomain } from '../lib';

describe('User Pool Client', () => {
  test('custom domain name', () => {
    // GIVEN
    const stack = new Stack();
    const pool = new UserPool(stack, 'Pool');

    // WHEN
    const certificate = Certificate.fromCertificateArn(stack, 'cert',
      'arn:aws:acm:eu-west-1:0123456789:certificate/7ec3e4ac-808a-4649-b805-66ae02346ad8');
    new UserPoolDomain(stack, 'Domain', {
      userPool: pool,
      customDomain: {
        domainName: 'test-domain.example.com',
        certificate,
      },
    });

    // THEN
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::Cognito::UserPoolDomain', {
      UserPoolId: stack.resolve(pool.userPoolId),
      Domain: 'test-domain.example.com',
      CustomDomainConfig: {
        CertificateArn: 'arn:aws:acm:eu-west-1:0123456789:certificate/7ec3e4ac-808a-4649-b805-66ae02346ad8',
      },
    });
  });

  test('cognito domain prefix', () => {
    // GIVEN
    const stack = new Stack();
    const pool = new UserPool(stack, 'Pool');

    // WHEN
    new UserPoolDomain(stack, 'Domain', {
      userPool: pool,
      cognitoDomain: {
        domainPrefix: 'cognito-domain-prefix',
      },
    });

    // THEN
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::Cognito::UserPoolDomain', {
      UserPoolId: stack.resolve(pool.userPoolId),
      Domain: 'cognito-domain-prefix',
    });
  });

  test('fails when neither cognitoDomain nor customDomain are specified', () => {
    const stack = new Stack();
    const pool = new UserPool(stack, 'Pool');
    const certificate = Certificate.fromCertificateArn(stack, 'cert',
      'arn:aws:acm:eu-west-1:0123456789:certificate/7ec3e4ac-808a-4649-b805-66ae02346ad8');

    expect(() => new UserPoolDomain(stack, 'Domain', {
      userPool: pool,
      cognitoDomain: {
        domainPrefix: 'cognito-domain-prefix',
      },
      customDomain: {
        domainName: 'mydomain.com',
        certificate,
      },
    })).toThrow(/cognitoDomain or customDomain must be specified/);
  });

  test('fails when both cognitoDomain and customDomain are specified', () => {
    const stack = new Stack();
    const pool = new UserPool(stack, 'Pool');

    expect(() => new UserPoolDomain(stack, 'Domain', {
      userPool: pool,
    })).toThrow(/cognitoDomain or customDomain must be specified/);
  });

  test('fails when domainPrefix has characters outside the allowed charset', () => {
    const stack = new Stack();
    const pool = new UserPool(stack, 'Pool');

    expect(() => pool.addDomain('Domain1', {
      cognitoDomain: { domainPrefix: 'domain.prefix' },
    })).toThrow(/lowercase alphabets, numbers and hyphens/);
    expect(() => pool.addDomain('Domain2', {
      cognitoDomain: { domainPrefix: 'Domain-Prefix' },
    })).toThrow(/lowercase alphabets, numbers and hyphens/);
    expect(() => pool.addDomain('Domain3', {
      cognitoDomain: { domainPrefix: 'dómäin-prefix' },
    })).toThrow(/lowercase alphabets, numbers and hyphens/);
  });

  test('does not fail when domainPrefix is a token', () => {
    const stack = new Stack();
    const pool = new UserPool(stack, 'Pool');

    const parameter = new CfnParameter(stack, 'Paraeter');

    expect(() => pool.addDomain('Domain', {
      cognitoDomain: { domainPrefix: parameter.valueAsString },
    })).not.toThrow();
  });

  test('custom resource is added when cloudFrontDomainName property is used', () => {
    // GIVEN
    const stack = new Stack();
    const pool = new UserPool(stack, 'Pool');
    const domain = pool.addDomain('Domain', {
      cognitoDomain: {
        domainPrefix: 'cognito-domain-prefix',
      },
    });

    // WHEN
    const cfDomainName = domain.cloudFrontDomainName;

    // THEN
    expect(stack.resolve(cfDomainName)).toEqual({
      'Fn::GetAtt': [
        'PoolDomainCloudFrontDomainName340BF87E',
        'DomainDescription.CloudFrontDistribution',
      ],
    });

    TemplateAssertions.fromStack(stack).resourceCountIs('Custom::UserPoolCloudFrontDomainName', 1);
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [{
          Action: 'cognito-idp:DescribeUserPoolDomain',
          Effect: 'Allow',
          Resource: '*',
        }],
        Version: '2012-10-17',
      },
    });
  });

  test('cloudFrontDomainName property can be called multiple times', () => {
    const stack = new Stack();
    const pool = new UserPool(stack, 'Pool');
    const domain = pool.addDomain('Domain', {
      cognitoDomain: {
        domainPrefix: 'cognito-domain-prefix',
      },
    });

    const cfDomainNameFirst = domain.cloudFrontDomainName;
    const cfDomainNameSecond = domain.cloudFrontDomainName;

    expect(cfDomainNameSecond).toEqual(cfDomainNameFirst);
  });

  test('import', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const client = UserPoolDomain.fromDomainName(stack, 'Domain', 'domain-name-1');

    // THEN
    expect(client.domainName).toEqual('domain-name-1');
    TemplateAssertions.fromStack(stack).resourceCountIs('AWS::Cognito::UserPoolDomain', 0);
  });

  describe('signInUrl', () => {
    test('returns the expected URL', () => {
      // GIVEN
      const stack = new Stack();
      const pool = new UserPool(stack, 'Pool');
      const domain = pool.addDomain('Domain', {
        cognitoDomain: {
          domainPrefix: 'cognito-domain-prefix',
        },
      });
      const client = pool.addClient('Client', {
        oAuth: {
          callbackUrls: ['https://example.com'],
        },
      });

      // WHEN
      const signInUrl = domain.signInUrl(client, {
        redirectUri: 'https://example.com',
      });

      // THEN
      expect(stack.resolve(signInUrl)).toEqual({
        'Fn::Join': [
          '', [
            'https://',
            { Ref: 'PoolDomainCFC71F56' },
            '.auth.',
            { Ref: 'AWS::Region' },
            '.amazoncognito.com/login?client_id=',
            { Ref: 'PoolClient8A3E5EB7' },
            '&response_type=code&redirect_uri=https://example.com',
          ],
        ],
      });
    });

    test('correctly uses the signInPath', () => {
      // GIVEN
      const stack = new Stack();
      const pool = new UserPool(stack, 'Pool');
      const domain = pool.addDomain('Domain', {
        cognitoDomain: {
          domainPrefix: 'cognito-domain-prefix',
        },
      });
      const client = pool.addClient('Client', {
        oAuth: {
          callbackUrls: ['https://example.com'],
        },
      });

      // WHEN
      const signInUrl = domain.signInUrl(client, {
        redirectUri: 'https://example.com',
        signInPath: '/testsignin',
      });

      // THEN
      expect(signInUrl).toMatch(/amazoncognito\.com\/testsignin\?/);
    });
  });
});