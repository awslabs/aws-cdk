import * as os from 'os';
import * as fs_path from 'path';
import * as fs from 'fs-extra';
import { Tag } from './cdk-toolkit';
import { debug, warning } from './logging';
import * as util from './util';

export type SettingsMap = {[key: string]: any};

export const PROJECT_CONFIG = 'cdk.json';
export const PROJECT_CONTEXT = 'cdk.context.json';
export const USER_DEFAULTS = '~/.cdk.json';

/**
 * If a context value is an object with this key set to a truthy value, it won't be saved to cdk.context.json
 */
export const TRANSIENT_CONTEXT_KEY = '$dontSaveContext';

const CONTEXT_KEY = 'context';

export enum Command {
  LS = 'ls',
  LIST = 'list',
  DIFF = 'diff',
  BOOTSTRAP = 'bootstrap',
  DEPLOY = 'deploy',
  DESTROY = 'destroy',
  SYNTHESIZE = 'synthesize',
  SYNTH = 'synth',
  METADATA = 'metadata',
  INIT = 'init',
  VERSION = 'version',
}

const BUNDLING_COMMANDS = [
  Command.DEPLOY,
  Command.DIFF,
  Command.SYNTH,
  Command.SYNTHESIZE,
];

export type Arguments = {
  readonly _: [Command, ...string[]];
  readonly exclusively?: boolean;
  readonly STACKS?: string[];
  readonly lookups?: boolean;
  readonly [name: string]: unknown;
};

export interface ConfigurationProps {
  /**
   * Configuration passed via command line arguments
   *
   * @default - Nothing passed
   */
  readonly commandLineArguments?: Arguments;

  /**
   * Whether or not to use context from `.cdk.json` in user home directory
   *
   * @default true
   */
  readonly readUserContext?: boolean;
}

/**
 * All sources of settings combined
 */
export class Configuration {
  public settings = new Settings();
  public context = new Context();

  public readonly defaultConfig = new Settings({
    versionReporting: true,
    pathMetadata: true,
    output: 'cdk.out',
  });

  private readonly commandLineArguments: Settings;
  private readonly commandLineContext: Settings;
  private _projectConfig?: Settings;
  private _projectContext?: Settings;
  private loaded = false;

  constructor(private readonly props: ConfigurationProps = {}) {
    this.commandLineArguments = props.commandLineArguments
      ? Settings.fromCommandLineArguments(props.commandLineArguments)
      : new Settings();
    this.commandLineContext = this.commandLineArguments.subSettings([CONTEXT_KEY]).makeReadOnly();
  }

  private get projectConfig() {
    if (!this._projectConfig) {
      throw new Error('#load has not been called yet!');
    }
    return this._projectConfig;
  }

  private get projectContext() {
    if (!this._projectContext) {
      throw new Error('#load has not been called yet!');
    }
    return this._projectContext;
  }

  /**
   * Load all config
   */
  public async load(): Promise<this> {
    const userConfig = await loadAndLog(USER_DEFAULTS);
    this._projectConfig = await loadAndLog(PROJECT_CONFIG);
    this._projectContext = await loadAndLog(PROJECT_CONTEXT);

    const readUserContext = this.props.readUserContext ?? true;

    const contextSources = [
      this.commandLineContext,
      this.projectConfig.subSettings([CONTEXT_KEY]).makeReadOnly(),
      this.projectContext,
    ];
    if (readUserContext) {
      contextSources.push(userConfig.subSettings([CONTEXT_KEY]).makeReadOnly());
    }

    this.context = new Context(...contextSources);

    // Build settings from what's left
    this.settings = this.defaultConfig
      .merge(userConfig)
      .merge(this.projectConfig)
      .merge(this.commandLineArguments)
      .makeReadOnly();

    debug('merged settings:', this.settings.all);

    this.loaded = true;

    return this;
  }

  /**
   * Save the project context
   */
  public async saveContext(): Promise<this> {
    if (!this.loaded) { return this; } // Avoid overwriting files with nothing

    await this.projectContext.save(PROJECT_CONTEXT);

    return this;
  }
}

async function loadAndLog(fileName: string): Promise<Settings> {
  const ret = new Settings();
  await ret.load(fileName);
  if (!ret.empty) {
    debug(fileName + ':', JSON.stringify(ret.all, undefined, 2));
  }
  return ret;
}

