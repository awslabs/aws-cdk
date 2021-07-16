/**
 * This file is executed as part of the 'prebuild' script for this package,
 * and is responsible for copying the modules from the main monorepo,
 * and performing any required changes (there are many!)
 * so that they can be released as individual V2 modules.
 */

const lerna_project = require('@lerna/project');
const path = require('path');
const fs = require('fs-extra');
const awsCdkMigration = require('aws-cdk-migration');

const phase = process.argv[2];
if (phase !== 'phase1' && phase !== 'phase2') {
    throw new Error('Usage: node gen.js phase1|phase2');
}

// we do the translation in 2 phases:
//   1. Copy all of the files, and remove all dependencies from the packages besides other experimental ones.
//     Save the dependencies in keys like 'tmp_dependencies', 'tmp_devDependencies', etc. in the package.json files of the copied modules.
//   2. Run 'lerna bootstrap'.
//   3. In phase 2, bring back the dependencies using the 'tmp_' keys saved in the files.
// We have to do it this way, because otherwise 'lerna bootstrap' would fail on the main monorepo packages like cdk-build-tools.
if (phase === 'phase1') {
    copyFilesRemovingDependencies();
} else {
    bringBackDependencies();
}

function copyFilesRemovingDependencies() {
    const project = new lerna_project.Project('..'); // there is a lerna.json in this directory
    const packages = project.getPackagesSync();
    const unstablePackages = getUnstablePackages(packages);
    for (const pkg of packages) {
        if (!packageIsUnstable(pkg)) {
            continue;
        }

        const srcDir = pkg.location;
        const packageUnscopedName = `${pkg.name.substring('@aws-cdk/'.length)}`;
        const destDir = path.join(__dirname, packageUnscopedName);
        fs.mkdirp(destDir);

        copyOrTransformFiles(pkg, srcDir, destDir, unstablePackages, [
            // list of files to _not_ copy from the V1 package root
            // .gitignore is not on the list, because pkglint checks it
            'dist',
            'node_modules',
            'coverage',
            '.nyc_output',
            'nyc.config.js',
            '.jsii',
            'tsconfig.json',
            'tsconfig.tsbuildinfo',
        ]);
    }
}

