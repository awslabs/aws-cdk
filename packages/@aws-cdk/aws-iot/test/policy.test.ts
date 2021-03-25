
import { expect, haveResource } from '@aws-cdk/assert';
import { App, Stack } from '@aws-cdk/core';
import { nodeunitShim, Test } from 'nodeunit-shim';
import * as iot from '../lib';

// to make it easy to copy & paste from output:
/* eslint-disable quote-props */

nodeunitShim({
  'all defaults'(test: Test) {
    const stack = new Stack();

    new iot.Policy(stack, 'MyIotPolicy', {
      statements: [new iot.PolicyStatement({
        actions: ['iot:Connect'],
        resources: ['arn:aws:iot:us-east-1:123456789012:client/myClientId'],
      })],
    });

    expect(stack).to(haveResource('AWS::IoT::Policy', {
      'PolicyName': 'MyIotPolicyCB76D4D8',
      'PolicyDocument': {
        'Version': '2012-10-17',
        'Statement': [
          {
            'Effect': 'Allow',
            'Action': 'iot:Connect',
            'Resource': 'arn:aws:iot:us-east-1:123456789012:client/myClientId',
          },
        ],
      },
    }));
    test.done();
  },
  'specify statements'(test: Test) {
    const stack = new Stack();

    new iot.Policy(stack, 'MyIotPolicy', {
      statements: [new iot.PolicyStatement({
        actions: ['iot:Connect'],
        resources: ['arn:aws:iot:us-east-1:123456789012:client/myClientId'],
      })],
    });

    expect(stack).to(haveResource('AWS::IoT::Policy', {
      'PolicyName': 'MyIotPolicyCB76D4D8',
      'PolicyDocument': {
        'Version': '2012-10-17',
        'Statement': [
          {
            'Effect': 'Allow',
            'Action': 'iot:Connect',
            'Resource': 'arn:aws:iot:us-east-1:123456789012:client/myClientId',
          },
        ],
      },
    }));
    test.done();
  },
  'specify policyName'(test: Test) {
    const stack = new Stack();
    new iot.Policy(stack, 'MyIotPolicy', {
      policyName: 'policyName',
      statements: [new iot.PolicyStatement({
        actions: ['iot:Connect'],
        resources: ['arn:aws:iot:us-east-1:123456789012:client/myClientId'],
      })],
    });
    expect(stack).to(haveResource('AWS::IoT::Policy', {
      'PolicyName': 'policyName',
    }));
    test.done();
  },
  'specify document'(test: Test) {
    const stack = new Stack();
    new iot.Policy(stack, 'MyIotPolicy', {
      document: new iot.PolicyDocument({
        statements: [new iot.PolicyStatement({
          actions: ['iot:Connect'],
          resources: ['arn:aws:iot:us-east-1:123456789012:client/myClientId'],
        })],
      }),
    });
    expect(stack).to(haveResource('AWS::IoT::Policy', {
      'PolicyName': 'MyIotPolicyCB76D4D8',
      'PolicyDocument': {
        'Version': '2012-10-17',
        'Statement': [
          {
            'Effect': 'Allow',
            'Action': 'iot:Connect',
            'Resource': 'arn:aws:iot:us-east-1:123456789012:client/myClientId',
          },
        ],
      },
    }));
    test.done();
  },
  'fromPolicyName'(test: Test) {
    // GIVEN
    const stack2 = new Stack();

    // WHEN
    const imported = iot.Policy.fromPolicyName(stack2, 'Imported', 'MyIotPolicy');

    // THEN
    test.deepEqual(imported.policyName, 'MyIotPolicy');
    test.done();
  },
  'can provide statements after creation'(test: Test) {
    const stack = new Stack();
    const policy = new iot.Policy(stack, 'MyIotPolicy');
    policy.addStatements(new iot.PolicyStatement({
      actions: ['iot:Connect'],
      resources: ['arn:aws:iot:us-east-1:123456789012:client/myClientId'],
    }));

    expect(stack).to(haveResource('AWS::IoT::Policy', {
      'PolicyName': 'MyIotPolicyCB76D4D8',
      'PolicyDocument': {
        'Version': '2012-10-17',
        'Statement': [
          {
            'Effect': 'Allow',
            'Action': 'iot:Connect',
            'Resource': 'arn:aws:iot:us-east-1:123456789012:client/myClientId',
          },
        ],
      },
    }));
    test.done();
  },
  'can attach policy to certificate'(test: Test) {
    const stack = new Stack();
    const statement = new iot.PolicyStatement();
    statement.addActions('iot:Connect');
    statement.addAllResources();
    const policy = new iot.Policy(stack, 'MyIotPolicy', {
      statements: [statement],
    });

    const cert = new iot.Certificate(stack, 'MyCertificate', {
      status: iot.CertificateStatus.ACTIVE,
      certificateSigningRequest: 'csr',
    });

    policy.attachToCertificate(cert);

    expect(stack).to(haveResource('AWS::IoT::PolicyPrincipalAttachment', {
      'PolicyName': 'MyIotPolicyCB76D4D8',
      'Principal': { 'Fn::GetAtt': ['MyCertificate41357985', 'Arn'] },
    }));
    test.done();
  },
  'provides policy name'(test: Test) {
    const stack = new Stack();
    const policy = new iot.Policy(stack, 'MyIotPolicy', {
      policyName: 'MyPolicyName',
    });
    test.deepEqual(policy.policyName, 'MyPolicyName');
    test.done();
  },
  'provides policy arn'(test: Test) {
    const stack = new Stack();
    const policy = new iot.Policy(stack, 'MyIotPolicy');
    test.deepEqual(stack.resolve(policy.policyArn), {
      'Fn::GetAtt': ['MyIotPolicyCB76D4D8', 'Arn'],
    });
    test.done();
  },
  'fails if policy document is missing actions'(test: Test) {
    const app = new App();
    const stack = new Stack(app, 'MyStack');
    new iot.Policy(stack, 'MyIotPolicy', {
      statements: [new iot.PolicyStatement({})],
    });
    test.throws(() => { app.synth(); }, /An IoT PolicyStatement must specify at least one 'action'./);
    test.done();
  },
  'fails if policy document is missing resources'(test: Test) {
    const app = new App();
    const stack = new Stack(app, 'MyStack');
    new iot.Policy(stack, 'MyIotPolicy', {
      statements: [new iot.PolicyStatement({
        actions: ['iot:Connect'],
      })],
    });
    test.throws(() => { app.synth(); }, /An IoT PolicyStatement must specify at least one 'resource'./);
    test.done();
  },
  'reading policyName forces a Policy to materialize'(test: Test) {
    const app = new App();
    const stack = new Stack(app, 'MyStack');
    const policy = new iot.Policy(stack, 'MyIotPolicy');
    Array.isArray(policy.policyName);
    test.throws(() => { app.synth(); }, /You must add statements ot the policy/);
    test.done();
  },
});

