import * as os from 'os';
import * as path from 'path';
import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import * as cxapi from '@aws-cdk/cx-api';
import * as fs from 'fs-extra';
import { Mode, SdkProvider, ISDK } from '../aws-auth';
import { deployStack, DeployStackResult } from '../deploy-stack';
import { DEFAULT_TOOLKIT_STACK_NAME, ToolkitInfo } from '../toolkit-info';
import { BOOTSTRAP_VERSION_OUTPUT, BootstrapEnvironmentOptions, BOOTSTRAP_VERSION_RESOURCE } from './bootstrap-props';

/**
 * A class to hold state around stack bootstrapping
 *
 * This class exists so we can break bootstrapping into 2 phases:
 *
 * ```ts
 * const current = BootstrapStack.lookup(...);
 * // ...
 * current.update(newTemplate, ...);
 * ```
 *
 * And do something in between the two phases (such as look at the
 * current bootstrap stack and doing something intelligent).
 */
export class BootstrapStack {
  public static async lookup(sdkProvider: SdkProvider, environment: cxapi.Environment, toolkitStackName?: string) {
    toolkitStackName = toolkitStackName ?? DEFAULT_TOOLKIT_STACK_NAME;

    const resolvedEnvironment = await sdkProvider.resolveEnvironment(environment);
    const sdk = await sdkProvider.forEnvironment(resolvedEnvironment, Mode.ForWriting);

    const currentToolkitInfo = await ToolkitInfo.lookup(resolvedEnvironment, sdk, toolkitStackName);

    return new BootstrapStack(sdkProvider, sdk, resolvedEnvironment, toolkitStackName, currentToolkitInfo);
  }

  protected constructor(
    private readonly sdkProvider: SdkProvider,
    private readonly sdk: ISDK,
    private readonly resolvedEnvironment: cxapi.Environment,
    private readonly toolkitStackName: string,
    private readonly currentToolkitInfo: ToolkitInfo) {
  }

  public get parameters(): Record<string, string> {
    return this.currentToolkitInfo.found ? this.currentToolkitInfo.bootstrapStack.parameters : {};
  }

  public get terminationProtection() {
    return this.currentToolkitInfo.found ? this.currentToolkitInfo.bootstrapStack.terminationProtection : undefined;
  }

  public async partition(): Promise<string> {
    return (await this.sdk.currentAccount()).partition;
  }

  /**
   * Perform the actual deployment of a bootstrap stack, given a template and some parameters
   */
  public async update(
    template: any,
    parameters: Record<string, string | undefined>,
    options: Omit<BootstrapEnvironmentOptions, 'parameters'>,
  ): Promise<DeployStackResult> {
    const newVersion = bootstrapVersionFromTemplate(template);
    if (this.currentToolkitInfo.found && newVersion < this.currentToolkitInfo.version && !options.force) {
      throw new Error(`Not downgrading existing bootstrap stack from version '${this.currentToolkitInfo.version}' to version '${newVersion}'. Use --force to force.`);
    }

    const outdir = await fs.mkdtemp(path.join(os.tmpdir(), 'cdk-bootstrap'));
    const builder = new cxapi.CloudAssemblyBuilder(outdir);
    const templateFile = `${this.toolkitStackName}.template.json`;
    await fs.writeJson(path.join(builder.outdir, templateFile), template, { spaces: 2 });

    builder.addArtifact(this.toolkitStackName, {
      type: cxschema.ArtifactType.AWS_CLOUDFORMATION_STACK,
      environment: cxapi.EnvironmentUtils.format(this.resolvedEnvironment.account, this.resolvedEnvironment.region),
      properties: {
        templateFile,
        terminationProtection: options.terminationProtection ?? false,
      },
    });

    const assembly = builder.buildAssembly();

    return deployStack({
      stack: assembly.getStackByName(this.toolkitStackName),
      resolvedEnvironment: this.resolvedEnvironment,
      sdk: this.sdk,
      sdkProvider: this.sdkProvider,
      force: options.force,
      roleArn: options.roleArn,
      tags: options.tags,
      execute: options.execute,
      parameters,
      usePreviousParameters: true,
      // Obviously we can't need a bootstrap stack to deploy a bootstrap stack
      toolkitInfo: ToolkitInfo.bootstraplessDeploymentsOnly(this.sdk),
    });
  }
}

export function bootstrapVersionFromTemplate(template: any): number {
  const versionSources = [
    template.Outputs?.[BOOTSTRAP_VERSION_OUTPUT]?.Value,
    template.Resources?.[BOOTSTRAP_VERSION_RESOURCE]?.Properties?.Value,
  ];

  for (const vs of versionSources) {
    if (typeof vs === 'number') { return vs; }
    if (typeof vs === 'string' && !isNaN(parseInt(vs, 10))) {
      return parseInt(vs, 10);
    }
  }
  return 0;
}