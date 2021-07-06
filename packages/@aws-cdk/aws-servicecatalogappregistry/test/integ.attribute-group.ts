import * as cdk from '@aws-cdk/core';
import * as appreg from '../lib';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'integ-servicecatalogappregistry-attribute-group');

new appreg.AttributeGroup(stack, 'TestAttributeGroup', {
  attributeGroupName: 'myAttributeGroupTest',
  description: 'my attribute group description',
  attributes: {
    stage: 'alpha',
    teamMembers: [
      'markI',
      'markII',
      'markIII',
    ],
    plannedRoadMap: {
      alpha: 'time1',
      beta: 'time2',
    },
  },
});

app.synth();
