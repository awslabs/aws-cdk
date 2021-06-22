# AWS ServiceCatalogAppRegistry Construct Library
<!--BEGIN STABILITY BANNER-->

---

![cfn-resources: Stable](https://img.shields.io/badge/cfn--resources-stable-success.svg?style=for-the-badge)

> All classes with the `Cfn` prefix in this module ([CFN Resources]) are always stable and safe to use.
>
> [CFN Resources]: https://docs.aws.amazon.com/cdk/latest/guide/constructs.html#constructs_lib

![cdk-constructs: Experimental](https://img.shields.io/badge/cdk--constructs-experimental-important.svg?style=for-the-badge)

> The APIs of higher level constructs in this module are experimental and under active development.
> They are subject to non-backward compatible changes or removal in any future version. These are
> not subject to the [Semantic Versioning](https://semver.org/) model and breaking changes will be
> announced in the release notes. This means that while you may use them, you may need to update
> your source code when upgrading to a newer version of this package.

---

<!--END STABILITY BANNER-->

[AWS Service Catalog App Registry](https://docs.aws.amazon.com/servicecatalog/latest/adminguide/appregistry.html) 
enables organizations to create and manage repositores of applications and associated resources.


```ts
import * as appreg from '@aws-cdk/aws-servicecatalogappregistry';
```

## Application

An AppRegistry application enables you to define your applications and associated resources.
The application name must be unique at the account level, but is mutable.

```ts
const application = new appreg.Application(this, 'MyFirstApplication', {
  applicationName: 'MyFirstApplicationName', 
  description: 'description for my application', // the description is optional
});
```

An application that has been created outside of the stack can be imported into your CDK app.
Applications can be imported by their ARN via the `Application.fromApplicationArn()` API:

```ts
const importedApplication = appreg.Application.fromApplicationArn(this, 'MyImportedApplication',
  'arn:aws:servicecatalog:us-east-1:012345678910:/applications/0aqmvxvgmry0ecc4mjhwypun6i');
```
