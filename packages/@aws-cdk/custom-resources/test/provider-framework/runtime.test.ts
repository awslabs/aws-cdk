/* eslint-disable max-len */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-require-imports */
import cfnResponse = require('../../lib/provider-framework/runtime/cfn-response');
import framework = require('../../lib/provider-framework/runtime/framework');
import outbound = require('../../lib/provider-framework/runtime/outbound');
import mocks = require('./mocks');

console.log = jest.fn();

cfnResponse.includeStackTraces = false;

const MOCK_PHYSICAL_ID = 'mock-physical-resource-id';
const MOCK_PROPS = { Name: 'Value', List: ['1', '2', '3'], ServiceToken: 'bla' };
const MOCK_ATTRS = { MyAttribute: 'my-mock-attribute' };

outbound.httpRequest = mocks.httpRequestMock;
outbound.invokeFunction = mocks.invokeFunctionMock;
outbound.startExecution = mocks.startExecutionMock;

beforeEach(() => mocks.setup());

test('async flow: isComplete returns true only after 3 times', async () => {
  let isCompleteCalls = 0;

  mocks.onEventImplMock = async event => {
    expect(event.RequestType).toEqual('Create');
    expect(event.ResourceProperties).toStrictEqual(MOCK_PROPS);
    expect(event.PhysicalResourceId).toBeUndefined(); // physical ID in CREATE

    return {
      PhysicalResourceId: MOCK_PHYSICAL_ID,
      Data: MOCK_ATTRS,
      ArbitraryField: 1234,
    };
  };

  mocks.isCompleteImplMock = async event => {
    isCompleteCalls++;
    expect((event as any).ArbitraryField).toEqual(1234); // any field is passed through
    expect(event.PhysicalResourceId).toEqual(MOCK_PHYSICAL_ID); // physical ID returned from onEvent is passed to "isComplete"
    expect(event.Data).toStrictEqual(MOCK_ATTRS); // attributes are propagated between the calls

    const result = isCompleteCalls === 3;
    if (!result) {
      return {
        IsComplete: false,
      };
    }

    return {
      IsComplete: true,
      Data: {
        Additional: 'attribute', // additional attributes can be returned from "isComplete"
      },
    };
  };

  // WHEN
  await simulateEvent({
    RequestType: 'Create',
    ResourceProperties: MOCK_PROPS,
  });

  // THEN
  expect(isCompleteCalls).toEqual(3);

  expectCloudFormationSuccess({
    PhysicalResourceId: MOCK_PHYSICAL_ID,
    Data: {
      ...MOCK_ATTRS,
      Additional: 'attribute',
    },
  });
});

test('isComplete throws in the first invocation', async () => {
  // GIVEN
  mocks.onEventImplMock = async () => ({ PhysicalResourceId: MOCK_PHYSICAL_ID });
  mocks.isCompleteImplMock = async () => { throw new Error('Some failure'); };

  // WHEN
  await simulateEvent({
    RequestType: 'Create',
    ResourceProperties: MOCK_PROPS,
  });

  expectCloudFormationFailed('Some failure\n\nLogs: /aws/lambda/complete\n');
});

test('fails gracefully if "onEvent" throws an error', async () => {
  // GIVEN
  mocks.onEventImplMock = async () => { throw new Error('error thrown during onEvent'); };
  mocks.isCompleteImplMock = async () => ({ IsComplete: true });

  // WHEN
  await simulateEvent({
    RequestType: 'Create',
  });

  // THEN
  expectCloudFormationFailed('error thrown during onEvent\n\nLogs: /aws/lambda/event\n');
  expectNoWaiter();
});

