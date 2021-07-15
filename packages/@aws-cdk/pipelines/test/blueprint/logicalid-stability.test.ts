import '@aws-cdk/assert-internal/jest';
import { Stack } from '@aws-cdk/core';
import { mkdict } from '../../lib/private/javascript';
import { PIPELINE_ENV, TestApp, LegacyTestGitHubNpmPipeline, ModernTestGitHubNpmPipeline, MegaAssetsApp, stackTemplate } from '../testhelpers';

let legacyApp: TestApp;
let modernApp: TestApp;

let legacyPipelineStack: Stack;
let modernPipelineStack: Stack;

beforeEach(() => {
  legacyApp = new TestApp({
    context: {
      '@aws-cdk/core:newStyleStackSynthesis': '1',
      'aws:cdk:enable-path-metadata': true,
    },
  });
  modernApp = new TestApp({
    context: {
      '@aws-cdk/core:newStyleStackSynthesis': '1',
      'aws:cdk:enable-path-metadata': true,
    },
  });
  legacyPipelineStack = new Stack(legacyApp, 'PipelineStack', { env: PIPELINE_ENV });
  modernPipelineStack = new Stack(modernApp, 'PipelineStack', { env: PIPELINE_ENV });
});

afterEach(() => {
  legacyApp.cleanup();
  modernApp.cleanup();
});

test('stateful or nameable resources have the same logicalID between old and new API', () => {
  const legacyPipe = new LegacyTestGitHubNpmPipeline(legacyPipelineStack, 'Cdk');
  legacyPipe.addApplicationStage(new MegaAssetsApp(legacyPipelineStack, 'MyApp', {
    numAssets: 2,
  }));

  const modernPipe = new ModernTestGitHubNpmPipeline(modernPipelineStack, 'Cdk', {
    crossAccountKeys: true,
  });
  modernPipe.addStage(new MegaAssetsApp(modernPipelineStack, 'MyApp', {
    numAssets: 2,
  }));

  const legacyTemplate = stackTemplate(legacyPipelineStack).template;
  const modernTemplate = stackTemplate(modernPipelineStack).template;

  const legacyStateful = filterR(legacyTemplate.Resources, isStateful);
  const modernStateful = filterR(modernTemplate.Resources, isStateful);

  expect(mapR(modernStateful, typeOfRes)).toEqual(mapR(legacyStateful, typeOfRes));
});

test('nameable resources have the same names between old and new API', () => {
  const legacyPipe = new LegacyTestGitHubNpmPipeline(legacyPipelineStack, 'Cdk', {
    pipelineName: 'asdf',
  });
  legacyPipe.addApplicationStage(new MegaAssetsApp(legacyPipelineStack, 'MyApp', {
    numAssets: 2,
  }));

  const modernPipe = new ModernTestGitHubNpmPipeline(modernPipelineStack, 'Cdk', {
    pipelineName: 'asdf',
    crossAccountKeys: true,
  });
  modernPipe.addStage(new MegaAssetsApp(modernPipelineStack, 'MyApp', {
    numAssets: 2,
  }));

  const legacyTemplate = stackTemplate(legacyPipelineStack).template;
  const modernTemplate = stackTemplate(modernPipelineStack).template;

  const legacyNamed = filterR(legacyTemplate.Resources, hasName);
  const modernNamed = filterR(modernTemplate.Resources, hasName);

  expect(mapR(modernNamed, nameProps)).toEqual(mapR(legacyNamed, nameProps));
});


const STATEFUL_TYPES = [
  // Holds state
  'AWS::S3::Bucket',
  'AWS::KMS::Key',
  'AWS::KMS::Alias',
  // Can be physical-named so will be impossible to replace
  'AWS::CodePipeline::Pipeline',
  'AWS::CodeBuild::Project',
];

function filterR(resources: Record<string, Resource>, fn: (x: Resource) => boolean): Record<string, Resource> {
  return mkdict(Object.entries(resources).filter(([, resource]) => fn(resource)));
}

function mapR<A>(resources: Record<string, Resource>, fn: (x: Resource) => A): Record<string, A> {
  return mkdict(Object.entries(resources).map(([lid, resource]) => [lid, fn(resource)] as const));
}

function typeOfRes(r: Resource) {
  return r.Type;
}

function isStateful(r: Resource) {
  return STATEFUL_TYPES.includes(r.Type);
}

function nameProps(r: Resource) {
  return Object.entries(r.Properties).filter(([prop, _]) =>
    // Don't care about policy names
    prop.endsWith('Name') && prop !== 'PolicyName');
}

function hasName(r: Resource) {
  return nameProps(r).length > 0;
}

interface Resource {
  readonly Type: string;
  readonly Properties: Record<string, any>;
  readonly Metadata?: Record<string, any>;
}