import { Secret } from '@aws-cdk/aws-secretsmanager';
import { nodeunitShim, Test } from 'nodeunit-shim';
import { App, CfnDynamicReference, CfnDynamicReferenceService, CfnParameter, SecretValue, Stack } from '../lib';

nodeunitShim({
  'plainText'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const v = SecretValue.plainText('this just resolves to a string');

    // THEN
    test.deepEqual(stack.resolve(v), 'this just resolves to a string');
    test.done();
  },

  'secretsManager'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const v = SecretValue.secretsManager('secret-id', {
      jsonField: 'json-key',
      versionId: 'version-id',
      versionStage: 'version-stage',
    });

    // THEN
    test.deepEqual(stack.resolve(v), '{{resolve:secretsmanager:secret-id:SecretString:json-key:version-stage:version-id}}');
    test.equal(v.secretQualifier, { secretId: 'secret-id', jsonField: 'json-key', versionStage: 'version-stage', versionId: 'version-id' });
    test.done();
  },

  'secretsManager with defaults'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const secretId = 'secret-id';

    // WHEN
    const v = SecretValue.secretsManager(secretId);

    // THEN
    test.deepEqual(stack.resolve(v), '{{resolve:secretsmanager:secret-id:SecretString:::}}');
    test.equal( v.secretQualifier, { secretId: secretId });
    test.done();
  },

  'secretsManager with an empty ID'(test: Test) {
    test.throws(() => SecretValue.secretsManager(''), /secretId cannot be empty/);
    test.done();
  },

  'secretsManager with a non-ARN ID that has colon'(test: Test) {
    test.throws(() => SecretValue.secretsManager('not:an:arn'), /is not an ARN but contains ":"/);
    test.done();
  },

  'when getting SecretValue from an imported Secret from another account has correct secret qualifiers'(test: Test) {
    // GIVEN
    const app = new App();
    const stack = new Stack(app, 'ProjectStack', {
      env: { account: '123456789012' },
    });
    const secretArn = 'arn:aws:secretsmanager:us-west-2:901234567890:secret:mysecret-123456';

    // WHEN
    const secretValue = Secret.fromSecretCompleteArn(stack, 'Secret', secretArn).secretValue;

    // THEN
    test.equal(secretValue.secretQualifier, { secretId: secretArn, jsonField: '' });
    test.done();
  },

  'when getting SecretValue via secretValueFromJson from imported Secret has correct secret qualifiers'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const secretArn = 'arn:aws:secretsmanager:us-west-2:123456789012:secret:mysecret-123456';

    // WHEN
    const secretValue = Secret.fromSecretCompleteArn(stack, 'Secret', secretArn).secretValueFromJson('json-key');

    // THEN
    test.equal(secretValue.secretQualifier, { secretId: secretArn, jsonField: 'json-key' });
    test.done();
  },

  'ssmSecure'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const v = SecretValue.ssmSecure('param-name', 'param-version');

    // THEN
    test.deepEqual(stack.resolve(v), '{{resolve:ssm-secure:param-name:param-version}}');
    test.done();
  },

  'cfnDynamicReference'(test: Test) {
    // GIVEN
    const stack = new Stack();

    // WHEN
    const v = SecretValue.cfnDynamicReference(new CfnDynamicReference(CfnDynamicReferenceService.SSM, 'foo:bar'));

    // THEN
    test.deepEqual(stack.resolve(v), '{{resolve:ssm:foo:bar}}');
    test.done();
  },

  'cfnParameter (with NoEcho)'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const p = new CfnParameter(stack, 'MyParam', { type: 'String', noEcho: true });

    // WHEN
    const v = SecretValue.cfnParameter(p);

    // THEN
    test.deepEqual(stack.resolve(v), { Ref: 'MyParam' });
    test.done();
  },

  'fails if cfnParameter does not have NoEcho'(test: Test) {
    // GIVEN
    const stack = new Stack();
    const p = new CfnParameter(stack, 'MyParam', { type: 'String' });

    // THEN
    test.throws(() => SecretValue.cfnParameter(p), /CloudFormation parameter must be configured with "NoEcho"/);
    test.done();
  },
});