describe('PhysicalResourceId', () => {
  describe('if not omitted from onEvent result', () => {
    it('defaults to RequestId for CREATE', async () => {
      // WHEN
      mocks.onEventImplMock = async () => undefined;

      // THEN
      await simulateEvent({
        RequestType: 'Create',
      });

      expectCloudFormationSuccess({
        PhysicalResourceId: mocks.MOCK_REQUEST.RequestId,
      });
    });

    it('defaults to the current PhysicalResourceId for UPDATE', async () => {
      // WHEN
      mocks.onEventImplMock = async () => undefined;

      // THEN
      await simulateEvent({
        RequestType: 'Update',
        PhysicalResourceId: MOCK_PHYSICAL_ID,
      });

      expectCloudFormationSuccess({
        PhysicalResourceId: MOCK_PHYSICAL_ID,
      });
    });

    it('defaults to the current PhysicalResourceId for DELETE', async () => {
      // WHEN
      mocks.onEventImplMock = async () => undefined;

      // THEN
      await simulateEvent({
        RequestType: 'Delete',
        PhysicalResourceId: MOCK_PHYSICAL_ID,
      });

      expectCloudFormationSuccess({
        PhysicalResourceId: MOCK_PHYSICAL_ID,
      });
    });
  });

  test('UPDATE: can change the physical ID by returning a new ID', async () => {
    // GIVEN
    mocks.onEventImplMock = async () => ({ PhysicalResourceId: 'NewPhysicalId' });
    mocks.isCompleteImplMock = async () => ({ IsComplete: true });

    // WHEN
    await simulateEvent({
      RequestType: 'Update',
      PhysicalResourceId: 'CurrentPhysicalId',
    });

    // THEN
    expectCloudFormationSuccess({
      PhysicalResourceId: 'NewPhysicalId',
    });
  });

  test('DELETE: cannot change the physical resource ID during a delete', async () => {
    // GIVEN
    mocks.onEventImplMock = async () => ({ PhysicalResourceId: 'NewPhysicalId' });
    mocks.isCompleteImplMock = async () => ({ IsComplete: true });

    // WHEN
    await simulateEvent({
      RequestType: 'Delete',
      PhysicalResourceId: 'CurrentPhysicalId',
    });

    // THEN
    expectNoWaiter();
    expectCloudFormationFailed('DELETE: cannot change the physical resource ID from "CurrentPhysicalId" to "NewPhysicalId" during deletion');
  });
});

test('isComplete always returns "false" and then a timeout occurs', async () => {
  // GIVEN
  mocks.onEventImplMock = async () => ({ Data: { Foo: 123 }, PhysicalResourceId: MOCK_PHYSICAL_ID });
  mocks.isCompleteImplMock = async () => ({ IsComplete: false });

  // WHEN
  await simulateEvent({
    RequestType: 'Update',
    PhysicalResourceId: MOCK_PHYSICAL_ID,
  });

  // THEN
  expectCloudFormationFailed('Operation timed out');
});

test('isComplete: "Data" is not allowed if InComplete is "False"', async () => {
  // GIVEN
  mocks.onEventImplMock = async () => ({ Data: { Foo: 123 }, PhysicalResourceId: MOCK_PHYSICAL_ID });
  mocks.isCompleteImplMock = async () => ({ IsComplete: false, Data: { Foo: 3333 } });

  // WHEN
  await simulateEvent({
    RequestType: 'Update',
    PhysicalResourceId: MOCK_PHYSICAL_ID,
  });

  expectCloudFormationFailed('"Data" is not allowed if "IsComplete" is "False"');
});

test('if there is no user-defined "isComplete", the waiter will not be triggered or needed', async () => {
  // GIVEN
  mocks.onEventImplMock = async () => ({ PhysicalResourceId: MOCK_PHYSICAL_ID });

  // WHEN
  await simulateEvent({
    RequestType: 'Create',
  });

  // THEN
  expectNoWaiter();
  expectCloudFormationSuccess({ PhysicalResourceId: MOCK_PHYSICAL_ID });
});

test('fails if user handler returns a non-object response', async () => {
  // GIVEN
  mocks.stringifyPayload = false;
  mocks.onEventImplMock = async () => 'string' as any;

  // WHEN
  await simulateEvent({ RequestType: 'Create' });

  // THEN
  expectCloudFormationFailed('return values from user-handlers must be JSON objects. got: \"string\"');
});

