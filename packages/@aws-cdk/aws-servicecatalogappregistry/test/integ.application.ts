import * as cdk from '@aws-cdk/core';
import * as appreg from '../lib';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'integ-servicecatalogappregistry-application');

const application = new appreg.Application(stack, 'TestApplication', {
  applicationName: 'myApplicationtest',
  description: 'my application description',
});

const attributeGroup = new appreg.AttributeGroup(stack, 'TestAttributeGroup', {
  attributeGroupName: 'myAttributeGroupTest',
  description: 'my attribute group description',
  attributes: {
    stage: 'alpha',
    teamMembers: [
      'markI',
      'markII',
      'markIII',
    ],
  },
});

application.associateStack(stack);
application.associateAttributeGroup(attributeGroup);

app.synth();

