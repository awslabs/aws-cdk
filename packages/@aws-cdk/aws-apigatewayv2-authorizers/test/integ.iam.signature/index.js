require('dotenv').config();

const fs = require('fs');
const path = require('path');
const awsV4 = require('aws-v4');

const { headers } = awsV4
  .newClient({
    accessKey: process.env.AWS_ACCESS_KEY_ID,
    secretKey: process.env.AWS_SECRET_KEY,
    region: process.env.AWS_REGION,
    endpoint: process.env.AWS_API_GATEWAY_ENDPOINT,
  })
  .signRequest({
    method: 'get',
    path: '/',
    headers: {
      'Content-Type': 'application/json',
    },
    queryParams: {},
    body: {},
  });
fs.writeFileSync(
  path.join(__dirname, './headers.yaml'),
  `Accept: ${headers.Accept}
x-amz-date: ${headers['x-amz-date']}
Authorization: ${headers.Authorization}
Content-Type: ${headers['Content-Type']}
`
);
