import '@aws-cdk/assert/jest';
import { App, Aws, Stack } from '@aws-cdk/core';
import { OriginRequestPolicy, OriginRequestCookieBehavior, OriginRequestHeaderBehavior, OriginRequestQueryStringBehavior } from '../lib';

describe('OriginRequestPolicy', () => {
  let app: App;
  let stack: Stack;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'Stack', {
      env: { account: '123456789012', region: 'testregion' },
    });
  });

  test('import existing policy by id', () => {
    const originRequestPolicyId = '344f6fe5-7ce5-4df0-a470-3f14177c549c';
    const originRequestPolicy = OriginRequestPolicy.fromOriginRequestPolicyId(stack, 'MyPolicy', originRequestPolicyId);
    expect(originRequestPolicy.originRequestPolicyId).toEqual(originRequestPolicyId);
  });

  test('minimal example', () => {
    new OriginRequestPolicy(stack, 'OriginRequestPolicy');

    expect(stack).toHaveResource('AWS::CloudFront::OriginRequestPolicy', {
      OriginRequestPolicyConfig: {
        Name: 'StackOriginRequestPolicy6B17D9ED',
        CookiesConfig: {
          CookieBehavior: 'none',
        },
        HeadersConfig: {
          HeaderBehavior: 'none',
        },
        QueryStringsConfig: {
          QueryStringBehavior: 'none',
        },
      },
    });
  });

  test('maximum example', () => {
    new OriginRequestPolicy(stack, 'OriginRequestPolicy', {
      originRequestPolicyName: 'MyPolicy',
      comment: 'A default policy',
      cookieBehavior: OriginRequestCookieBehavior.none(),
      headerBehavior: OriginRequestHeaderBehavior.all('CloudFront-Is-Android-Viewer'),
      queryStringBehavior: OriginRequestQueryStringBehavior.allowList('username'),
    });

    expect(stack).toHaveResource('AWS::CloudFront::OriginRequestPolicy', {
      OriginRequestPolicyConfig: {
        Name: 'MyPolicy',
        Comment: 'A default policy',
        CookiesConfig: {
          CookieBehavior: 'none',
        },
        HeadersConfig: {
          HeaderBehavior: 'allViewerAndWhitelistCloudFront',
          Headers: ['CloudFront-Is-Android-Viewer'],
        },
        QueryStringsConfig: {
          QueryStringBehavior: 'whitelist',
          QueryStrings: ['username'],
        },
      },
    });
  });

  test('throws if given a originRequestPolicyName with invalid characters', () => {
    const errorMessage = /'originRequestPolicyName' can only include '-', '_', and alphanumeric characters/;
    expect(() => new OriginRequestPolicy(stack, 'OriginRequestPolicy1', { originRequestPolicyName: 'My Policy' })).toThrow(errorMessage);
    expect(() => new OriginRequestPolicy(stack, 'OriginRequestPolicy2', { originRequestPolicyName: 'MyPolicy!' })).toThrow(errorMessage);
    expect(() => new OriginRequestPolicy(stack, 'OriginRequestPolicy3', { originRequestPolicyName: 'MyPolicy,New' })).toThrow(errorMessage);

    expect(() => new OriginRequestPolicy(stack, 'OriginRequestPolicy4', { originRequestPolicyName: 'MyPolicy' })).not.toThrow();
    expect(() => new OriginRequestPolicy(stack, 'OriginRequestPolicy5', { originRequestPolicyName: 'My-Policy' })).not.toThrow();
    expect(() => new OriginRequestPolicy(stack, 'OriginRequestPolicy6', { originRequestPolicyName: 'My_Policy' })).not.toThrow();
  });

  test('throws if prohibited headers are being passed', () => {
    const errorMessage = /you cannot pass `Authorization` or `Accept-Encoding` as header values/;
    expect(() => new OriginRequestPolicy(stack, 'OriginRequestPolicy1', { headerBehavior: OriginRequestHeaderBehavior.allowList('Authorization') })).toThrow(errorMessage);
    expect(() => new OriginRequestPolicy(stack, 'OriginRequestPolicy2', { headerBehavior: OriginRequestHeaderBehavior.allowList('Accept-Encoding') })).toThrow(errorMessage);
    expect(() => new OriginRequestPolicy(stack, 'OriginRequestPolicy3', { headerBehavior: OriginRequestHeaderBehavior.allowList('authorization') })).toThrow(errorMessage);
    expect(() => new OriginRequestPolicy(stack, 'OriginRequestPolicy4', { headerBehavior: OriginRequestHeaderBehavior.allowList('accept-encoding') })).toThrow(errorMessage);
    expect(() => new OriginRequestPolicy(stack, 'OriginRequestPolicy5', { headerBehavior: OriginRequestHeaderBehavior.allowList('Foo', 'Authorization', 'Bar') })).toThrow(errorMessage);
    expect(() => new OriginRequestPolicy(stack, 'OriginRequestPolicy6', { headerBehavior: OriginRequestHeaderBehavior.allowList('Foo', 'Accept-Encoding', 'Bar') })).toThrow(errorMessage);

    expect(() => new OriginRequestPolicy(stack, 'OriginRequestPolicy7', { headerBehavior: OriginRequestHeaderBehavior.allowList('Foo', 'Bar') })).not.toThrow();
  });

  test('does not throw if originRequestPolicyName is a token', () => {
    expect(() => new OriginRequestPolicy(stack, 'CachePolicy', {
      originRequestPolicyName: Aws.STACK_NAME,
    })).not.toThrow();
  });
});

