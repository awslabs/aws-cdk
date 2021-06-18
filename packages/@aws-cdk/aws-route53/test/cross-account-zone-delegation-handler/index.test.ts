import { handler } from '../../lib/cross-account-zone-delegation-handler';

const mockStsClient = {
  assumeRole: jest.fn().mockReturnThis(),
  promise: jest.fn(),
};
const mockRoute53Client = {
  changeResourceRecordSets: jest.fn().mockReturnThis(),
  listHostedZonesByName: jest.fn().mockReturnThis(),
  promise: jest.fn(),
};

jest.mock('aws-sdk', () => {
  return {
    ...(jest.requireActual('aws-sdk') as any),
    STS: jest.fn(() => mockStsClient),
    Route53: jest.fn(() => mockRoute53Client),
  };
});

beforeEach(() => {
  mockStsClient.assumeRole.mockReturnThis();
  mockRoute53Client.changeResourceRecordSets.mockReturnThis();
  mockRoute53Client.listHostedZonesByName.mockReturnThis();
});

afterEach(() => {
  jest.clearAllMocks();
});

test('throws error if both ParentZoneId and ParentZoneName are not provided', async () => {
  // WHEN
  const event = getCfnEvent({}, {
    ParentZoneId: undefined,
    ParentZoneName: undefined,
  });

  // THEN
  await expect(invokeHandler(event)).rejects.toThrow(/One of ParentZoneId or ParentZoneName must be specified/);
});

test('throws error if getting credentials fails', async () => {
  // GIVEN
  mockStsClient.promise.mockResolvedValueOnce({ Credentials: undefined });

  // WHEN
  const event= getCfnEvent();

  // THEN
  await expect(invokeHandler(event)).rejects.toThrow(/Error getting assume role credentials/);

  expect(mockStsClient.assumeRole).toHaveBeenCalledTimes(1);
  expect(mockStsClient.assumeRole).toHaveBeenCalledWith({
    RoleArn: 'roleArn',
    RoleSessionName: expect.any(String),
  });
});

test('calls create resource record set with Upsert for Create event', async () => {
  // GIVEN
  mockStsClient.promise.mockResolvedValueOnce({ Credentials: { AccessKeyId: 'K', SecretAccessKey: 'S', SessionToken: 'T' } });
  mockRoute53Client.promise.mockResolvedValueOnce({});

  // WHEN
  const event= getCfnEvent();
  await invokeHandler(event);

  // THEN
  expect(mockRoute53Client.changeResourceRecordSets).toHaveBeenCalledTimes(1);
  expect(mockRoute53Client.changeResourceRecordSets).toHaveBeenCalledWith({
    HostedZoneId: '1',
    ChangeBatch: {
      Changes: [{
        Action: 'UPSERT',
        ResourceRecordSet: {
          Name: 'recordName',
          Type: 'NS',
          TTL: 172800,
          ResourceRecords: [{ Value: 'one' }, { Value: 'two' }],
        },
      }],
    },
  });
});

test('calls create resource record set with DELETE for Delete event', async () => {
  // GIVEN
  mockStsClient.promise.mockResolvedValueOnce({ Credentials: { AccessKeyId: 'K', SecretAccessKey: 'S', SessionToken: 'T' } });
  mockRoute53Client.promise.mockResolvedValueOnce({});

  // WHEN
  const event= getCfnEvent({ RequestType: 'Delete' });
  await invokeHandler(event);

  // THEN
  expect(mockRoute53Client.changeResourceRecordSets).toHaveBeenCalledTimes(1);
  expect(mockRoute53Client.changeResourceRecordSets).toHaveBeenCalledWith({
    HostedZoneId: '1',
    ChangeBatch: {
      Changes: [{
        Action: 'DELETE',
        ResourceRecordSet: {
          Name: 'recordName',
          Type: 'NS',
          TTL: 172800,
          ResourceRecords: [{ Value: 'one' }, { Value: 'two' }],
        },
      }],
    },
  });
});

test('calls listHostedZonesByName to get zoneId if ParentZoneId is not provided', async () => {
  // GIVEN
  const parentZoneName = 'some.zone';
  const parentZoneId = 'zone-id';

  mockStsClient.promise.mockResolvedValueOnce({ Credentials: { AccessKeyId: 'K', SecretAccessKey: 'S', SessionToken: 'T' } });
  mockRoute53Client.promise.mockResolvedValueOnce({ HostedZones: [{ Name: `${parentZoneName}.`, Id: parentZoneId }] });
  mockRoute53Client.promise.mockResolvedValueOnce({});

  // WHEN
  const event = getCfnEvent({}, {
    ParentZoneId: undefined,
    ParentZoneName: parentZoneName,
  });
  await invokeHandler(event);

  // THEN
  expect(mockRoute53Client.listHostedZonesByName).toHaveBeenCalledTimes(1);
  expect(mockRoute53Client.listHostedZonesByName).toHaveBeenCalledWith({ DNSName: parentZoneName });

  expect(mockRoute53Client.changeResourceRecordSets).toHaveBeenCalledTimes(1);
  expect(mockRoute53Client.changeResourceRecordSets).toHaveBeenCalledWith({
    HostedZoneId: parentZoneId,
    ChangeBatch: {
      Changes: [{
        Action: 'UPSERT',
        ResourceRecordSet: {
          Name: 'recordName',
          Type: 'NS',
          TTL: 172800,
          ResourceRecords: [{ Value: 'one' }, { Value: 'two' }],
        },
      }],
    },
  });
});

test('throws if more than one HostedZones are returnd for the provided ParentHostedZone', async () => {
  // GIVEN
  const parentZoneName = 'some.zone';
  const parentZoneId = 'zone-id';

  mockStsClient.promise.mockResolvedValueOnce({ Credentials: { AccessKeyId: 'K', SecretAccessKey: 'S', SessionToken: 'T' } });
  mockRoute53Client.promise.mockResolvedValueOnce({
    HostedZones: [
      { Name: `${parentZoneName}.`, Id: parentZoneId },
      { Name: `${parentZoneName}.`, Id: parentZoneId },
    ],
  });

  // WHEN
  const event = getCfnEvent({}, {
    ParentZoneId: undefined,
    ParentZoneName: parentZoneName,
  });

  // THEN
  await expect(invokeHandler(event)).rejects.toThrow(/Expected one hosted zone to match the given name but found 2/);
  expect(mockRoute53Client.listHostedZonesByName).toHaveBeenCalledTimes(1);
  expect(mockRoute53Client.listHostedZonesByName).toHaveBeenCalledWith({ DNSName: parentZoneName });
});

function getCfnEvent(
    event?: Partial<AWSLambda.CloudFormationCustomResourceEvent>,
    resourceProps?: any,
): Partial<AWSLambda.CloudFormationCustomResourceEvent> {
  return {
    RequestType: 'Create',
    ResourceProperties: {
      ServiceToken: 'Foo',
      AssumeRoleArn: 'roleArn',
      ParentZoneId: '1',
      DelegatedZoneName: 'recordName',
      DelegatedZoneNameServers: ['one', 'two'],
      TTL: 172800,
      ...resourceProps,
    },
    ...event,
  };
}

// helper function to get around TypeScript expecting a complete event object,
// even though our tests only need some of the fields
async function invokeHandler(event: Partial<AWSLambda.CloudFormationCustomResourceEvent>) {
  return handler(event as AWSLambda.CloudFormationCustomResourceEvent);
}
