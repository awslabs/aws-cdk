import * as iam from '@aws-cdk/aws-iam';
import { App, Stack } from '@aws-cdk/core';
import * as servicecatalog from '../lib';

const app = new App();
const stack = new Stack(app, 'integ-servicecatalog-portfolio');

const role = new iam.Role(stack, 'TestRole', {
  assumedBy: new iam.AccountRootPrincipal(),
});

const group = new iam.Group(stack, 'TestGroup');

const portfolio = new servicecatalog.Portfolio(stack, 'TestPortfolio', {
  displayName: 'TestPortfolio',
  providerName: 'TestProvider',
  description: 'This is our Service Catalog Portfolio',
  messageLanguage: servicecatalog.MessageLanguage.EN,
});

portfolio.giveAccessToRole(role);
portfolio.giveAccessToGroup(group);

const tagOptions = new servicecatalog.TagOptions(stack, {
  key1: ['value1', 'value2'],
  key2: ['value1'],
});
portfolio.addTagOptions(tagOptions);

portfolio.shareWithAccount('123456789012');

const product = new servicecatalog.CloudFormationProduct(stack, 'TestProduct', {
  productName: 'testProduct',
  owner: 'testOwner',
  productVersions: [
    {
      validateTemplate: false,
      cloudFormationTemplate: servicecatalog.CloudFormationTemplate.fromUrl(
        'https://awsdocs.s3.amazonaws.com/servicecatalog/development-environment.template'),
    },
  ],
});

portfolio.addProduct(product);

portfolio.constrainTagUpdates(product);

app.synth();
