# Amazon Relational Database Service Construct Library
<!--BEGIN STABILITY BANNER-->

---

![cfn-resources: Stable](https://img.shields.io/badge/cfn--resources-stable-success.svg?style=for-the-badge)

![cdk-constructs: Stable](https://img.shields.io/badge/cdk--constructs-stable-success.svg?style=for-the-badge)

---

<!--END STABILITY BANNER-->


```ts
import * as rds from '@aws-cdk/aws-rds';
```

## Starting a clustered database

To set up a clustered database (like Aurora), define a `DatabaseCluster`. You must
always launch a database in a VPC. Use the `vpcSubnets` attribute to control whether
your instances will be launched privately or publicly:

```ts
const cluster = new rds.DatabaseCluster(this, 'Database', {
  engine: rds.DatabaseClusterEngine.auroraMysql({ version: rds.AuroraMysqlEngineVersion.VER_2_08_1 }),
  credentials: rds.Credentials.fromGeneratedSecret('clusteradmin'), // Optional - will default to 'admin' username and generated password
  instanceProps: {
    // optional , defaults to t3.medium
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
    vpcSubnets: {
      subnetType: ec2.SubnetType.PRIVATE,
    },
    vpc,
  },
});
```

If there isn't a constant for the exact version you want to use,
all of the `Version` classes have a static `of` method that can be used to create an arbitrary version.

```ts
const customEngineVersion = rds.AuroraMysqlEngineVersion.of('5.7.mysql_aurora.2.08.1');
```

By default, the master password will be generated and stored in AWS Secrets Manager with auto-generated description.

Your cluster will be empty by default. To add a default database upon construction, specify the
`defaultDatabaseName` attribute.

Use `DatabaseClusterFromSnapshot` to create a cluster from a snapshot:

```ts
new rds.DatabaseClusterFromSnapshot(stack, 'Database', {
  engine: rds.DatabaseClusterEngine.aurora({ version: rds.AuroraEngineVersion.VER_1_22_2 }),
  instanceProps: {
    vpc,
  },
  snapshotIdentifier: 'mySnapshot',
});
```

## Starting an instance database

To set up a instance database, define a `DatabaseInstance`. You must
always launch a database in a VPC. Use the `vpcSubnets` attribute to control whether
your instances will be launched privately or publicly:

```ts
const instance = new rds.DatabaseInstance(this, 'Instance', {
  engine: rds.DatabaseInstanceEngine.oracleSe2({ version: rds.OracleEngineVersion.VER_19_0_0_0_2020_04_R1 }),
  // optional, defaults to m5.large
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.SMALL),
  credentials: rds.Credentials.fromGeneratedSecret('syscdk'), // Optional - will default to 'admin' username and generated password
  vpc,
  vpcSubnets: {
    subnetType: ec2.SubnetType.PRIVATE
  }
});
```

If there isn't a constant for the exact engine version you want to use,
all of the `Version` classes have a static `of` method that can be used to create an arbitrary version.

```ts
const customEngineVersion = rds.OracleEngineVersion.of('19.0.0.0.ru-2020-04.rur-2020-04.r1', '19');
```

By default, the master password will be generated and stored in AWS Secrets Manager.

To use the storage auto scaling option of RDS you can specify the maximum allocated storage.
This is the upper limit to which RDS can automatically scale the storage. More info can be found
[here](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIOPS.StorageTypes.html#USER_PIOPS.Autoscaling)
Example for max storage configuration:

```ts
const instance = new rds.DatabaseInstance(this, 'Instance', {
  engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_12_3 }),
  // optional, defaults to m5.large
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
  vpc,
  maxAllocatedStorage: 200,
});
```

Use `DatabaseInstanceFromSnapshot` and `DatabaseInstanceReadReplica` to create an instance from snapshot or
a source database respectively:

```ts
new rds.DatabaseInstanceFromSnapshot(stack, 'Instance', {
  snapshotIdentifier: 'my-snapshot',
  engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_12_3 }),
  // optional, defaults to m5.large
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.LARGE),
  vpc,
});

new rds.DatabaseInstanceReadReplica(stack, 'ReadReplica', {
  sourceDatabaseInstance: sourceInstance,
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.LARGE),
  vpc,
});
```

Creating a "production" Oracle database instance with option and parameter groups:

[example of setting up a production oracle instance](test/integ.instance.lit.ts)

## Setting Public Accessibility

You can set public accessibility for the database instance or cluster using the `publiclyAccessible` property.
If you specify `true`, it creates an instance with a publicly resolvable DNS name, which resolves to a public IP address.
If you specify `false`, it creates an internal instance with a DNS name that resolves to a private IP address.
The default value depends on `vpcSubnets`.
It will be `true` if `vpcSubnets` is `subnetType: SubnetType.PUBLIC`, `false` otherwise.

```ts
// Setting public accessibility for DB instance
new rds.DatabaseInstance(stack, 'Instance', {
  engine: rds.DatabaseInstanceEngine.mysql({
    version: rds.MysqlEngineVersion.VER_8_0_19,
  }),
  vpc,
  vpcSubnets: {
    subnetType: ec2.SubnetType.PRIVATE,
  },
  publiclyAccessible: true,
});

// Setting public accessibility for DB cluster
new rds.DatabaseCluster(stack, 'DatabaseCluster', {
  engine: DatabaseClusterEngine.AURORA,
  instanceProps: {
    vpc,
    vpcSubnets: {
      subnetType: ec2.SubnetType.PRIVATE,
    },
    publiclyAccessible: true,
  },
});
```

## Instance events

To define Amazon CloudWatch event rules for database instances, use the `onEvent`
method:

```ts
const rule = instance.onEvent('InstanceEvent', { target: new targets.LambdaFunction(fn) });
```

## Login credentials

By default, database instances and clusters will have `admin` user with an auto-generated password.
An alternative username (and password) may be specified for the admin user instead of the default.

The following examples use a `DatabaseInstance`, but the same usage is applicable to `DatabaseCluster`.

```ts
const engine = rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_12_3 });
new rds.DatabaseInstance(this, 'InstanceWithUsername', {
  engine,
  vpc,
  credentials: rds.Credentials.fromGeneratedSecret('postgres'), // Creates an admin user of postgres with a generated password
});

new rds.DatabaseInstance(this, 'InstanceWithUsernameAndPassword', {
  engine,
  vpc,
  credentials: rds.Credentials.fromPassword('postgres', SecretValue.ssmSecure('/dbPassword', '1')), // Use password from SSM
});

const mySecret = secretsmanager.Secret.fromSecretName(this, 'DBSecret', 'myDBLoginInfo');
new rds.DatabaseInstance(this, 'InstanceWithSecretLogin', {
  engine,
  vpc,
  credentials: rds.Credentials.fromSecret(mySecret), // Get both username and password from existing secret
});
```

## Connecting

To control who can access the cluster or instance, use the `.connections` attribute. RDS databases have
a default port, so you don't need to specify the port:

```ts
cluster.connections.allowFromAnyIpv4('Open to the world');
```

The endpoints to access your database cluster will be available as the `.clusterEndpoint` and `.readerEndpoint`
attributes:

```ts
const writeAddress = cluster.clusterEndpoint.socketAddress;   // "HOSTNAME:PORT"
```

For an instance database:

```ts
const address = instance.instanceEndpoint.socketAddress;   // "HOSTNAME:PORT"
```

## Rotating credentials

When the master password is generated and stored in AWS Secrets Manager, it can be rotated automatically:

```ts
instance.addRotationSingleUser({
  automaticallyAfter: cdk.Duration.days(7), // defaults to 30 days
  excludeCharacters: '!@#$%^&*', // defaults to the set " %+~`#$&*()|[]{}:;<>?!'/@\"\\"
});
```

It's also possible to create user credentials together with the instance/cluster and add single-user rotation:

```ts
const myUserSecret = new rds.DatabaseSecret(this, 'MyUserSecret', {
  username: 'myuser',
  secretName: 'my-user-secret', // optional, defaults to a CloudFormation-generated name
  excludeCharacters: '{}[]()\'"/\\', // defaults to the set " %+~`#$&*()|[]{}:;<>?!'/@\"\\"
});
const myUserSecretAttached = myUserSecret.attach(instance); // Adds DB connections information in the secret

instance.addRotationSingleUser('MyUser', { // Add rotation using the single user scheme
  secret: myUserSecretAttached,
});
```

examples of setting up single user password rotations for an [instance](test/integ.instance-rotation.lit.ts) and a [cluster](test/integ.cluster-rotation.lit.ts)

The multi user rotation scheme is also available:

```ts
instance.addRotationMultiUser('MyUser', {
  secret: myImportedSecret, // This secret must have the `masterarn` key
});
```

It's also possible to create user credentials together with the instance/cluster and add multi-user rotation:

```ts
const myUserSecret = new rds.DatabaseSecret(this, 'MyUserSecret', {
  username: 'myuser',
  secretName: 'my-user-secret', // optional, defaults to a CloudFormation-generated name
  masterSecret: instance.secret,
  excludeCharacters: '{}[]()\'"/\\', // defaults to the set " %+~`#$&*()|[]{}:;<>?!'/@\"\\"
});
const myUserSecretAttached = myUserSecret.attach(instance); // Adds DB connections information in the secret

instance.addRotationMultiUser('MyUser', { // Add rotation using the multi user scheme
  secret: myUserSecretAttached,
});
```

**Note**: This user must be created manually in the database using the master credentials.
The rotation will start as soon as this user exists.

See also [@aws-cdk/aws-secretsmanager](https://github.com/aws/aws-cdk/blob/master/packages/%40aws-cdk/aws-secretsmanager/README.md) for credentials rotation of existing clusters/instances.

## IAM Authentication

You can also authenticate to a database instance using AWS Identity and Access Management (IAM) database authentication;
See <https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.html> for more information
and a list of supported versions and limitations.

The following example shows enabling IAM authentication for a database instance and granting connection access to an IAM role.

```ts
const instance = new rds.DatabaseInstance(stack, 'Instance', {
  engine: rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_8_0_19 }),
  vpc,
  iamAuthentication: true, // Optional - will be automatically set if you call grantConnect().
});
const role = new Role(stack, 'DBRole', { assumedBy: new AccountPrincipal(stack.account) });
instance.grantConnect(role); // Grant the role connection access to the DB.
```

The following example shows granting connection access for RDS Proxy to an IAM role.

```ts
const cluster = new rds.DatabaseCluster(stack, 'Database', {
  engine: rds.DatabaseClusterEngine.AURORA,
  instanceProps: { vpc },
});

