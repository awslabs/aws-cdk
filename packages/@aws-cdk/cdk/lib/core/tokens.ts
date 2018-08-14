import { Construct } from "./construct";

/**
 * If objects has a function property by this name, they will be considered tokens, and this
 * function will be called to resolve the value for this object.
 */
export const RESOLVE_METHOD = 'resolve';

/**
 * Properties for Token customization
 */
export interface TokenProps {
    /**
     * A human-readable representation hint for this Token
     *
     * stringRepresentationHint is used in the placeholder string of stringified
     * Tokens, so that if humans look at the string its purpose makes sense to
     * them. Must contain only alphanumeric and simple separator characters
     * (_.:-).
     *
     * @default No string representation
     */
    stringRepresentationHint?: string;

    /**
     * Function used to concatenate strings and Token results together
     *
     * @default No joining
     */
    joiner?: ITokenJoiner;
}

/**
 * Represents a lazy-evaluated value.
 *
 * Can be used to delay evaluation of a certain value in case, for example,
 * that it requires some context or late-bound data.
 */
export class Token {
    public readonly joiner?: ITokenJoiner;

    private tokenKey?: string;
    private readonly stringRepresentationHint?: string;

    /**
     * Creates a token that resolves to `value`.
     *
     * If value is a function, the function is evaluated upon resolution and
     * the value it returns will be used as the token's value.
     *
     * @param valueOrFunction What this token will evaluate to, literal or function.
     *
     */
    constructor(private readonly valueOrFunction?: any, props: TokenProps = {}) {
        this.stringRepresentationHint = props && props.stringRepresentationHint;
        this.joiner = props && props.joiner;
    }

    /**
     * @returns The resolved value for this token.
     */
    public resolve(): any {
        let value = this.valueOrFunction;
        if (typeof(value) === 'function') {
            value = value();
        }

        return value;
    }

    /**
     * Return a reversible string representation of this token
     *
     * If the Token is initialized with a literal, the stringified value of the
     * literal is returned. Otherwise, a special quoted string representation
     * of the Token is returned that can be embedded into other strings.
     *
     * Strings with quoted Tokens in them can be restored back into
     * complex values with the Tokens restored by calling `resolve()`
     * on the string.
     */
    public toString(): string {
        const valueType = typeof this.valueOrFunction;
        // Optimization: if we can immediately resolve this, don't bother
        // registering a Token.
        if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
            return this.valueOrFunction.toString();
        }

        if (this.tokenKey === undefined) {
            this.tokenKey = TOKEN_STRING_MAP.register(this, this.stringRepresentationHint);
        }
        return this.tokenKey;
    }

    /**
     * Turn this Token into JSON
     *
     * This gets called by JSON.stringify(). We want to prohibit this, because
     * it's not possible to do this properly, so we just throw an error here.
     */
    public toJSON(): any {
        throw new Error('JSON.stringify() cannot be applied to structure with a deferred Token in it. Use TokenJSON.stringify() instead.');
    }
}

/**
 * Returns true if obj is a token (i.e. has the resolve() method)
 * @param obj The object to test.
 */
export function isToken(obj: any): obj is Token {
    return typeof(obj[RESOLVE_METHOD]) === 'function';
}

/**
 * Resolves an object by evaluating all tokens and removing any undefined or empty objects or arrays.
 * Values can only be primitives, arrays or tokens. Other objects (i.e. with methods) will be rejected.
 *
 * @param obj The object to resolve.
 * @param prefix Prefix key path components for diagnostics.
 */
export function resolve(obj: any, prefix?: string[]): any {
    const path = prefix || [ ];
    const pathName = '/' + path.join('/');

    // protect against cyclic references by limiting depth.
    if (path.length > 200) {
        throw new Error('Unable to resolve object tree with circular reference. Path: ' + pathName);
    }

    //
    // undefined
    //

    if (typeof(obj) === 'undefined') {
        return undefined;
    }

    //
    // null
    //

    if (obj === null) {
        return null;
    }

    //
    // functions - not supported (only tokens are supported)
    //

    if (typeof(obj) === 'function') {
        throw new Error(`Trying to resolve a non-data object. Only token are supported for lazy evaluation. Path: ${pathName}. Object: ${obj}`);
    }

    //
    // string - potentially replace all stringified Tokens
    //
    if (typeof(obj) === 'string') {
        return TOKEN_STRING_MAP.resolveMarkers(obj as string);
    }

    //
    // primitives - as-is
    //

    if (typeof(obj) !== 'object' || obj instanceof Date) {
        return obj;
    }

    //
    // tokens - invoke 'resolve' and continue to resolve recursively
    //

    if (isToken(obj)) {
        const value = obj[RESOLVE_METHOD]();
        return resolve(value, path);
    }

    //
    // arrays - resolve all values, remove undefined and remove empty arrays
    //

    if (Array.isArray(obj)) {
        const arr = obj
            .map((x, i) => resolve(x, path.concat(i.toString())))
            .filter(x => typeof(x) !== 'undefined');

        return arr;
    }

    //
    // objects - deep-resolve all values
    //

    // Must not be a Construct at this point, otherwise you probably made a type
    // mistake somewhere and resolve will get into an infinite loop recursing into
    // child.parent <---> parent.children
    if (obj instanceof Construct) {
        throw new Error('Trying to resolve() a Construct at ' + pathName);
    }

    const result: any = { };
    for (const key of Object.keys(obj)) {
        const value = resolve(obj[key], path.concat(key));

        // skip undefined
        if (typeof(value) === 'undefined') {
            continue;
        }

        result[key] = value;
    }

    return result;
}

