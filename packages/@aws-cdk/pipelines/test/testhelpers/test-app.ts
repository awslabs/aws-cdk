/* eslint-disable import/no-extraneous-dependencies */
import '@aws-cdk/assert-internal/jest';
import * as fs from 'fs';
import * as path from 'path';
import * as ecr_assets from '@aws-cdk/aws-ecr-assets';
import * as s3 from '@aws-cdk/aws-s3';
import * as s3_assets from '@aws-cdk/aws-s3-assets';
import { App, AppProps, Environment, CfnOutput, Stage, StageProps, Stack, StackProps } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { assemblyBuilderOf } from '../../lib/private/construct-internals';

export const PIPELINE_ENV: Environment = {
  account: '123pipeline',
  region: 'us-pipeline',
};

export class TestApp extends App {
  constructor(props?: Partial<AppProps>) {
    super({
      context: {
        '@aws-cdk/core:newStyleStackSynthesis': '1',
      },
      stackTraces: false,
      autoSynth: false,
      treeMetadata: false,
      ...props,
    });
  }

  public stackArtifact(stackName: string | Stack) {
    if (typeof stackName !== 'string') {
      stackName = stackName.stackName;
    }

    this.synth();
    const supportStack = this.node.findAll().filter(Stack.isStack).find(s => s.stackName === stackName);
    expect(supportStack).not.toBeUndefined();
    return supportStack;
  }

  public cleanup() {
    rimraf(assemblyBuilderOf(this).outdir);
  }
}


export class OneStackApp extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);

    new BucketStack(this, 'Stack');
  }
}

export class AppWithOutput extends Stage {
  public readonly theOutput: CfnOutput;

  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);

    const stack = new BucketStack(this, 'Stack');
    this.theOutput = new CfnOutput(stack, 'MyOutput', { value: stack.bucket.bucketName });
  }
}

export class TwoStackApp extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);

    const stack2 = new BucketStack(this, 'Stack2');
    const stack1 = new BucketStack(this, 'Stack1');

    stack2.addDependency(stack1);
  }
}

/**
 * Three stacks where the last one depends on the earlier 2
 */
export class ThreeStackApp extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);

    const stack1 = new BucketStack(this, 'Stack1');
    const stack2 = new BucketStack(this, 'Stack2');
    const stack3 = new BucketStack(this, 'Stack3');

    stack3.addDependency(stack1);
    stack3.addDependency(stack2);
  }
}

/**
 * A test stack
 *
 * It contains a single Bucket. Such robust. Much uptime.
 */
export class BucketStack extends Stack {
  public readonly bucket: s3.IBucket;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    this.bucket = new s3.Bucket(this, 'Bucket');
  }
}


/**
 * rm -rf reimplementation, don't want to depend on an NPM package for this
 */
export function rimraf(fsPath: string) {
  try {
    const isDir = fs.lstatSync(fsPath).isDirectory();

    if (isDir) {
      for (const file of fs.readdirSync(fsPath)) {
        rimraf(path.join(fsPath, file));
      }
      fs.rmdirSync(fsPath);
    } else {
      fs.unlinkSync(fsPath);
    }
  } catch (e) {
    // We will survive ENOENT
    if (e.code !== 'ENOENT') { throw e; }
  }
}

export function stackTemplate(stack: Stack) {
  const stage = Stage.of(stack);
  if (!stage) { throw new Error('stack not in a Stage'); }
  return stage.synth().getStackArtifact(stack.artifactId);
}

export class StageWithStackOutput extends Stage {
  public readonly output: CfnOutput;

  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);
    const stack = new BucketStack(this, 'Stack');

    this.output = new CfnOutput(stack, 'BucketName', {
      value: stack.bucket.bucketName,
    });
  }
}

export class FileAssetApp extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);
    const stack = new Stack(this, 'Stack');
    new s3_assets.Asset(stack, 'Asset', {
      path: path.join(__dirname, 'assets', 'test-file-asset.txt'),
    });
  }
}

export class TwoFileAssetsApp extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);
    const stack = new Stack(this, 'Stack');
    new s3_assets.Asset(stack, 'Asset1', {
      path: path.join(__dirname, 'assets', 'test-file-asset.txt'),
    });
    new s3_assets.Asset(stack, 'Asset2', {
      path: path.join(__dirname, 'assets', 'test-file-asset-two.txt'),
    });
  }
}

export class DockerAssetApp extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);
    const stack = new Stack(this, 'Stack');
    new ecr_assets.DockerImageAsset(stack, 'Asset', {
      directory: path.join(__dirname, 'assets', 'test-docker-asset'),
    });
  }
}

export interface MegaAssetsAppProps extends StageProps {
  readonly numAssets: number;
}

// Creates a mix of file and image assets, up to a specified count
export class MegaAssetsApp extends Stage {
  constructor(scope: Construct, id: string, props: MegaAssetsAppProps) {
    super(scope, id, props);
    const stack = new Stack(this, 'Stack');

    let assetCount = 0;
    for (; assetCount < props.numAssets / 2; assetCount++) {
      new s3_assets.Asset(stack, `Asset${assetCount}`, {
        path: path.join(__dirname, 'assets', 'test-file-asset.txt'),
        assetHash: `FileAsset${assetCount}`,
      });
    }
    for (; assetCount < props.numAssets; assetCount++) {
      new ecr_assets.DockerImageAsset(stack, `Asset${assetCount}`, {
        directory: path.join(__dirname, 'assets', 'test-docker-asset'),
        extraHash: `FileAsset${assetCount}`,
      });
    }
  }
}

export class PlainStackApp extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);
    new BucketStack(this, 'Stack');
  }
}


