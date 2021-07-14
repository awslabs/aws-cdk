import * as path from 'path';
import * as db from '@aws-cdk/aws-dynamodb';
import * as s3 from '@aws-cdk/aws-s3';
import * as s3deploy from '@aws-cdk/aws-s3-deployment';
import * as cdk from '@aws-cdk/core';
import * as appsync from '../lib';

/*
 * Creates an Appsync GraphQL API with schema definition through
 * s3 location.
 *
 * Stack verification steps:
 * Deploy app and check if schema is defined.
 *
 * -- cdk deploy --app 'node integ.graphql-s3.js'             -- start                      --
 * -- aws appsync list-graphql-apis                           -- obtain api id && endpoint  --
 * -- aws appsync list-api-keys --api-id [API ID]             -- obtain api key             --
 * -- bash verify.integ.graphql-s3.sh [APIKEY] [ENDPOINT]     -- return with "getTests"     --
 * -- cdk destroy --app 'node integ.graphql-s3.js'            -- clean                      --
 */

const app = new cdk.App();

const stack = new cdk.Stack(app, 'aws-appsync-integ');

const bucket = new s3.Bucket(stack, 'Bucket');

const deploy = new s3deploy.BucketDeployment(stack, 'Deployment', {
  sources: [s3deploy.Source.asset(path.join(__dirname, 'schemas'))],
  destinationBucket: bucket,
});

const api = new appsync.GraphqlApi(stack, 'Api', {
  name: 'integ-test-s3',
  schema: appsync.Schema.fromBucket(bucket, 'appsync.test.graphql'),
});

api.node.addDependency(deploy);

const testTable = new db.Table(stack, 'TestTable', {
  billingMode: db.BillingMode.PAY_PER_REQUEST,
  partitionKey: {
    name: 'id',
    type: db.AttributeType.STRING,
  },
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});

const testDS = api.addDynamoDbDataSource('testDataSource', testTable);

testDS.createResolver({
  typeName: 'Query',
  fieldName: 'getTests',
  requestMappingTemplate: appsync.MappingTemplate.dynamoDbScanTable(),
  responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultList(),
});

app.synth();