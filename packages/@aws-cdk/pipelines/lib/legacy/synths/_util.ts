import * as codebuild from '@aws-cdk/aws-codebuild';

export function copyEnvironmentVariables(...names: string[]): Record<string, codebuild.BuildEnvironmentVariable> {
  const ret: Record<string, codebuild.BuildEnvironmentVariable> = {};
  for (const name of names) {
    if (process.env[name]) {
      ret[name] = { value: process.env[name] };
    }
  }
  return ret;
}

export function filterEmpty(xs: Array<string | undefined>): string[] {
  return xs.filter(x => x) as any;
}