import * as iam from '@aws-cdk/aws-iam';
import * as sns from '@aws-cdk/aws-sns';
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

const topics = [
  new sns.Topic(stack, 'Topic1'),
  new sns.Topic(stack, 'Topic2'),
  new sns.Topic(stack, 'Topic3'),
];
const specialTopic = new sns.Topic(stack, 'specialTopic');

portfolio.addEventNotifications(product, topics);
portfolio.addEventNotifications(product, [specialTopic], {
  description: 'special topic description',
  messageLanguage: servicecatalog.MessageLanguage.EN,
});

app.synth();
