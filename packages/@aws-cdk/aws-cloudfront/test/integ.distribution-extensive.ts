import * as cdk from '@aws-cdk/core';
import * as cloudfront from '../lib';
import { TestOrigin } from './test-origin';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'integ-distribution-extensive');

new cloudfront.Distribution(stack, 'MyDist', {
  defaultBehavior: {
    origin: new TestOrigin('www.example.com', {
      originShieldRegion: 'us-west-2',
    }),
  },
  comment: 'a test',
  defaultRootObject: 'index.html',
  enabled: true,
  enableIpv6: true,
  enableLogging: true,
  geoRestriction: cloudfront.GeoRestriction.whitelist('US', 'GB'),
  httpVersion: cloudfront.HttpVersion.HTTP2,
  logFilePrefix: 'logs/',
  logIncludesCookies: true,
  priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
});

app.synth();
