## AWS Security Hub Construct Library
<!--BEGIN STABILITY BANNER-->

---

![Stability: Experimental](https://img.shields.io/badge/stability-Experimental-important.svg?style=for-the-badge)

> **This is a _developer preview_ (public beta) module. Releases might lack important features and might have
> future breaking changes.**
>
> This API is still under active development and subject to non-backward
> compatible changes or removal in any future version. Use of the API is not recommended in production
> environments. Experimental APIs are not subject to the Semantic Versioning model.

---
<!--END STABILITY BANNER-->


This module is part of the [AWS Cloud Development Kit](https://github.com/aws/aws-cdk) project.

```ts
import securityhub = require('@aws-cdk/aws-securityhub');
```

## Hub

To create a Hub within Security Hub:

```js
import securityhub = require('@aws-cdk/aws-securityhub');

const hub = new securityhub.Hub(this, 'MyHub');
```

## Events

SecurityHub publishes events to AWS CloudWatch which allows other resources to be triggered on those events. See also [Automating AWS Security Hub with CloudWatch Events](https://docs.aws.amazon.com/en_pv/securityhub/latest/userguide/securityhub-cloudwatch-events.html).

### Imported Findings

```js
const targets = require('@aws-cdk/aws-events-targets');

hub.onImportedFindings('OnImportedFindings', {
    target: new targets.LambdaFunction(fn)
});
```

### Custom Action

```js
const targets = require('@aws-cdk/aws-events-targets');

hub.onCustomAction('OnCustomAction', {
    target: new targets.LambdaFunction(fn)
});
```

### Insight Results

```js
const targets = require('@aws-cdk/aws-events-targets');

hub.onInsightResults('OnInsightResults', {
    target: new targets.LambdaFunction(fn)
});
```