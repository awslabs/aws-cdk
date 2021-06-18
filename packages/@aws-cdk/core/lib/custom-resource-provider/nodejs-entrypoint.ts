import * as https from 'https';
import * as url from 'url';

// for unit tests
export const external = {
  sendHttpRequest: defaultSendHttpRequest,
  log: defaultLog,
  includeStackTraces: true,
  userHandlerIndex: './index',
};

const CREATE_FAILED_PHYSICAL_ID_MARKER = 'AWSCDK::CustomResourceProviderFramework::CREATE_FAILED';
const MISSING_PHYSICAL_ID_MARKER = 'AWSCDK::CustomResourceProviderFramework::MISSING_PHYSICAL_ID';

export type Response = AWSLambda.CloudFormationCustomResourceEvent & HandlerResponse;
export type Handler = (event: AWSLambda.CloudFormationCustomResourceEvent) => Promise<HandlerResponse | void>;
export type HandlerResponse = undefined | {
  Data?: any;
  PhysicalResourceId?: string;
  Reason?: string;
  NoEcho?: boolean;
};

export async function handler(event: AWSLambda.CloudFormationCustomResourceEvent) {
  external.log(JSON.stringify(event, undefined, 2));

  // ignore DELETE event when the physical resource ID is the marker that
  // indicates that this DELETE is a subsequent DELETE to a failed CREATE
  // operation.
  if (event.RequestType === 'Delete' && event.PhysicalResourceId === CREATE_FAILED_PHYSICAL_ID_MARKER) {
    external.log('ignoring DELETE event caused by a failed CREATE event');
    await submitResponse('SUCCESS', event);
    return;
  }

  try {
    // invoke the user handler. this is intentionally inside the try-catch to
    // ensure that if there is an error it's reported as a failure to
    // cloudformation (otherwise cfn waits).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const userHandler: Handler = require(external.userHandlerIndex).handler;
    const result = await userHandler(event);

    // validate user response and create the combined event
    const responseEvent = renderResponse(event, result);

    // submit to cfn as success
    await submitResponse('SUCCESS', responseEvent);
  } catch (e) {
    const resp: Response = {
      ...event,
      Reason: external.includeStackTraces ? e.stack : e.message,
    };

    if (!resp.PhysicalResourceId) {
      // special case: if CREATE fails, which usually implies, we usually don't
      // have a physical resource id. in this case, the subsequent DELETE
      // operation does not have any meaning, and will likely fail as well. to
      // address this, we use a marker so the provider framework can simply
      // ignore the subsequent DELETE.
      if (event.RequestType === 'Create') {
        external.log('CREATE failed, responding with a marker physical resource id so that the subsequent DELETE will be ignored');
        resp.PhysicalResourceId = CREATE_FAILED_PHYSICAL_ID_MARKER;
      } else {
        // otherwise, if PhysicalResourceId is not specified, something is
        // terribly wrong because all other events should have an ID.
        external.log(`ERROR: Malformed event. "PhysicalResourceId" is required: ${JSON.stringify(event)}`);
      }
    }

    // this is an actual error, fail the activity altogether and exist.
    await submitResponse('FAILED', resp);
  }
}

function renderResponse(
    cfnRequest: AWSLambda.CloudFormationCustomResourceEvent & { PhysicalResourceId?: string },
    handlerResponse: void | HandlerResponse = { }): Response {
  // if physical ID is not returned, we have some defaults for you based
  // on the request type.
  const physicalResourceId = handlerResponse.PhysicalResourceId ?? cfnRequest.PhysicalResourceId ?? cfnRequest.RequestId;

  // if we are in DELETE and physical ID was changed, it's an error.
  if (cfnRequest.RequestType === 'Delete' && physicalResourceId !== cfnRequest.PhysicalResourceId) {
    throw new Error(`DELETE: cannot change the physical resource ID from "${cfnRequest.PhysicalResourceId}" to "${handlerResponse.PhysicalResourceId}" during deletion`);
  }

  // merge request event and result event (result prevails).
  return {
    ...cfnRequest,
    ...handlerResponse,
    PhysicalResourceId: physicalResourceId,
  };
}

async function submitResponse(status: 'SUCCESS' | 'FAILED', event: Response) {
  const json: AWSLambda.CloudFormationCustomResourceResponse = {
    Status: status,
    Reason: event.Reason ?? status,
    StackId: event.StackId,
    RequestId: event.RequestId,
    PhysicalResourceId: event.PhysicalResourceId || MISSING_PHYSICAL_ID_MARKER,
    LogicalResourceId: event.LogicalResourceId,
    NoEcho: event.NoEcho,
    Data: event.Data,
  };

  external.log('submit response to cloudformation', json);

  const responseBody = JSON.stringify(json);
  const parsedUrl = url.parse(event.ResponseURL);
  const req = {
    hostname: parsedUrl.hostname,
    path: parsedUrl.path,
    method: 'PUT',
    headers: { 'content-type': '', 'content-length': responseBody.length },
  };

  await external.sendHttpRequest(req, responseBody);
}

async function defaultSendHttpRequest(options: https.RequestOptions, responseBody: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const request = https.request(options, _ => resolve());
      request.on('error', reject);
      request.write(responseBody);
      request.end();
    } catch (e) {
      reject(e);
    }
  });
}

function defaultLog(fmt: string, ...params: any[]) {
  // eslint-disable-next-line no-console
  console.log(fmt, ...params);
}
