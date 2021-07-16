import { captureStackTrace, IResolvable, IResolveContext, Token, Tokenization } from '@aws-cdk/core';

const JSON_PATH_TOKEN_SYMBOL = Symbol.for('@aws-cdk/aws-stepfunctions.JsonPathToken');

export class JsonPathToken implements IResolvable {
  public static isJsonPathToken(x: IResolvable): x is JsonPathToken {
    return (x as any)[JSON_PATH_TOKEN_SYMBOL] === true;
  }

  public readonly creationStack: string[];
  public displayHint: string;

  constructor(public readonly path: string) {
    this.creationStack = captureStackTrace();
    this.displayHint = path.replace(/^[^a-zA-Z]+/, '');
    Object.defineProperty(this, JSON_PATH_TOKEN_SYMBOL, { value: true });
  }

  public resolve(_ctx: IResolveContext): any {
    return this.path;
  }

  public toString() {
    return Token.asString(this, { displayHint: this.displayHint });
  }

  public toJSON() {
    return `<path:${this.path}>`;
  }
}

/**
 * Deep render a JSON object to expand JSON path fields, updating the key to end in '.$'
 */
export function renderObject(obj: object | undefined): object | undefined {
  return recurseObject(obj, {
    handleString: renderString,
    handleList: renderStringList,
    handleNumber: renderNumber,
    handleBoolean: renderBoolean,
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
    },

    handleBoolean(_key: string, _x: boolean) {
      return {};
    },
  });

  return found;
}

interface FieldHandlers {
  handleString(key: string, x: string): {[key: string]: string};
  handleList(key: string, x: string[]): {[key: string]: string[] | string };
  handleNumber(key: string, x: number): {[key: string]: number | string};
  handleBoolean(key: string, x: boolean): {[key: string]: boolean};
}

export function recurseObject(obj: object | undefined, handlers: FieldHandlers, visited: object[] = []): object | undefined {
  if (obj === undefined) { return undefined; }

  // Avoiding infinite recursion
  if (visited.includes(obj)) { return {}; }

  // Marking current object as visited for the current recursion path
  visited.push(obj);

  const ret: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      Object.assign(ret, handlers.handleString(key, value));
    } else if (typeof value === 'number') {
      Object.assign(ret, handlers.handleNumber(key, value));
    } else if (Array.isArray(value)) {
      Object.assign(ret, recurseArray(key, value, handlers, visited));
    } else if (typeof value === 'boolean') {
      Object.assign(ret, handlers.handleBoolean(key, value));
    } else if (value === null || value === undefined) {
      // Nothing
    } else if (typeof value === 'object') {
      ret[key] = recurseObject(value, handlers, visited);
    }
  }

  // Removing from visited after leaving the current recursion path
  // Allowing it to be visited again if it's not causing a recursion (circular reference)
  visited.pop();

  return ret;
}

/**
 * Render an array that may or may not contain a string list token
 */
function recurseArray(key: string | undefined, arr: any[], handlers: FieldHandlers, visited: object[] = []): {[key: string]: any[] | string} | any[] {
  if (isStringArray(arr)) {
    const path = jsonPathStringList(arr);
    if (path !== undefined && key !== undefined) {
      return handlers.handleList(key, arr);
    }

    // Fall through to correctly reject encoded strings inside an array.
    // They cannot be represented because there is no key to append a '.$' to.
  }

  const mappedArray = arr.map(value => {
    if ((typeof value === 'string' && jsonPathString(value) !== undefined)
        || (typeof value === 'number' && jsonPathNumber(value) !== undefined)
        || (isStringArray(value) && jsonPathStringList(value) !== undefined)) {
      throw new Error('Cannot use JsonPath fields in an array, they must be used in objects');
    }
    if (Array.isArray(value) && value !== null) {
      return recurseArray(undefined, value, handlers, visited);
    }
    if (typeof value === 'object' && value !== null) {
      return recurseObject(value, handlers, visited);
    }
    return value;
  });


  // If key is undefined it means the parent is an array, not an object
  if (key === undefined) {
    return mappedArray;
  }

  return {
    [key]: mappedArray,
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
 * Render a parameter string list
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
 * Render a parameter number
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
 * Render a parameter boolean
 */
function renderBoolean(key: string, value: boolean): {[key: string]: boolean} {
  return { [key]: value };
}

/**
 * If the indicated string is an encoded JSON path, return the path
 *
 * Otherwise return undefined.
 */
export function jsonPathString(x: string): string | undefined {
  const fragments = Tokenization.reverseString(x);
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
  return pathFromToken(Tokenization.reverseList(x));
}

/**
 * If the indicated number is an encoded JSON path, return the path
 *
 * Otherwise return undefined.
 */
function jsonPathNumber(x: number): string | undefined {
  return pathFromToken(Tokenization.reverseNumber(x));
}

function pathFromToken(token: IResolvable | undefined) {
  return token && (JsonPathToken.isJsonPathToken(token) ? token.path : undefined);
}
