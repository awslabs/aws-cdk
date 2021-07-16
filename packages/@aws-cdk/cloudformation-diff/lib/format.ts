import { format } from 'util';
import * as colors from 'colors/safe';
import { Difference, isPropertyDifference, ResourceDifference, ResourceImpact } from './diff-template';
import { DifferenceCollection, TemplateDiff } from './diff/types';
import { deepEqual } from './diff/util';
import { formatTable } from './format-table';
import { IamChanges } from './iam/iam-changes';
import { SecurityGroupChanges } from './network/security-group-changes';

// from cx-api
const PATH_METADATA_KEY = 'aws:cdk:path';

/* eslint-disable @typescript-eslint/no-require-imports */
const { structuredPatch } = require('diff');
/* eslint-enable */

export interface FormatStream extends NodeJS.WritableStream {
  columns?: number;
}

/** A map from logical ID to construct path. Useful in case there is no aws:cdk:path metadata in the template. */
export type LogicalPathMap = {
  [logicalId: string]: string;
};

/**
 * Renders template differences to the given stream using the default formatter.
 *
 * @param stream           The IO stream where to output the rendered diff.
 * @param templateDiff     TemplateDiff to be rendered to the console.
 * @param logicalToPathMap A map from logical ID to construct path. Useful in
 *                         case there is no aws:cdk:path metadata in the template.
 * @param context          the number of context lines to use in arbitrary JSON diff (defaults to 3).
 */
export function formatDifferences(
  stream: FormatStream,
  templateDiff: TemplateDiff,
  logicalToPathMap?: LogicalPathMap,
  context?: number): void {
  const differ = new BasicDifferenceFormatter(stream, templateDiff, logicalToPathMap, context);
  differ.formatDifferences();
}

/**
* Renders a diff of security changes to the given stream using the default formatter
*
* @param stream           The IO stream where to output the rendered diff.
* @param templateDiff     TemplateDiff to be rendered to the console.
* @param logicalToPathMap A map from logical ID to construct path.
* @param context          the number of context lines to use in arbitrary JSON diff (defaults to 3).
*/
export function formatSecurityChanges(
  stream: FormatStream,
  templateDiff: TemplateDiff,
  logicalToPathMap?: LogicalPathMap,
  context?: number): void {
  const differ = new BasicDifferenceFormatter(stream, templateDiff, logicalToPathMap, context);
  differ.formatSecurityChanges();
}


/** Implements a strategy to output differences between templates */
export abstract class DifferenceFormatter {

  /**
 * @param stream           The IO stream where to output the rendered diff.
 * @param templateDiff     TemplateDiff to be rendered to the console.
 * @param logicalToPathMap A map from logical ID to construct path.
 * @param context          the number of context lines to use in arbitrary JSON diff (defaults to 3).
 */
  constructor(protected readonly stream: FormatStream,
    protected readonly templateDiff: TemplateDiff,
    protected readonly logicalToPathMap: LogicalPathMap = {},
    protected readonly context: number = 3) {
    this.readConstructPaths();
  }

  /**
 * Renders `this.templateDiff` to `this.stream`.
 */
  abstract formatDifferences(): void;

  /**
 * Renders security changes of `this.templateDiff` to `this.stream`.
 */
  abstract formatSecurityChanges(): void;

  /**
   * Find 'aws:cdk:path' metadata in the diff and add it to the logicalToPathMap
   *
   * There are multiple sources of logicalID -> path mappings: synth metadata
   * and resource metadata, and we combine all sources into a single map.
   */
  public readConstructPaths() {
    for (const [logicalId, resourceDiff] of Object.entries(this.templateDiff.resources)) {
      if (!resourceDiff) { continue; }

      const oldPathMetadata = resourceDiff.oldValue && resourceDiff.oldValue.Metadata && resourceDiff.oldValue.Metadata[PATH_METADATA_KEY];
      if (oldPathMetadata && !(logicalId in this.logicalToPathMap)) {
        this.logicalToPathMap[logicalId] = oldPathMetadata;
      }

      const newPathMetadata = resourceDiff.newValue && resourceDiff.newValue.Metadata && resourceDiff.newValue.Metadata[PATH_METADATA_KEY];
      if (newPathMetadata && !(logicalId in this.logicalToPathMap)) {
        this.logicalToPathMap[logicalId] = newPathMetadata;
      }
    }
  }

  public deepSubstituteBracedLogicalIds(rows: string[][]): string[][] {
    return rows.map(row => row.map(this.substituteBracedLogicalIds.bind(this)));
  }

