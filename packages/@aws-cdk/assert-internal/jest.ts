import * as core from '@aws-cdk/core';
import * as cxapi from '@aws-cdk/cx-api';
import { countResources } from './lib';
import { JestFriendlyAssertion } from './lib/assertion';
import { haveOutput, HaveOutputProperties } from './lib/assertions/have-output';
import { HaveResourceAssertion, ResourcePart } from './lib/assertions/have-resource';
import { MatchStyle, matchTemplate } from './lib/assertions/match-template';
import { expect as ourExpect } from './lib/expect';
import { StackInspector } from './lib/inspector';

declare global {
  namespace jest {
    interface Matchers<R, T> {
      toMatchTemplate(
        template: any,
        matchStyle?: MatchStyle): R;

      toHaveResource(
        resourceType: string,
        properties?: any,
        comparison?: ResourcePart): R;

      toHaveResourceLike(
        resourceType: string,
        properties?: any,
        comparison?: ResourcePart): R;

      toHaveOutput(props: HaveOutputProperties): R;

      toCountResources(resourceType: string, count: number): R;
    }
  }
}

expect.extend({
  toMatchTemplate(
    actual: cxapi.CloudFormationStackArtifact | core.Stack,
    template: any,
    matchStyle?: MatchStyle) {
    const assertion = matchTemplate(template, matchStyle);
    const inspector = ourExpect(actual);
    const pass = assertion.assertUsing(inspector);
    if (pass) {
      return {
        pass,
        message: () => 'Not ' + assertion.description,
      };
    } else {
      return {
        pass,
        message: () => assertion.description,
      };
    }
  },

  toHaveResource(
    actual: cxapi.CloudFormationStackArtifact | core.Stack,
    resourceType: string,
    properties?: any,
    comparison?: ResourcePart) {
    const assertion = new HaveResourceAssertion(resourceType, properties, comparison, false);
    return applyAssertion(assertion, actual);
  },

  toHaveResourceLike(
    actual: cxapi.CloudFormationStackArtifact | core.Stack,
    resourceType: string,
    properties?: any,
    comparison?: ResourcePart) {
    const assertion = new HaveResourceAssertion(resourceType, properties, comparison, true);
    return applyAssertion(assertion, actual);
  },

  toHaveOutput(
    actual: cxapi.CloudFormationStackArtifact | core.Stack,
    props: HaveOutputProperties) {
    return applyAssertion(haveOutput(props), actual);
  },

  toCountResources(
    actual: cxapi.CloudFormationStackArtifact | core.Stack,
    resourceType: string,
    count = 1) {
    return applyAssertion(countResources(resourceType, count), actual);
  },
});

function applyAssertion(assertion: JestFriendlyAssertion<StackInspector>, actual: cxapi.CloudFormationStackArtifact | core.Stack) {
  const inspector = ourExpect(actual);
  const pass = assertion.assertUsing(inspector);
  if (pass) {
    return {
      pass,
      message: () => 'Not ' + assertion.generateErrorMessage(),
    };
  } else {
    return {
      pass,
      message: () => assertion.generateErrorMessage(),
    };
  }
}
