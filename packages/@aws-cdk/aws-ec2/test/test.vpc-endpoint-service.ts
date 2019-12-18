import { expect, haveResource } from '@aws-cdk/assert';
import { Stack } from '@aws-cdk/core';
import { Test } from 'nodeunit';
// tslint:disable-next-line:max-line-length
import { VpcEndpointService } from '../lib';

export = {
  'test vpc endpoint service': {
    'create endpoint service with no principals'(test: Test) {
      // GIVEN
      const stack = new Stack();

      // WHEN
      new VpcEndpointService(stack, "EndpointService", {
        networkLoadBalancerArns: ["arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/net/Test/9bn6qkf4e9jrw77a"],
        acceptanceRequired: false,
        whitelistedPrincipalIds: []
      });

      // THEN
      expect(stack).to(haveResource('AWS::EC2::VPCEndpointService', {
          NetworkLoadBalancerArns: ["arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/net/Test/9bn6qkf4e9jrw77a"],
          AcceptanceRequired: false
      }));

      expect(stack).to(haveResource('AWS::EC2::VPCEndpointServicePermissions', {
        ServiceId: {
          Ref: "EndpointService"
        },
        AllowedPrincipals: []
      }));

      test.done();
    },

    'create endpoint service with a principal'(test: Test) {
      // GIVEN
      const stack = new Stack();

      // WHEN
      new VpcEndpointService(stack, "EndpointService", {
        networkLoadBalancerArns: ["arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/net/Test/9bn6qkf4e9jrw77a"],
        acceptanceRequired: false,
        whitelistedPrincipalIds: ["arn:aws:iam::123456789012:root"]
      });

      // THEN
      expect(stack).to(haveResource('AWS::EC2::VPCEndpointService', {
          NetworkLoadBalancerArns: ["arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/net/Test/9bn6qkf4e9jrw77a"],
          AcceptanceRequired: false
      }));

      expect(stack).to(haveResource('AWS::EC2::VPCEndpointServicePermissions', {
        ServiceId: {
          Ref: "EndpointService"
        },
        AllowedPrincipals: ["arn:aws:iam::123456789012:root"]
      }));

      test.done();
    },

    'with acceptance requried'(test: Test) {
      // GIVEN
      const stack = new Stack();

      // WHEN
      new VpcEndpointService(stack, "EndpointService", {
        networkLoadBalancerArns: ["arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/net/Test/9bn6qkf4e9jrw77a"],
        acceptanceRequired: true,
        whitelistedPrincipalIds: ["arn:aws:iam::123456789012:root"]
      });

      // THEN
      expect(stack).to(haveResource('AWS::EC2::VPCEndpointService', {
          NetworkLoadBalancerArns: ["arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/net/Test/9bn6qkf4e9jrw77a"],
          AcceptanceRequired: true
      }));

      expect(stack).to(haveResource('AWS::EC2::VPCEndpointServicePermissions', {
        ServiceId: {
          Ref: "EndpointService"
        },
        AllowedPrincipals: ["arn:aws:iam::123456789012:root"]
      }));

      test.done();
    }
  }
};
