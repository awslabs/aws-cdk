import { TagType } from './cfn-resource';
import { CfnTag } from './cfn-tag';

interface Tag {
  key: string;
  value: string;
  priority: number;

  /**
   * @default true
   */
  applyToLaunchedInstances?: boolean;
}

interface CfnAsgTag {
  key: string;
  value: string;
  propagateAtLaunch: boolean;
}

interface StackTag {
  Key: string;
  Value: string;
}
/**
 * Interface for converter between CloudFormation and internal tag representations
 */
interface ITagFormatter {
  /**
   * Format the given tags as CloudFormation tags
   */
  formatTags(tags: Tag[]): any;

  /**
   * Parse the CloudFormation tag representation into internal representation
   *
   * Use the given priority.
   */
  parseTags(cfnPropertyTags: any, priority: number): Tag[];
}

/**
 * Standard tags are a list of { key, value } objects
 */
class StandardFormatter implements ITagFormatter {
  public parseTags(cfnPropertyTags: any, priority: number): Tag[] {
    if (!Array.isArray(cfnPropertyTags)) {
      throw new Error(`Invalid tag input expected array of {key, value} have ${JSON.stringify(cfnPropertyTags)}`);
    }

    const tags: Tag[] = [];
    for (const tag of cfnPropertyTags) {
      if (tag.key === undefined || tag.value === undefined) {
        throw new Error(`Invalid tag input expected {key, value} have ${JSON.stringify(tag)}`);
      }
      // using interp to ensure Token is now string
      tags.push({
        key: `${tag.key}`,
        value: `${tag.value}`,
        priority,
      });
    }
    return tags;
  }

  public formatTags(tags: Tag[]): any {
    const cfnTags: CfnTag[] = [];
    for (const tag of tags) {
      cfnTags.push({
        key: tag.key,
        value: tag.value,
      });
    }
    return cfnTags.length === 0 ? undefined : cfnTags;
  }
}

/**
 * ASG tags are a list of { key, value, propagateAtLaunch } objects
 */
class AsgFormatter implements ITagFormatter {
  public parseTags(cfnPropertyTags: any, priority: number): Tag[] {
    const tags: Tag[] = [];
    if (!Array.isArray(cfnPropertyTags)) {
      throw new Error(`Invalid tag input expected array of {key, value, propagateAtLaunch} have ${JSON.stringify(cfnPropertyTags)}`);
    }

    for (const tag of cfnPropertyTags) {
      if (tag.key === undefined ||
        tag.value === undefined ||
        tag.propagateAtLaunch === undefined) {
        throw new Error(`Invalid tag input expected {key, value, propagateAtLaunch} have ${JSON.stringify(tag)}`);
      }
      // using interp to ensure Token is now string
      tags.push({
        key: `${tag.key}`,
        value: `${tag.value}`,
        priority,
        applyToLaunchedInstances: !!tag.propagateAtLaunch,
      });
    }

    return tags;
  }

  public formatTags(tags: Tag[]): any {
    const cfnTags: CfnAsgTag[] = [];
    for (const tag of tags) {
      cfnTags.push({
        key: tag.key,
        value: tag.value,
        propagateAtLaunch: tag.applyToLaunchedInstances !== false,
      });
    }
    return cfnTags.length === 0 ? undefined : cfnTags;
  }
}

/**
 * Some CloudFormation constructs use a { key: value } map for tags
 */
class MapFormatter implements ITagFormatter {
  public parseTags(cfnPropertyTags: any, priority: number): Tag[] {
    const tags: Tag[] = [];
    if (Array.isArray(cfnPropertyTags) || typeof(cfnPropertyTags) !== 'object') {
      throw new Error(`Invalid tag input expected map of {key: value} have ${JSON.stringify(cfnPropertyTags)}`);
    }

    for (const [key, value] of Object.entries(cfnPropertyTags)) {
      tags.push({
        key,
        value: `${value}`,
        priority,
      });
    }

    return tags;
  }

  public formatTags(tags: Tag[]): any {
    const cfnTags: {[key: string]: string} = {};
    for (const tag of tags) {
      cfnTags[`${tag.key}`] = `${tag.value}`;
    }
    return Object.keys(cfnTags).length === 0 ? undefined : cfnTags;
  }
}

/**
 * StackTags are of the format { Key: key, Value: value }
 */
class KeyValueFormatter implements ITagFormatter {
  public parseTags(keyValueTags: any, priority: number): Tag[] {
    const tags: Tag[] = [];
    for (const key in keyValueTags) {
      if (keyValueTags.hasOwnProperty(key)) {
        const value = keyValueTags[key];
        tags.push({
          key,
          value,
          priority,
        });
      }
    }
    return tags;
  }
  public formatTags(unformattedTags: Tag[]): any {
    const tags: StackTag[] = [];
    unformattedTags.forEach(tag => {
      tags.push({
        Key: tag.key,
        Value: tag.value,
      });
    });
    return tags;
  }
}

