import { Match } from './match';
import { Matcher, MatchResult } from './matcher';
import { StackInspector } from './vendored/assert';

export function hasResource(inspector: StackInspector, type: string, props: any): string | void {
  const matcher = Matcher.isMatcher(props) ? props : Match.objectLike(props);
  let closestResult: MatchResult | undefined = undefined;
  let closestResource: { [key: string]: any } | undefined = undefined;
  let count: number = 0;

  for (const logicalId of Object.keys(inspector.value.Resources ?? {})) {
    const resource: { [key: string]: any } = inspector.value.Resources[logicalId];
    if (resource.Type === type) {
      count++;
      const result = matcher.test(resource);
      if (!result.hasFailed()) {
        return;
      }
      if (closestResult === undefined || closestResult.failCount > result.failCount) {
        closestResult = result;
        closestResource = resource;
      }
    }
  }

  if (closestResult === undefined) {
    return `No resource with type ${type} found`;
  }

  if (!closestResource) {
    throw new Error('unexpected: closestResult is null');
  }

  return [
    `${count} resources with type ${type} found, but none match as expected.`,
    formatMessage(closestResult, closestResource),
  ].join('\n');
}

function formatMessage(closestResult: MatchResult, closestResource: {}): string {
  return [
    'The closest result is:',
    reindent(JSON.stringify(closestResource, undefined, 2)),
    'with the following mismatches:',
    ...closestResult.toHumanStrings().map(s => `\t${s}`),
  ].join('\n');
}

function reindent(x: string, indent: number = 2): string {
  const pad = ' '.repeat(indent);
  return pad + x.split('\n').join(`\n${pad}`);
}