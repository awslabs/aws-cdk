require('isomorphic-fetch');
const AWS = require('aws-sdk/global');
const gql = require('graphql-tag');
const appsync = require('aws-appsync');

const config = {
  url: process.env.APPSYNC_ENDPOINT,
  region: process.env.AWS_REGION,
  auth: {
    type: appsync.AUTH_TYPE.AWS_IAM,
    credentials: AWS.config.credentials,
  },
  disableOffline: true
};

const getTests = 
`query getTests {
  getTests {
    id
    version
  }
}`;

const client = new appsync.AWSAppSyncClient(config);

exports.handler = (event, context, callback) => {

  (async () => {
    try {
      const result = await client.query({
        query: gql(getTests)
      });
      console.log(result.data);
      callback(null, result.data);
    } catch (e) {
      console.warn('Error sending mutation: ',  e);
      callback(Error(e));
    }
  })();
};