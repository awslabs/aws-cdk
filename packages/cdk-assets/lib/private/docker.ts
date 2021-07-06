import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { cdkCredentialsConfig, obtainEcrCredentials } from './docker-credentials';
import { Logger, shell, ShellOptions } from './shell';

interface BuildOptions {
  readonly directory: string;

  /**
   * Tag the image with a given repoName:tag combination
   */
  readonly tag: string;
  readonly target?: string;
  readonly file?: string;
  readonly buildArgs?: Record<string, string>;
}

export interface DockerCredentialsConfig {
  readonly version: string;
  readonly domainCredentials: Record<string, DockerDomainCredentials>;
}

export interface DockerDomainCredentials {
  readonly secretsManagerSecretId?: string;
  readonly ecrRepository?: string;
}

export class Docker {

  private configDir: string | undefined = undefined;

  constructor(private readonly logger?: Logger) {
  }

  /**
   * Whether an image with the given tag exists
   */
  public async exists(tag: string) {
    try {
      await this.execute(['inspect', tag], { quiet: true });
      return true;
    } catch (e) {
      if (e.code !== 'PROCESS_FAILED' || e.exitCode !== 1) { throw e; }
      return false;
    }
  }

  public async build(options: BuildOptions) {
    const buildCommand = [
      'build',
      ...flatten(Object.entries(options.buildArgs || {}).map(([k, v]) => ['--build-arg', `${k}=${v}`])),
      '--tag', options.tag,
      ...options.target ? ['--target', options.target] : [],
      ...options.file ? ['--file', options.file] : [],
      '.',
    ];
    await this.execute(buildCommand, { cwd: options.directory });
  }

  /**
   * Get credentials from ECR and run docker login
   */
  public async login(ecr: AWS.ECR) {
    const credentials = await obtainEcrCredentials(ecr);

    // Use --password-stdin otherwise docker will complain. Loudly.
    await this.execute(['login',
      '--username', credentials.username,
      '--password-stdin',
      credentials.endpoint], {
      input: credentials.password,

      // Need to quiet otherwise Docker will complain
      // 'WARNING! Your password will be stored unencrypted'
      // doesn't really matter since it's a token.
      quiet: true,
    });
  }

  public async tag(sourceTag: string, targetTag: string) {
    await this.execute(['tag', sourceTag, targetTag]);
  }

  public async push(tag: string) {
    await this.execute(['push', tag]);
  }

  /**
   * If a CDK Docker Credentials file exists, creates a new Docker config directory.
   * Sets up `docker-credential-cdk-assets` to be the credential helper for each domain in the CDK config.
   * All future commands (e.g., `build`, `push`) will use this config.
   *
   * See https://docs.docker.com/engine/reference/commandline/login/#credential-helpers for more details on cred helpers.
   *
   * @returns true if CDK config was found and configured, false otherwise
   */
  public configureCdkCredentials(): boolean {
    const config = cdkCredentialsConfig();
    if (!config) { return false; }

    this.configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdkDockerConfig'));

    const domains = Object.keys(config.domainCredentials);
    const credHelpers = domains.reduce((map: Record<string, string>, domain) => {
      map[domain] = 'cdk-assets'; // Use docker-credential-cdk-assets for this domain
      return map;
    }, {});
    fs.writeFileSync(path.join(this.configDir, 'config.json'), JSON.stringify({ credHelpers }), { encoding: 'utf-8' });

    return true;
  }

  /**
   * Removes any configured Docker config directory.
   * All future commands (e.g., `build`, `push`) will use the default config.
   *
   * This is useful after calling `configureCdkCredentials` to reset to default credentials.
   */
  public resetAuthPlugins() {
    this.configDir = undefined;
  }

  private async execute(args: string[], options: ShellOptions = {}) {
    const configArgs = this.configDir ? ['--config', this.configDir] : [];

    try {
      await shell(['docker', ...configArgs, ...args], { logger: this.logger, ...options });
    } catch (e) {
      if (e.code === 'ENOENT') {
        throw new Error('Unable to execute \'docker\' in order to build a container asset. Please install \'docker\' and try again.');
      }
      throw e;
    }
  }
}

function flatten(x: string[][]) {
  return Array.prototype.concat([], ...x);
}
