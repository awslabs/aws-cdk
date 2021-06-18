import { IConstruct } from './construct-compat';

const ASPECTS_SYMBOL = Symbol('cdk-aspects');

/**
 * Represents an Aspect
 */
export interface IAspect {
  /**
   * All aspects can visit an IConstruct
   */
  visit(node: IConstruct): void;
}

/**
 * Aspects can be applied to CDK tree scopes and can operate on the tree before
 * synthesis.
 */
export class Aspects {
  /**
   * Returns the `Aspects` object associated with a construct scope.
   * @param scope The scope for which these aspects will apply.
   */
  public static of(scope: IConstruct): Aspects {
    let aspects = (scope as any)[ASPECTS_SYMBOL];
    if (!aspects) {
      aspects = new Aspects(scope);

      Object.defineProperty(scope, ASPECTS_SYMBOL, {
        value: aspects,
        configurable: false,
        enumerable: false,
      });
    }
    return aspects;
  }

  // TODO(2.0): private readonly _aspects = new Array<IAspect>();
  private constructor(private readonly scope: IConstruct) { }

  /**
   * Adds an aspect to apply this scope before synthesis.
   * @param aspect The aspect to add.
   */
  public add(aspect: IAspect) {
    // TODO(2.0): this._aspects.push(aspect);
    this.scope.node._actualNode.applyAspect(aspect);
  }

  /**
   * The list of aspects which were directly applied on this scope.
   */
  public get aspects(): IAspect[] {
    // TODO(2.0): return  [ ...this._aspects ];
    return [...(this.scope.node._actualNode as any)._aspects]; // clone
  }
}