/**
 * Central place where we keep a mapping from Tokens to their String representation
 *
 * The string representation is used to embed token into strings,
 * and stored to be able to
 *
 * All instances of TokenStringMap share the same storage, so that this process
 * works even when different copies of the library are loaded.
 */
class TokenStringMap {
    private readonly tokenMap: {[key: string]: Token};

    constructor() {
        const glob = global as any;
        this.tokenMap = glob.__cdkTokenMap = glob.__cdkTokenMap || {};
    }

    /**
     * Generating a unique string for this Token, returning a key
     *
     * Every call for the same Token will produce a new unique string, no
     * attempt is made to deduplicate. Token objects should cache the
     * value themselves, if required.
     *
     * The token can choose (part of) its own representation string with a
     * hint. This may be used to produce aesthetically pleasing and
     * recognizable token representations for humans.
     */
    public register(token: Token, representationHint?: string): string {
        const counter = Object.keys(this.tokenMap).length;
        const representation = representationHint || `TOKEN`;

        const key = `${representation}.${counter}`;
        if (new RegExp(`[^${VALID_KEY_CHARS}]`).exec(key)) {
            throw new Error(`Invalid characters in token representation: ${key}`);
        }

        this.tokenMap[key] = token;
        return `${BEGIN_TOKEN_MARKER}${key}${END_TOKEN_MARKER}`;
    }

    /**
     * Replace any Token markers in this string with their resolved values
     */
    public resolveMarkers(s: string): any {
        const str = new TokenString(s, BEGIN_TOKEN_MARKER, `[${VALID_KEY_CHARS}]+`, END_TOKEN_MARKER);
        const fragments = str.split(this.lookupToken.bind(this));
        return fragments.join();
    }

    /**
     * Find a Token by key
     */
    public lookupToken(key: string): Token {
        if (!(key in this.tokenMap)) {
            throw new Error(`Unrecognized token key: ${key}`);
        }

        return this.tokenMap[key];
    }
}

const BEGIN_TOKEN_MARKER = '${Token[';
const END_TOKEN_MARKER = ']}';
const VALID_KEY_CHARS = 'a-zA-Z0-9:._-';

/**
 * Singleton instance of the token string map
 */
const TOKEN_STRING_MAP = new TokenStringMap();

/**
 * Interface that provisioning engines implement
 */
export interface ITokenJoiner {
    /**
     * The name of the joiner.
     *
     * Must be unique per joiner, because it will be used.
     */
    joinerName: string;

    /**
     * Return the language intrinsic that will combine the strings in the given engine
     */
    joinStringFragments(fragments: any[]): any;
}

/**
 * A string with markers in it that can be resolved to external values
 */
class TokenString {
    constructor(
        private readonly str: string,
        private readonly beginMarker: string,
        private readonly idPattern: string,
        private readonly endMarker: string) {
    }

    /**
     * Split string on markers, substituting markers with Tokens
     */
    public split(lookup: (id: string) => Token): TokenStringFragments {
        const re = new RegExp(`${regexQuote(this.beginMarker)}(${this.idPattern})${regexQuote(this.endMarker)}`, 'g');
        const ret = new TokenStringFragments();

        let rest = 0;
        let m = re.exec(this.str);
        while (m) {
            if (m.index > rest) {
                ret.addString(this.str.substring(rest, m.index));
            }

            ret.addToken(lookup(m[1]));

            rest = re.lastIndex;
            m = re.exec(this.str);
        }

        if (rest < this.str.length) {
            ret.addString(this.str.substring(rest));
        }

        return ret;
    }
}

/**
 * Result of the split of a string with Tokens
 *
 * Either a literal part of the string, or an unresolved Token.
 */
type Fragment = { type: 'string'; str: string } | { type: 'token'; token: Token };

/**
 * Fragments of a string with markers
 */
class TokenStringFragments {
    private readonly fragments = new Array<Fragment>();

    public values(): any[] {
        return this.fragments.map(f => f.type === 'token' ? resolve(f.token) : f.str);
    }

    public addString(str: string) {
        this.fragments.push({ type: 'string', str });
    }

    public addToken(token: Token) {
        this.fragments.push({ type: 'token', token });
    }

    /**
     * Combine resolved fragments using the appropriate engine.
     *
     * Resolves the result.
     */
    public join(): any {
        if (this.fragments.length === 0) { return ''; }
        if (this.fragments.length === 1) { return this.values()[0]; }

        const joiners = this.fragments.map(f => f.type === 'token' ? f.token.joiner : undefined).filter(x => x !== undefined) as ITokenJoiner[];
        // Two reasons to look at joiner names here instead of object identity:
        // 1) So we can display a better error message
        // 2) If the library gets loaded multiple times, the same engine will be instantiated
        // multiple times and so the objects will compare as different, even though they all
        // do the same, and any one of them would be fine.
        const joinerNames = Array.from(new Set<string>(joiners.map(e => e.joinerName)));

        if (joiners.length === 0) {
            // No joiners. This can happen if we only have non language-specific Tokens. Stay
            // in literal-land, convert all to string and combine.
            return this.values().map(x => `${x}`).join('');
        }

        if (joinerNames.length > 1) {
            throw new Error(`Combining different joiners in one string fragment: ${joinerNames.join(', ')}`);
        }

        // This might return another Token, so resolve again
        return resolve(joiners[0].joinStringFragments(this.values()));
    }
}

/**
 * Quote a string for use in a regex
 */
function regexQuote(s: string) {
    return s.replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&");
}