const proxy = new rds.DatabaseProxy(stack, 'Proxy', {
  proxyTarget: rds.ProxyTarget.fromCluster(cluster),
  secrets: [cluster.secret!],
  vpc,
});

const role = new Role(stack, 'DBProxyRole', { assumedBy: new AccountPrincipal(stack.account) });
proxy.grantConnect(role, 'admin'); // Grant the role connection access to the DB Proxy for database user 'admin'.
```

**Note**: In addition to the setup above, a database user will need to be created to support IAM auth.
See <https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.DBAccounts.html> for setup instructions.

## Kerberos Authentication

You can also authenticate using Kerberos to a database instance using AWS Managed Microsoft AD for authentication;
See <https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/kerberos-authentication.html> for more information
and a list of supported versions and limitations.

The following example shows enabling domain support for a database instance and creating an IAM role to access
Directory Services.

```ts
const role = new iam.Role(stack, 'RDSDirectoryServicesRole', {
  assumedBy: new iam.ServicePrincipal('rds.amazonaws.com'),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonRDSDirectoryServiceAccess'),
  ],
});
const instance = new rds.DatabaseInstance(stack, 'Instance', {
  engine: rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_8_0_19 }),
  vpc,
  domain: 'd-????????', // The ID of the domain for the instance to join.
  domainRole: role, // Optional - will be create automatically if not provided.
});
```

**Note**: In addition to the setup above, you need to make sure that the database instance has network connectivity
to the domain controllers. This includes enabling cross-VPC traffic if in a different VPC and setting up the
appropriate security groups/network ACL to allow traffic between the database instance and domain controllers.
Once configured, see <https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/kerberos-authentication.html> for details
on configuring users for each available database engine.

## Metrics

Database instances and clusters both expose metrics (`cloudwatch.Metric`):

```ts
// The number of database connections in use (average over 5 minutes)
const dbConnections = instance.metricDatabaseConnections();

