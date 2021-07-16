#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
import * as glue from '../lib';

/*
 * Stack verification steps:
 * * 1. Run a query on the created view, use the databucket below as output:
 * *  a. aws athena start-query-execution --query-string "SELECT * FROM mydatabase.combined_view" --result-configuration OutputLocation=s3://test-databucketd8691f4e-12wylrvb09hdt
 * *
 * * 2. Take the query execution id from the output and check for "State": "SUCCEEDED"
 * *  a. aws athena get-query-execution --query-execution-id a58df117-9837-4667-96a3-253687350c96
 */

const app = new cdk.App();

const stack = new cdk.Stack(app, 'aws-cdk-glue');

const database = new glue.Database(stack, 'database', {
  databaseName: 'mydatabase',
});

const dataBucket = new s3.Bucket(stack, 'dataBucket');

const partitionKeys = [
  { name: 'year', type: glue.Schema.STRING },
  { name: 'month', type: glue.Schema.STRING },
  { name: 'day', type: glue.Schema.STRING },
  { name: 'hour', type: glue.Schema.STRING },
];

const sourceTable = new glue.Table(stack, 'sourceTable', {
  columns: [
    { name: 'date', type: glue.Schema.DATE },
    { name: 'time', type: glue.Schema.STRING },
    { name: 'location', type: glue.Schema.STRING },
    { name: 'bytes', type: glue.Schema.BIG_INT },
    { name: 'request_ip', type: glue.Schema.STRING },
    { name: 'method', type: glue.Schema.STRING },
    { name: 'host', type: glue.Schema.STRING },
    { name: 'uri', type: glue.Schema.STRING },
    { name: 'status', type: glue.Schema.INTEGER },
    { name: 'referrer', type: glue.Schema.STRING },
    { name: 'user_agent', type: glue.Schema.STRING },
    { name: 'query_string', type: glue.Schema.STRING },
    { name: 'cookie', type: glue.Schema.STRING },
    { name: 'result_type', type: glue.Schema.STRING },
    { name: 'request_id', type: glue.Schema.STRING },
    { name: 'host_header', type: glue.Schema.STRING },
    { name: 'request_protocol', type: glue.Schema.STRING },
    { name: 'request_bytes', type: glue.Schema.BIG_INT },
    { name: 'time_taken', type: glue.Schema.FLOAT },
    { name: 'xforwarded_for', type: glue.Schema.STRING },
    { name: 'ssl_protocol', type: glue.Schema.STRING },
    { name: 'ssl_cipher', type: glue.Schema.STRING },
    { name: 'response_result_type', type: glue.Schema.STRING },
    { name: 'http_version', type: glue.Schema.STRING },
    { name: 'fle_status', type: glue.Schema.STRING },
    { name: 'fle_encrypted_fields', type: glue.Schema.INTEGER },
    { name: 'c_port', type: glue.Schema.INTEGER },
    { name: 'time_to_first_byte', type: glue.Schema.FLOAT },
    { name: 'x_edge_detailed_result_type', type: glue.Schema.STRING },
    { name: 'sc_content_type', type: glue.Schema.STRING },
    { name: 'sc_content_len', type: glue.Schema.BIG_INT },
    { name: 'sc_range_start', type: glue.Schema.BIG_INT },
    { name: 'sc_range_end', type: glue.Schema.BIG_INT },
  ],
  partitionKeys: partitionKeys,
  database: database,
  tableName: 'partitioned_gz',
  description: 'Gzip logs delivered by Amazon CloudFront partitioned',
  s3Prefix: 'partitioned_gz',
  bucket: dataBucket,
  dataFormat: {
    outputFormat: glue.OutputFormat.HIVE_IGNORE_KEY_TEXT,
    inputFormat: glue.InputFormat.TEXT,
    serializationLibrary: glue.SerializationLibrary.LAZY_SIMPLE,
  },
});

const sourceCfnTable = sourceTable.node.defaultChild as glue.CfnTable;
sourceCfnTable.addOverride(
  'Properties.TableInput.Parameters.skip\\.header\\.line\\.count',
  '2',
);
sourceCfnTable.addOverride(
  'Properties.TableInput.StorageDescriptor.SerdeInfo.Parameters.field\\.delim',
  '\\t',
);
sourceCfnTable.addOverride(
  'Properties.TableInput.StorageDescriptor.SerdeInfo.Parameters.serialization\\.format',
  '\\t',
);

const targetTable = new glue.Table(stack, 'targetTable', {
  columns: sourceTable.columns,
  partitionKeys: sourceTable.partitionKeys,
  database: database,
  tableName: 'partitioned_parquet',
  description: 'Gzip logs delivered by Amazon CloudFront partitioned',
  s3Prefix: 'partitioned_parquet',
  bucket: dataBucket,
  dataFormat: {
    outputFormat: glue.OutputFormat.PARQUET,
    inputFormat: glue.InputFormat.PARQUET,
    serializationLibrary: glue.SerializationLibrary.PARQUET,
  },
});

const targetCfnTable = targetTable.node.defaultChild as glue.CfnTable;
targetCfnTable.addOverride(
  'Properties.TableInput.Parameters.parquet\\.compression',
  'snappy',
);

new glue.View(stack, 'combinedView', {
  columns: sourceTable.columns.concat(partitionKeys, {
    name: 'file',
    type: glue.Schema.STRING,
  }),
  database: database,
  tableName: 'combined_view',
  description: 'Gzip logs delivered by Amazon CloudFront partitioned',
  statement: fs
    .readFileSync(path.join(__dirname, 'combinedView.sql'))
    .toString(),
  placeHolders: {
    sourceTable: sourceTable.tableName,
    targetTable: targetTable.tableName,
  },
});

app.synth();
