import * as childProcess from 'child_process';
import * as path from 'path';
import * as cxapi from '@aws-cdk/cx-api';
import * as colors from 'colors/safe';
import * as fs from 'fs-extra';
import * as semver from 'semver';
import { error, print, warning } from './logging';
import { cdkHomeDir } from './util/directories';
import { versionNumber } from './version';

export type InvokeHook = (targetDirectory: string) => Promise<void>;

/* eslint-disable @typescript-eslint/no-var-requires */ // Packages don't have @types module
// eslint-disable-next-line @typescript-eslint/no-require-imports
const camelCase = require('camelcase');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const decamelize = require('decamelize');

/**
 * Initialize a CDK package in the current directory
 */
export async function cliInit(type?: string, language?: string, canUseNetwork = true, generateOnly = false, workDir = process.cwd()) {
  if (!type && !language) {
    await printAvailableTemplates();
    return;
  }

  type = type || 'default'; // "default" is the default type (and maps to "app")

  const template = (await availableInitTemplates()).find(t => t.hasName(type!));
  if (!template) {
    await printAvailableTemplates(language);
    throw new Error(`Unknown init template: ${type}`);
  }
  if (!language && template.languages.length === 1) {
    language = template.languages[0];
    warning(`No --language was provided, but '${type}' supports only '${language}', so defaulting to --language=${language}`);
  }
  if (!language) {
    print(`Available languages for ${colors.green(type)}: ${template.languages.map(l => colors.blue(l)).join(', ')}`);
    throw new Error('No language was selected');
  }

  await initializeProject(template, language, canUseNetwork, generateOnly, workDir);
}

/**
 * Returns the name of the Python executable for this OS
 */
function pythonExecutable() {
  let python = 'python3';
  if (process.platform === 'win32') {
    python = 'python';
  }
  return python;
}
const INFO_DOT_JSON = 'info.json';

export class InitTemplate {
  public static async fromName(templatesDir: string, name: string) {
    const basePath = path.join(templatesDir, name);
    const languages = (await listDirectory(basePath)).filter(f => f !== INFO_DOT_JSON);
    const info = await fs.readJson(path.join(basePath, INFO_DOT_JSON));
    return new InitTemplate(basePath, name, languages, info);
  }

  public readonly description: string;
  public readonly aliases = new Set<string>();

  constructor(
    private readonly basePath: string,
    public readonly name: string,
    public readonly languages: string[],
    info: any) {
    this.description = info.description;
    for (const alias of info.aliases || []) {
      this.aliases.add(alias);
    }
  }

  /**
   * @param name the name that is being checked
   * @returns ``true`` if ``name`` is the name of this template or an alias of it.
   */
  public hasName(name: string): boolean {
    return name === this.name || this.aliases.has(name);
  }

  /**
   * Creates a new instance of this ``InitTemplate`` for a given language to a specified folder.
   *
   * @param language    the language to instantiate this template with
   * @param targetDirectory the directory where the template is to be instantiated into
   */
  public async install(language: string, targetDirectory: string) {
    if (this.languages.indexOf(language) === -1) {
      error(`The ${colors.blue(language)} language is not supported for ${colors.green(this.name)} `
          + `(it supports: ${this.languages.map(l => colors.blue(l)).join(', ')})`);
      throw new Error(`Unsupported language: ${language}`);
    }
    const sourceDirectory = path.join(this.basePath, language);
    const hookTempDirectory = path.join(targetDirectory, 'tmp');
    await fs.mkdir(hookTempDirectory);
    await this.installFiles(sourceDirectory, targetDirectory, {
      name: decamelize(path.basename(path.resolve(targetDirectory))),
    });
    await this.applyFutureFlags(targetDirectory);
    await this.invokeHooks(hookTempDirectory, targetDirectory);
    await fs.remove(hookTempDirectory);
  }

  private async installFiles(sourceDirectory: string, targetDirectory: string, project: ProjectInfo) {
    for (const file of await fs.readdir(sourceDirectory)) {
      const fromFile = path.join(sourceDirectory, file);
      const toFile = path.join(targetDirectory, this.expand(file, project));
      if ((await fs.stat(fromFile)).isDirectory()) {
        await fs.mkdir(toFile);
        await this.installFiles(fromFile, toFile, project);
        continue;
      } else if (file.match(/^.*\.template\.[^.]+$/)) {
        await this.installProcessed(fromFile, toFile.replace(/\.template(\.[^.]+)$/, '$1'), project);
        continue;
      } else if (file.match(/^.*\.hook\.(d.)?[^.]+$/)) {
        await this.installProcessed(fromFile, path.join(targetDirectory, 'tmp', file), project);
        continue;
      } else {
        await fs.copy(fromFile, toFile);
      }
    }
  }

