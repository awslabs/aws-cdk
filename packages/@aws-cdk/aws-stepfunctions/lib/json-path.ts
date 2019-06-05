import { Intrinsic, IToken, TokenMap } from '@aws-cdk/cdk';

const JSON_PATH_TOKEN_SYMBOL = Symbol.for('@aws-cdk/aws-stepfunctions.JsonPathToken');

export class JsonPathToken extends Intrinsic {
  public static isJsonPathToken(x: any): x is JsonPathToken {
    return (x as any)[JSON_PATH_TOKEN_SYMBOL] === true;
  }

  constructor(public readonly path: string) {
    super(path, { displayHint: `field${path}` }); // Make function to prevent eager evaluation in superclass
    Object.defineProperty(this, JSON_PATH_TOKEN_SYMBOL, { value: true });
  }
}

/**
 * Deep render a JSON object to expand JSON path fields, updating the key to end in '.$'
 */
export function renderObject(obj: object | undefined): object | undefined {
  return recurseObject(obj, {
    handleString: renderString,
    handleList: renderStringList,
    handleNumber: renderNumber
  });
}

/**
 * Return all JSON paths that are used in the given structure
 */
export function findReferencedPaths(obj: object | undefined): Set<string> {
  const found = new Set<string>();

  recurseObject(obj, {
    handleString(_key: string, x: string) {
      const path = jsonPathString(x);
      if (path !== undefined) { found.add(path); }
      return {};
    },

    handleList(_key: string, x: string[]) {
      const path = jsonPathStringList(x);
      if (path !== undefined) { found.add(path); }
      return {};
    },

    handleNumber(_key: string, x: number) {
      const path = jsonPathNumber(x);
      if (path !== undefined) { found.add(path); }
      return {};
    }
  });

  return found;
}

interface FieldHandlers {
  handleString(key: string, x: string): {[key: string]: string};
  handleList(key: string, x: string[]): {[key: string]: string[] | string };
  handleNumber(key: string, x: number): {[key: string]: number | string};
}

export function recurseObject(obj: object | undefined, handlers: FieldHandlers): object | undefined {
  if (obj === undefined) { return undefined; }

  const ret: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      Object.assign(ret, handlers.handleString(key, value));
    } else if (typeof value === 'number') {
      Object.assign(ret, handlers.handleNumber(key, value));
    } else if (Array.isArray(value)) {
      Object.assign(ret, recurseArray(key, value, handlers));
    } else if (value === null || value === undefined) {
      // Nothing
    } else if (typeof value === 'object') {
      ret[key] = recurseObject(value, handlers);
    }
  }

  return ret;
}

/**
 * Render an array that may or may not contain a string list token
 */
function recurseArray(key: string, arr: any[], handlers: FieldHandlers): {[key: string]: any[] | string} {
  if (isStringArray(arr)) {
    const path = jsonPathStringList(arr);
    if (path !== undefined) {
      return handlers.handleList(key, arr);
    }

    // Fall through to correctly reject encoded strings inside an array.
    // They cannot be represented because there is no key to append a '.$' to.
  }

  return {
    [key]: arr.map(value => {
      if ((typeof value === 'string' && jsonPathString(value) !== undefined)
        || (typeof value === 'number' && jsonPathNumber(value) !== undefined)
        || (isStringArray(value) && jsonPathStringList(value) !== undefined)) {
        throw new Error('Cannot use JsonPath fields in an array, they must be used in objects');
      }
      if (typeof value === 'object' && value !== null) {
        return recurseObject(value, handlers);
      }
      return value;
    })
  };
}

function isStringArray(x: any): x is string[] {
  return Array.isArray(x) && x.every(el => typeof el === 'string');
}

/**
 * Render a parameter string
 *
 * If the string value starts with '$.', render it as a path string, otherwise as a direct string.
 */
function renderString(key: string, value: string): {[key: string]: string} {
  const path = jsonPathString(value);
  if (path !== undefined) {
    return { [key + '.$']: path };
  } else {
    return { [key]: value };
  }
}

/**
 * Render a parameter string
 *
 * If the string value starts with '$.', render it as a path string, otherwise as a direct string.
 */
function renderStringList(key: string, value: string[]): {[key: string]: string[] | string} {
  const path = jsonPathStringList(value);
  if (path !== undefined) {
    return { [key + '.$']: path };
  } else {
    return { [key]: value };
  }
}

/**
 * Render a parameter string
 *
 * If the string value starts with '$.', render it as a path string, otherwise as a direct string.
 */
function renderNumber(key: string, value: number): {[key: string]: number | string} {
  const path = jsonPathNumber(value);
  if (path !== undefined) {
    return { [key + '.$']: path };
  } else {
    return { [key]: value };
  }
}

/**
 * If the indicated string is an encoded JSON path, return the path
 *
 * Otherwise return undefined.
 */
function jsonPathString(x: string): string | undefined {
  const fragments = TokenMap.instance().splitString(x);
  const jsonPathTokens = fragments.tokens.filter(JsonPathToken.isJsonPathToken);

  if (jsonPathTokens.length > 0 && fragments.length > 1) {
    throw new Error(`Field references must be the entire string, cannot concatenate them (found '${x}')`);
  }
  if (jsonPathTokens.length > 0) {
    return jsonPathTokens[0].path;
  }
  return undefined;
}

/**
 * If the indicated string list is an encoded JSON path, return the path
 *
 * Otherwise return undefined.
 */
function jsonPathStringList(x: string[]): string | undefined {
  return pathFromToken(TokenMap.instance().lookupList(x));
}

/**
 * If the indicated number is an encoded JSON path, return the path
 *
 * Otherwise return undefined.
 */
function jsonPathNumber(x: number): string | undefined {
  return pathFromToken(TokenMap.instance().lookupNumberToken(x));
}

function pathFromToken(token: IToken | undefined) {
  return token && (JsonPathToken.isJsonPathToken(token) ? token.path : undefined);
}