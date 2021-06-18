import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import * as api from '@aws-cdk/cx-api';
import { Assertion, not } from './assertion';
import { MatchStyle, matchTemplate } from './assertions/match-template';

export abstract class Inspector {
  public aroundAssert?: (cb: () => void) => any;

  constructor() {
    this.aroundAssert = undefined;
  }

  public to(assertion: Assertion<this>): any {
    return this.aroundAssert ? this.aroundAssert(() => this._to(assertion))
      : this._to(assertion);
  }

  public notTo(assertion: Assertion<this>): any {
    return this.to(not(assertion));
  }

  abstract get value(): any;

  private _to(assertion: Assertion<this>): any {
    assertion.assertOrThrow(this);
  }
}

export class StackInspector extends Inspector {
  private readonly template: { [key: string]: any };

  constructor(public readonly stack: api.CloudFormationStackArtifact | object) {
    super();

    this.template = stack instanceof api.CloudFormationStackArtifact ? stack.template : stack;
  }

  public at(path: string | string[]): StackPathInspector {
    if (!(this.stack instanceof api.CloudFormationStackArtifact)) {
      throw new Error('Cannot use "expect(stack).at(path)" for a raw template, only CloudFormationStackArtifact');
    }

    const strPath = typeof path === 'string' ? path : path.join('/');
    return new StackPathInspector(this.stack, strPath);
  }

  public toMatch(template: { [key: string]: any }, matchStyle = MatchStyle.EXACT) {
    return this.to(matchTemplate(template, matchStyle));
  }

  public get value(): { [key: string]: any } {
    return this.template;
  }
}

export class StackPathInspector extends Inspector {
  constructor(public readonly stack: api.CloudFormationStackArtifact, public readonly path: string) {
    super();
  }

  public get value(): { [key: string]: any } | undefined {
    // The names of paths in metadata in tests are very ill-defined. Try with the full path first,
    // then try with the stack name preprended for backwards compat with most tests that happen to give
    // their stack an ID that's the same as the stack name.
    const metadata = this.stack.manifest.metadata || {};
    const md = metadata[this.path] || metadata[`/${this.stack.id}${this.path}`];
    if (md === undefined) { return undefined; }
    const resourceMd = md.find(entry => entry.type === cxschema.ArtifactMetadataEntryType.LOGICAL_ID);
    if (resourceMd === undefined) { return undefined; }
    const logicalId = resourceMd.data as cxschema.LogMessageMetadataEntry;
    return this.stack.template.Resources[logicalId];
  }
}
