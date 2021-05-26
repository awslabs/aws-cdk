import { nodeunitShim, Test } from 'nodeunit-shim';
import { CfnDynamicReference, CfnDynamicReferenceService, CfnParameter, SecretValue, Stack } from '../lib';

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
      versionStage: 'version-stage',
      versionId: '',
    });

    // THEN
    test.deepEqual(stack.resolve(v), '{{resolve:secretsmanager:secret-id:SecretString:json-key:version-stage:}}');
    test.equal(v.secretQualifier, { secretId: 'secret-id', jsonField: 'json-key', versionStage: 'version-stage', versionId: '' });
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
    test.equal(v.secretQualifier, { secretId: secretId });
    test.done();
  },

  'secretsManager with an empty ID'(test: Test) {
    test.throws(() => SecretValue.secretsManager(''), /secretId cannot be empty/);
    test.done();
  },

  'secretsManager with versionStage and versionId'(test: Test) {
    test.throws(() => SecretValue.secretsManager('secret-id', { versionStage: 'version-stage', versionId: 'version-id' }), /were both provided but only one is allowed/);
    test.done();
  },

  'secretsManager with a non-ARN ID that has colon'(test: Test) {
    test.throws(() => SecretValue.secretsManager('not:an:arn'), /is not an ARN but contains ":"/);
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
