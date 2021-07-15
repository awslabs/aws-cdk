import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecr from '@aws-cdk/aws-ecr';
import * as iam from '@aws-cdk/aws-iam';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import { Fn } from '@aws-cdk/core';

/**
 * Represents credentials used to access a Docker registry.
 */
export abstract class DockerCredential {
  /**
   * Creates a DockerCredential for DockerHub.
   * Convenience method for `fromCustomRegistry('index.docker.io', opts)`.
   */
  public static dockerHub(secret: secretsmanager.ISecret, opts: ExternalDockerCredentialOptions = {}): DockerCredential {
    return new ExternalDockerCredential('index.docker.io', secret, opts);
  }

  /**
   * Creates a DockerCredential for a registry, based on its domain name (e.g., 'www.example.com').
   */
  public static customRegistry(
    registryDomain: string,
    secret: secretsmanager.ISecret,
    opts: ExternalDockerCredentialOptions = {}): DockerCredential {
    return new ExternalDockerCredential(registryDomain, secret, opts);
  }

  /**
   * Creates a DockerCredential for one or more ECR repositories.
   *
   * NOTE - All ECR repositories in the same account and region share a domain name
   * (e.g., 0123456789012.dkr.ecr.eu-west-1.amazonaws.com), and can only have one associated
   * set of credentials (and DockerCredential). Attempting to associate one set of credentials
   * with one ECR repo and another with another ECR repo in the same account and region will
   * result in failures when using these credentials in the pipeline.
   */
  public static ecr(repositories: ecr.IRepository[], opts?: EcrDockerCredentialOptions): DockerCredential {
    return new EcrDockerCredential(repositories, opts ?? {});
  }

  constructor(protected readonly usages?: DockerCredentialUsage[]) { }

  /**
   * Determines if this credential is relevant to the input usage.
   * @internal
   */
  public _applicableForUsage(usage: DockerCredentialUsage) {
    return !this.usages || this.usages.includes(usage);
  }

  /**
   * Grant read-only access to the registry credentials.
   * This grants read access to any secrets, and pull access to any repositories.
   */
  public abstract grantRead(grantee: iam.IGrantable, usage: DockerCredentialUsage): void;

  /**
   * Creates and returns the credential configuration, to be used by `cdk-assets`
   * to support the `docker-credential-cdk-assets` tool for `docker login`.
   * @internal
   */
  public abstract _renderCdkAssetsConfig(): DockerCredentialCredentialSource
}

/** Options for defining credentials for a Docker Credential */
export interface ExternalDockerCredentialOptions {
  /**
   * The name of the JSON field of the secret which contains the user/login name.
   * @default 'username'
   */
  readonly secretUsernameField?: string;
  /**
   * The name of the JSON field of the secret which contains the secret/password.
   * @default 'secret'
   */
  readonly secretPasswordField?: string;
  /**
   * An IAM role to assume prior to accessing the secret.
   * @default - none. The current execution role will be used.
   */
  readonly assumeRole?: iam.IRole
  /**
   * Defines which stages of the pipeline should be granted access to these credentials.
   * @default - all relevant stages (synth, self-update, asset publishing) are granted access.
   */
  readonly usages?: DockerCredentialUsage[];
}

/** Options for defining access for a Docker Credential composed of ECR repos */
export interface EcrDockerCredentialOptions {
  /**
   * An IAM role to assume prior to accessing the secret.
   * @default - none. The current execution role will be used.
   */
  readonly assumeRole?: iam.IRole
  /**
   * Defines which stages of the pipeline should be granted access to these credentials.
   * @default - all relevant stages (synth, self-update, asset publishing) are granted access.
   */
  readonly usages?: DockerCredentialUsage[];
}

/** Defines which stages of a pipeline require the specified credentials */
export enum DockerCredentialUsage {
  /** Synth/Build */
  SYNTH = 'SYNTH',
  /** Self-update */
  SELF_UPDATE = 'SELF_UPDATE',
  /** Asset publishing */
  ASSET_PUBLISHING = 'ASSET_PUBLISHING',
};

/** DockerCredential defined by registry domain and a secret */
class ExternalDockerCredential extends DockerCredential {
  constructor(
    private readonly registryDomain: string,
    private readonly secret: secretsmanager.ISecret,
    private readonly opts: ExternalDockerCredentialOptions) {
    super(opts.usages);
  }