// Average CPU utilization over 5 minutes
const cpuUtilization = cluster.metricCPUUtilization();

// The average amount of time taken per disk I/O operation (average over 1 minute)
const readLatency = instance.metric('ReadLatency', { statistic: 'Average', periodSec: 60 });
```

## Enabling S3 integration

Data in S3 buckets can be imported to and exported from certain database engines using SQL queries. To enable this
functionality, set the `s3ImportBuckets` and `s3ExportBuckets` properties for import and export respectively. When
configured, the CDK automatically creates and configures IAM roles as required.
Additionally, the `s3ImportRole` and `s3ExportRole` properties can be used to set this role directly.

You can read more about loading data to (or from) S3 here:

* Aurora MySQL - [import](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraMySQL.Integrating.LoadFromS3.html)
  and [export](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraMySQL.Integrating.SaveIntoS3.html).
* Aurora PostgreSQL - [import](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraPostgreSQL.Migrating.html)
  and [export](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/postgresql-s3-export.html).
* Microsoft SQL Server - [import & export](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/SQLServer.Procedural.Importing.html)
* PostgreSQL - [import](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Procedural.Importing.html)
* Oracle - [import & export](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/oracle-s3-integration.html)

The following snippet sets up a database cluster with different S3 buckets where the data is imported and exported -

```ts
import * as s3 from '@aws-cdk/aws-s3';

