import * as assert from 'assert';
import * as fs from 'fs';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import * as url from 'url';
import { nodeunitShim, Test } from 'nodeunit-shim';
import * as entrypoint from '../../lib/custom-resource-provider/nodejs-entrypoint';

nodeunitShim({
  'handler return value is sent back to cloudformation as a success response': {

    async 'physical resource id (ref)'(test: Test) {
      // GIVEN
      const createEvent = makeEvent({ RequestType: 'Create' });

      // WHEN
      const response = await invokeHandler(createEvent, async _ => ({ PhysicalResourceId: 'returned-from-handler' }));

      // THEN
      test.deepEqual(response.Status, 'SUCCESS');
      test.deepEqual(response.PhysicalResourceId, 'returned-from-handler');
      test.done();
    },

    async 'data (attributes)'(test: Test) {
      // GIVEN
      const createEvent = makeEvent({ RequestType: 'Create' });

      // WHEN
      const response = await invokeHandler(createEvent, async _ => {
        return {
          Data: {
            Attribute1: 'hello',
            Attribute2: {
              Foo: 1111,
            },
          },
        };
      });

      // THEN
      test.deepEqual(response.Status, 'SUCCESS');
      test.deepEqual(response.PhysicalResourceId, '<RequestId>', 'physical id defaults to request id');
      test.deepEqual(response.Data, {
        Attribute1: 'hello',
        Attribute2: {
          Foo: 1111,
        },
      });
      test.done();
    },

    async 'no echo'(test: Test) {
      // GIVEN
      const createEvent = makeEvent({ RequestType: 'Create' });

      // WHEN
      const response = await invokeHandler(createEvent, async _ => ({ NoEcho: true }));

      // THEN
      test.deepEqual(response.Status, 'SUCCESS');
      test.deepEqual(response.NoEcho, true);
      test.done();
    },

    async 'reason'(test: Test) {
      // GIVEN
      const createEvent = makeEvent({ RequestType: 'Create' });

      // WHEN
      const response = await invokeHandler(createEvent, async _ => ({ Reason: 'hello, reason' }));

      // THEN
      test.deepEqual(response.Status, 'SUCCESS');
      test.deepEqual(response.Reason, 'hello, reason');
      test.done();
    },
  },

  async 'an error thrown by the handler is sent as a failure response to cloudformation'(test: Test) {
    // GIVEN
    const createEvent = makeEvent({ RequestType: 'Create' });

    // WHEN
    const response = await invokeHandler(createEvent, async _ => {
      throw new Error('this is an error');
    });

    // THEN
    test.deepEqual(response, {
      Status: 'FAILED',
      Reason: 'this is an error',
      StackId: '<StackId>',
      RequestId: '<RequestId>',
      PhysicalResourceId: 'AWSCDK::CustomResourceProviderFramework::CREATE_FAILED',
      LogicalResourceId: '<LogicalResourceId>',
    });

    test.done();
  },

  async 'physical resource id cannot be changed in DELETE'(test: Test) {
    // GIVEN
    const event = makeEvent({ RequestType: 'Delete' });

    // WHEN
    const response = await invokeHandler(event, async _ => ({
      PhysicalResourceId: 'Changed',
    }));

    // THEN
    test.deepEqual(response, {
      Status: 'FAILED',
      Reason: 'DELETE: cannot change the physical resource ID from "undefined" to "Changed" during deletion',
      StackId: '<StackId>',
      RequestId: '<RequestId>',
      PhysicalResourceId: 'AWSCDK::CustomResourceProviderFramework::MISSING_PHYSICAL_ID',
      LogicalResourceId: '<LogicalResourceId>',
    });

    test.done();
  },

  async 'DELETE after CREATE is ignored with success'(test: Test) {
    // GIVEN
    const event = makeEvent({
      RequestType: 'Delete',
      PhysicalResourceId: 'AWSCDK::CustomResourceProviderFramework::CREATE_FAILED',
    });

    // WHEN
    const response = await invokeHandler(event, async _ => {
      test.ok(false, 'handler should not be called');
    });

    // THEN
    test.deepEqual(response, {
      Status: 'SUCCESS',
      Reason: 'SUCCESS',
      StackId: '<StackId>',
      RequestId: '<RequestId>',
      PhysicalResourceId: 'AWSCDK::CustomResourceProviderFramework::CREATE_FAILED',
      LogicalResourceId: '<LogicalResourceId>',
    });

    test.done();
  },
});

function makeEvent(req: Partial<AWSLambda.CloudFormationCustomResourceEvent>): AWSLambda.CloudFormationCustomResourceEvent {
  return {
    LogicalResourceId: '<LogicalResourceId>',
    RequestId: '<RequestId>',
    ResourceType: '<ResourceType>',
    ResponseURL: '<ResponseURL>',
    ServiceToken: '<ServiceToken>',
    StackId: '<StackId>',
    ResourceProperties: {
      ServiceToken: '<ServiceToken>',
      ...req.ResourceProperties,
    },
    ...req,
  } as any;
}

async function invokeHandler(req: AWSLambda.CloudFormationCustomResourceEvent, userHandler: entrypoint.Handler) {
  const parsedResponseUrl = url.parse(req.ResponseURL);

  // stage entry point and user handler.
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdk-custom-resource-provider-handler-test-'));
  entrypoint.external.userHandlerIndex = path.join(workdir, 'index.js');
  fs.writeFileSync(entrypoint.external.userHandlerIndex, `exports.handler = ${userHandler.toString()};`);

  // do not include stack traces in failure responses so we can assert against them.
  entrypoint.external.includeStackTraces = false;

  // disable logging
  entrypoint.external.log = () => {
    return;
  };

  let actualResponse;
  entrypoint.external.sendHttpRequest = async (options: https.RequestOptions, responseBody: string): Promise<void> => {
    assert(options.hostname === parsedResponseUrl.hostname, 'request hostname expected to be based on response URL');
    assert(options.path === parsedResponseUrl.path, 'request path expected to be based on response URL');
    assert(options.method === 'PUT', 'request method is expected to be PUT');
    actualResponse = responseBody;
  };

  await entrypoint.handler(req);
  if (!actualResponse) {
    throw new Error('no response sent to cloudformation');
  }

  return JSON.parse(actualResponse) as AWSLambda.CloudFormationCustomResourceResponse;
}
