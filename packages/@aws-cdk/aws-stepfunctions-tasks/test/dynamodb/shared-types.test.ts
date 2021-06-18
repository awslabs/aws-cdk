import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as tasks from '../../lib';

describe('DynamoProjectionExpression', () => {
  test('should correctly configure projectionExpression', () => {
    expect(
      new tasks.DynamoProjectionExpression()
        .withAttribute('Messages')
        .atIndex(1)
        .atIndex(10)
        .withAttribute('Tags')
        .withAttribute('Items')
        .atIndex(0)
        .toString(),
    ).toEqual('Messages[1][10].Tags.Items[0]');
  });

  test('should throw if expression starts with atIndex', () => {
    expect(() => new tasks.DynamoProjectionExpression().atIndex(1).withAttribute('Messages').toString()).toThrow(
      /Expression must start with an attribute/,
    );
  });
});

describe('DynamoAttributeValue', () => {
  test('from string with a string literal', () => {
    // GIVEN
    const s = 'my-string';

    // WHEN
    const attribute = tasks.DynamoAttributeValue.fromString(s);

    // THEN
    expect(sfn.FieldUtils.renderObject(attribute)).toEqual({
      attributeValue: {
        S: s,
      },
    });
  });

  test('from string with a json path', () => {
    // GIVEN
    const s = '$.string';

    // WHEN
    const attribute = tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt(s));

    // THEN
    expect(sfn.FieldUtils.renderObject(attribute)).toEqual({
      attributeValue: {
        'S.$': s,
      },
    });
  });

  test('from number', () => {
    // GIVEN
    const n = 9;

    // WHEN
    const attribute = tasks.DynamoAttributeValue.fromNumber(n);

    // THEN
    expect(sfn.FieldUtils.renderObject(attribute)).toEqual({
      attributeValue: {
        N: `${n}`,
      },
    });
  });

  test('number from string', () => {
    // GIVEN
    const n = '9';

    // WHEN
    const attribute = tasks.DynamoAttributeValue.numberFromString(n);

    // THEN
    expect(sfn.FieldUtils.renderObject(attribute)).toEqual({
      attributeValue: {
        N: n,
      },
    });
  });

  test('from binary', () => {
    // GIVEN
    const b = 'ejBtZ3d0ZmJicQ==';

    // WHEN
    const attribute = tasks.DynamoAttributeValue.fromBinary(b);

    // THEN
    expect(sfn.FieldUtils.renderObject(attribute)).toEqual({
      attributeValue: {
        B: b,
      },
    });
  });

  test('from string set', () => {
    // GIVEN
    const ss = ['apple', 'banana'];

    // WHEN
    const attribute = tasks.DynamoAttributeValue.fromStringSet(ss);

    // THEN
    expect(sfn.FieldUtils.renderObject(attribute)).toEqual({
      attributeValue: {
        SS: ss,
      },
    });
  });

  test('from number set', () => {
    // GIVEN
    const ns = [1, 2];

    // WHEN
    const attribute = tasks.DynamoAttributeValue.fromNumberSet(ns);

    // THEN
    expect(sfn.FieldUtils.renderObject(attribute)).toEqual({
      attributeValue: {
        NS: ['1', '2'],
      },
    });
  });

  test('number set from strings', () => {
    // GIVEN
    const ns = ['1', '2'];

    // WHEN
    const attribute = tasks.DynamoAttributeValue.numberSetFromStrings(ns);

    // THEN
    expect(sfn.FieldUtils.renderObject(attribute)).toEqual({
      attributeValue: {
        NS: ns,
      },
    });
  });

  test('from binary set', () => {
    // GIVEN
    const bs = ['Y2RrIGlzIGF3ZXNvbWU=', 'ejBtZ3d0ZmJicQ=='];

    // WHEN
    const attribute = tasks.DynamoAttributeValue.fromBinarySet(bs);

    // THEN
    expect(sfn.FieldUtils.renderObject(attribute)).toEqual({
      attributeValue: {
        BS: bs,
      },
    });
  });

  test('from map', () => {
    // GIVEN
    const m = { cdk: tasks.DynamoAttributeValue.fromString('is-cool') };

    // WHEN
    const attribute = tasks.DynamoAttributeValue.fromMap(m);

    // THEN
    expect(sfn.FieldUtils.renderObject(attribute)).toEqual({
      attributeValue: {
        M: {
          cdk: { S: 'is-cool' },
        },
      },
    });
  });

  test('map from json path', () => {
    // GIVEN
    const m = '$.path';

    // WHEN
    const attribute = tasks.DynamoAttributeValue.mapFromJsonPath(m);

    // THEN
    expect(sfn.FieldUtils.renderObject(attribute)).toEqual({
      attributeValue: {
        'M.$': m,
      },
    });
  });

  test('map from invalid json path throws', () => {
    // GIVEN
    const m = 'invalid';

    // WHEN / THEN
    expect(() => {
      tasks.DynamoAttributeValue.mapFromJsonPath(m);
    }).toThrow("Data JSON path values must either be exactly equal to '$' or start with '$.'");
  });

  test('from list', () => {
    // GIVEN
    const l = [tasks.DynamoAttributeValue.fromString('a string'), tasks.DynamoAttributeValue.fromNumber(7)];

    // WHEN
    const attribute = tasks.DynamoAttributeValue.fromList(l);

    // THEN
    expect(sfn.FieldUtils.renderObject(attribute)).toEqual({
      attributeValue: {
        L: [
          {
            S: 'a string',
          },
          {
            N: '7',
          },
        ],
      },
    });
  });

  test('from null', () => {
    // WHEN
    const attribute = tasks.DynamoAttributeValue.fromNull(true);

    // THEN
    expect(sfn.FieldUtils.renderObject(attribute)).toEqual({
      attributeValue: {
        NULL: true,
      },
    });
  });


  test('from invalid boolean with json path', () => {
    // GIVEN
    const m = 'invalid';

    // WHEN / THEN
    expect(() => {
      tasks.DynamoAttributeValue.booleanFromJsonPath(m);
    }).toThrow("Data JSON path values must either be exactly equal to '$' or start with '$.'");
  });


  test('from boolean with json path', () => {
    // GIVEN
    const m = '$.path';
    // WHEN
    const attribute = tasks.DynamoAttributeValue.booleanFromJsonPath(sfn.JsonPath.stringAt(m));

    // THEN
    expect(sfn.FieldUtils.renderObject(attribute)).toEqual({
      attributeValue: {
        'BOOL.$': m,
      },
    });
  });

  test('from boolean', () => {
    // WHEN
    const attribute = tasks.DynamoAttributeValue.fromBoolean(true);

    // THEN
    expect(sfn.FieldUtils.renderObject(attribute)).toEqual({
      attributeValue: {
        BOOL: true,
      },
    });
  });
});
