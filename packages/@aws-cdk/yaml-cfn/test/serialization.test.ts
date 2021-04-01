import '@aws-cdk/assert/jest';
import * as yaml_cfn from '../lib';

test('An object with a single string value is serialized as a simple string', () => {
  const value = yaml_cfn.serialize({ key: 'some string' });

  expect(value).toEqual('key: some string\n');
});
