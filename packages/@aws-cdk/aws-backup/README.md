# AWS Backup Construct Library
<!--BEGIN STABILITY BANNER-->

---

![cfn-resources: Stable](https://img.shields.io/badge/cfn--resources-stable-success.svg?style=for-the-badge)

![cdk-constructs: Stable](https://img.shields.io/badge/cdk--constructs-stable-success.svg?style=for-the-badge)

---

<!--END STABILITY BANNER-->

AWS Backup is a fully managed backup service that makes it easy to centralize and automate the backup of data across AWS services in the cloud and on premises. Using AWS Backup, you can configure backup policies and monitor backup activity for your AWS resources in one place.

## Backup plan and selection

In AWS Backup, a *backup plan* is a policy expression that defines when and how you want to back up your AWS resources, such as Amazon DynamoDB tables or Amazon Elastic File System (Amazon EFS) file systems. You can assign resources to backup plans, and AWS Backup automatically backs up and retains backups for those resources according to the backup plan. You can create multiple backup plans if you have workloads with different backup requirements.

This module provides ready-made backup plans (similar to the console experience):

```ts
// Daily, weekly and monthly with 5 year retention
const plan = backup.BackupPlan.dailyWeeklyMonthly5YearRetention(this, 'Plan');
```

Assigning resources to a plan can be done with `addSelection()`:

```ts fixture=with-plan
const myTable = dynamodb.Table.fromTableName(this, 'Table', 'myTableName');
const myCoolConstruct = new Construct(this, 'MyCoolConstruct');

plan.addSelection('Selection', {
  resources: [
    backup.BackupResource.fromDynamoDbTable(myTable), // A DynamoDB table
    backup.BackupResource.fromTag('stage', 'prod'), // All resources that are tagged stage=prod in the region/account
    backup.BackupResource.fromConstruct(myCoolConstruct), // All backupable resources in `myCoolConstruct`
  ]
})
```

If not specified, a new IAM role with a managed policy for backup will be
created for the selection. The `BackupSelection` implements `IGrantable`.

To add rules to a plan, use `addRule()`:

```ts fixture=with-plan
plan.addRule(new backup.BackupPlanRule({
  completionWindow: Duration.hours(2),
  startWindow: Duration.hours(1),
  scheduleExpression: events.Schedule.cron({ // Only cron expressions are supported
    day: '15',
    hour: '3',
    minute: '30'
  }),
  moveToColdStorageAfter: Duration.days(30)
}));
```

Ready-made rules are also available:

```ts fixture=with-plan
plan.addRule(backup.BackupPlanRule.daily());
plan.addRule(backup.BackupPlanRule.weekly());
```

By default a new [vault](#Backup-vault) is created when creating a plan.
It is also possible to specify a vault either at the plan level or at the
rule level.

```ts
const myVault = backup.BackupVault.fromBackupVaultName(this, 'Vault1', 'myVault');
const otherVault = backup.BackupVault.fromBackupVaultName(this, 'Vault2', 'otherVault');

const plan = backup.BackupPlan.daily35DayRetention(this, 'Plan', myVault); // Use `myVault` for all plan rules
plan.addRule(backup.BackupPlanRule.monthly1Year(otherVault)); // Use `otherVault` for this specific rule
```

## Backup vault

In AWS Backup, a *backup vault* is a container that you organize your backups in. You can use backup vaults to set the AWS Key Management Service (AWS KMS) encryption key that is used to encrypt backups in the backup vault and to control access to the backups in the backup vault. If you require different encryption keys or access policies for different groups of backups, you can optionally create multiple backup vaults.

```ts
const myKey = kms.Key.fromKeyArn(this, 'MyKey', 'aaa');
const myTopic = sns.Topic.fromTopicArn(this, 'MyTopic', 'bbb');

const vault = new backup.BackupVault(this, 'Vault', {
  encryptionKey: myKey, // Custom encryption key
  notificationTopic: myTopic, // Send all vault events to this SNS topic
});
```

A vault has a default `RemovalPolicy` set to `RETAIN`. Note that removing a vault
that contains recovery points will fail.


## Importing existing backup vault

To import an existing backup vault into your CDK application, use the `BackupVault.fromBackupVaultArn` or `BackupVault.fromBackupVaultName` 
static method. Here is an example of giving an IAM Role permission to start a backup job:

```ts
const importedVault = backup.BackupVault.fromBackupVaultName(this, 'Vault', 'myVaultName');

const role = new iam.Role(this, 'Access Role', { assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com') });

importedVault.grant(role, 'backup:StartBackupJob');
```