class NoFormat implements ITagFormatter {
  public parseTags(_cfnPropertyTags: any): Tag[] {
    return [];
  }
  public formatTags(_tags: Tag[]): any {
    return undefined;
  }
}


let _tagFormattersCache: {[key: string]: ITagFormatter} | undefined;

/**
 * Access tag formatters table
 *
 * In a function because we're in a load cycle with cfn-resource that defines `TagType`.
 */
function TAG_FORMATTERS(): {[key: string]: ITagFormatter} {
  return _tagFormattersCache ?? (_tagFormattersCache = {
    [TagType.AUTOSCALING_GROUP]: new AsgFormatter(),
    [TagType.STANDARD]: new StandardFormatter(),
    [TagType.MAP]: new MapFormatter(),
    [TagType.KEY_VALUE]: new KeyValueFormatter(),
    [TagType.NOT_TAGGABLE]: new NoFormat(),
  });
};

/**
 * Interface to implement tags.
 */
export interface ITaggable {
  /**
   * TagManager to set, remove and format tags
   */
  readonly tags: TagManager;
}

/**
 * Options to configure TagManager behavior
 */
export interface TagManagerOptions {
  /**
   * The name of the property in CloudFormation for these tags
   *
   * Normally this is `tags`, but Cognito UserPool uses UserPoolTags
   *
   * @default "tags"
   */
  readonly tagPropertyName?: string;
}

/**
 * TagManager facilitates a common implementation of tagging for Constructs.
 */
export class TagManager {
  /**
   * Check whether the given construct is Taggable
   */
  public static isTaggable(construct: any): construct is ITaggable {
    return (construct as any).tags !== undefined;
  }

  /**
   * The property name for tag values
   *
   * Normally this is `tags` but some resources choose a different name. Cognito
   * UserPool uses UserPoolTags
   */
  public readonly tagPropertyName: string;

  private readonly tags = new Map<string, Tag>();
  private readonly priorities = new Map<string, number>();
  private readonly tagFormatter: ITagFormatter;
  private readonly resourceTypeName: string;
  private readonly initialTagPriority = 50;

  constructor(tagType: TagType, resourceTypeName: string, tagStructure?: any, options: TagManagerOptions = { }) {
    this.resourceTypeName = resourceTypeName;
    this.tagFormatter = TAG_FORMATTERS()[tagType];
    if (tagStructure !== undefined) {
      this._setTag(...this.tagFormatter.parseTags(tagStructure, this.initialTagPriority));
    }
    this.tagPropertyName = options.tagPropertyName || 'tags';
  }

  /**
   * Adds the specified tag to the array of tags
   *
   */
  public setTag(key: string, value: string, priority = 0, applyToLaunchedInstances = true): void {
    // This method mostly exists because we don't want to expose the 'Tag' type used (it will be confusing
    // to users).
    this._setTag({ key, value, priority, applyToLaunchedInstances });
  }

  /**
   * Removes the specified tag from the array if it exists
   *
   * @param key The tag to remove
   * @param priority The priority of the remove operation
   */
  public removeTag(key: string, priority: number): void {
    if (priority >= (this.priorities.get(key) || 0)) {
      this.tags.delete(key);
      this.priorities.set(key, priority);
    }
  }

  /**
   * Renders tags into the proper format based on TagType
   */
  public renderTags(): any {
    return this.tagFormatter.formatTags(this.sortedTags);
  }

  /**
   * Render the tags in a readable format
   */
  public tagValues(): Record<string, string> {
    const ret: Record<string, string> = {};
    for (const tag of this.sortedTags) {
      ret[tag.key] = tag.value;
    }
    return ret;
  }

  /**
   * Determine if the aspect applies here
   *
   * Looks at the include and exclude resourceTypeName arrays to determine if
   * the aspect applies here
   */
  public applyTagAspectHere(include?: string[], exclude?: string[]) {
    if (exclude && exclude.length > 0 && exclude.indexOf(this.resourceTypeName) !== -1) {
      return false;
    }
    if (include && include.length > 0 && include.indexOf(this.resourceTypeName) === -1) {
      return false;
    }

    return true;
  }

  /**
   * Returns true if there are any tags defined
   */
  public hasTags(): boolean {
    return this.tags.size > 0;
  }

  private _setTag(...tags: Tag[]) {
    for (const tag of tags) {
      if (tag.priority >= (this.priorities.get(tag.key) || 0)) {
        this.tags.set(tag.key, tag);
        this.priorities.set(tag.key, tag.priority);
      }
    }
  }

  private get sortedTags() {
    return Array.from(this.tags.values()).sort((a, b) => a.key.localeCompare(b.key));
  }
}