  public grantRead(grantee: iam.IGrantable, usage: DockerCredentialUsage) {
    if (!this._applicableForUsage(usage)) { return; }

    if (this.opts.assumeRole) {
      grantee.grantPrincipal.addToPrincipalPolicy(new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [this.opts.assumeRole.roleArn],
      }));
    }
    const role = this.opts.assumeRole ?? grantee;
    this.secret.grantRead(role);
  }

  public _renderCdkAssetsConfig(): DockerCredentialCredentialSource {
    return {
      [this.registryDomain]: {
        secretsManagerSecretId: this.secret.secretArn,
        secretsUsernameField: this.opts.secretUsernameField,
        secretsPasswordField: this.opts.secretPasswordField,
        assumeRoleArn: this.opts.assumeRole?.roleArn,
      },
    };
  }
}

/** DockerCredential defined by a set of ECR repositories in the same account & region */
class EcrDockerCredential extends DockerCredential {
  public readonly registryDomain: string;

  constructor(private readonly repositories: ecr.IRepository[], private readonly opts: EcrDockerCredentialOptions) {
    super(opts.usages);

    if (repositories.length === 0) {
      throw new Error('must supply at least one `ecr.IRepository` to create an `EcrDockerCredential`');
    }
    this.registryDomain = Fn.select(0, Fn.split('/', repositories[0].repositoryUri));
  }

  public grantRead(grantee: iam.IGrantable, usage: DockerCredentialUsage) {
    if (!this._applicableForUsage(usage)) { return; }

    if (this.opts.assumeRole) {
      grantee.grantPrincipal.addToPrincipalPolicy(new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [this.opts.assumeRole.roleArn],
      }));
    }
    const role = this.opts.assumeRole ?? grantee;
    this.repositories.forEach(repo => repo.grantPull(role));
  }

  public _renderCdkAssetsConfig(): DockerCredentialCredentialSource {
    return {
      [this.registryDomain]: {
        ecrRepository: true,
        assumeRoleArn: this.opts.assumeRole?.roleArn,
      },
    };
  }
}

/** Format for the CDK assets config. See the cdk-assets `DockerDomainCredentialSource` */
interface DockerCredentialCredentialSource {
  readonly secretsManagerSecretId?: string;
  readonly secretsUsernameField?: string;
  readonly secretsPasswordField?: string;
  readonly ecrRepository?: boolean;
  readonly assumeRoleArn?: string;
}

/**
 * Creates a set of OS-specific buildspec installation commands for setting up the given
 * registries and associated credentials.
 *
 * @param registries - Registries to configure credentials for. It is an error to provide
 * multiple registries for the same domain.
 * @param osType - (optional) Defaults to Linux.
 * @returns An array of commands to configure cdk-assets to use these credentials.
 */
export function dockerCredentialsInstallCommands(
  usage: DockerCredentialUsage,
  registries?: DockerCredential[],
  osType?: ec2.OperatingSystemType | 'both'): string[] {

  const relevantRegistries = (registries ?? []).filter(reg => reg._applicableForUsage(usage));
  if (!relevantRegistries || relevantRegistries.length === 0) { return []; }

  const domainCredentials = relevantRegistries.reduce(function (map: Record<string, any>, registry) {
    Object.assign(map, registry._renderCdkAssetsConfig());
    return map;
  }, {});
  const cdkAssetsConfigFile = {
    version: '1.0',
    domainCredentials,
  };

  const windowsCommands = [
    'mkdir %USERPROFILE%\\.cdk',
    `echo '${JSON.stringify(cdkAssetsConfigFile)}' > %USERPROFILE%\\.cdk\\cdk-docker-creds.json`,
  ];

  const linuxCommands = [
    'mkdir $HOME/.cdk',
    `echo '${JSON.stringify(cdkAssetsConfigFile)}' > $HOME/.cdk/cdk-docker-creds.json`,
  ];

  if (osType === 'both') {
    return [
      // These tags are magic and will be stripped when rendering the project
      ...windowsCommands.map(c => `!WINDOWS!${c}`),
      ...linuxCommands.map(c => `!LINUX!${c}`),
    ];
  } else if (osType === ec2.OperatingSystemType.WINDOWS) {
    return windowsCommands;
  } else {
    return linuxCommands;
  }
}
