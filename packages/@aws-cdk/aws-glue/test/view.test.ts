import { expect as cdkExpect, haveResource } from '@aws-cdk/assert';
import '@aws-cdk/assert/jest';
import * as cdk from '@aws-cdk/core';
import * as glue from '../lib';

test('minimal config', () => {
  const app = new cdk.App();
  const dbStack = new cdk.Stack(app, 'db');
  const database = new glue.Database(dbStack, 'Database', {
    databaseName: 'database',
  });

  const viewStack = new cdk.Stack(app, 'table');
  new glue.View(viewStack, 'viewStack', {
    columns: [{ name: 'x', type: glue.Schema.INTEGER }],
    database,
    tableName: 'x_table',
    statement: 'SELECT 1 x',
  });
  cdkExpect(viewStack).to(
    haveResource('AWS::Glue::Table', {
      CatalogId: {
        Ref: 'AWS::AccountId',
      },
      DatabaseName: {
        'Fn::ImportValue': 'db:ExportsOutputRefDatabaseB269D8BB88F4B1C4',
      },
      TableInput: {
        Description: 'x_table generated by CDK',
        Name: 'x_table',
        Parameters: {
          presto_view: true,
        },
        PartitionKeys: [],
        StorageDescriptor: {
          Columns: [
            {
              Name: 'x',
              Type: 'int',
            },
          ],
          SerdeInfo: {},
        },
        TableType: 'VIRTUAL_VIEW',
        ViewOriginalText: {
          'Fn::Join': [
            '',
            [
              '/* Presto View: ',
              {
                'Fn::Base64': {
                  'Fn::Sub': [
                    '{"originalSql":"SELECT 1 x","catalog":"awsdatacatalog","columns":[{"name":"x","type":"integer"}],"schema":"${database}"}',
                    {
                      database: {
                        'Fn::ImportValue':
                          'db:ExportsOutputRefDatabaseB269D8BB88F4B1C4',
                      },
                    },
                  ],
                },
              },
              ' */',
            ],
          ],
        },
      },
    }),
  );
});

test('placeholders', () => {
  const app = new cdk.App();
  const dbStack = new cdk.Stack(app, 'db');
  const database = new glue.Database(dbStack, 'Database', {
    databaseName: 'database',
  });

  const viewStack = new cdk.Stack(app, 'table');
  new glue.View(viewStack, 'viewStack', {
    columns: [{ name: 'x', type: glue.Schema.INTEGER }],
    database,
    tableName: 'x_table',
    statement: 'SELECT x FROM ${otherDatabase}.${table}',
    placeHolders: {
      otherDatabase: 'mydb',
      table: 'otherTable',
    },
  });
  cdkExpect(viewStack).to(
    haveResource('AWS::Glue::Table', {
      CatalogId: {
        Ref: 'AWS::AccountId',
      },
      DatabaseName: {
        'Fn::ImportValue': 'db:ExportsOutputRefDatabaseB269D8BB88F4B1C4',
      },
      TableInput: {
        Description: 'x_table generated by CDK',
        Name: 'x_table',
        Parameters: {
          presto_view: true,
        },
        PartitionKeys: [],
        StorageDescriptor: {
          Columns: [
            {
              Name: 'x',
              Type: 'int',
            },
          ],
          SerdeInfo: {},
        },
        TableType: 'VIRTUAL_VIEW',
        ViewOriginalText: {
          'Fn::Join': [
            '',
            [
              '/* Presto View: ',
              {
                'Fn::Base64': {
                  'Fn::Sub': [
                    '{"originalSql":"SELECT x FROM ${otherDatabase}.${table}","catalog":"awsdatacatalog","columns":[{"name":"x","type":"integer"}],"schema":"${database}"}',
                    {
                      otherDatabase: 'mydb',
                      table: 'otherTable',
                      database: {
                        'Fn::ImportValue':
                          'db:ExportsOutputRefDatabaseB269D8BB88F4B1C4',
                      },
                    },
                  ],
                },
              },
              ' */',
            ],
          ],
        },
      },
    }),
  );
});