test('managed policies are provided', () => {
  expect(OriginRequestPolicy.USER_AGENT_REFERER_HEADERS.originRequestPolicyId).toEqual('acba4595-bd28-49b8-b9fe-13317c0390fa');
  expect(OriginRequestPolicy.CORS_CUSTOM_ORIGIN.originRequestPolicyId).toEqual('59781a5b-3903-41f3-afcb-af62929ccde1');
  expect(OriginRequestPolicy.CORS_S3_ORIGIN.originRequestPolicyId).toEqual('88a5eaf4-2fd4-4709-b370-b4c650ea3fcf');
  expect(OriginRequestPolicy.ALL_VIEWER.originRequestPolicyId).toEqual('216adef6-5c7f-47e4-b989-5492eafa07d3');
  expect(OriginRequestPolicy.ELEMENTAL_MEDIA_TAILOR.originRequestPolicyId).toEqual('775133bc-15f2-49f9-abea-afb2e0bf67d2');
});

// OriginRequestCookieBehavior and OriginRequestQueryStringBehavior have identical behavior
describe.each([
  ['CookieBehavior', OriginRequestCookieBehavior, 'cookie', (c: OriginRequestCookieBehavior) => c.cookies],
  ['QueryStringBehavior', OriginRequestQueryStringBehavior, 'query string', (qs: OriginRequestQueryStringBehavior) => qs.queryStrings],
])('%s', (_className, clazz, type, items) => {
  test('none()', () => {
    const behavior = clazz.none();

    expect(behavior.behavior).toEqual('none');
    expect(items(behavior)).toBeUndefined();
  });

  test('all()', () => {
    const behavior = clazz.all();

    expect(behavior.behavior).toEqual('all');
    expect(items(behavior)).toBeUndefined();
  });

  test('allowList()', () => {
    const behavior = clazz.allowList('SESSION_ID', 'secrets');

    expect(behavior.behavior).toEqual('whitelist');
    expect(items(behavior)).toEqual(['SESSION_ID', 'secrets']);
  });

  test('allowList() throws if list is empty', () => {
    expect(() => clazz.allowList()).toThrow(new RegExp(`At least one ${type} to allow must be provided`));
  });
});

describe('HeaderBehavior', () => {
  test('none()', () => {
    const headers = OriginRequestHeaderBehavior.none();

    expect(headers.behavior).toEqual('none');
    expect(headers.headers).toBeUndefined();
  });

  test('allowList()', () => {
    const headers = OriginRequestHeaderBehavior.allowList('X-CustomHeader', 'X-AnotherHeader');

    expect(headers.behavior).toEqual('whitelist');
    expect(headers.headers).toEqual(['X-CustomHeader', 'X-AnotherHeader']);
  });

  test('allowList() throws if list is empty', () => {
    expect(() => OriginRequestHeaderBehavior.allowList()).toThrow(/At least one header to allow must be provided/);
  });

  describe('all()', () => {
    test('defaults to allViewer', () => {
      const headers = OriginRequestHeaderBehavior.all();

      expect(headers.behavior).toEqual('allViewer');
      expect(headers.headers).toBeUndefined();
    });

    test('accepts additional CloudFront headers', () => {
      const headers = OriginRequestHeaderBehavior.all('CloudFront-Is-Android-Viewer', 'CloudFront-Viewer-Country');

      expect(headers.behavior).toEqual('allViewerAndWhitelistCloudFront');
      expect(headers.headers).toEqual(['CloudFront-Is-Android-Viewer', 'CloudFront-Viewer-Country']);
    });

    test('throws if provided a header that is not a CloudFront- header', () => {
      const errorMessage = 'additional CloudFront headers passed to `OriginRequestHeaderBehavior.all()` must begin with \'CloudFront-\'';
      expect(() => { OriginRequestHeaderBehavior.all('X-MyCustomHeader'); }).toThrow(errorMessage);
    });
  });
});
