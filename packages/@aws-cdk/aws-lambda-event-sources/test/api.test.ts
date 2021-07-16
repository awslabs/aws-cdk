import { TemplateAssertions } from '@aws-cdk/assertions';
import * as lambda from '@aws-cdk/aws-lambda';
import * as cdk from '@aws-cdk/core';
import * as events from '../lib';

describe('ApiEventSource', () => {
  test('minimal example', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const handler = new lambda.Function(stack, 'MyFunc', {
      code: lambda.Code.fromInline('boom'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS,
    });

    // WHEN
    handler.addEventSource(new events.ApiEventSource('get', '/foo'));

    // THEN
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'foo',
      ParentId: { 'Fn::GetAtt': ['MyFuncApiEventSourceA7A86A4FFB3F557C', 'RootResourceId'] },
    });

    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'GET',
      ResourceId: { Ref: 'MyFuncApiEventSourceA7A86A4FfooCA6F87E4' },
    });


  });

  test('disjoint routes', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const handler = new lambda.Function(stack, 'MyFunc', {
      code: lambda.Code.fromInline('boom'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS,
    });

    // WHEN
    handler.addEventSource(new events.ApiEventSource('get', '/foo'));
    handler.addEventSource(new events.ApiEventSource('post', '/bar'));

    // THEN
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'foo',
      ParentId: { 'Fn::GetAtt': ['MyFuncApiEventSourceA7A86A4FFB3F557C', 'RootResourceId'] },
    });

    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'bar',
      ParentId: { 'Fn::GetAtt': ['MyFuncApiEventSourceA7A86A4FFB3F557C', 'RootResourceId'] },
    });

    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'GET',
      ResourceId: { Ref: 'MyFuncApiEventSourceA7A86A4FfooCA6F87E4' },
    });

    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'POST',
      ResourceId: { Ref: 'MyFuncApiEventSourceA7A86A4FbarDFB0F21B' },
    });


  });

  test('tree of routes', () => {
    // GIVEN
    const stack = new cdk.Stack();
    const handler = new lambda.Function(stack, 'MyFunc', {
      code: lambda.Code.fromInline('boom'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS,
    });

    // WHEN
    handler.addEventSource(new events.ApiEventSource('get', '/foo'));
    handler.addEventSource(new events.ApiEventSource('post', '/foo/bar'));
    handler.addEventSource(new events.ApiEventSource('post', '/foo/bar/zoo'));

    // THEN
    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'foo',
      ParentId: { 'Fn::GetAtt': ['MyFuncApiEventSourceA7A86A4FFB3F557C', 'RootResourceId'] },
    });

    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'bar',
      ParentId: { Ref: 'MyFuncApiEventSourceA7A86A4FfooCA6F87E4' },
    });

    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'GET',
      ResourceId: { Ref: 'MyFuncApiEventSourceA7A86A4FfooCA6F87E4' },
    });

    TemplateAssertions.fromStack(stack).hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'POST',
      ResourceId: { Ref: 'MyFuncApiEventSourceA7A86A4Ffoobar028FFFDE' },
    });


  });
});
