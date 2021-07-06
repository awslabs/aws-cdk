jest.mock('aws-sdk');
import * as AWS from 'aws-sdk';

export function mockAws() {
  const mockEcr = new AWS.ECR();
  const mockS3 = new AWS.S3();
  const mockSecretsManager = new AWS.SecretsManager();

  // Sane defaults which can be overridden
  mockS3.getBucketLocation = mockedApiResult({});
  mockEcr.describeRepositories = mockedApiResult({
    repositories: [
      {
        repositoryUri: '12345.amazonaws.com/repo',
      },
    ],
  });

  return {
    mockEcr,
    mockS3,
    mockSecretsManager,
    discoverPartition: jest.fn(() => Promise.resolve('swa')),
    discoverCurrentAccount: jest.fn(() => Promise.resolve({ accountId: 'current_account', partition: 'swa' })),
    discoverDefaultRegion: jest.fn(() => Promise.resolve('current_region')),
    ecrClient: jest.fn(() => Promise.resolve(mockEcr)),
    s3Client: jest.fn(() => Promise.resolve(mockS3)),
    secretsManagerClient: jest.fn(() => Promise.resolve(mockSecretsManager)),
  };
}

export function errorWithCode(code: string, message: string) {
  const ret = new Error(message);
  (ret as any).code = code;
  return ret;
}

export function mockedApiResult(returnValue: any) {
  return jest.fn().mockReturnValue({
    promise: jest.fn().mockResolvedValue(returnValue),
  });
}

export function mockedApiFailure(code: string, message: string) {
  return jest.fn().mockReturnValue({
    promise: jest.fn().mockRejectedValue(errorWithCode(code, message)),
  });
}

/**
 * Mock upload, draining the stream that we get before returning
 * so no race conditions happen with the uninstallation of mock-fs.
 */
export function mockUpload(expectContent?: string) {
  return jest.fn().mockImplementation(request => ({
    promise: () => new Promise((ok, ko) => {
      const didRead = new Array<string>();

      const bodyStream: NodeJS.ReadableStream = request.Body;
      bodyStream.on('data', (chunk) => { didRead.push(chunk.toString()); }); // This listener must exist
      bodyStream.on('error', ko);
      bodyStream.on('close', () => {
        const actualContent = didRead.join('');
        if (expectContent !== undefined && expectContent !== actualContent) {
          throw new Error(`Expected to read '${expectContent}' but read: '${actualContent}'`);
        }
        ok();
      });
    }),
  }));
}
