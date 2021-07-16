# AWS Service Catalog Construct Library
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

[AWS Service Catalog](https://docs.aws.amazon.com/servicecatalog/latest/dg/what-is-service-catalog.html)
enables organizations to create and manage catalogs of products for their end users that are approved for use on AWS.

## Table Of Contents

- [Portfolio](#portfolio)
  - [Granting access to a portfolio](#granting-access-to-a-portfolio)
  - [Sharing a portfolio with another AWS account](#sharing-a-portfolio-with-another-aws-account)
- [Product](#product)
  - [Adding a product to a portfolio](#adding-a-product-to-a-portfolio)
- [TagOptions](#tag-options)
- [Constraints](#constraints)
  - [Tag update constraint](#tag-update-constraint)

The `@aws-cdk/aws-servicecatalog` package contains resources that enable users to automate governance and management of their AWS resources at scale.

```ts nofixture
import * as servicecatalog from '@aws-cdk/aws-servicecatalog';
```

## Portfolio

AWS Service Catalog portfolios allow admins to manage products that their end users have access to.
Using the CDK, a new portfolio can be created with the `Portfolio` construct:

```ts
new servicecatalog.Portfolio(this, 'MyFirstPortfolio', {
  displayName: 'MyFirstPortfolio',
  providerName: 'MyTeam',
});
```

You can also specify properties such as `description` and `acceptLanguage`
to help better catalog and manage your portfolios.

```ts
new servicecatalog.Portfolio(this, 'MyFirstPortfolio', {
  displayName: 'MyFirstPortfolio',
  providerName: 'MyTeam',
  description: 'Portfolio for a project',
  messageLanguage: servicecatalog.MessageLanguage.EN,
});
```

Read more at [Creating and Managing Portfolios](https://docs.aws.amazon.com/servicecatalog/latest/adminguide/catalogs_portfolios.html).

A portfolio that has been created outside the stack can be imported into your CDK app.
Portfolios can be imported by their ARN via the `Portfolio.fromPortfolioArn()` API:

```ts
const portfolio = servicecatalog.Portfolio.fromPortfolioArn(this, 'MyImportedPortfolio',
  'arn:aws:catalog:region:account-id:portfolio/port-abcdefghi');
```

### Granting access to a portfolio

You can manage end user access to a portfolio by granting permissions to `IAM` entities like a user, group, or role.
Once resources are deployed end users will be able to access them via the console or service catalog CLI.

```ts fixture=basic-portfolio
import * as iam from '@aws-cdk/aws-iam';

const user = new iam.User(this, 'MyUser');
portfolio.giveAccessToUser(user);

const role = new iam.Role(this, 'MyRole', {
  assumedBy: new iam.AccountRootPrincipal(),
});
portfolio.giveAccessToRole(role);

const group = new iam.Group(this, 'MyGroup');
portfolio.giveAccessToGroup(group);
```

### Sharing a portfolio with another AWS account

A portfolio can be programatically shared with other accounts so that specified users can also access it:

```ts fixture=basic-portfolio
portfolio.shareWithAccount('012345678901');
```

## Product

Products are the resources you are allowing end users to provision and utilize. 
The CDK currently only supports adding products of type Cloudformation product. 
Using the CDK, a new Product can be created with the `CloudFormationProduct` construct.
`CloudFormationTemplate.fromUrl` can be utilized to create a Product using a Cloudformation template directly from an URL:

```ts
const product = new servicecatalog.CloudFormationProduct(this, 'MyFirstProduct', {
  productName: "My Product",
  owner: "Product Owner",
  productVersions: [
    {
      productVersionName: "v1",
      cloudFormationTemplate: servicecatalog.CloudFormationTemplate.fromUrl(
        'https://raw.githubusercontent.com/awslabs/aws-cloudformation-templates/master/aws/services/ServiceCatalog/Product.yaml'),
    },
  ]
});
```

A `CloudFormationProduct` can also be created using a Cloudformation template from an Asset.
Assets are files that are uploaded to an S3 Bucket before deployment.
`CloudFormationTemplate.fromAsset` can be utilized to create a Product by passing the path to a local template file on your disk:

```ts
import * as path from 'path';

const product = new servicecatalog.CloudFormationProduct(this, 'MyFirstProduct', {
  productName: "My Product",
  owner: "Product Owner",
  productVersions: [
    {
      productVersionName: "v1",
      cloudFormationTemplate: servicecatalog.CloudFormationTemplate.fromUrl(
        'https://raw.githubusercontent.com/awslabs/aws-cloudformation-templates/master/aws/services/ServiceCatalog/Product.yaml'),
    },
    {
      productVersionName: "v2",
      cloudFormationTemplate: servicecatalog.CloudFormationTemplate.fromAsset(path.join(__dirname, 'development-environment.template.json')),
    },
  ]
});
```

### Adding a product to a portfolio

You add products to a portfolio to manage your resources at scale.  After adding a product to a portfolio,
it creates a portfolio-product association, and will become visible from the portfolio side in both the console and service catalog CLI.
A product can be added to multiple portfolios depending on your resource and organizational needs.

```ts fixture=portfolio-product
portfolio.addProduct(product);
```

### TagOptions

TagOptions allow administrators to easily manage tags on provisioned products by creating a selection of tags for end users to choose from.
For example, an end user can choose an `ec2` for the instance type size.
TagOptions are created by specifying a key with a selection of values.
At the moment, TagOptions can only be disabled on the console.

```ts fixture=basic-portfolio
const tagOptions = new servicecatalog.TagOptions({
  key1: ['value1', 'value2'],
  key2: ['value1'],
});
portfolio.addTagOptions(tagOptions);
```

## Constraints

Constraints define governance mechanisms that allow you to manage permissions, notifications, and options related to actions end users can perform on products,
Constraints are applied on a portfolio-product association.
Using the CDK, if you do not explicitly associate a product to a portfolio and add a constraint, it will automatically add an association for you.

There are rules around plurariliites of constraints for a portfolio and product.
For example, you can only have a single "tag update" constraint applied to a portfolio-product association. 
If a misconfigured constraint is added, `synth` will fail with an error message.

Read more at [Service Catalog Constraints](https://docs.aws.amazon.com/servicecatalog/latest/adminguide/constraints.html).

### Tag update constraint

Tag update constraints allow or disallow end users to update tags on resources associated with an AWS Service Catalog product upon provisioning.
By default, tag updating is not permitted.
If tag updating is allowed, then new tags associated with the product or portfolio will be applied to provisioned resources during a provisioned product update.

```ts fixture=portfolio-product
portfolio.addProduct(product);

portfolio.constrainTagUpdates(product);
```

If you want to disable this feature later on, you can update it by setting the "allow" parameter to `false`:

```ts fixture=portfolio-product
// to disable tag updates:
portfolio.constrainTagUpdates(product, {
  allow: false,
});
```