function copyOrTransformFiles(pkg, srcDir, destDir, unstablePackages, ignoredFiles) {
    const sourceFiles = fs.readdirSync(srcDir);
    for (const sourceFileName of sourceFiles) {
        if (shouldIgnoreFile(sourceFileName)) {
            continue;
        }

        const source = path.join(srcDir, sourceFileName);
        const destination = path.join(destDir, sourceFileName);

        let fileProcessed = false;
        if (sourceFileName === 'package.json') {
            const srcPackageJson = fs.readJsonSync(source);
            if (srcPackageJson.name === pkg.name) {
                const pkgUnscopedName = `${pkg.name.substring('@aws-cdk/'.length)}`;

                const destPkgName = `@aws-cdk-lib-alpha/${pkgUnscopedName}`;
                srcPackageJson.name = destPkgName;
                srcPackageJson.repository.directory = `packages/@aws-cdk-lib/${pkgUnscopedName}`;

                // JSII targets
                const jsiiTargets = srcPackageJson.jsii.targets;
                jsiiTargets.dotnet.namespace = jsiiTargets.dotnet.namespace.replace(
                    /^Amazon\.CDK\./, 'Amazon.CDK.Alpha.');
                jsiiTargets.java.package = jsiiTargets.java.package.replace(
                    /^software\.amazon\.awscdk\./, 'software.amazon.awscdk.alpha.');
                jsiiTargets.java.maven.artifactId = jsiiTargets.java.maven.artifactId.startsWith('cdk-')
                    ? jsiiTargets.java.maven.artifactId.replace(/cdk-/, 'cdk-alpha.')
                    : 'cdk-alpha.aws-' + jsiiTargets.java.maven.artifactId;
                jsiiTargets.python.distName = jsiiTargets.python.distName.replace(
                    /^aws-cdk\./, 'aws-cdk.alpha.');
                jsiiTargets.python.module = jsiiTargets.python.module.replace(
                    /^aws_cdk\./, 'aws_cdk.alpha.');

                // disable awslint (some rules are hard-coded to @aws-cdk/core)
                srcPackageJson.awslint = {
                    exclude: ['*:*']
                };

                // add a pkglint exemption for the 'package name = dir name' rule
                const pkglint = srcPackageJson.pkglint || {};
                pkglint.exclude = [
                    ...(pkglint.exclude || []),
                    'naming/package-matches-directory',
                    // the experimental packages need the "real" assert dependency
                    'assert/assert-dependency',
                ];
                srcPackageJson.pkglint = pkglint;

                const unstableDependencies = {};
                // regular dependencies
                const dependencies = srcPackageJson.dependencies || {};
                const bundledDependencies = srcPackageJson.bundledDependencies || [];
                for (const dependency of Object.keys(dependencies)) {
                    // all 'regular' dependencies on unstable modules will be converted to
                    // a pair of devDependency on '0.0.0' and peerDependency on '^0.0.0',
                    // and the package will have no regular dependencies anymore...
                    if (unstablePackages[dependency]) {
                        unstableDependencies[unstablePackages[dependency]] = '0.0.0';
                    }
                    // ...other than third-party dependencies, which are in bundledDependencies
                    if (bundledDependencies.indexOf(dependency) === -1) {
                        delete dependencies[dependency];
                    }
                }

                // devDependencies
                const unstableDevDependencies = {};
                const devDependencies = srcPackageJson.devDependencies || {};
                for (const devDependency of Object.keys(devDependencies)) {
                    if (devDependency.startsWith('@aws-cdk/')) {
                        delete devDependencies[devDependency];
                    }
                    if (unstablePackages[devDependency]) {
                        unstableDevDependencies[unstablePackages[devDependency]] = '0.0.0';
                    }
                }
                devDependencies['@aws-cdk/assert'] = '0.0.0';
                devDependencies['aws-cdk-lib'] = '0.0.0';
                devDependencies['constructs'] = '^10.0.0';
                // we save the devDependencies in a temporary key in package.json
                srcPackageJson.tmp_devDependencies = {
                    ...devDependencies,
                    ...unstableDevDependencies,
                    ...unstableDependencies,
                };
                srcPackageJson.devDependencies = {
                    ...unstableDevDependencies,
                    ...unstableDependencies,
                };

                // peer dependencies
                srcPackageJson.tmp_peerDependencies = {
                    'aws-cdk-lib': '^0.0.0',
                    'constructs': '^10.0.0',
                    ...(Object.keys(unstableDependencies)
                        .reduce((acc, unstableDependency) => {
                            acc[unstableDependency] = '^0.0.0';
                            return acc;
                        }, {})),
                };
                srcPackageJson.peerDependencies = undefined;

                // turn off the L1 generation, which uses @aws-cdk/ modules
                delete srcPackageJson.scripts.gen;

                fileProcessed = true;
                fs.writeJsonSync(destination, srcPackageJson, {spaces: 2});
            }
        } else if (sourceFileName === '.gitignore') {
            // ignore everything, otherwise there are uncommitted files present in testing,
            // because the module's .gitignore file has entries like !.eslintrc.js
            fileProcessed = true;
            const gitIgnoreContents = fs.readFileSync(source);
            fs.outputFileSync(destination, Buffer.concat([gitIgnoreContents, Buffer.from('\n*\n')]));
        } else if (sourceFileName === '.eslintrc.js') {
            // Our ESLint configuration prevents importing libraries not in 'dependencies',
            // which is against our philosophy for experimental modules (which use peerDependencies).
            // Given that, remove that rule from the ESLint configuration of that module
            fileProcessed = true;
            const esLintRcLines = fs.readFileSync(source).toString().split('\n');
            const resultFileLines = [];
            for (const line of esLintRcLines) {
                resultFileLines.push(line);
                // put our new line right after the parserOptions.project setting line,
                // as some files export a copy of this object,
                // in which case putting it at the end doesn't work
                if (line.startsWith('baseConfig.parserOptions.project')) {
                    resultFileLines.push("delete baseConfig.rules['import/no-extraneous-dependencies'];");
                }
            }
            fs.outputFileSync(destination, resultFileLines.join('\n'));
        } else if (sourceFileName.endsWith('.ts') && !sourceFileName.endsWith('.d.ts')) {
            fileProcessed = true;
            const sourceCode = fs.readFileSync(source).toString();
            const sourceCodeOutput = awsCdkMigration.rewriteImports(sourceCode, sourceFileName, {
                customModules: unstablePackages,
            });
            fs.outputFileSync(destination, sourceCodeOutput);
        }

        if (fileProcessed) {
            continue;
        }

        const stat = fs.statSync(source);
        if (stat.isDirectory()) {
            // we only ignore files on the top level in the package,
            // as some subdirectories we do want to copy over
            // (for example, synthetics contains a node_modules/ in the test/ directory
            // that is needed for running the tests)
            copyOrTransformFiles(pkg, source, destination, unstablePackages, []);
        } else {
            fs.copy(source, destination);
        }
    }

    function shouldIgnoreFile(name) {
        return ignoredFiles.indexOf(name) !== -1;
    }
}

function getUnstablePackages(packages) {
    return packages
        .filter(packageIsUnstable)
        .reduce((acc, pkg) => {
            acc[pkg.name] = pkg.name.replace(/^@aws-cdk\//, '@aws-cdk-lib-alpha/');
            return acc;
        }, {});
}

function packageIsUnstable(pkg) {
    // allow modules to decide themselves whether they should be packaged separately
    const separateModule = pkg.get('separate-module');
    if (separateModule !== undefined) {
        return separateModule;
    }

    const maturity = pkg.get('maturity');
    if (maturity !== 'experimental' && maturity !== 'developer-preview') {
        return false;
    }
    // we're only interested in '@aws-cdk/' packages,
    // and those that are JSII-enabled (so no @aws-cdk/assert)
    return pkg.name.startsWith('@aws-cdk/') && !!pkg.get('jsii');
}

function bringBackDependencies() {
    const project = new lerna_project.Project();
    const separatePackages = project.getPackagesSync();
    for (const separatePkg of separatePackages) {
        const pkgJson = fs.readJsonSync(separatePkg.manifestLocation);
        pkgJson.devDependencies = pkgJson.tmp_devDependencies;
        pkgJson.peerDependencies = pkgJson.tmp_peerDependencies;
        pkgJson.tmp_devDependencies = undefined;
        pkgJson.tmp_peerDependencies = undefined;
        fs.writeJsonSync(separatePkg.manifestLocation, pkgJson, {spaces: 2});
    }
}