  /**
   * Substitute all strings like ${LogId.xxx} with the path instead of the logical ID
   */
  public substituteBracedLogicalIds(source: string): string {
    return source.replace(/\$\{([^.}]+)(.[^}]+)?\}/ig, (_match, logId, suffix) => {
      return '${' + (this.normalizedLogicalIdPath(logId) || logId) + (suffix || '') + '}';
    });
  }

  public normalizedLogicalIdPath(logicalId: string): string | undefined {
    // if we have a path in the map, return it
    const path = this.logicalToPathMap[logicalId];
    return path ? normalizePath(path) : undefined;

    /**
     * Path is supposed to start with "/stack-name". If this is the case (i.e. path has more than
     * two components, we remove the first part. Otherwise, we just use the full path.
     * @param p
     */
    function normalizePath(p: string) {
      if (p.startsWith('/')) {
        p = p.substr(1);
      }

      let parts = p.split('/');
      if (parts.length > 1) {
        parts = parts.slice(1);

        // remove the last component if it's "Resource" or "Default" (if we have more than a single component)
        if (parts.length > 1) {
          const last = parts[parts.length - 1];
          if (last === 'Resource' || last === 'Default') {
            parts = parts.slice(0, parts.length - 1);
          }
        }

        p = parts.join('/');
      }
      return p;
    }
  }
}

const ADDITION = colors.green('[+]');
const CONTEXT = colors.grey('[ ]');
const UPDATE = colors.yellow('[~]');
const REMOVAL = colors.red('[-]');

export class BasicDifferenceFormatter extends DifferenceFormatter {
  public formatDifferences() {
    if (this.templateDiff.awsTemplateFormatVersion || this.templateDiff.transform || this.templateDiff.description) {
      this.printSectionHeader('Template');
      this.formatDifference('AWSTemplateFormatVersion', 'AWSTemplateFormatVersion', this.templateDiff.awsTemplateFormatVersion);
      this.formatDifference('Transform', 'Transform', this.templateDiff.transform);
      this.formatDifference('Description', 'Description', this.templateDiff.description);
      this.printSectionFooter();
    }

    this.formatSecurityChanges();

    this.formatSection('Parameters', 'Parameter', this.templateDiff.parameters);
    this.formatSection('Metadata', 'Metadata', this.templateDiff.metadata);
    this.formatSection('Mappings', 'Mapping', this.templateDiff.mappings);
    this.formatSection('Conditions', 'Condition', this.templateDiff.conditions);
    this.formatSection('Resources', 'Resource', this.templateDiff.resources, this.formatResourceDifference.bind(this));
    this.formatSection('Outputs', 'Output', this.templateDiff.outputs);
    this.formatSection('Other Changes', 'Unknown', this.templateDiff.unknown);
  }

  public formatSecurityChanges() {
    if (!this.templateDiff.iamChanges.hasChanges && !this.templateDiff.securityGroupChanges.hasChanges) { return; }
    this.formatIamChanges(this.templateDiff.iamChanges);
    this.formatSecurityGroupChanges(this.templateDiff.securityGroupChanges);

    this.warning('(NOTE: There may be security-related changes not in this list. See https://github.com/aws/aws-cdk/issues/1299)');
    this.printSectionFooter();
  }

  public print(fmt: string, ...args: any[]) {
    this.stream.write(colors.white(format(fmt, ...args)) + '\n');
  }

  public warning(fmt: string, ...args: any[]) {
    this.stream.write(colors.yellow(format(fmt, ...args)) + '\n');
  }

  public formatSection<V, T extends Difference<V>>(
    title: string,
    entryType: string,
    collection: DifferenceCollection<V, T>,
    formatter: (type: string, id: string, diff: T) => void = this.formatDifference.bind(this)) {

    if (collection.differenceCount === 0) {
      return;
    }

    this.printSectionHeader(title);
    collection.forEachDifference((id, diff) => formatter(entryType, id, diff));
    this.printSectionFooter();
  }

  public printSectionHeader(title: string) {
    this.print(colors.underline(colors.bold(title)));
  }

  public printSectionFooter() {
    this.print('');
  }

  /**
   * Print a simple difference for a given named entity.
   *
   * @param logicalId the name of the entity that is different.
   * @param diff the difference to be rendered.
   */
  public formatDifference(type: string, logicalId: string, diff: Difference<any> | undefined) {
    if (!diff || !diff.isDifferent) { return; }

    let value;

    const oldValue = this.formatValue(diff.oldValue, colors.red);
    const newValue = this.formatValue(diff.newValue, colors.green);
    if (diff.isAddition) {
      value = newValue;
    } else if (diff.isUpdate) {
      value = `${oldValue} to ${newValue}`;
    } else if (diff.isRemoval) {
      value = oldValue;
    }

    this.print(`${this.formatPrefix(diff)} ${colors.cyan(type)} ${this.formatLogicalId(logicalId)}: ${value}`);
  }

