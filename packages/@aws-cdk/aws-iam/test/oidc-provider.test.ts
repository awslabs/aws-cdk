import '@aws-cdk/assert-internal/jest';
import { App, Stack, Token } from '@aws-cdk/core';
import * as sinon from 'sinon';
import * as iam from '../lib';
import { arrayDiff } from '../lib/oidc-provider/diff';
import { external } from '../lib/oidc-provider/external';
import * as handler from '../lib/oidc-provider/index';

const arnOfProvider = 'arn:aws:iam::1234567:oidc-provider/oidc.eks.us-east-1.amazonaws.com/id/someid';

describe('OpenIdConnectProvider resource', () => {
  test('minimal configuration (no clients and no thumbprint)', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new iam.OpenIdConnectProvider(stack, 'MyProvider', {
      url: 'https://openid-endpoint',
    });

    // THEN
    expect(stack).toHaveResource('Custom::AWSCDKOpenIdConnectProvider', {
      Url: 'https://openid-endpoint',
    });
  });

  test('"openIdConnectProviderArn" resolves to the ref', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const provider = new iam.OpenIdConnectProvider(stack, 'MyProvider', {
      url: 'https://openid-endpoint',
    });

    // THEN
    expect(stack.resolve(provider.openIdConnectProviderArn)).toStrictEqual({ Ref: 'MyProvider730BA1C8' });
  });

  test('static fromOpenIdConnectProviderArn can be used to import a provider', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const provider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(stack, 'MyProvider', arnOfProvider);

    // THEN
    expect(stack.resolve(provider.openIdConnectProviderArn)).toStrictEqual(arnOfProvider);
  });

  test('thumbprint list and client ids can be specified', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new iam.OpenIdConnectProvider(stack, 'MyProvider', {
      url: 'https://my-url',
      clientIds: ['client1', 'client2'],
      thumbprints: ['thumb1'],
    });

    // THEN
    expect(stack).toHaveResource('Custom::AWSCDKOpenIdConnectProvider', {
      Url: 'https://my-url',
      ClientIDList: ['client1', 'client2'],
      ThumbprintList: ['thumb1'],
    });
  });
});

describe('custom resource provider infrastructure', () => {
  test('two resources share the same cr provider', () => {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'stack');

    // WHEN
    new iam.OpenIdConnectProvider(stack, 'Provider1', { url: 'provider1' });
    new iam.OpenIdConnectProvider(stack, 'Provider2', { url: 'provider2' });

    // THEN
    const template = app.synth().getStackArtifact(stack.artifactId).template;
    const resourceTypes = Object.values(template.Resources).map((r: any) => r.Type).sort();
    expect(resourceTypes).toStrictEqual([
      // custom resource perovider resources
      'AWS::IAM::Role',
      'AWS::Lambda::Function',

      // open id connect resources
      'Custom::AWSCDKOpenIdConnectProvider',
      'Custom::AWSCDKOpenIdConnectProvider',
    ]);
  });

  test('iam policy', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    new iam.OpenIdConnectProvider(stack, 'Provider1', { url: 'provider1' });

    // THEN
    expect(stack).toHaveResource('AWS::IAM::Role', {
      Policies: [
        {
          PolicyName: 'Inline',
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Resource: '*',
                Action: [
                  'iam:CreateOpenIDConnectProvider',
                  'iam:DeleteOpenIDConnectProvider',
                  'iam:UpdateOpenIDConnectProviderThumbprint',
                  'iam:AddClientIDToOpenIDConnectProvider',
                  'iam:RemoveClientIDFromOpenIDConnectProvider',
                ],
              },
            ],
          },
        },
      ],
    });
  });
});