  /**
   * @summary   Invoke any javascript hooks that exist in the template.
   * @description Sometimes templates need more complex logic than just replacing tokens. A 'hook' is
   *        any file that ends in .hook.js. It should export a single function called "invoke"
   *        that accepts a single string parameter. When the template is installed, each hook
   *        will be invoked, passing the target directory as the only argument. Hooks are invoked
   *        in lexical order.
   */
  private async invokeHooks(sourceDirectory: string, targetDirectory: string) {
    const files = await fs.readdir(sourceDirectory);
    files.sort(); // Sorting allows template authors to control the order in which hooks are invoked.

    for (const file of files) {
      if (file.match(/^.*\.hook\.js$/)) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const invoke: InvokeHook = require(path.join(sourceDirectory, file)).invoke;
        await invoke(targetDirectory);
      }
    }
  }

  private async installProcessed(templatePath: string, toFile: string, project: ProjectInfo) {
    const template = await fs.readFile(templatePath, { encoding: 'utf-8' });
    await fs.writeFile(toFile, this.expand(template, project));
  }

  private expand(template: string, project: ProjectInfo) {
    const MATCH_VER_BUILD = /\+[a-f0-9]+$/; // Matches "+BUILD" in "x.y.z-beta+BUILD"
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cdkVersion = require('../package.json').version.replace(MATCH_VER_BUILD, '');
    return template.replace(/%name%/g, project.name)
      .replace(/%name\.camelCased%/g, camelCase(project.name))
      .replace(/%name\.PascalCased%/g, camelCase(project.name, { pascalCase: true }))
      .replace(/%cdk-version%/g, cdkVersion)
      .replace(/%cdk-home%/g, cdkHomeDir())
      .replace(/%name\.PythonModule%/g, project.name.replace(/-/g, '_'))
      .replace(/%python-executable%/g, pythonExecutable())
      .replace(/%name\.StackName%/g, project.name.replace(/[^A-Za-z0-9-]/g, '-'));
  }

  /**
   * Adds context variables to `cdk.json` in the generated project directory to
   * enable future behavior for new projects.
   */
  private async applyFutureFlags(projectDir: string) {
    const cdkJson = path.join(projectDir, 'cdk.json');
    if (!await fs.pathExists(cdkJson)) {
      return;
    }

    const futureFlags: {[key: string]: any} = {};
    Object.entries(cxapi.FUTURE_FLAGS)
      .filter(([k, _]) => !cxapi.FUTURE_FLAGS_EXPIRED.includes(k))
      .forEach(([k, v]) => futureFlags[k] = v);

    const config = await fs.readJson(cdkJson);
    config.context = {
      ...config.context,
      ...futureFlags,
    };

    await fs.writeJson(cdkJson, config, { spaces: 2 });
  }
}

interface ProjectInfo {
  /** The value used for %name% */
  readonly name: string;
}

function versionedTemplatesDir(): Promise<string> {
  return new Promise(async resolve => {
    let currentVersion = versionNumber();
    // If the CLI is invoked from source (i.e., developement), rather than from a packaged distribution,
    // the version number will be '0.0.0'. We will (currently) default to the v1 templates in this case.
    if (currentVersion === '0.0.0') {
      currentVersion = '1.0.0';
    }
    const majorVersion = semver.major(currentVersion);
    resolve(path.join(__dirname, 'init-templates', `v${majorVersion}`));
  });
}

export async function availableInitTemplates(): Promise<InitTemplate[]> {
  return new Promise(async resolve => {
    const templatesDir = await versionedTemplatesDir();
    const templateNames = await listDirectory(templatesDir);
    const templates = new Array<InitTemplate>();
    for (const templateName of templateNames) {
      templates.push(await InitTemplate.fromName(templatesDir, templateName));
    }
    resolve(templates);
  });
}
export async function availableInitLanguages(): Promise<string[]> {
  return new Promise(async resolve => {
    const templates = await availableInitTemplates();
    const result = new Set<string>();
    for (const template of templates) {
      for (const language of template.languages) {
        result.add(language);
      }
    }
    resolve([...result]);
  });
}

/**
 * @param dirPath is the directory to be listed.
 * @returns the list of file or directory names contained in ``dirPath``, excluding any dot-file, and sorted.
 */
async function listDirectory(dirPath: string) {
  return (await fs.readdir(dirPath))
    .filter(p => !p.startsWith('.'))
    .sort();
}

export async function printAvailableTemplates(language?: string) {
  print('Available templates:');
  for (const template of await availableInitTemplates()) {
    if (language && template.languages.indexOf(language) === -1) { continue; }
    print(`* ${colors.green(template.name)}: ${template.description}`);
    const languageArg = language ? colors.bold(language)
      : template.languages.length > 1 ? `[${template.languages.map(t => colors.bold(t)).join('|')}]`
        : colors.bold(template.languages[0]);
    print(`   └─ ${colors.blue(`cdk init ${colors.bold(template.name)} --language=${languageArg}`)}`);
  }
}

