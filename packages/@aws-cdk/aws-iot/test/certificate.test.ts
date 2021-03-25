
import '@aws-cdk/assert/jest';
import { expect, haveResource } from '@aws-cdk/assert';
import { Stack } from '@aws-cdk/core';
import { nodeunitShim, Test } from 'nodeunit-shim';
import * as iot from '../lib';

// to make it easy to copy & paste from output:
/* eslint-disable quote-props */

nodeunitShim({
  'default properties'(test: Test) {
    const stack = new Stack();

    new iot.Certificate(stack, 'MyCertificate', {
      caCertificatePem: 'pem',
    });

    expect(stack).to(haveResource('AWS::IoT::Certificate', {
      'Status': 'INACTIVE',
      'CACertificatePem': 'pem',
      'CertificateMode': 'DEFAULT',
    }));
    test.done();
  },
  'specify status'(test: Test) {
    const stack = new Stack();

    new iot.Certificate(stack, 'MyCertificate', {
      status: iot.CertificateStatus.ACTIVE,
      certificateSigningRequest: 'csr',
    });

    expect(stack).to(haveResource('AWS::IoT::Certificate', {
      'Status': 'ACTIVE',
      'CertificateSigningRequest': 'csr',
    }));
    test.done();
  },
  'specify certificate mode'(test: Test) {
    const stack = new Stack();

    new iot.Certificate(stack, 'MyCertificate', {
      certificateMode: iot.CertificateMode.SNI_ONLY,
      certificatePem: 'pem',
    });

    expect(stack).to(haveResource('AWS::IoT::Certificate', {
      'Status': 'INACTIVE',
      'CertificateMode': 'SNI_ONLY',
      'CertificatePem': 'pem',
    }));
    test.done();
  },
  'throws if pem provided to SNI_ONLY certificate'(test: Test) {
    const stack = new Stack();

    test.throws(() => new iot.Certificate(stack, 'MyCertificate', {
      caCertificatePem: 'pem',
      certificateMode: iot.CertificateMode.SNI_ONLY,
    }), /Certificate invalid./);

    test.done();
  },
  'throws when nothing provided'(test: Test) {
    const stack = new Stack();

    test.throws(() => new iot.Certificate(stack, 'MyCertificate'), /Certificate invalid./);

    test.done();
  },
  'attachPolicy()'(test: Test) {
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

    cert.attachPolicy(policy);

    expect(stack).to(haveResource('AWS::IoT::PolicyPrincipalAttachment', {
      'PolicyName': 'MyIotPolicyCB76D4D8',
      'Principal': { 'Fn::GetAtt': ['MyCertificate41357985', 'Arn'] },
    }));
    test.done();
  },
  'attachThing()'(test: Test) {
    const stack = new Stack();

    const cert = new iot.Certificate(stack, 'MyCertificate', {
      status: iot.CertificateStatus.ACTIVE,
      certificateSigningRequest: 'csr',
    });

    const thing = new iot.Thing(stack, 'MyThing');

    cert.attachThing(thing);

    expect(stack).to(haveResource('AWS::IoT::ThingPrincipalAttachment', {
      'ThingName': 'MyThing0C5333DD',
      'Principal': { 'Fn::GetAtt': ['MyCertificate41357985', 'Arn'] },
    }));
    test.done();
  },
  'fromCertificateId'(test: Test) {
    // GIVEN
    const stack2 = new Stack();

    // WHEN
    const imported = iot.Certificate.fromCertificateId(stack2, 'Imported', '1234567890');

    // THEN
    test.deepEqual(stack2.resolve(imported.certificateArn), {
      'Fn::Join':
        ['',
          ['arn:',
            { Ref: 'AWS::Partition' },
            ':iot:',
            { Ref: 'AWS::Region' },
            ':',
            { Ref: 'AWS::AccountId' },
            ':cert/1234567890']],
    });
    test.deepEqual(imported.certificateId, '1234567890');
    test.done();
  },
  'fromCertificateArn'(test: Test) {
    // GIVEN
    const stack2 = new Stack();

    // WHEN
    const imported = iot.Certificate.fromCertificateArn(stack2, 'Imported', 'arn:aws:iot::us-east-2:*:cert/1234567890');

    // THEN
    test.deepEqual(imported.certificateArn, 'arn:aws:iot::us-east-2:*:cert/1234567890');
    test.deepEqual(imported.certificateId, '1234567890');
    test.done();
  },
  'provides certificate arn'(test: Test) {
    const stack = new Stack();
    const cert = new iot.Certificate(stack, 'MyIotCertificate', {
      certificateSigningRequest: 'csr',
    });
    test.deepEqual(stack.resolve(cert.certificateArn), {
      'Fn::GetAtt': ['MyIotCertificate84152F23', 'Arn'],
    });
    test.done();
  },
});
