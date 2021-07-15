/**
 * Get access to construct internals that we need but got removed from the Stages PR.
 */
import * as path from 'path';
import { App, Stage } from '@aws-cdk/core';
import * as cxapi from '@aws-cdk/cx-api';
import { Construct, IConstruct, Node } from 'constructs';

// eslint-disable-next-line no-duplicate-imports,import/order
import { Construct as CoreConstruct } from '@aws-cdk/core';

export function appOf(construct: IConstruct): App {
  const root = Node.of(construct).root;

  if (!App.isApp(root)) {
    throw new Error(`Construct must be created under an App, but is not: ${Node.of(construct).path}`);
  }

  return root;
}

export function assemblyBuilderOf(stage: Stage): cxapi.CloudAssemblyBuilder {
  return (stage as any)._assemblyBuilder;
}

/**
 * Return the relative path from the app assembly to the scope's (nested) assembly
 */
export function embeddedAsmPath(scope: IConstruct) {
  const appAsmRoot = assemblyBuilderOf(appOf(scope)).outdir;
  const stage = Stage.of(scope) ?? appOf(scope);
  const stageAsmRoot = assemblyBuilderOf(stage).outdir;
  return path.relative(appAsmRoot, stageAsmRoot) || '.';
}

/**
 * Determine the directory where the cloud assembly will be written, for use in a BuildSpec
 */
export function cloudAssemblyBuildSpecDir(scope: IConstruct) {
  return assemblyBuilderOf(appOf(scope)).outdir;
}

export function obtainScope(parent: Construct, id: string): Construct {
  const existing = Node.of(parent).tryFindChild(id);
  if (existing) {
    return existing as Construct;
  }
  return new CoreConstruct(parent, id);
}