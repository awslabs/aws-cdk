#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import * as s3 from '../lib';

const app = new cdk.App();

const stack = new cdk.Stack(app, 'aws-cdk-s3');

const inventoryBucket = new s3.Bucket(stack, 'InventoryBucket', {
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});

const myBucket = new s3.Bucket(stack, 'MyBucket', {
  inventories: [
    {
      bucket: inventoryBucket,
      frequency: s3.InventoryFrequency.DAILY,
      format: s3.InventoryFormat.PARQUET,
      prefix: 'reports',
    },
  ],
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});

const secondInventoryBucket = new s3.Bucket(stack, 'SecondBucket', {
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});

myBucket.addInventory({
  bucket: secondInventoryBucket,
});

app.synth();