async function initializeProject(template: InitTemplate, language: string, canUseNetwork: boolean, generateOnly: boolean, workDir: string) {
  await assertIsEmptyDirectory(workDir);
  print(`Applying project template ${colors.green(template.name)} for ${colors.blue(language)}`);
  await template.install(language, workDir);
  if (await fs.pathExists('README.md')) {
    print(colors.green(await fs.readFile('README.md', { encoding: 'utf-8' })));
  }

  if (!generateOnly) {
    await initializeGitRepository(workDir);
    await postInstall(language, canUseNetwork, workDir);
  }

  print('✅ All done!');
}

async function assertIsEmptyDirectory(workDir: string) {
  const files = await fs.readdir(workDir);
  if (files.filter(f => !f.startsWith('.')).length !== 0) {
    throw new Error('`cdk init` cannot be run in a non-empty directory!');
  }
}

async function initializeGitRepository(workDir: string) {
  if (await isInGitRepository(workDir)) { return; }
  print('Initializing a new git repository...');
  try {
    await execute('git', ['init'], { cwd: workDir });
    await execute('git', ['add', '.'], { cwd: workDir });
    await execute('git', ['commit', '--message="Initial commit"', '--no-gpg-sign'], { cwd: workDir });
  } catch (e) {
    warning('Unable to initialize git repository for your project.');
  }
}

async function postInstall(language: string, canUseNetwork: boolean, workDir: string) {
  switch (language) {
    case 'javascript':
      return postInstallJavascript(canUseNetwork, workDir);
    case 'typescript':
      return postInstallTypescript(canUseNetwork, workDir);
    case 'java':
      return postInstallJava(canUseNetwork, workDir);
    case 'python':
      return postInstallPython(workDir);
  }
}

async function postInstallJavascript(canUseNetwork: boolean, cwd: string) {
  return postInstallTypescript(canUseNetwork, cwd);
}

async function postInstallTypescript(canUseNetwork: boolean, cwd: string) {
  const command = 'npm';

  if (!canUseNetwork) {
    warning(`Please run '${command} install'!`);
    return;
  }

  print(`Executing ${colors.green(`${command} install`)}...`);
  try {
    await execute(command, ['install'], { cwd });
  } catch (e) {
    warning(`${command} install failed: ` + e.message);
  }
}

async function postInstallJava(canUseNetwork: boolean, cwd: string) {
  const mvnPackageWarning = 'Please run \'mvn package\'!';
  if (!canUseNetwork) {
    warning(mvnPackageWarning);
    return;
  }

  print('Executing \'mvn package\'');
  try {
    await execute('mvn', ['package'], { cwd });
  } catch (e) {
    warning('Unable to package compiled code as JAR');
    warning(mvnPackageWarning);
  }
}

async function postInstallPython(cwd: string) {
  const python = pythonExecutable();
  warning(`Please run '${python} -m venv .venv'!`);
  print(`Executing ${colors.green('Creating virtualenv...')}`);
  try {
    await execute(python, ['-m venv', '.venv'], { cwd });
  } catch (e) {
    warning('Unable to create virtualenv automatically');
    warning(`Please run '${python} -m venv .venv'!`);
  }
}

/**
 * @param dir a directory to be checked
 * @returns true if ``dir`` is within a git repository.
 */
async function isInGitRepository(dir: string) {
  while (true) {
    if (await fs.pathExists(path.join(dir, '.git'))) { return true; }
    if (isRoot(dir)) { return false; }
    dir = path.dirname(dir);
  }
}

/**
 * @param dir a directory to be checked.
 * @returns true if ``dir`` is the root of a filesystem.
 */
function isRoot(dir: string) {
  return path.dirname(dir) === dir;
}

/**
 * Executes `command`. STDERR is emitted in real-time.
 *
 * If command exits with non-zero exit code, an exceprion is thrown and includes
 * the contents of STDOUT.
 *
 * @returns STDOUT (if successful).
 */
async function execute(cmd: string, args: string[], { cwd }: { cwd: string }) {
  const child = childProcess.spawn(cmd, args, { cwd, shell: true, stdio: ['ignore', 'pipe', 'inherit'] });
  let stdout = '';
  child.stdout.on('data', chunk => stdout += chunk.toString());
  return new Promise<string>((ok, fail) => {
    child.once('error', err => fail(err));
    child.once('exit', status => {
      if (status === 0) {
        return ok(stdout);
      } else {
        process.stderr.write(stdout);
        return fail(new Error(`${cmd} exited with status ${status}`));
      }
    });
  });
}