/**
 * Class that supports overlaying property bags
 *
 * Reads come from the first property bag that can has the given key,
 * writes go to the first property bag that is not readonly. A write
 * will remove the value from all property bags after the first
 * writable one.
 */
export class Context {
  private readonly bags: Settings[];

  constructor(...bags: Settings[]) {
    this.bags = bags.length > 0 ? bags : [new Settings()];
  }

  public get keys(): string[] {
    return Object.keys(this.all);
  }

  public has(key: string) {
    return this.keys.indexOf(key) > -1;
  }

  public get all(): {[key: string]: any} {
    let ret = new Settings();

    // In reverse order so keys to the left overwrite keys to the right of them
    for (const bag of [...this.bags].reverse()) {
      ret = ret.merge(bag);
    }

    return ret.all;
  }

  public get(key: string): any {
    for (const bag of this.bags) {
      const v = bag.get([key]);
      if (v !== undefined) { return v; }
    }
    return undefined;
  }

  public set(key: string, value: any) {
    for (const bag of this.bags) {
      if (bag.readOnly) { continue; }

      // All bags past the first one have the value erased
      bag.set([key], value);
      value = undefined;
    }
  }

  public unset(key: string) {
    this.set(key, undefined);
  }

  public clear() {
    for (const key of this.keys) {
      this.unset(key);
    }
  }
}

/**
 * A single bag of settings
 */
export class Settings {
  /**
   * Parse Settings out of CLI arguments.
   * @param argv the received CLI arguments.
   * @returns a new Settings object.
   */
  public static fromCommandLineArguments(argv: Arguments): Settings {
    const context = this.parseStringContextListToObject(argv);
    const tags = this.parseStringTagsListToObject(expectStringList(argv.tags));

    // Determine bundling stacks
    let bundlingStacks: string[];
    if (BUNDLING_COMMANDS.includes(argv._[0])) {
    // If we deploy, diff or synth a list of stacks exclusively we skip
    // bundling for all other stacks.
      bundlingStacks = argv.exclusively
        ? argv.STACKS ?? ['*']
        : ['*'];
    } else { // Skip bundling for all stacks
      bundlingStacks = [];
    }

    return new Settings({
      app: argv.app,
      browser: argv.browser,
      context,
      debug: argv.debug,
      tags,
      language: argv.language,
      pathMetadata: argv.pathMetadata,
      assetMetadata: argv.assetMetadata,
      profile: argv.profile,
      plugin: argv.plugin,
      requireApproval: argv.requireApproval,
      toolkitStackName: argv.toolkitStackName,
      toolkitBucket: {
        bucketName: argv.bootstrapBucketName,
        kmsKeyId: argv.bootstrapKmsKeyId,
      },
      versionReporting: argv.versionReporting,
      staging: argv.staging,
      output: argv.output,
      outputsFile: argv.outputsFile,
      progress: argv.progress,
      bundlingStacks,
      lookups: argv.lookups,
    });
  }

  public static mergeAll(...settings: Settings[]): Settings {
    let ret = new Settings();
    for (const setting of settings) {
      ret = ret.merge(setting);
    }
    return ret;
  }

  private static parseStringContextListToObject(argv: Arguments): any {
    const context: any = {};

    for (const assignment of ((argv as any).context || [])) {
      const parts = assignment.split(/=(.*)/, 2);
      if (parts.length === 2) {
        debug('CLI argument context: %s=%s', parts[0], parts[1]);
        if (parts[0].match(/^aws:.+/)) {
          throw new Error(`User-provided context cannot use keys prefixed with 'aws:', but ${parts[0]} was provided.`);
        }
        context[parts[0]] = parts[1];
      } else {
        warning('Context argument is not an assignment (key=value): %s', assignment);
      }
    }
    return context;
  }