test('presto types', () => {
  const app = new cdk.App();
  const dbStack = new cdk.Stack(app, 'db');
  const database = new glue.Database(dbStack, 'Database', {
    databaseName: 'database',
  });

  const viewStack = new cdk.Stack(app, 'table');
  new glue.View(viewStack, 'viewStack', {
    columns: [
      { name: 'col_double', type: glue.Schema.DOUBLE },
      { name: 'col_float', type: glue.Schema.FLOAT },
      { name: 'col_big_int', type: glue.Schema.BIG_INT },
      { name: 'col_integer', type: glue.Schema.INTEGER },
      { name: 'col_small_int', type: glue.Schema.SMALL_INT },
      { name: 'col_tiny_int', type: glue.Schema.TINY_INT },
      { name: 'col_string', type: glue.Schema.STRING },
      { name: 'col_date', type: glue.Schema.DATE },
      { name: 'col_timestamp', type: glue.Schema.TIMESTAMP },
      { name: 'col_binary', type: glue.Schema.BINARY },
      { name: 'col_boolean', type: glue.Schema.BOOLEAN },
    ],
    database,
    tableName: 'x_table',
    statement: 'SELECT * FROM table',
  });
  cdkExpect(viewStack).to(
    haveResource('AWS::Glue::Table', {
      CatalogId: {
        Ref: 'AWS::AccountId',
      },
      DatabaseName: {
        'Fn::ImportValue': 'db:ExportsOutputRefDatabaseB269D8BB88F4B1C4',
      },
      TableInput: {
        Description: 'x_table generated by CDK',
        Name: 'x_table',
        Parameters: {
          presto_view: true,
        },
        PartitionKeys: [],
        StorageDescriptor: {
          Columns: [
            {
              Name: 'col_double',
              Type: 'double',
            },
            {
              Name: 'col_float',
              Type: 'float',
            },
            {
              Name: 'col_big_int',
              Type: 'bigint',
            },
            {
              Name: 'col_integer',
              Type: 'int',
            },
            {
              Name: 'col_small_int',
              Type: 'smallint',
            },
            {
              Name: 'col_tiny_int',
              Type: 'tinyint',
            },
            {
              Name: 'col_string',
              Type: 'string',
            },
            {
              Name: 'col_date',
              Type: 'date',
            },
            {
              Name: 'col_timestamp',
              Type: 'timestamp',
            },
            {
              Name: 'col_binary',
              Type: 'binary',
            },
            {
              Name: 'col_boolean',
              Type: 'boolean',
            },
          ],
          SerdeInfo: {},
        },
        TableType: 'VIRTUAL_VIEW',
        ViewOriginalText: {
          'Fn::Join': [
            '',
            [
              '/* Presto View: ',
              {
                'Fn::Base64': {
                  'Fn::Sub': [
                    '{"originalSql":"SELECT * FROM table","catalog":"awsdatacatalog","columns":[{"name":"col_double","type":"double"},{"name":"col_float","type":"real"},{"name":"col_big_int","type":"bigint"},{"name":"col_integer","type":"integer"},{"name":"col_small_int","type":"smallint"},{"name":"col_tiny_int","type":"tinyint"},{"name":"col_string","type":"varchar"},{"name":"col_date","type":"date"},{"name":"col_timestamp","type":"timestamp"},{"name":"col_binary","type":"varbinary"},{"name":"col_boolean","type":"boolean"}],"schema":"${database}"}',
                    {
                      database: {
                        'Fn::ImportValue':
                          'db:ExportsOutputRefDatabaseB269D8BB88F4B1C4',
                      },
                    },
                  ],
                },
              },
              ' */',
            ],
          ],
        },
      },
    }),
  );
});
