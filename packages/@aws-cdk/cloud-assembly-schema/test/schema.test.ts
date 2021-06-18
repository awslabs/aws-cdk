import { generateSchema, SCHEMAS } from '../scripts/update-schema';

test('if this test fails, run "yarn update-schema"', () => {
  // when we compare schemas we ignore changes the
  // description that is generated from the ts docstrings.
  const docStringFields = [
    'description',
  ];

  for (const schemaName of SCHEMAS) {
    const expected = removeStringKeys(generateSchema(schemaName, false), docStringFields);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const actual = removeStringKeys(require(`../schema/${schemaName}.schema.json`), docStringFields);

    try {
      expect(actual).toEqual(expected);
    } catch (err) {
      // I couldn't for the life of me figure out how to provide additional error message
      // to jest...any ideas?
      err.message = `Whoops, Looks like the schema has changed. Did you forget to run 'yarn update-schema'?\n\n${err.message}`;
      throw err;
    }
  }
});

function removeStringKeys(obj: any, keys: string[]) {
  function _recurse(o: any) {
    for (const prop in o) {
      if (keys.includes(prop) && typeof o[prop] === 'string') {
        delete o[prop];
      } else if (typeof o[prop] === 'object') {
        _recurse(o[prop]);
      }
    }
  }

  const cloned = clone(obj);
  _recurse(cloned);

  return cloned;
}

function clone(obj: any) {
  return JSON.parse(JSON.stringify(obj));
}