  /**
   * Parse tags out of arguments
   *
   * Return undefined if no tags were provided, return an empty array if only empty
   * strings were provided
   */
  private static parseStringTagsListToObject(argTags: string[] | undefined): Tag[] | undefined {
    if (argTags === undefined) { return undefined; }
    if (argTags.length === 0) { return undefined; }
    const nonEmptyTags = argTags.filter(t => t !== '');
    if (nonEmptyTags.length === 0) { return []; }

    const tags: Tag[] = [];

    for (const assignment of nonEmptyTags) {
      const parts = assignment.split('=', 2);
      if (parts.length === 2) {
        debug('CLI argument tags: %s=%s', parts[0], parts[1]);
        tags.push({
          Key: parts[0],
          Value: parts[1],
        });
      } else {
        warning('Tags argument is not an assignment (key=value): %s', assignment);
      }
    }
    return tags.length > 0 ? tags : undefined;
  }

  constructor(private settings: SettingsMap = {}, public readonly readOnly = false) {}

  public async load(fileName: string): Promise<this> {
    if (this.readOnly) {
      throw new Error(`Can't load ${fileName}: settings object is readonly`);
    }
    this.settings = {};

    const expanded = expandHomeDir(fileName);
    if (await fs.pathExists(expanded)) {
      this.settings = await fs.readJson(expanded);
    }

    // See https://github.com/aws/aws-cdk/issues/59
    this.prohibitContextKey('default-account', fileName);
    this.prohibitContextKey('default-region', fileName);
    this.warnAboutContextKey('aws:', fileName);

    return this;
  }

  public async save(fileName: string): Promise<this> {
    const expanded = expandHomeDir(fileName);
    await fs.writeJson(expanded, stripTransientValues(this.settings), { spaces: 2 });
    return this;
  }

  public get all(): any {
    return this.get([]);
  }

  public merge(other: Settings): Settings {
    return new Settings(util.deepMerge(this.settings, other.settings));
  }

  public subSettings(keyPrefix: string[]) {
    return new Settings(this.get(keyPrefix) || {}, false);
  }

  public makeReadOnly(): Settings {
    return new Settings(this.settings, true);
  }

  public clear() {
    if (this.readOnly) {
      throw new Error('Cannot clear(): settings are readonly');
    }
    this.settings = {};
  }

  public get empty(): boolean {
    return Object.keys(this.settings).length === 0;
  }

  public get(path: string[]): any {
    return util.deepClone(util.deepGet(this.settings, path));
  }

  public set(path: string[], value: any): Settings {
    if (this.readOnly) {
      throw new Error(`Can't set ${path}: settings object is readonly`);
    }
    if (path.length === 0) {
      // deepSet can't handle this case
      this.settings = value;
    } else {
      util.deepSet(this.settings, path, value);
    }
    return this;
  }

  public unset(path: string[]) {
    this.set(path, undefined);
  }

  private prohibitContextKey(key: string, fileName: string) {
    if (!this.settings.context) { return; }
    if (key in this.settings.context) {
      // eslint-disable-next-line max-len
      throw new Error(`The 'context.${key}' key was found in ${fs_path.resolve(fileName)}, but it is no longer supported. Please remove it.`);
    }
  }

  private warnAboutContextKey(prefix: string, fileName: string) {
    if (!this.settings.context) { return; }
    for (const contextKey of Object.keys(this.settings.context)) {
      if (contextKey.startsWith(prefix)) {
        // eslint-disable-next-line max-len
        warning(`A reserved context key ('context.${prefix}') key was found in ${fs_path.resolve(fileName)}, it might cause surprising behavior and should be removed.`);
      }
    }
  }
}

function expandHomeDir(x: string) {
  if (x.startsWith('~')) {
    return fs_path.join(os.homedir(), x.substr(1));
  }
  return x;
}

/**
 * Return all context value that are not transient context values
 */
function stripTransientValues(obj: {[key: string]: any}) {
  const ret: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!isTransientValue(value)) {
      ret[key] = value;
    }
  }
  return ret;
}

/**
 * Return whether the given value is a transient context value
 *
 * Values that are objects with a magic key set to a truthy value are considered transient.
 */
function isTransientValue(value: any) {
  return typeof value === 'object' && value !== null && (value as any)[TRANSIENT_CONTEXT_KEY];
}

function expectStringList(x: unknown): string[] | undefined {
  if (x === undefined) { return undefined; }
  if (!Array.isArray(x)) {
    throw new Error(`Expected array, got '${x}'`);
  }
  const nonStrings = x.filter(e => typeof e !== 'string');
  if (nonStrings.length > 0) {
    throw new Error(`Expected list of strings, found ${nonStrings}`);
  }
  return x;
}