describe('custom resource provider handler', () => {
  external.log = () => { return; }; // disable verbosity for tests
  const downloadThumbprint = external.downloadThumbprint = sinon.fake.returns('FAKE-THUMBPRINT');
  const createOpenIDConnectProvider = external.createOpenIDConnectProvider = sinon.fake.resolves({ OpenIDConnectProviderArn: 'FAKE-ARN' });
  const deleteOpenIDConnectProvider = external.deleteOpenIDConnectProvider = sinon.fake.resolves({ });
  const updateOpenIDConnectProviderThumbprint = external.updateOpenIDConnectProviderThumbprint = sinon.fake.resolves({ });
  const addClientIDToOpenIDConnectProvider = external.addClientIDToOpenIDConnectProvider = sinon.fake.resolves({ });
  const removeClientIDFromOpenIDConnectProvider = external.removeClientIDFromOpenIDConnectProvider = sinon.fake.resolves({ });

  beforeEach(() => sinon.reset());

  test('create with url will download thumbprint from host', async () => {
    // WHEN
    const response = await invokeHandler({
      RequestType: 'Create',
      ResourceProperties: {
        ServiceToken: 'Foo',
        Url: 'https://my-urlx',
        ThumbprintList: ['MyThumbprint'],
      },
    });

    // THEN
    sinon.assert.notCalled(downloadThumbprint);
    sinon.assert.calledWithExactly(createOpenIDConnectProvider, {
      ClientIDList: [],
      Url: 'https://my-urlx',
      ThumbprintList: ['MyThumbprint'],
    });

    expect(response).toStrictEqual({
      PhysicalResourceId: 'FAKE-ARN',
    });
  });

  test('create without thumbprint will download from host', async () => {
    // WHEN
    const response = await invokeHandler({
      RequestType: 'Create',
      ResourceProperties: {
        ServiceToken: 'Foo',
        Url: 'https://my-urlx',
      },
    });

    // THEN
    sinon.assert.calledWithExactly(downloadThumbprint, 'https://my-urlx');
    sinon.assert.calledWithExactly(createOpenIDConnectProvider, {
      ClientIDList: [],
      Url: 'https://my-urlx',
      ThumbprintList: ['FAKE-THUMBPRINT'],
    });

    expect(response).toStrictEqual({
      PhysicalResourceId: 'FAKE-ARN',
    });
  });

  test('delete', async () => {
    // WHEN
    await invokeHandler({
      RequestType: 'Delete',
      PhysicalResourceId: 'FAKE-ARN',
    });

    // THEN
    sinon.assert.notCalled(downloadThumbprint);
    sinon.assert.notCalled(createOpenIDConnectProvider);
    sinon.assert.calledWithExactly(deleteOpenIDConnectProvider, {
      OpenIDConnectProviderArn: 'FAKE-ARN',
    });
  });

  test('update url with explicit thumbprints (replace)', async () => {
    // WHEN
    const response = await invokeHandler({
      RequestType: 'Update',
      ResourceProperties: {
        ServiceToken: 'Foo',
        Url: 'https://new',
        ThumbprintList: ['THUMB1', 'THUMB2'],
      },
      OldResourceProperties: {
        Url: 'https://old',
      },
    });

    // THEN
    expect(response).toStrictEqual({
      PhysicalResourceId: 'FAKE-ARN',
    });
    sinon.assert.notCalled(downloadThumbprint);
    sinon.assert.calledWithExactly(createOpenIDConnectProvider, {
      ClientIDList: [],
      Url: 'https://new',
      ThumbprintList: ['THUMB1', 'THUMB2'],
    });
  });

  test('update url with no thumbprint (replace)', async () => {
    // WHEN
    const response = await invokeHandler({
      RequestType: 'Update',
      ResourceProperties: {
        ServiceToken: 'Foo',
        Url: 'https://new',
      },
      OldResourceProperties: {
        Url: 'https://old',
      },
    });

    // THEN
    expect(response).toStrictEqual({
      PhysicalResourceId: 'FAKE-ARN',
    });
    sinon.assert.calledOnceWithExactly(downloadThumbprint, 'https://new');
    sinon.assert.calledOnceWithExactly(createOpenIDConnectProvider, {
      ClientIDList: [],
      Url: 'https://new',
      ThumbprintList: ['FAKE-THUMBPRINT'],
    });
    sinon.assert.notCalled(deleteOpenIDConnectProvider);
  });

  test('update thumbprint list', async () => {
    // WHEN
    await invokeHandler({
      RequestType: 'Update',
      PhysicalResourceId: 'FAKE-PhysicalResourceId',
      ResourceProperties: {
        ServiceToken: 'Foo',
        Url: 'https://url',
        ThumbprintList: ['Foo', 'Bar'],
      },
      OldResourceProperties: {
        Url: 'https://url',
        ThumbprintList: ['Foo'],
      },
    });

    // THEN
    sinon.assert.notCalled(downloadThumbprint);
    sinon.assert.notCalled(createOpenIDConnectProvider);
    sinon.assert.notCalled(deleteOpenIDConnectProvider);
    sinon.assert.calledOnceWithExactly(updateOpenIDConnectProviderThumbprint, {
      OpenIDConnectProviderArn: 'FAKE-PhysicalResourceId',
      ThumbprintList: ['Bar', 'Foo'],
    });
  });

  test('add/remove client ids', async () => {
    // WHEN
    await invokeHandler({
      RequestType: 'Update',
      PhysicalResourceId: 'FAKE-PhysicalResourceId',
      ResourceProperties: {
        ServiceToken: 'Foo',
        Url: 'https://url',
        ClientIDList: ['A', 'B', 'C'],
      },
      OldResourceProperties: {
        Url: 'https://url',
        ClientIDList: ['A', 'D'],
      },
    });

    // THEN
    sinon.assert.notCalled(downloadThumbprint);
    sinon.assert.notCalled(createOpenIDConnectProvider);
    sinon.assert.notCalled(deleteOpenIDConnectProvider);
    sinon.assert.notCalled(updateOpenIDConnectProviderThumbprint);
    sinon.assert.calledTwice(addClientIDToOpenIDConnectProvider);
    sinon.assert.calledWithExactly(addClientIDToOpenIDConnectProvider, {
      OpenIDConnectProviderArn: 'FAKE-PhysicalResourceId', ClientID: 'B',
    });
    sinon.assert.calledWithExactly(addClientIDToOpenIDConnectProvider, {
      OpenIDConnectProviderArn: 'FAKE-PhysicalResourceId', ClientID: 'C',
    });
    sinon.assert.calledOnceWithExactly(removeClientIDFromOpenIDConnectProvider, {
      OpenIDConnectProviderArn: 'FAKE-PhysicalResourceId', ClientID: 'D',
    });
  });

  test('multiple in-place updates (no replace)', async () => {
    // WHEN
    await invokeHandler({
      RequestType: 'Update',
      PhysicalResourceId: 'FAKE-PhysicalResourceId',
      ResourceProperties: {
        ServiceToken: 'Foo',
        Url: 'https://url',
        ThumbprintList: ['NEW-LIST'],
        ClientIDList: ['A'],
      },
      OldResourceProperties: {
        Url: 'https://url',
        ThumbprintList: ['OLD-LIST'],
        ClientIDList: [],
      },
    });

    // THEN
    sinon.assert.notCalled(downloadThumbprint);
    sinon.assert.notCalled(createOpenIDConnectProvider);
    sinon.assert.notCalled(deleteOpenIDConnectProvider);
    sinon.assert.notCalled(removeClientIDFromOpenIDConnectProvider);
    sinon.assert.calledOnceWithExactly(updateOpenIDConnectProviderThumbprint, {
      OpenIDConnectProviderArn: 'FAKE-PhysicalResourceId',
      ThumbprintList: ['NEW-LIST'],
    });
    sinon.assert.calledOnceWithExactly(addClientIDToOpenIDConnectProvider, {
      OpenIDConnectProviderArn: 'FAKE-PhysicalResourceId',
      ClientID: 'A',
    });
  });

  test('multiple updates that include a url update, which means replacement', async () => {
    // WHEN
    await invokeHandler({
      RequestType: 'Update',
      PhysicalResourceId: 'FAKE-PhysicalResourceId',
      ResourceProperties: {
        ServiceToken: 'Foo',
        Url: 'https://new-url',
        ClientIDList: ['A'],
      },
      OldResourceProperties: {
        Url: 'https://old-url',
        ThumbprintList: ['OLD-LIST'],
        ClientIDList: [],
      },
    });

    // THEN
    sinon.assert.notCalled(deleteOpenIDConnectProvider);
    sinon.assert.notCalled(removeClientIDFromOpenIDConnectProvider);
    sinon.assert.notCalled(updateOpenIDConnectProviderThumbprint);
    sinon.assert.notCalled(addClientIDToOpenIDConnectProvider);
    sinon.assert.calledOnceWithExactly(downloadThumbprint, 'https://new-url'); // since thumbprint list is empty
    sinon.assert.calledOnceWithExactly(createOpenIDConnectProvider, {
      ClientIDList: ['A'],
      ThumbprintList: ['FAKE-THUMBPRINT'],
      Url: 'https://new-url',
    });
  });
});