  /**
   * Print a resource difference for a given logical ID.
   *
   * @param logicalId the logical ID of the resource that changed.
   * @param diff      the change to be rendered.
   */
  public formatResourceDifference(_type: string, logicalId: string, diff: ResourceDifference) {
    if (!diff.isDifferent) { return; }

    const resourceType = diff.isRemoval ? diff.oldResourceType : diff.newResourceType;

    // eslint-disable-next-line max-len
    this.print(`${this.formatPrefix(diff)} ${this.formatValue(resourceType, colors.cyan)} ${this.formatLogicalId(logicalId)} ${this.formatImpact(diff.changeImpact)}`);

    if (diff.isUpdate) {
      const differenceCount = diff.differenceCount;
      let processedCount = 0;
      diff.forEachDifference((_, name, values) => {
        processedCount += 1;
        this.formatTreeDiff(name, values, processedCount === differenceCount);
      });
    }
  }

  public formatPrefix<T>(diff: Difference<T>) {
    if (diff.isAddition) { return ADDITION; }
    if (diff.isUpdate) { return UPDATE; }
    if (diff.isRemoval) { return REMOVAL; }
    return colors.white('[?]');
  }

  /**
   * @param value the value to be formatted.
   * @param color the color to be used.
   *
   * @returns the formatted string, with color applied.
   */
  public formatValue(value: any, color: (str: string) => string) {
    if (value == null) { return undefined; }
    if (typeof value === 'string') { return color(value); }
    return color(JSON.stringify(value));
  }

  /**
   * @param impact the impact to be formatted
   * @returns a user-friendly, colored string representing the impact.
   */
  public formatImpact(impact: ResourceImpact) {
    switch (impact) {
      case ResourceImpact.MAY_REPLACE:
        return colors.italic(colors.yellow('may be replaced'));
      case ResourceImpact.WILL_REPLACE:
        return colors.italic(colors.bold(colors.red('replace')));
      case ResourceImpact.WILL_DESTROY:
        return colors.italic(colors.bold(colors.red('destroy')));
      case ResourceImpact.WILL_ORPHAN:
        return colors.italic(colors.yellow('orphan'));
      case ResourceImpact.WILL_UPDATE:
      case ResourceImpact.WILL_CREATE:
      case ResourceImpact.NO_CHANGE:
        return ''; // no extra info is gained here
    }
  }

  /**
   * Renders a tree of differences under a particular name.
   * @param name    the name of the root of the tree.
   * @param diff    the difference on the tree.
   * @param last    whether this is the last node of a parent tree.
   */
  public formatTreeDiff(name: string, diff: Difference<any>, last: boolean) {
    let additionalInfo = '';
    if (isPropertyDifference(diff)) {
      if (diff.changeImpact === ResourceImpact.MAY_REPLACE) {
        additionalInfo = ' (may cause replacement)';
      } else if (diff.changeImpact === ResourceImpact.WILL_REPLACE) {
        additionalInfo = ' (requires replacement)';
      }
    }
    this.print(' %s─ %s %s%s', last ? '└' : '├', this.changeTag(diff.oldValue, diff.newValue), name, additionalInfo);
    return this.formatObjectDiff(diff.oldValue, diff.newValue, ` ${last ? ' ' : '│'}`);
  }

  /**
   * Renders the difference between two objects, looking for the differences as deep as possible,
   * and rendering a tree graph of the path until the difference is found.
   *
   * @param oldObject  the old object.
   * @param newObject  the new object.
   * @param linePrefix a prefix (indent-like) to be used on every line.
   */
  public formatObjectDiff(oldObject: any, newObject: any, linePrefix: string) {
    if ((typeof oldObject !== typeof newObject) || Array.isArray(oldObject) || typeof oldObject === 'string' || typeof oldObject === 'number') {
      if (oldObject !== undefined && newObject !== undefined) {
        if (typeof oldObject === 'object' || typeof newObject === 'object') {
          const oldStr = JSON.stringify(oldObject, null, 2);
          const newStr = JSON.stringify(newObject, null, 2);
          const diff = _diffStrings(oldStr, newStr, this.context);
          for (let i = 0 ; i < diff.length ; i++) {
            this.print('%s   %s %s', linePrefix, i === 0 ? '└─' : '  ', diff[i]);
          }
        } else {
          this.print('%s   ├─ %s %s', linePrefix, REMOVAL, this.formatValue(oldObject, colors.red));
          this.print('%s   └─ %s %s', linePrefix, ADDITION, this.formatValue(newObject, colors.green));
        }
      } else if (oldObject !== undefined /* && newObject === undefined */) {
        this.print('%s   └─ %s', linePrefix, this.formatValue(oldObject, colors.red));
      } else /* if (oldObject === undefined && newObject !== undefined) */ {
        this.print('%s   └─ %s', linePrefix, this.formatValue(newObject, colors.green));
      }
      return;
    }
    const keySet = new Set(Object.keys(oldObject));
    Object.keys(newObject).forEach(k => keySet.add(k));
    const keys = new Array(...keySet).filter(k => !deepEqual(oldObject[k], newObject[k])).sort();
    const lastKey = keys[keys.length - 1];
    for (const key of keys) {
      const oldValue = oldObject[key];
      const newValue = newObject[key];
      const treePrefix = key === lastKey ? '└' : '├';
      if (oldValue !== undefined && newValue !== undefined) {
        this.print('%s   %s─ %s %s:', linePrefix, treePrefix, this.changeTag(oldValue, newValue), colors.blue(`.${key}`));
        this.formatObjectDiff(oldValue, newValue, `${linePrefix}   ${key === lastKey ? ' ' : '│'}`);
      } else if (oldValue !== undefined /* && newValue === undefined */) {
        this.print('%s   %s─ %s Removed: %s', linePrefix, treePrefix, REMOVAL, colors.blue(`.${key}`));
      } else /* if (oldValue === undefined && newValue !== undefined */ {
        this.print('%s   %s─ %s Added: %s', linePrefix, treePrefix, ADDITION, colors.blue(`.${key}`));
      }
    }
  }