const importBucket = new s3.Bucket(this, 'importbucket');
const exportBucket = new s3.Bucket(this, 'exportbucket');
new rds.DatabaseCluster(this, 'dbcluster', {
  // ...
  s3ImportBuckets: [importBucket],
  s3ExportBuckets: [exportBucket],
});
```

## Creating a Database Proxy

Amazon RDS Proxy sits between your application and your relational database to efficiently manage
connections to the database and improve scalability of the application. Learn more about at [Amazon RDS Proxy](https://aws.amazon.com/rds/proxy/)

The following code configures an RDS Proxy for a `DatabaseInstance`.

```ts
import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as rds from '@aws-cdk/aws-rds';
import * as secrets from '@aws-cdk/aws-secretsmanager';

const vpc: ec2.IVpc = ...;
const securityGroup: ec2.ISecurityGroup = ...;
const secrets: secrets.ISecret[] = [...];
const dbInstance: rds.IDatabaseInstance = ...;

const proxy = dbInstance.addProxy('proxy', {
    connectionBorrowTimeout: cdk.Duration.seconds(30),
    maxConnectionsPercent: 50,
    secrets,
    vpc,
});
```

## Exporting Logs

You can publish database logs to Amazon CloudWatch Logs. With CloudWatch Logs, you can perform real-time analysis of the log data,
store the data in highly durable storage, and manage the data with the CloudWatch Logs Agent. This is available for both database
instances and clusters; the types of logs available depend on the database type and engine being used.

```ts
// Exporting logs from a cluster
const cluster = new rds.DatabaseCluster(this, 'Database', {
  engine: rds.DatabaseClusterEngine.aurora({
    version: rds.AuroraEngineVersion.VER_1_17_9, // different version class for each engine type
  },
  // ...
  cloudwatchLogsExports: ['error', 'general', 'slowquery', 'audit'], // Export all available MySQL-based logs
  cloudwatchLogsRetention: logs.RetentionDays.THREE_MONTHS, // Optional - default is to never expire logs
  cloudwatchLogsRetentionRole: myLogsPublishingRole, // Optional - a role will be created if not provided
  // ...
});

// Exporting logs from an instance
const instance = new rds.DatabaseInstance(this, 'Instance', {
  engine: rds.DatabaseInstanceEngine.postgres({
    version: rds.PostgresEngineVersion.VER_12_3,
  }),
  // ...
  cloudwatchLogsExports: ['postgresql'], // Export the PostgreSQL logs
  // ...
});
```

## Option Groups

Some DB engines offer additional features that make it easier to manage data and databases, and to provide additional security for your database.
Amazon RDS uses option groups to enable and configure these features. An option group can specify features, called options,
that are available for a particular Amazon RDS DB instance.

```ts
const vpc: ec2.IVpc = ...;
const securityGroup: ec2.ISecurityGroup = ...;
new rds.OptionGroup(stack, 'Options', {
  engine: rds.DatabaseInstanceEngine.oracleSe2({
    version: rds.OracleEngineVersion.VER_19,
  }),
  configurations: [
    {
      name: 'OEM',
      port: 5500,
      vpc,
      securityGroups: [securityGroup], // Optional - a default group will be created if not provided.
    },
  ],
});
```

## Serverless

[Amazon Aurora Serverless](https://aws.amazon.com/rds/aurora/serverless/) is an on-demand, auto-scaling configuration for Amazon
Aurora. The database will automatically start up, shut down, and scale capacity
up or down based on your application's needs. It enables you to run your database
in the cloud without managing any database instances.

The following example initializes an Aurora Serverless PostgreSql cluster.
Aurora Serverless clusters can specify scaling properties which will be used to
automatically scale the database cluster seamlessly based on the workload.

```ts
import * as ec2 from '@aws-cdk/aws-ec2';
import * as rds from '@aws-cdk/aws-rds';

const vpc = new ec2.Vpc(this, 'myrdsvpc');

const cluster = new rds.ServerlessCluster(this, 'AnotherCluster', {
  engine: rds.DatabaseClusterEngine.AURORA_POSTGRESQL,
  parameterGroup: rds.ParameterGroup.fromParameterGroupName(this, 'ParameterGroup', 'default.aurora-postgresql10'),
  vpc,
  scaling: {
    autoPause: Duration.minutes(10), // default is to pause after 5 minutes of idle time
    minCapacity: rds.AuroraCapacityUnit.ACU_8, // default is 2 Aurora capacity units (ACUs)
    maxCapacity: rds.AuroraCapacityUnit.ACU_32, // default is 16 Aurora capacity units (ACUs)
  }
});
```

Aurora Serverless Clusters do not support the following features:

* Loading data from an Amazon S3 bucket
* Saving data to an Amazon S3 bucket
* Invoking an AWS Lambda function with an Aurora MySQL native function
* Aurora replicas
* Backtracking
* Multi-master clusters
* Database cloning
* IAM database cloning
* IAM database authentication
* Restoring a snapshot from MySQL DB instance
* Performance Insights
* RDS Proxy

Read more about the [limitations of Aurora Serverless](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless.html#aurora-serverless.limitations)

Learn more about using Amazon Aurora Serverless by reading the [documentation](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless.html)

### Data API

You can access your Aurora Serverless DB cluster using the built-in Data API. The Data API doesn't require a persistent connection to the DB cluster. Instead, it provides a secure HTTP endpoint and integration with AWS SDKs.

The following example shows granting Data API access to a Lamba function.

```ts
import * as ec2 from '@aws-cdk/aws-ec2';
import * as lambda from '@aws-cdk/aws-lambda';
import * as rds from '@aws-cdk/aws-rds';

const vpc = new ec2.Vpc(this, 'MyVPC');

const cluster = new rds.ServerlessCluster(this, 'AnotherCluster', {
  engine: rds.DatabaseClusterEngine.AURORA_MYSQL,
  vpc,
  enableDataApi: true, // Optional - will be automatically set if you call grantDataApiAccess()
});

const fn = new lambda.Function(this, 'MyFunction', {
  runtime: lambda.Runtime.NODEJS_12_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset(path.join(__dirname, 'lambda-handler')),
  environment: {
    CLUSTER_ARN: cluster.clusterArn,
    SECRET_ARN: cluster.secret.secretArn,
  },
});
cluster.grantDataApiAccess(fn)
```

**Note**: To invoke the Data API, the resource will need to read the secret associated with the cluster.

To learn more about using the Data API, see the [documentation](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/data-api.html).
