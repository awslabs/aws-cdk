import { expect, haveResource, ResourcePart } from '@aws-cdk/assert';
import iam = require('@aws-cdk/aws-iam');
import kms = require('@aws-cdk/aws-kms');
import s3 = require('@aws-cdk/aws-s3');
import cdk = require('@aws-cdk/cdk');
import { Test } from 'nodeunit';

import glue = require('../lib');

export = {
  'unpartitioned JSON table'(test: Test) {
    const dbStack = new cdk.Stack();
    const database = new glue.Database(dbStack, 'Database', {
      databaseName: 'database'
    });

    const tableStack = new cdk.Stack();
    const table = new glue.Table(tableStack, 'Table', {
      database,
      tableName: 'table',
      columns: [{
        name: 'col',
        type: glue.Schema.string
      }],
      dataFormat: glue.DataFormat.Json,
    });
    test.equals(table.encryption, glue.TableEncryption.Unencrypted);

    expect(tableStack).to(haveResource('AWS::S3::Bucket', {
      Type: "AWS::S3::Bucket",
      DeletionPolicy: "Retain"
    }, ResourcePart.CompleteDefinition));

    expect(tableStack).to(haveResource('AWS::Glue::Table', {
      CatalogId: {
        Ref: "AWS::AccountId"
      },
      DatabaseName: {
        "Fn::ImportValue": "ExportsOutputRefDatabaseB269D8BB88F4B1C4"
      },
      TableInput: {
        Name: "table",
        Description: "table generated by CDK",
        Parameters: {
          has_encrypted_data: false
        },
        StorageDescriptor: {
          Columns: [
            {
              Name: "col",
              Type: "string"
            }
          ],
          Compressed: false,
          InputFormat: "org.apache.hadoop.mapred.TextInputFormat",
          Location: {
            "Fn::Join": [
              "",
              [
                "s3://",
                {
                  Ref: "TableBucketDA42407C"
                },
                "/data/"
              ]
            ]
          },
          OutputFormat: "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
          SerdeInfo: {
            SerializationLibrary: "org.openx.data.jsonserde.JsonSerDe"
          },
          StoredAsSubDirectories: false
        },
        TableType: "EXTERNAL_TABLE"
      }
    }));

    test.done();
  },

  'partitioned JSON table'(test: Test) {
    const dbStack = new cdk.Stack();
    const database = new glue.Database(dbStack, 'Database', {
      databaseName: 'database'
    });

    const tableStack = new cdk.Stack();
    const table = new glue.Table(tableStack, 'Table', {
      database,
      tableName: 'table',
      columns: [{
        name: 'col',
        type: glue.Schema.string
      }],
      partitionKeys: [{
        name: 'year',
        type: glue.Schema.smallint
      }],
      dataFormat: glue.DataFormat.Json,
    });
    test.equals(table.encryption, glue.TableEncryption.Unencrypted);
    test.equals(table.encryptionKey, undefined);
    test.equals(table.bucket.encryptionKey, undefined);

    expect(tableStack).to(haveResource('AWS::Glue::Table', {
      CatalogId: {
        Ref: "AWS::AccountId"
      },
      DatabaseName: {
        "Fn::ImportValue": "ExportsOutputRefDatabaseB269D8BB88F4B1C4"
      },
      TableInput: {
        Name: "table",
        Description: "table generated by CDK",
        Parameters: {
          has_encrypted_data: false
        },
        PartitionKeys: [
          {
            Name: "year",
            Type: "smallint"
          }
        ],
        StorageDescriptor: {
          Columns: [
            {
              Name: "col",
              Type: "string"
            }
          ],
          Compressed: false,
          InputFormat: "org.apache.hadoop.mapred.TextInputFormat",
          Location: {
            "Fn::Join": [
              "",
              [
                "s3://",
                {
                  Ref: "TableBucketDA42407C"
                },
                "/data/"
              ]
            ]
          },
          OutputFormat: "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
          SerdeInfo: {
            SerializationLibrary: "org.openx.data.jsonserde.JsonSerDe"
          },
          StoredAsSubDirectories: false
        },
        TableType: "EXTERNAL_TABLE"
      }
    }));

    test.done();
  },

  'compressed table'(test: Test) {
    const stack = new cdk.Stack();
    const database = new glue.Database(stack, 'Database', {
      databaseName: 'database'
    });

    const table = new glue.Table(stack, 'Table', {
      database,
      tableName: 'table',
      columns: [{
        name: 'col',
        type: glue.Schema.string
      }],
      compressed: true,
      dataFormat: glue.DataFormat.Json,
    });
    test.equals(table.encryptionKey, undefined);
    test.equals(table.bucket.encryptionKey, undefined);

    expect(stack).to(haveResource('AWS::Glue::Table', {
      CatalogId: {
        Ref: "AWS::AccountId"
      },
      DatabaseName: {
        Ref: "DatabaseB269D8BB"
      },
      TableInput: {
        Name: "table",
        Description: "table generated by CDK",
        Parameters: {
          has_encrypted_data: false
        },
        StorageDescriptor: {
          Columns: [
            {
              Name: "col",
              Type: "string"
            }
          ],
          Compressed: true,
          InputFormat: "org.apache.hadoop.mapred.TextInputFormat",
          Location: {
            "Fn::Join": [
              "",
              [
                "s3://",
                {
                  Ref: "TableBucketDA42407C"
                },
                "/data/"
              ]
            ]
          },
          OutputFormat: "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
          SerdeInfo: {
            SerializationLibrary: "org.openx.data.jsonserde.JsonSerDe"
          },
          StoredAsSubDirectories: false
        },
        TableType: "EXTERNAL_TABLE"
      }
    }));

    test.done();
  },

  'encrypted table': {
    'SSE-S3'(test: Test) {
      const stack = new cdk.Stack();
      const database = new glue.Database(stack, 'Database', {
        databaseName: 'database'
      });

      const table = new glue.Table(stack, 'Table', {
        database,
        tableName: 'table',
        columns: [{
          name: 'col',
          type: glue.Schema.string
        }],
        encryption: glue.TableEncryption.S3Managed,
        dataFormat: glue.DataFormat.Json,
      });
      test.equals(table.encryption, glue.TableEncryption.S3Managed);
      test.equals(table.encryptionKey, undefined);
      test.equals(table.bucket.encryptionKey, undefined);

      expect(stack).to(haveResource('AWS::Glue::Table', {
        CatalogId: {
          Ref: "AWS::AccountId"
        },
        DatabaseName: {
          Ref: "DatabaseB269D8BB"
        },
        TableInput: {
          Name: "table",
          Description: "table generated by CDK",
          Parameters: {
            has_encrypted_data: true
          },
          StorageDescriptor: {
            Columns: [
              {
                Name: "col",
                Type: "string"
              }
            ],
            Compressed: false,
            InputFormat: "org.apache.hadoop.mapred.TextInputFormat",
            Location: {
              "Fn::Join": [
                "",
                [
                  "s3://",
                  {
                    Ref: "TableBucketDA42407C"
                  },
                  "/data/"
                ]
              ]
            },
            OutputFormat: "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
            SerdeInfo: {
              SerializationLibrary: "org.openx.data.jsonserde.JsonSerDe"
            },
            StoredAsSubDirectories: false
          },
          TableType: "EXTERNAL_TABLE"
        }
      }));

      expect(stack).to(haveResource('AWS::S3::Bucket', {
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: "AES256"
              }
            }
          ]
        }
      }));

      test.done();
    },

    'SSE-KMS (implicitly created key)'(test: Test) {
      const stack = new cdk.Stack();
      const database = new glue.Database(stack, 'Database', {
        databaseName: 'database'
      });

      const table = new glue.Table(stack, 'Table', {
        database,
        tableName: 'table',
        columns: [{
          name: 'col',
          type: glue.Schema.string
        }],
        encryption: glue.TableEncryption.Kms,
        dataFormat: glue.DataFormat.Json,
      });
      test.equals(table.encryption, glue.TableEncryption.Kms);
      test.equals(table.encryptionKey, table.bucket.encryptionKey);

      expect(stack).to(haveResource('AWS::KMS::Key', {
        KeyPolicy: {
          Statement: [
            {
              Action: [
                "kms:Create*",
                "kms:Describe*",
                "kms:Enable*",
                "kms:List*",
                "kms:Put*",
                "kms:Update*",
                "kms:Revoke*",
                "kms:Disable*",
                "kms:Get*",
                "kms:Delete*",
                "kms:ScheduleKeyDeletion",
                "kms:CancelKeyDeletion"
              ],
              Effect: "Allow",
              Principal: {
                AWS: {
                  "Fn::Join": [
                    "",
                    [
                      "arn:",
                      {
                        Ref: "AWS::Partition"
                      },
                      ":iam::",
                      {
                        Ref: "AWS::AccountId"
                      },
                      ":root"
                    ]
                  ]
                }
              },
              Resource: "*"
            }
          ],
          Version: "2012-10-17"
        },
        Description: "Created by Table/Bucket"
      }));

      expect(stack).to(haveResource('AWS::S3::Bucket', {
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                KMSMasterKeyID: {
                  "Fn::GetAtt": [
                    "TableBucketKey3E9F984A",
                    "Arn"
                  ]
                },
                SSEAlgorithm: "aws:kms"
              }
            }
          ]
        }
      }));

      expect(stack).to(haveResource('AWS::Glue::Table', {
        CatalogId: {
          Ref: "AWS::AccountId"
        },
        DatabaseName: {
          Ref: "DatabaseB269D8BB"
        },
        TableInput: {
          Name: "table",
          Description: "table generated by CDK",
          Parameters: {
            has_encrypted_data: true
          },
          StorageDescriptor: {
            Columns: [
              {
                Name: "col",
                Type: "string"
              }
            ],
            Compressed: false,
            InputFormat: "org.apache.hadoop.mapred.TextInputFormat",
            Location: {
              "Fn::Join": [
                "",
                [
                  "s3://",
                  {
                    Ref: "TableBucketDA42407C"
                  },
                  "/data/"
                ]
              ]
            },
            OutputFormat: "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
            SerdeInfo: {
              SerializationLibrary: "org.openx.data.jsonserde.JsonSerDe"
            },
            StoredAsSubDirectories: false
          },
          TableType: "EXTERNAL_TABLE"
        }
      }));

      test.done();
    },

    'SSE-KMS (explicitly created key)'(test: Test) {
      const stack = new cdk.Stack();
      const database = new glue.Database(stack, 'Database', {
        databaseName: 'database'
      });
      const encryptionKey = new kms.EncryptionKey(stack, 'MyKey');

      const table = new glue.Table(stack, 'Table', {
        database,
        tableName: 'table',
        columns: [{
          name: 'col',
          type: glue.Schema.string
        }],
        encryption: glue.TableEncryption.Kms,
        encryptionKey,
        dataFormat: glue.DataFormat.Json,
      });
      test.equals(table.encryption, glue.TableEncryption.Kms);
      test.equals(table.encryptionKey, table.bucket.encryptionKey);
      test.notEqual(table.encryptionKey, undefined);

      expect(stack).to(haveResource('AWS::KMS::Key', {
        KeyPolicy: {
          Statement: [
            {
              Action: [
                "kms:Create*",
                "kms:Describe*",
                "kms:Enable*",
                "kms:List*",
                "kms:Put*",
                "kms:Update*",
                "kms:Revoke*",
                "kms:Disable*",
                "kms:Get*",
                "kms:Delete*",
                "kms:ScheduleKeyDeletion",
                "kms:CancelKeyDeletion"
              ],
              Effect: "Allow",
              Principal: {
                AWS: {
                  "Fn::Join": [
                    "",
                    [
                      "arn:",
                      {
                        Ref: "AWS::Partition"
                      },
                      ":iam::",
                      {
                        Ref: "AWS::AccountId"
                      },
                      ":root"
                    ]
                  ]
                }
              },
              Resource: "*"
            }
          ],
          Version: "2012-10-17"
        }
      }));

      expect(stack).to(haveResource('AWS::S3::Bucket', {
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                KMSMasterKeyID: {
                  "Fn::GetAtt": [
                    "MyKey6AB29FA6",
                    "Arn"
                  ]
                },
                SSEAlgorithm: "aws:kms"
              }
            }
          ]
        }
      }));

      expect(stack).to(haveResource('AWS::Glue::Table', {
        CatalogId: {
          Ref: "AWS::AccountId"
        },
        DatabaseName: {
          Ref: "DatabaseB269D8BB"
        },
        TableInput: {
          Description: "table generated by CDK",
          Name: "table",
          Parameters: {
            has_encrypted_data: true
          },
          StorageDescriptor: {
            Columns: [
              {
                Name: "col",
                Type: "string"
              }
            ],
            Compressed: false,
            InputFormat: "org.apache.hadoop.mapred.TextInputFormat",
            Location: {
              "Fn::Join": [
                "",
                [
                  "s3://",
                  {
                    Ref: "TableBucketDA42407C"
                  },
                  "/data/"
                ]
              ]
            },
            OutputFormat: "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
            SerdeInfo: {
              SerializationLibrary: "org.openx.data.jsonserde.JsonSerDe"
            },
            StoredAsSubDirectories: false
          },
          TableType: "EXTERNAL_TABLE"
        }
      }));

      test.done();
    },

    'SSE-KMS_MANAGED'(test: Test) {
      const stack = new cdk.Stack();
      const database = new glue.Database(stack, 'Database', {
        databaseName: 'database'
      });

      const table = new glue.Table(stack, 'Table', {
        database,
        tableName: 'table',
        columns: [{
          name: 'col',
          type: glue.Schema.string
        }],
        encryption: glue.TableEncryption.KmsManaged,
        dataFormat: glue.DataFormat.Json,
      });
      test.equals(table.encryption, glue.TableEncryption.KmsManaged);
      test.equals(table.encryptionKey, undefined);
      test.equals(table.bucket.encryptionKey, undefined);

      expect(stack).to(haveResource('AWS::S3::Bucket', {
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: "aws:kms"
              }
            }
          ]
        }
      }));

      expect(stack).to(haveResource('AWS::Glue::Table', {
        CatalogId: {
          Ref: "AWS::AccountId"
        },
        DatabaseName: {
          Ref: "DatabaseB269D8BB"
        },
        TableInput: {
          Name: "table",
          Description: "table generated by CDK",
          Parameters: {
            has_encrypted_data: true
          },
          StorageDescriptor: {
            Columns: [
              {
                Name: "col",
                Type: "string"
              }
            ],
            Compressed: false,
            InputFormat: "org.apache.hadoop.mapred.TextInputFormat",
            Location: {
              "Fn::Join": [
                "",
                [
                  "s3://",
                  {
                    Ref: "TableBucketDA42407C"
                  },
                  "/data/"
                ]
              ]
            },
            OutputFormat: "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
            SerdeInfo: {
              SerializationLibrary: "org.openx.data.jsonserde.JsonSerDe"
            },
            StoredAsSubDirectories: false
          },
          TableType: "EXTERNAL_TABLE"
        }
      }));

      test.done();
    },

    'CSE-KMS (implicitly created key)'(test: Test) {
      const stack = new cdk.Stack();
      const database = new glue.Database(stack, 'Database', {
        databaseName: 'database'
      });

      const table = new glue.Table(stack, 'Table', {
        database,
        tableName: 'table',
        columns: [{
          name: 'col',
          type: glue.Schema.string
        }],
        encryption: glue.TableEncryption.ClientSideKms,
        dataFormat: glue.DataFormat.Json,
      });
      test.equals(table.encryption, glue.TableEncryption.ClientSideKms);
      test.notEqual(table.encryptionKey, undefined);
      test.equals(table.bucket.encryptionKey, undefined);

      expect(stack).to(haveResource('AWS::KMS::Key', {
        KeyPolicy: {
          Statement: [
            {
              Action: [
                "kms:Create*",
                "kms:Describe*",
                "kms:Enable*",
                "kms:List*",
                "kms:Put*",
                "kms:Update*",
                "kms:Revoke*",
                "kms:Disable*",
                "kms:Get*",
                "kms:Delete*",
                "kms:ScheduleKeyDeletion",
                "kms:CancelKeyDeletion"
              ],
              Effect: "Allow",
              Principal: {
                AWS: {
                  "Fn::Join": [
                    "",
                    [
                      "arn:",
                      {
                        Ref: "AWS::Partition"
                      },
                      ":iam::",
                      {
                        Ref: "AWS::AccountId"
                      },
                      ":root"
                    ]
                  ]
                }
              },
              Resource: "*"
            }
          ],
          Version: "2012-10-17"
        }
      }));

      expect(stack).to(haveResource('AWS::Glue::Table', {
        CatalogId: {
          Ref: "AWS::AccountId"
        },
        DatabaseName: {
          Ref: "DatabaseB269D8BB"
        },
        TableInput: {
          Description: "table generated by CDK",
          Name: "table",
          Parameters: {
            has_encrypted_data: true
          },
          StorageDescriptor: {
            Columns: [
              {
                Name: "col",
                Type: "string"
              }
            ],
            Compressed: false,
            InputFormat: "org.apache.hadoop.mapred.TextInputFormat",
            Location: {
              "Fn::Join": [
                "",
                [
                  "s3://",
                  {
                    Ref: "TableBucketDA42407C"
                  },
                  "/data/"
                ]
              ]
            },
            OutputFormat: "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
            SerdeInfo: {
              SerializationLibrary: "org.openx.data.jsonserde.JsonSerDe"
            },
            StoredAsSubDirectories: false
          },
          TableType: "EXTERNAL_TABLE"
        }
      }));

      test.done();
    },

    'CSE-KMS (explicitly created key)'(test: Test) {
      const stack = new cdk.Stack();
      const database = new glue.Database(stack, 'Database', {
        databaseName: 'database'
      });
      const encryptionKey = new kms.EncryptionKey(stack, 'MyKey');

      const table = new glue.Table(stack, 'Table', {
        database,
        tableName: 'table',
        columns: [{
          name: 'col',
          type: glue.Schema.string
        }],
        encryption: glue.TableEncryption.ClientSideKms,
        encryptionKey,
        dataFormat: glue.DataFormat.Json,
      });
      test.equals(table.encryption, glue.TableEncryption.ClientSideKms);
      test.notEqual(table.encryptionKey, undefined);
      test.equals(table.bucket.encryptionKey, undefined);

      expect(stack).to(haveResource('AWS::KMS::Key', {
        KeyPolicy: {
          Statement: [
            {
              Action: [
                "kms:Create*",
                "kms:Describe*",
                "kms:Enable*",
                "kms:List*",
                "kms:Put*",
                "kms:Update*",
                "kms:Revoke*",
                "kms:Disable*",
                "kms:Get*",
                "kms:Delete*",
                "kms:ScheduleKeyDeletion",
                "kms:CancelKeyDeletion"
              ],
              Effect: "Allow",
              Principal: {
                AWS: {
                  "Fn::Join": [
                    "",
                    [
                      "arn:",
                      {
                        Ref: "AWS::Partition"
                      },
                      ":iam::",
                      {
                        Ref: "AWS::AccountId"
                      },
                      ":root"
                    ]
                  ]
                }
              },
              Resource: "*"
            }
          ],
          Version: "2012-10-17"
        }
      }));

      expect(stack).to(haveResource('AWS::Glue::Table', {
        CatalogId: {
          Ref: "AWS::AccountId"
        },
        DatabaseName: {
          Ref: "DatabaseB269D8BB"
        },
        TableInput: {
          Description: "table generated by CDK",
          Name: "table",
          Parameters: {
            has_encrypted_data: true
          },
          StorageDescriptor: {
            Columns: [
              {
                Name: "col",
                Type: "string"
              }
            ],
            Compressed: false,
            InputFormat: "org.apache.hadoop.mapred.TextInputFormat",
            Location: {
              "Fn::Join": [
                "",
                [
                  "s3://",
                  {
                    Ref: "TableBucketDA42407C"
                  },
                  "/data/"
                ]
              ]
            },
            OutputFormat: "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
            SerdeInfo: {
              SerializationLibrary: "org.openx.data.jsonserde.JsonSerDe"
            },
            StoredAsSubDirectories: false
          },
          TableType: "EXTERNAL_TABLE"
        }
      }));

      test.done();
    },
  },

  'explicit s3 bucket and prefix'(test: Test) {
    const dbStack = new cdk.Stack();
    const stack = new cdk.Stack();
    const bucket = new s3.Bucket(stack, 'ExplicitBucket');
    const database = new glue.Database(dbStack, 'Database', {
      databaseName: 'database'
    });

    new glue.Table(stack, 'Table', {
      database,
      bucket,
      s3Prefix: 'prefix/',
      tableName: 'table',
      columns: [{
        name: 'col',
        type: glue.Schema.string
      }],
      dataFormat: glue.DataFormat.Json,
    });

    expect(stack).to(haveResource('AWS::Glue::Table', {
      CatalogId: {
        Ref: "AWS::AccountId"
      },
      DatabaseName: {
        "Fn::ImportValue": "ExportsOutputRefDatabaseB269D8BB88F4B1C4"
      },
      TableInput: {
        Description: "table generated by CDK",
        Name: "table",
        Parameters: {
          has_encrypted_data: false
        },
        StorageDescriptor: {
          Columns: [
            {
              Name: "col",
              Type: "string"
            }
          ],
          Compressed: false,
          InputFormat: "org.apache.hadoop.mapred.TextInputFormat",
          Location: {
            "Fn::Join": [
              "",
              [
                "s3://",
                {
                  Ref: "ExplicitBucket0AA51A3F"
                },
                "/prefix/"
              ]
            ]
          },
          OutputFormat: "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
          SerdeInfo: {
            SerializationLibrary: "org.openx.data.jsonserde.JsonSerDe"
          },
          StoredAsSubDirectories: false
        },
        TableType: "EXTERNAL_TABLE"
      }
    }));

    test.done();
  },

  'grants': {
    'read only'(test: Test) {
      const stack = new cdk.Stack();
      const user = new iam.User(stack, 'User');
      const database = new glue.Database(stack, 'Database', {
        databaseName: 'database'
      });

      const table = new glue.Table(stack, 'Table', {
        database,
        tableName: 'table',
        columns: [{
          name: 'col',
          type: glue.Schema.string
        }],
        compressed: true,
        dataFormat: glue.DataFormat.Json,
      });

      table.grantRead(user);

      expect(stack).to(haveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Action: [
                "glue:BatchDeletePartition",
                "glue:BatchGetPartition",
                "glue:GetPartition",
                "glue:GetPartitions",
                "glue:GetTable",
                "glue:GetTables",
                "glue:GetTableVersions"
              ],
              Effect: "Allow",
              Resource: {
                "Fn::Join": [
                  "",
                  [
                    "arn:",
                    {
                      Ref: "AWS::Partition"
                    },
                    ":glue:",
                    {
                      Ref: "AWS::Region"
                    },
                    ":",
                    {
                      Ref: "AWS::AccountId"
                    },
                    ":database/",
                    {
                      Ref: "DatabaseB269D8BB"
                    },
                    "/",
                    {
                      Ref: "Table4C2D914F"
                    }
                  ]
                ]
              }
            },
            {
              Action: [
                "s3:GetObject*",
                "s3:GetBucket*",
                "s3:List*"
              ],
              Effect: "Allow",
              Resource: [
                {
                  "Fn::GetAtt": [
                    "TableBucketDA42407C",
                    "Arn"
                  ]
                },
                {
                  "Fn::Join": [
                    "",
                    [
                      {
                        "Fn::GetAtt": [
                          "TableBucketDA42407C",
                          "Arn"
                        ]
                      },
                      "/data/"
                    ]
                  ]
                }
              ]
            }
          ],
          Version: "2012-10-17"
        },
        PolicyName: "UserDefaultPolicy1F97781E",
        Users: [
          {
            Ref: "User00B015A1"
          }
        ]
      }));

      test.done();
    },

    'write only'(test: Test) {
      const stack = new cdk.Stack();
      const user = new iam.User(stack, 'User');
      const database = new glue.Database(stack, 'Database', {
        databaseName: 'database'
      });

      const table = new glue.Table(stack, 'Table', {
        database,
        tableName: 'table',
        columns: [{
          name: 'col',
          type: glue.Schema.string
        }],
        compressed: true,
        dataFormat: glue.DataFormat.Json,
      });

      table.grantWrite(user);

      expect(stack).to(haveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Action: [
                "glue:BatchCreatePartition",
                "glue:BatchDeletePartition",
                "glue:CreatePartition",
                "glue:DeletePartition",
                "glue:UpdatePartition"
              ],
              Effect: "Allow",
              Resource: {
                "Fn::Join": [
                  "",
                  [
                    "arn:",
                    {
                      Ref: "AWS::Partition"
                    },
                    ":glue:",
                    {
                      Ref: "AWS::Region"
                    },
                    ":",
                    {
                      Ref: "AWS::AccountId"
                    },
                    ":database/",
                    {
                      Ref: "DatabaseB269D8BB"
                    },
                    "/",
                    {
                      Ref: "Table4C2D914F"
                    }
                  ]
                ]
              }
            },
            {
              Action: [
                "s3:DeleteObject*",
                "s3:PutObject*",
                "s3:Abort*"
              ],
              Effect: "Allow",
              Resource: [
                {
                  "Fn::GetAtt": [
                    "TableBucketDA42407C",
                    "Arn"
                  ]
                },
                {
                  "Fn::Join": [
                    "",
                    [
                      {
                        "Fn::GetAtt": [
                          "TableBucketDA42407C",
                          "Arn"
                        ]
                      },
                      "/data/"
                    ]
                  ]
                }
              ]
            }
          ],
          Version: "2012-10-17"
        },
        PolicyName: "UserDefaultPolicy1F97781E",
        Users: [
          {
            Ref: "User00B015A1"
          }
        ]
      }));

      test.done();
    },

    'read and write'(test: Test) {
      const stack = new cdk.Stack();
      const user = new iam.User(stack, 'User');
      const database = new glue.Database(stack, 'Database', {
        databaseName: 'database'
      });

      const table = new glue.Table(stack, 'Table', {
        database,
        tableName: 'table',
        columns: [{
          name: 'col',
          type: glue.Schema.string
        }],
        compressed: true,
        dataFormat: glue.DataFormat.Json,
      });

      table.grantReadWrite(user);

      expect(stack).to(haveResource('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Action: [
                "glue:BatchDeletePartition",
                "glue:BatchGetPartition",
                "glue:GetPartition",
                "glue:GetPartitions",
                "glue:GetTable",
                "glue:GetTables",
                "glue:GetTableVersions",
                "glue:BatchCreatePartition",
                "glue:BatchDeletePartition",
                "glue:CreatePartition",
                "glue:DeletePartition",
                "glue:UpdatePartition"
              ],
              Effect: "Allow",
              Resource: {
                "Fn::Join": [
                  "",
                  [
                    "arn:",
                    {
                      Ref: "AWS::Partition"
                    },
                    ":glue:",
                    {
                      Ref: "AWS::Region"
                    },
                    ":",
                    {
                      Ref: "AWS::AccountId"
                    },
                    ":database/",
                    {
                      Ref: "DatabaseB269D8BB"
                    },
                    "/",
                    {
                      Ref: "Table4C2D914F"
                    }
                  ]
                ]
              }
            },
            {
              Action: [
                "s3:GetObject*",
                "s3:GetBucket*",
                "s3:List*",
                "s3:DeleteObject*",
                "s3:PutObject*",
                "s3:Abort*"
              ],
              Effect: "Allow",
              Resource: [
                {
                  "Fn::GetAtt": [
                    "TableBucketDA42407C",
                    "Arn"
                  ]
                },
                {
                  "Fn::Join": [
                    "",
                    [
                      {
                        "Fn::GetAtt": [
                          "TableBucketDA42407C",
                          "Arn"
                        ]
                      },
                      "/data/"
                    ]
                  ]
                }
              ]
            }
          ],
          Version: "2012-10-17"
        },
        PolicyName: "UserDefaultPolicy1F97781E",
        Users: [
          {
            Ref: "User00B015A1"
          }
        ]
      }));

      test.done();
    }
  },

  'validate': {
    'at least one column'(test: Test) {
      test.throws(() => {
        createTable({
          columns: [],
          tableName: 'name',
        });
      }, undefined, 'you must specify at least one column for the table');

      test.done();
    },

    'unique column names'(test: Test) {
      test.throws(() => {
        createTable({
          tableName: 'name',
          columns: [{
            name: 'col1',
            type: glue.Schema.string
          }, {
            name: 'col1',
            type: glue.Schema.string
          }]
        });
      }, undefined, "column names and partition keys must be unique, but 'col1' is duplicated.");

      test.done();
    },

    'unique partition keys'(test: Test) {
      test.throws(() => createTable({
        tableName: 'name',
        columns: [{
          name: 'col1',
          type: glue.Schema.string
        }],
        partitionKeys: [{
          name: 'p1',
          type: glue.Schema.string
        }, {
          name: 'p1',
          type: glue.Schema.string
        }]
      }), undefined, "column names and partition keys must be unique, but 'p1' is duplicated");

      test.done();
    },

    'column names and partition keys are all unique'(test: Test) {
      test.throws(() => createTable({
        tableName: 'name',
        columns: [{
          name: 'col1',
          type: glue.Schema.string
        }],
        partitionKeys: [{
          name: 'col1',
          type: glue.Schema.string
        }]
      }), "column names and partition keys must be unique, but 'col1' is duplicated");

      test.done();
    },

    'can not specify an explicit bucket and encryption'(test: Test) {
      test.throws(() => createTable({
        tableName: 'name',
        columns: [{
          name: 'col1',
          type: glue.Schema.string
        }],
        bucket: new s3.Bucket(new cdk.Stack(), 'Bucket'),
        encryption: glue.TableEncryption.Kms
      }), undefined, 'you can not specify encryption settings if you also provide a bucket');
      test.done();
    },

    'can explicitly pass bucket if Encryption undefined'(test: Test) {
      test.doesNotThrow(() => createTable({
        tableName: 'name',
        columns: [{
          name: 'col1',
          type: glue.Schema.string
        }],
        bucket: new s3.Bucket(new cdk.Stack(), 'Bucket'),
        encryption: undefined
      }));
      test.done();
    },

    'can explicitly pass bucket if Unencrypted'(test: Test) {
      test.doesNotThrow(() => createTable({
        tableName: 'name',
        columns: [{
          name: 'col1',
          type: glue.Schema.string
        }],
        bucket: new s3.Bucket(new cdk.Stack(), 'Bucket'),
        encryption: undefined
      }));
      test.done();
    },

    'can explicitly pass bucket if ClientSideKms'(test: Test) {
      test.doesNotThrow(() => createTable({
        tableName: 'name',
        columns: [{
          name: 'col1',
          type: glue.Schema.string
        }],
        bucket: new s3.Bucket(new cdk.Stack(), 'Bucket'),
        encryption: glue.TableEncryption.ClientSideKms
      }));
      test.done();
    }
  }
};

function createTable(props: Pick<glue.TableProps, Exclude<keyof glue.TableProps, 'database' | 'dataFormat'>>): void {
  const stack = new cdk.Stack();
  new glue.Table(stack, 'table', {
    ...props,
    database: new glue.Database(stack, 'db', {
      databaseName: 'database_name'
    }),
    dataFormat: glue.DataFormat.Json
  });
}