  /**
   * @param oldValue the old value of a difference.
   * @param newValue the new value of a difference.
   *
   * @returns a tag to be rendered in the diff, reflecting whether the difference
   *      was an ADDITION, UPDATE or REMOVAL.
   */
  public changeTag(oldValue: any | undefined, newValue: any | undefined): string {
    if (oldValue !== undefined && newValue !== undefined) {
      return UPDATE;
    } else if (oldValue !== undefined /* && newValue === undefined*/) {
      return REMOVAL;
    } else /* if (oldValue === undefined && newValue !== undefined) */ {
      return ADDITION;
    }
  }

  public formatLogicalId(logicalId: string) {
    // if we have a path in the map, return it
    const normalized = this.normalizedLogicalIdPath(logicalId);

    if (normalized) {
      return `${normalized} ${colors.gray(logicalId)}`;
    }

    return logicalId;
  }

  public formatIamChanges(changes: IamChanges) {
    if (!changes.hasChanges) { return; }

    if (changes.statements.hasChanges) {
      this.printSectionHeader('IAM Statement Changes');
      this.print(formatTable(this.deepSubstituteBracedLogicalIds(changes.summarizeStatements()), this.stream.columns));
    }

    if (changes.managedPolicies.hasChanges) {
      this.printSectionHeader('IAM Policy Changes');
      this.print(formatTable(this.deepSubstituteBracedLogicalIds(changes.summarizeManagedPolicies()), this.stream.columns));
    }
  }

  public formatSecurityGroupChanges(changes: SecurityGroupChanges) {
    if (!changes.hasChanges) { return; }

    this.printSectionHeader('Security Group Changes');
    this.print(formatTable(this.deepSubstituteBracedLogicalIds(changes.summarize()), this.stream.columns));
  }
}

/**
 * A patch as returned by ``diff.structuredPatch``.
 */
interface Patch {
  /**
   * Hunks in the patch.
   */
  hunks: ReadonlyArray<PatchHunk>;
}

/**
 * A hunk in a patch produced by ``diff.structuredPatch``.
 */
interface PatchHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

/**
 * Creates a unified diff of two strings.
 *
 * @param oldStr  the "old" version of the string.
 * @param newStr  the "new" version of the string.
 * @param context the number of context lines to use in arbitrary JSON diff.
 *
 * @returns an array of diff lines.
 */
function _diffStrings(oldStr: string, newStr: string, context: number): string[] {
  const patch: Patch = structuredPatch(null, null, oldStr, newStr, null, null, { context });
  const result = new Array<string>();
  for (const hunk of patch.hunks) {
    result.push(colors.magenta(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`));
    const baseIndent = _findIndent(hunk.lines);
    for (const line of hunk.lines) {
      // Don't care about termination newline.
      if (line === '\\ No newline at end of file') { continue; }
      const marker = line.charAt(0);
      const text = line.slice(1 + baseIndent);
      switch (marker) {
        case ' ':
          result.push(`${CONTEXT} ${text}`);
          break;
        case '+':
          result.push(colors.bold(`${ADDITION} ${colors.green(text)}`));
          break;
        case '-':
          result.push(colors.bold(`${REMOVAL} ${colors.red(text)}`));
          break;
        default:
          throw new Error(`Unexpected diff marker: ${marker} (full line: ${line})`);
      }
    }
  }
  return result;

  function _findIndent(lines: string[]): number {
    let indent = Number.MAX_SAFE_INTEGER;
    for (const line of lines) {
      for (let i = 1 ; i < line.length ; i++) {
        if (line.charAt(i) !== ' ') {
          indent = indent > i - 1 ? i - 1 : indent;
          break;
        }
      }
    }
    return indent;
  }
}
