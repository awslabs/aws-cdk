import '@aws-cdk/assert-internal/jest';
import { FieldUtils, JsonPath, TaskInput } from '../lib';

describe('Fields', () => {
  const jsonPathValidationErrorMsg = /exactly '\$', '\$\$', start with '\$.', start with '\$\$.' or start with '\$\['/;

  test('deep replace correctly handles fields in arrays', () => {
    expect(
      FieldUtils.renderObject({
        unknown: undefined,
        bool: true,
        literal: 'literal',
        field: JsonPath.stringAt('$.stringField'),
        listField: JsonPath.listAt('$.listField'),
        deep: [
          'literal',
          {
            deepField: JsonPath.numberAt('$.numField'),
          },
        ],
      }),
    ).toStrictEqual({
      'bool': true,
      'literal': 'literal',
      'field.$': '$.stringField',
      'listField.$': '$.listField',
      'deep': [
        'literal',
        {
          'deepField.$': '$.numField',
        },
      ],
    });
  }),
  test('exercise contextpaths', () => {
    expect(
      FieldUtils.renderObject({
        str: JsonPath.stringAt('$$.Execution.StartTime'),
        count: JsonPath.numberAt('$$.State.RetryCount'),
        token: JsonPath.taskToken,
        entire: JsonPath.entireContext,
      }),
    ).toStrictEqual({
      'str.$': '$$.Execution.StartTime',
      'count.$': '$$.State.RetryCount',
      'token.$': '$$.Task.Token',
      'entire.$': '$$',
    });
  }),
  test('find all referenced paths', () => {
    expect(
      FieldUtils.findReferencedPaths({
        bool: false,
        literal: 'literal',
        field: JsonPath.stringAt('$.stringField'),
        listField: JsonPath.listAt('$.listField'),
        deep: [
          'literal',
          {
            field: JsonPath.stringAt('$.stringField'),
            deepField: JsonPath.numberAt('$.numField'),
          },
        ],
      }),
    ).toStrictEqual(['$.listField', '$.numField', '$.stringField']);
  }),
  test('cannot have JsonPath fields in arrays', () => {
    expect(() => FieldUtils.renderObject({
      deep: [JsonPath.stringAt('$.hello')],
    })).toThrowError(/Cannot use JsonPath fields in an array/);
  }),
  test('datafield path must be correct', () => {
    expect(JsonPath.stringAt('$')).toBeDefined();

    expect(() => JsonPath.stringAt('$hello')).toThrowError(jsonPathValidationErrorMsg);
    expect(() => JsonPath.stringAt('hello')).toThrowError(jsonPathValidationErrorMsg);
  }),
  test('context path must be correct', () => {
    expect(JsonPath.stringAt('$$')).toBeDefined();

    expect(() => JsonPath.stringAt('$$hello')).toThrowError(jsonPathValidationErrorMsg);
    expect(() => JsonPath.stringAt('hello')).toThrowError(jsonPathValidationErrorMsg);
  }),
  test('datafield path with array must be correct', () => {
    expect(JsonPath.stringAt('$[0]')).toBeDefined();
    expect(JsonPath.stringAt("$['abc']")).toBeDefined();
  }),
  test('test contains task token', () => {
    expect(true).toEqual(
      FieldUtils.containsTaskToken({
        field: JsonPath.taskToken,
      }),
    );

    expect(true).toEqual(
      FieldUtils.containsTaskToken({
        field: JsonPath.stringAt('$$.Task'),
      }),
    );

    expect(true).toEqual(
      FieldUtils.containsTaskToken({
        field: JsonPath.entireContext,
      }),
    );

    expect(false).toEqual(
      FieldUtils.containsTaskToken({
        oops: 'not here',
      }),
    );

    expect(false).toEqual(
      FieldUtils.containsTaskToken({
        oops: JsonPath.stringAt('$$.Execution.StartTime'),
      }),
    );
  }),
  test('arbitrary JSONPath fields are not replaced', () => {
    expect(
      FieldUtils.renderObject({
        field: '$.content',
      }),
    ).toStrictEqual({
      field: '$.content',
    });
  }),
  test('fields cannot be used somewhere in a string interpolation', () => {
    expect(() => FieldUtils.renderObject({
      field: `contains ${JsonPath.stringAt('$.hello')}`,
    })).toThrowError(/Field references must be the entire string/);
  });
  test('infinitely recursive object graphs do not break referenced path finding', () => {
    const deepObject = {
      field: JsonPath.stringAt('$.stringField'),
      deepField: JsonPath.numberAt('$.numField'),
      recursiveField: undefined as any,
    };
    const paths = {
      bool: false,
      literal: 'literal',
      field: JsonPath.stringAt('$.stringField'),
      listField: JsonPath.listAt('$.listField'),
      recursiveField: undefined as any,
      deep: [
        'literal',
        deepObject,
      ],
    };
    paths.recursiveField = paths;
    deepObject.recursiveField = paths;
    expect(FieldUtils.findReferencedPaths(paths))
      .toStrictEqual(['$.listField', '$.numField', '$.stringField']);
  });
  test('rendering a non-object value should just return itself', () => {
    expect(
      FieldUtils.renderObject(TaskInput.fromText('Hello World').value),
    ).toEqual(
      'Hello World',
    );
    expect(
      FieldUtils.renderObject('Hello World' as any),
    ).toEqual(
      'Hello World',
    );
    expect(
      FieldUtils.renderObject(null as any),
    ).toEqual(
      null,
    );
    expect(
      FieldUtils.renderObject(3.14 as any),
    ).toEqual(
      3.14,
    );
    expect(
      FieldUtils.renderObject(true as any),
    ).toEqual(
      true,
    );
    expect(
      FieldUtils.renderObject(undefined),
    ).toEqual(
      undefined,
    );
  });
});
