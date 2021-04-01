import '@aws-cdk/assert/jest';
import * as yaml_cfn from '../lib';

test('Unquoted year-month-day is treated as a string, not a Date', () => {
  const value = yaml_cfn.deserialize('Key: 2020-12-31');

  expect(value).toEqual({
    Key: '2020-12-31',
  });
});

test("Unquoted 'No' is treated as a string, not a boolean", () => {
  const value = yaml_cfn.deserialize('Key: No');

  expect(value).toEqual({
    Key: 'No',
  });
});

test("Short-form 'Ref' is deserialized correctly", () => {
  const value = yaml_cfn.deserialize('!Ref Resource');

  expect(value).toEqual({
    Ref: 'Resource',
  });
});

test("Short-form 'Fn::GetAtt' is deserialized correctly", () => {
  const value = yaml_cfn.deserialize('!GetAtt Resource.Attribute');

  expect(value).toEqual({
    'Fn::GetAtt': 'Resource.Attribute',
  });
});
