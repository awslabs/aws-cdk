import { makeExecutable, shell } from './os';
import { CDKBuildOptions, CompilerOverrides, currentPackageJson, packageCompiler } from './package-info';
import { Timers } from './timer';

/**
 * Run the compiler on the current package
 */
export async function compileCurrentPackage(options: CDKBuildOptions, timers: Timers, compilers: CompilerOverrides = {}): Promise<void> {
  const env = options.env;
  await shell(packageCompiler(compilers, options), { timers, env });

  // Find files in bin/ that look like they should be executable, and make them so.
  const scripts = currentPackageJson().bin || {};
  for (const script of Object.values(scripts) as any) {
    await makeExecutable(script);
  }
}
