
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

    new iot.Thing(stack, 'MyThing');

    expect(stack).to(haveResource('AWS::IoT::Thing'));
    test.done();
  },
  'specify thing name'(test: Test) {
    const stack = new Stack();

    new iot.Thing(stack, 'MyThing', {
      thingName: 'thingOne',
    });

    expect(stack).to(haveResource('AWS::IoT::Thing', {
      'ThingName': 'thingOne',
    }));
    test.done();
  },
  'specify thing attributes'(test: Test) {
    const stack = new Stack();

    new iot.Thing(stack, 'MyThing', {
      attributePayload: {
        attributes: {
          hello: 'world',
        },
      },
    });

    expect(stack).to(haveResource('AWS::IoT::Thing', {
      'AttributePayload': {
        Attributes: {
          hello: 'world',
        },
      },
    }));
    test.done();
  },
  'throws when given too many attributes'(test: Test) {
    const stack = new Stack();

    test.throws(() => new iot.Thing(stack, 'MyThing', {
      attributePayload: {
        attributes: {
          one: 'attribute',
          two: 'attribute',
          three: 'attribute',
          four: 'attribute',
        },
      },
    }), /Invalid thing attributes/);

    test.done();
  },
  'attachCertificate()'(test: Test) {
    const stack = new Stack();

    const cert = new iot.Certificate(stack, 'MyCertificate', {
      status: iot.CertificateStatus.ACTIVE,
      certificateSigningRequest: 'csr',
    });

    const thing = new iot.Thing(stack, 'MyThing');
    thing.attachCertificate(cert);

    expect(stack).to(haveResource('AWS::IoT::ThingPrincipalAttachment', {
      'ThingName': 'MyThing0C5333DD',
      'Principal': { 'Fn::GetAtt': ['MyCertificate41357985', 'Arn'] },
    }));
    test.done();
  },
  'fromThingName'(test: Test) {
    // GIVEN
    const stack2 = new Stack();

    // WHEN
    const imported = iot.Thing.fromThingName(stack2, 'Imported', 'thingOne');

    // THEN
    test.deepEqual(stack2.resolve(imported.thingArn), {
      'Fn::Join':
        ['',
          ['arn:',
            { Ref: 'AWS::Partition' },
            ':iot:',
            { Ref: 'AWS::Region' },
            ':',
            { Ref: 'AWS::AccountId' },
            ':thing/thingOne']],
    });
    test.deepEqual(imported.thingName, 'thingOne');
    test.done();
  },
  'fromThingArn'(test: Test) {
    // GIVEN
    const stack2 = new Stack();

    // WHEN
    const imported = iot.Certificate.fromCertificateArn(stack2, 'Imported', 'arn:aws:iot:us-east-2:*:thing/thingTwo');

    // THEN
    test.deepEqual(imported.certificateArn, 'arn:aws:iot:us-east-2:*:thing/thingTwo');
    test.deepEqual(imported.certificateId, 'thingTwo');
    test.done();
  },
});