describe('if CREATE fails, the subsequent DELETE will be ignored', () => {
  it('FAILED response sets PhysicalResourceId to a special marker', async () => {
    // WHEN
    mocks.onEventImplMock = async () => { throw new Error('CREATE FAILED'); };

    // THEN
    await simulateEvent({
      RequestType: 'Create',
    });

    expectCloudFormationFailed('CREATE FAILED\n\nLogs: /aws/lambda/event\n', {
      PhysicalResourceId: cfnResponse.CREATE_FAILED_PHYSICAL_ID_MARKER,
    });
  });

  it('DELETE request with the marker succeeds without calling user handler', async () => {
    // GIVEN
    // user handler is not assigned

    // WHEN
    await simulateEvent({
      RequestType: 'Delete',
      PhysicalResourceId: cfnResponse.CREATE_FAILED_PHYSICAL_ID_MARKER,
    });

    // THEN
    expectCloudFormationSuccess();
  });
});

// -----------------------------------------------------------------------------------------------------------------------

/**
 * Triggers the custom resource lifecycle event flow by invoking the framework's
 * onEvent function and then, if the waiter state machine was started, simulates
 * the waiter and invokes isComplete and onTimeout as appropriate.
 */
async function simulateEvent(req: Partial<AWSLambda.CloudFormationCustomResourceEvent>) {
  const x = {
    ServiceToken: 'SERVICE-TOKEN',
    ResponseURL: mocks.MOCK_REQUEST.ResponseURL,
    StackId: mocks.MOCK_REQUEST.StackId,
    RequestId: mocks.MOCK_REQUEST.RequestId,
    ResourceType: 'Custom::TestResource',
    LogicalResourceId: mocks.MOCK_REQUEST.LogicalResourceId,
    ...req,
  };

  mocks.prepareForExecution();

  await framework.onEvent(x as AWSLambda.CloudFormationCustomResourceEvent);

  // if the FSM
  if (mocks.startStateMachineInput && mocks.startStateMachineInput.stateMachineArn === mocks.MOCK_SFN_ARN) {
    await simulateWaiter(JSON.parse(mocks.startStateMachineInput.input!));
  }

  async function simulateWaiter(event: AWSCDKAsyncCustomResource.IsCompleteRequest) {
    let retry = true;
    let count = 5;
    while (retry) {
      try {
        await framework.isComplete(event);
        retry = false;
      } catch (e) {
        if (e instanceof cfnResponse.Retry) {
          if (count-- === 0) {
            await framework.onTimeout({ Cause: JSON.stringify({ errorMessage: e.message }) });
            retry = false;
          } else {
            retry = true;
            continue;
          }
        } else {
          throw new Error(e);
        }
      }
    }
  }
}

function expectCloudFormationFailed(expectedReason: string, resp?: Partial<AWSLambda.CloudFormationCustomResourceResponse>) {
  expectCloudFormationResponse({
    Status: 'FAILED',
    Reason: expectedReason,
    ...resp,
  });
}

function expectCloudFormationSuccess(resp?: Partial<AWSLambda.CloudFormationCustomResourceResponse>) {
  if (mocks.cfnResponse.Status !== 'SUCCESS') {
    console.error(mocks.cfnResponse.Reason || '<NO REASON>');
  }

  expectCloudFormationResponse({ Status: 'SUCCESS', ...resp });
}

function expectCloudFormationResponse(resp: Partial<AWSLambda.CloudFormationCustomResourceResponse> = {}) {
  for (const [key, expected] of Object.entries(resp)) {
    const actual = (mocks.cfnResponse as any)[key];
    expect(actual).toStrictEqual(expected as any);
  }
}

function expectNoWaiter() {
  expect(mocks.startStateMachineInput).toBeUndefined();
}