describe('arrayDiff', () => {
  test('calculates the difference between two arrays', () => {
    expect(arrayDiff(['a', 'b', 'c'], ['a', 'd'])).toStrictEqual({ adds: ['d'], deletes: ['b', 'c'] });
    expect(arrayDiff(['a', 'b', 'c'], [])).toStrictEqual({ adds: [], deletes: ['a', 'b', 'c'] });
    expect(arrayDiff(['a', 'b', 'c'], ['a', 'c', 'b'])).toStrictEqual({ adds: [], deletes: [] });
    expect(arrayDiff([], ['a', 'c', 'b'])).toStrictEqual({ adds: ['a', 'c', 'b'], deletes: [] });
    expect(arrayDiff(['x', 'y'], ['a', 'c', 'b'])).toStrictEqual({ adds: ['a', 'c', 'b'], deletes: ['x', 'y'] });
    expect(arrayDiff([], [])).toStrictEqual({ adds: [], deletes: [] });
    expect(arrayDiff(['a', 'a'], ['a', 'b', 'a', 'b', 'b'])).toStrictEqual({ adds: ['b'], deletes: [] });
  });
});

describe('OIDC issuer', () => {
  test('extract issuer properly in the new provider', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const provider = new iam.OpenIdConnectProvider(stack, 'MyProvider', {
      url: 'https://my-issuer',
    });

    // THEN
    expect(stack.resolve(provider.openIdConnectProviderIssuer)).toStrictEqual(
      { 'Fn::Select': [1, { 'Fn::Split': [':oidc-provider/', { Ref: 'MyProvider730BA1C8' }] }] },
    );
  });

  test('extract issuer properly in a literal imported provider', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const provider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(stack, 'MyProvider', arnOfProvider);

    // THEN
    expect(stack.resolve(provider.openIdConnectProviderIssuer)).toStrictEqual('oidc.eks.us-east-1.amazonaws.com/id/someid');
  });

  test('extract issuer properly in a Token imported provider', () => {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const provider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(stack, 'MyProvider', Token.asString({ Ref: 'ARN' }));

    // THEN
    expect(stack.resolve(provider.openIdConnectProviderIssuer)).toStrictEqual({
      'Fn::Select': [1, { 'Fn::Split': [':oidc-provider/', { Ref: 'ARN' }] }],
    });
  });
});

async function invokeHandler(event: Partial<AWSLambda.CloudFormationCustomResourceEvent>) {
  return handler.handler(event as any);
}
