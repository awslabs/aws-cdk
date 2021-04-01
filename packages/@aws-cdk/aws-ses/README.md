# Amazon Simple Email Service Construct Library
<!--BEGIN STABILITY BANNER-->

---

![cfn-resources: Stable](https://img.shields.io/badge/cfn--resources-stable-success.svg?style=for-the-badge)

![cdk-constructs: Stable](https://img.shields.io/badge/cdk--constructs-stable-success.svg?style=for-the-badge)

---

<!--END STABILITY BANNER-->

This module is part of the [AWS Cloud Development Kit](https://github.com/aws/aws-cdk) project.

## Email receiving

Create a receipt rule set with rules and actions (actions can be found in the
`@aws-cdk/aws-ses-actions` package):

```ts
import * as s3 from '@aws-cdk/aws-s3';
import * as ses from '@aws-cdk/aws-ses';
import * as actions from '@aws-cdk/aws-ses-actions';
import * as sns from '@aws-cdk/aws-sns';

const bucket = new s3.Bucket(stack, 'Bucket');
const topic = new sns.Topic(stack, 'Topic');

new ses.ReceiptRuleSet(stack, 'RuleSet', {
  rules: [
    {
      recipients: ['hello@aws.com'],
      actions: [
        new actions.AddHeader({
          name: 'X-Special-Header',
          value: 'aws'
        }),
        new actions.S3({
          bucket,
          objectKeyPrefix: 'emails/',
          topic
        })
      ],
    },
    {
      recipients: ['aws.com'],
      actions: [
        new actions.Sns({
          topic
        })
      ]
    }
  ]
});
```

Alternatively, rules can be added to a rule set:

```ts
const ruleSet = new ses.ReceiptRuleSet(this, 'RuleSet'):

const awsRule = ruleSet.addRule('Aws', {
  recipients: ['aws.com']
});
```

And actions to rules:

```ts
awsRule.addAction(new actions.Sns({
  topic
}));
```

When using `addRule`, the new rule is added after the last added rule unless `after` is specified.

### Drop spams

A rule to drop spam can be added by setting `dropSpam` to `true`:

```ts
new ses.ReceiptRuleSet(this, 'RuleSet', {
  dropSpam: true
});
```

This will add a rule at the top of the rule set with a Lambda action that stops processing messages that have at least one spam indicator. See [Lambda Function Examples](https://docs.aws.amazon.com/ses/latest/DeveloperGuide/receiving-email-action-lambda-example-functions.html).


## Receipt filter

Create a receipt filter:

```ts
new ses.ReceiptFilter(this, 'Filter', {
  ip: '1.2.3.4/16' // Will be blocked
})
```

A white list filter is also available:

```ts
new ses.WhiteListReceiptFilter(this, 'WhiteList', {
  ips: [
    '10.0.0.0/16',
    '1.2.3.4/16',
  ]
});
```

This will first create a block all filter and then create allow filters for the listed ip addresses.
