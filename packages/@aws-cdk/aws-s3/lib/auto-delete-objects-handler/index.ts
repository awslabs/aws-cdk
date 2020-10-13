export async function handler(event: AWSLambda.CloudFormationCustomResourceEvent) {
  if (event.RequestType === 'Create') { return onCreate(event); }
  if (event.RequestType === 'Update') { return onUpdate(event); }
  if (event.RequestType === 'Delete') { return onDelete(event); }
  throw new Error('Invalid request type.');
}

/**
 * Recursively delete all items in the bucket
 *
 * @param {AWS.S3} s3 the S3 client
 * @param {*} bucketName the bucket name
 */
async function emptyBucket(s3: any, bucketName: string) {
  const listedObjects = await s3.listObjectVersions({ Bucket: bucketName }).promise();
  const contents = (listedObjects.Versions || []).concat(listedObjects.DeleteMarkers || []);
  if (contents.length === 0) {
    return;
  };

  let records = contents.map((record: any) => ({ Key: record.Key, VersionId: record.VersionId }));
  await s3.deleteObjects({ Bucket: bucketName, Delete: { Objects: records } }).promise();

  if (listedObjects?.IsTruncated === 'true' ) await emptyBucket(s3, bucketName);
}

async function onCreate(_event: AWSLambda.CloudFormationCustomResourceCreateEvent) {
  return;
}

async function onUpdate(_event: AWSLambda.CloudFormationCustomResourceUpdateEvent) {
  return;
}

async function onDelete(deleteEvent: AWSLambda.CloudFormationCustomResourceDeleteEvent) {
  const bucketName = deleteEvent.ResourceProperties?.BucketName;
  if (!bucketName) {
    throw new Error('No BucketName was provided.');
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports, import/no-extraneous-dependencies
  const s3 = new (require('aws-sdk').S3)();
  await emptyBucket(s3, bucketName);
}
