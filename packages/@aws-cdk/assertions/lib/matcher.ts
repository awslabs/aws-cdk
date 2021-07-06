/**
 * Represents a matcher that can perform special data matching
 * capabilities between a given pattern and a target.
 */
export abstract class Matcher {
  /**
   * Check whether the provided object is a subtype of the `IMatcher`.
   */
  public static isMatcher(x: any): x is Matcher {
    return x && x instanceof Matcher;
  }

  /**
   * A name for the matcher. This is collected as part of the result and may be presented to the user.
   */
  public abstract readonly name: string;

  /**
   * Test whether a target matches the provided pattern.
   * @param actual the target to match
   * @return the list of match failures. An empty array denotes a successful match.
   */
  public abstract test(actual: any): MatchResult;
}

/**
 * The result of `Match.test()`.
 */
export class MatchResult {
  private readonly failures: MatchFailure[] = [];

  /**
   * Push a new failure into this result at a specific path.
   * If the failure occurred at root of the match tree, set the path to an empty list.
   * If it occurs in the 5th index of an array nested within the 'foo' key of an object,
   * set the path as `['/foo', '[5]']`.
   * @param path the path at which the failure occurred.
   * @param message the failure
   */
  public push(matcher: Matcher, path: string[], message: string): this {
    this.failures.push({ matcher, path, message });
    return this;
  }

  /** Does the result contain any failures. If not, the result is a success */
  public hasFailed(): boolean {
    return this.failures.length !== 0;
  }

  /** The number of failures */
  public get failCount(): number {
    return this.failures.length;
  }

  /**
   * Compose the results of a previous match as a subtree.
   * @param id the id of the parent tree.
   */
  public compose(id: string, inner: MatchResult): this {
    const innerF = (inner as any).failures as MatchFailure[];
    this.failures.push(...innerF.map(f => {
      return { path: [id, ...f.path], message: f.message, matcher: f.matcher };
    }));
    return this;
  }

  /**
   * Get the list of failures as human readable strings
   */
  public toHumanStrings(): string[] {
    return this.failures.map(r => {
      const loc = r.path.length === 0 ? '' : ` at ${r.path.join('')}`;
      return '' + r.message + loc + ` (using ${r.matcher.name} matcher)`;
    });
  }
}

type MatchFailure = {
  matcher: Matcher;
  path: string[];
  message: string;
}