import '@aws-cdk/assert-internal/jest';
import { Stack } from '@aws-cdk/core';
import * as apigw from '../lib';

/* eslint-disable quote-props */

describe('resource', () => {
  test('ProxyResource defines a "{proxy+}" resource with ANY method', () => {
    // GIVEN
    const stack = new Stack();
    const api = new apigw.RestApi(stack, 'api');

    // WHEN
    new apigw.ProxyResource(stack, 'proxy', {
      parent: api.root,
    });

    // THEN
    expect(stack).toHaveResource('AWS::ApiGateway::Resource', {
      'ParentId': {
        'Fn::GetAtt': [
          'apiC8550315',
          'RootResourceId',
        ],
      },
      'PathPart': '{proxy+}',
      'RestApiId': {
        'Ref': 'apiC8550315',
      },
    });

    expect(stack).toHaveResource('AWS::ApiGateway::Method', {
      'HttpMethod': 'ANY',
      'ResourceId': {
        'Ref': 'proxy3A1DA9C7',
      },
      'RestApiId': {
        'Ref': 'apiC8550315',
      },
      'AuthorizationType': 'NONE',
      'Integration': {
        'Type': 'MOCK',
      },
    });
  });

  test('if "anyMethod" is false, then an ANY method will not be defined', () => {
    // GIVEN
    const stack = new Stack();
    const api = new apigw.RestApi(stack, 'api');

    // WHEN
    const proxy = new apigw.ProxyResource(stack, 'proxy', {
      parent: api.root,
      anyMethod: false,
    });

    proxy.addMethod('GET');

    // THEN
    expect(stack).toHaveResource('AWS::ApiGateway::Resource');
    expect(stack).toHaveResource('AWS::ApiGateway::Method', { 'HttpMethod': 'GET' });
    expect(stack).not.toHaveResource('AWS::ApiGateway::Method', { 'HttpMethod': 'ANY' });
  });

  test('addProxy can be used on any resource to attach a proxy from that route', () => {
    // GIVEN
    const stack = new Stack();
    const api = new apigw.RestApi(stack, 'api', {
      deploy: false,
      cloudWatchRole: false,
    });

    const v2 = api.root.addResource('v2');
    v2.addProxy();

    expect(stack).toMatchTemplate({
      'Resources': {
        'apiC8550315': {
          'Type': 'AWS::ApiGateway::RestApi',
          'Properties': {
            'Name': 'api',
          },
        },
        'apiv25206B108': {
          'Type': 'AWS::ApiGateway::Resource',
          'Properties': {
            'ParentId': {
              'Fn::GetAtt': [
                'apiC8550315',
                'RootResourceId',
              ],
            },
            'PathPart': 'v2',
            'RestApiId': {
              'Ref': 'apiC8550315',
            },
          },
        },
        'apiv2proxyAEA4DAC8': {
          'Type': 'AWS::ApiGateway::Resource',
          'Properties': {
            'ParentId': {
              'Ref': 'apiv25206B108',
            },
            'PathPart': '{proxy+}',
            'RestApiId': {
              'Ref': 'apiC8550315',
            },
          },
        },
        'apiv2proxyANY889F4CE1': {
          'Type': 'AWS::ApiGateway::Method',
          'Properties': {
            'HttpMethod': 'ANY',
            'ResourceId': {
              'Ref': 'apiv2proxyAEA4DAC8',
            },
            'RestApiId': {
              'Ref': 'apiC8550315',
            },
            'AuthorizationType': 'NONE',
            'Integration': {
              'Type': 'MOCK',
            },
          },
        },
      },
    });
  });

  test('if proxy is added to root, proxy methods are automatically duplicated (with integration and options)', () => {
    // GIVEN
    const stack = new Stack();
    const api = new apigw.RestApi(stack, 'api');
    const proxy = api.root.addProxy({
      anyMethod: false,
    });
    const deleteInteg = new apigw.MockIntegration({
      requestParameters: {
        foo: 'bar',
      },
    });

    // WHEN
    proxy.addMethod('DELETE', deleteInteg, {
      operationName: 'DeleteMe',
    });

    // THEN
    expect(stack).toHaveResource('AWS::ApiGateway::Method', {
      HttpMethod: 'DELETE',
      ResourceId: { Ref: 'apiproxy4EA44110' },
      Integration: {
        RequestParameters: { foo: 'bar' },
        Type: 'MOCK',
      },
      OperationName: 'DeleteMe',
    });

    expect(stack).toHaveResource('AWS::ApiGateway::Method', {
      HttpMethod: 'DELETE',
      ResourceId: { 'Fn::GetAtt': ['apiC8550315', 'RootResourceId'] },
      Integration: {
        RequestParameters: { foo: 'bar' },
        Type: 'MOCK',
      },
      OperationName: 'DeleteMe',
    });
  });

  test('if proxy is added to root, proxy methods are only added if they are not defined already on the root resource', () => {
    // GIVEN
    const stack = new Stack();
    const api = new apigw.RestApi(stack, 'api');
    api.root.addMethod('POST');
    const proxy = api.root.addProxy({ anyMethod: false });

    // WHEN
    proxy.addMethod('POST');

    // THEN
  });

  test('url for a resource', () => {
    // GIVEN
    const stack = new Stack();
    const api = new apigw.RestApi(stack, 'api');

    // WHEN
    const aResource = api.root.addResource('a');
    const cResource = aResource.addResource('b').addResource('c');

    // THEN
    expect(stack.resolve(aResource.url)).toEqual({
      'Fn::Join': [
        '',
        [
          'https://',
          { Ref: 'apiC8550315' },
          '.execute-api.',
          { Ref: 'AWS::Region' },
          '.',
          { Ref: 'AWS::URLSuffix' },
          '/',
          { Ref: 'apiDeploymentStageprod896C8101' },
          '/a',
        ],
      ],
    });
    expect(stack.resolve(cResource.url)).toEqual({
      'Fn::Join': [
        '',
        [
          'https://',
          { Ref: 'apiC8550315' },
          '.execute-api.',
          { Ref: 'AWS::Region' },
          '.',
          { Ref: 'AWS::URLSuffix' },
          '/',
          { Ref: 'apiDeploymentStageprod896C8101' },
          '/a/b/c',
        ],
      ],
    });
  });

  test('fromResourceAttributes()', () => {
    // GIVEN
    const stack = new Stack();
    const resourceId = 'resource-id';
    const api = new apigw.RestApi(stack, 'MyRestApi');

    // WHEN
    const imported = apigw.Resource.fromResourceAttributes(stack, 'imported-resource', {
      resourceId,
      restApi: api,
      path: 'some-path',
    });
    imported.addMethod('GET');

    // THEN
    expect(stack).toHaveResource('AWS::ApiGateway::Method', {
      HttpMethod: 'GET',
      ResourceId: resourceId,
    });
  });

  describe('getResource', () => {
    describe('root resource', () => {
      test('returns undefined if not found', () => {
        // GIVEN
        const stack = new Stack();
        const api = new apigw.RestApi(stack, 'MyRestApi');

        // THEN
        expect(api.root.getResource('boom')).toBeUndefined();
      });

      test('returns the resource if found', () => {
        // GIVEN
        const stack = new Stack();
        const api = new apigw.RestApi(stack, 'MyRestApi');

        // WHEN
        const r1 = api.root.addResource('hello');
        const r2 = api.root.addResource('world');

        // THEN
        expect(api.root.getResource('hello')).toEqual(r1);
        expect(api.root.getResource('world')).toEqual(r2);
      });

      test('returns the resource even if it was created using "new"', () => {
        // GIVEN
        const stack = new Stack();
        const api = new apigw.RestApi(stack, 'MyRestApi');

        // WHEN
        const r1 = new apigw.Resource(stack, 'child', {
          parent: api.root,
          pathPart: 'yello',
        });

        // THEN
        expect(api.root.getResource('yello')).toEqual(r1);
      });
    });

    describe('non-root', () => {
      test('returns undefined if not found', () => {
        // GIVEN
        const stack = new Stack();
        const api = new apigw.RestApi(stack, 'MyRestApi');
        const res = api.root.addResource('boom');

        // THEN
        expect(res.getResource('child-of-boom')).toBeUndefined();
      });

      test('returns the resource if found', () => {
        // GIVEN
        const stack = new Stack();
        const api = new apigw.RestApi(stack, 'MyRestApi');
        const child = api.root.addResource('boom');

        // WHEN
        const r1 = child.addResource('hello');
        const r2 = child.addResource('world');

        // THEN
        expect(child.getResource('hello')).toEqual(r1);
        expect(child.getResource('world')).toEqual(r2);
      });

      test('returns the resource even if created with "new"', () => {
        // GIVEN
        const stack = new Stack();
        const api = new apigw.RestApi(stack, 'MyRestApi');
        const child = api.root.addResource('boom');

        // WHEN
        const r1 = child.addResource('hello');

        const r2 = new apigw.Resource(stack, 'world', {
          parent: child,
          pathPart: 'outside-world',
        });

        // THEN
        expect(child.getResource('hello')).toEqual(r1);
        expect(child.getResource('outside-world')).toEqual(r2);
      });
    });

    describe('resourceForPath', () => {
      test('empty path or "/" (on root) returns this', () => {
        // GIVEN
        const stack = new Stack();
        const api = new apigw.RestApi(stack, 'MyRestApi');

        // THEN
        expect(api.root.resourceForPath('')).toEqual(api.root);
        expect(api.root.resourceForPath('/')).toEqual(api.root);
        expect(api.root.resourceForPath('///')).toEqual(api.root);
      });

      test('returns a resource for that path', () => {
        // GIVEN
        const stack = new Stack();
        const api = new apigw.RestApi(stack, 'MyRestApi');

        // WHEN
        const resource = api.root.resourceForPath('/boom/trach');

        // THEN
        expect(resource.path).toEqual('/boom/trach');
      });

      test('resources not created if not needed', () => {
        // GIVEN
        const stack = new Stack();
        const api = new apigw.RestApi(stack, 'MyRestApi');

        // WHEN
        const trach = api.root.resourceForPath('/boom/trach');
        const bam1 = api.root.resourceForPath('/boom/bam');

        // THEN
        const parent = api.root.getResource('boom');
        expect(parent).toBeDefined();
        expect(parent!.path).toEqual('/boom');

        expect(trach.parentResource).toBe(parent);
        expect(trach.parentResource!.path).toEqual('/boom');

        const bam2 = api.root.resourceForPath('/boom/bam');
        expect(bam1).toBe(bam2);
        expect(bam1.parentResource!.path).toEqual('/boom');
      });
    });
  });
});
