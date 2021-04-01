import * as fs from 'fs';
import * as path from 'path';
import * as caseUtils from 'case';
import * as glob from 'glob';
import * as semver from 'semver';
import { LICENSE, NOTICE } from './licensing';
import { PackageJson, ValidationRule } from './packagejson';
import {
  deepGet, deepSet,
  expectDevDependency, expectJSON,
  fileShouldBe, fileShouldBeginWith, fileShouldContain,
  fileShouldNotContain,
  findInnerPackages,
  monoRepoRoot,
} from './util';

const AWS_SERVICE_NAMES = require('./aws-service-official-names.json'); // eslint-disable-line @typescript-eslint/no-require-imports

/**
 * Verify that the package name matches the directory name
 */
export class PackageNameMatchesDirectoryName extends ValidationRule {
  public readonly name = 'naming/package-matches-directory';

  public validate(pkg: PackageJson): void {
    const parts = pkg.packageRoot.split(path.sep);

    const expectedName = parts[parts.length - 2].startsWith('@')
      ? parts.slice(parts.length - 2).join('/')
      : parts[parts.length - 1];

    expectJSON(this.name, pkg, 'name', expectedName);
  }
}

/**
 * Verify that all packages have a description
 */
export class DescriptionIsRequired extends ValidationRule {
  public readonly name = 'package-info/require-description';

  public validate(pkg: PackageJson): void {
    if (!pkg.json.description) {
      pkg.report({ ruleName: this.name, message: 'Description is required' });
    }
  }
}

/**
 * Verify that all packages have a publishConfig with a publish tag set.
 */
export class PublishConfigTagIsRequired extends ValidationRule {
  public readonly name = 'package-info/publish-config-tag';

  public validate(pkg: PackageJson): void {
    if (pkg.json.private) { return; }

    // While v2 is still under development, we publish all v2 packages with the 'next'
    // distribution tag, while still tagging all v1 packages as 'latest'.
    // The one exception is 'aws-cdk-lib', since it's a new package for v2.
    const newV2Packages = ['aws-cdk-lib'];
    const defaultPublishTag = (cdkMajorVersion() === 2 && !newV2Packages.includes(pkg.json.name)) ? 'next' : 'latest';

    if (pkg.json.publishConfig?.tag !== defaultPublishTag) {
      pkg.report({
        ruleName: this.name,
        message: `publishConfig.tag must be ${defaultPublishTag}`,
        fix: (() => {
          const publishConfig = pkg.json.publishConfig ?? {};
          publishConfig.tag = defaultPublishTag;
          pkg.json.publishConfig = publishConfig;
        }),
      });
    }
  }
}

/**
 * Verify cdk.out directory is included in npmignore since we should not be
 * publishing it.
 */
export class CdkOutMustBeNpmIgnored extends ValidationRule {

  public readonly name = 'package-info/npm-ignore-cdk-out';

  public validate(pkg: PackageJson): void {

    const npmIgnorePath = path.join(pkg.packageRoot, '.npmignore');

    if (fs.existsSync(npmIgnorePath)) {

      const npmIgnore = fs.readFileSync(npmIgnorePath);

      if (!npmIgnore.includes('**/cdk.out')) {
        pkg.report({
          ruleName: this.name,
          message: `${npmIgnorePath}: Must exclude **/cdk.out`,
          fix: () => fs.writeFileSync(
            npmIgnorePath,
            `${npmIgnore}\n# exclude cdk artifacts\n**/cdk.out`,
          ),
        });
      }
    }
  }

}

/**
 * Repository must be our GitHub repo
 */
export class RepositoryCorrect extends ValidationRule {
  public readonly name = 'package-info/repository';

  public validate(pkg: PackageJson): void {
    expectJSON(this.name, pkg, 'repository.type', 'git');
    expectJSON(this.name, pkg, 'repository.url', 'https://github.com/aws/aws-cdk.git');
    const pkgDir = path.relative(monoRepoRoot(), pkg.packageRoot);
    expectJSON(this.name, pkg, 'repository.directory', pkgDir);
  }
}

/**
 * Homepage must point to the GitHub repository page.
 */
export class HomepageCorrect extends ValidationRule {
  public readonly name = 'package-info/homepage';

  public validate(pkg: PackageJson): void {
    expectJSON(this.name, pkg, 'homepage', 'https://github.com/aws/aws-cdk');
  }
}

/**
 * The license must be Apache-2.0.
 */
export class License extends ValidationRule {
  public readonly name = 'package-info/license';

  public validate(pkg: PackageJson): void {
    expectJSON(this.name, pkg, 'license', 'Apache-2.0');
  }
}

/**
 * There must be a license file that corresponds to the Apache-2.0 license.
 */
export class LicenseFile extends ValidationRule {
  public readonly name = 'license/license-file';

  public validate(pkg: PackageJson): void {
    fileShouldBe(this.name, pkg, 'LICENSE', LICENSE);
  }
}

/**
 * There must be a NOTICE file.
 */
export class NoticeFile extends ValidationRule {
  public readonly name = 'license/notice-file';

  public validate(pkg: PackageJson): void {
    fileShouldBeginWith(this.name, pkg, 'NOTICE', ...NOTICE.split('\n'));
  }
}

/**
 * NOTICE files must contain 3rd party attributions
 */
export class ThirdPartyAttributions extends ValidationRule {
  public readonly name = 'license/3p-attributions';

  public validate(pkg: PackageJson): void {
    const alwaysCheck = ['monocdk', 'aws-cdk-lib'];
    if (pkg.json.private && !alwaysCheck.includes(pkg.json.name)) {
      return;
    }
    const bundled = pkg.getAllBundledDependencies().filter(dep => !dep.startsWith('@aws-cdk'));
    const attribution = pkg.json.pkglint?.attribution ?? [];
    const noticePath = path.join(pkg.packageRoot, 'NOTICE');
    const lines = fs.existsSync(noticePath)
      ? fs.readFileSync(noticePath, { encoding: 'utf8' }).split('\n')
      : [];

    const re = /^\*\* (\S+)/;
    const attributions = lines.filter(l => re.test(l)).map(l => l.match(re)![1]);

    for (const dep of bundled) {
      if (!attributions.includes(dep)) {
        pkg.report({
          message: `Missing attribution for bundled dependency '${dep}' in NOTICE file.`,
          ruleName: this.name,
        });
      }
    }
    for (const attr of attributions) {
      if (!bundled.includes(attr) && !attribution.includes(attr)) {
        pkg.report({
          message: `Unnecessary attribution found for dependency '${attr}' in NOTICE file. Attribution is determined from package.json (all "bundledDependencies" or the list in "pkglint.attribution")`,
          ruleName: this.name,
        });
      }
    }
  }
}

/**
 * Author must be AWS (as an Organization)
 */
export class AuthorAWS extends ValidationRule {
  public readonly name = 'package-info/author';

  public validate(pkg: PackageJson): void {
    expectJSON(this.name, pkg, 'author.name', 'Amazon Web Services');
    expectJSON(this.name, pkg, 'author.url', 'https://aws.amazon.com');
    expectJSON(this.name, pkg, 'author.organization', true);
  }
}

/**
 * There must be a README.md file.
 */
export class ReadmeFile extends ValidationRule {
  public readonly name = 'package-info/README.md';

  public validate(pkg: PackageJson): void {
    const readmeFile = path.join(pkg.packageRoot, 'README.md');

    const scopes = pkg.json['cdk-build'] && pkg.json['cdk-build'].cloudformation;
    if (!scopes) {
      return;
    }
    if (pkg.packageName === '@aws-cdk/core') {
      return;
    }
    const scope: string = typeof scopes === 'string' ? scopes : scopes[0];
    const serviceName = AWS_SERVICE_NAMES[scope];

    const headline = serviceName && `${serviceName} Construct Library`;

    if (!fs.existsSync(readmeFile)) {
      pkg.report({
        ruleName: this.name,
        message: 'There must be a README.md file at the root of the package',
        fix: () => fs.writeFileSync(
          readmeFile,
          [
            `# ${headline || pkg.json.description}`,
            'This module is part of the[AWS Cloud Development Kit](https://github.com/aws/aws-cdk) project.',
          ].join('\n'),
        ),
      });
    } else if (headline) {
      const requiredFirstLine = `# ${headline}`;
      const [firstLine, ...rest] = fs.readFileSync(readmeFile, { encoding: 'utf8' }).split('\n');
      if (firstLine !== requiredFirstLine) {
        pkg.report({
          ruleName: this.name,
          message: `The title of the README.md file must be "${headline}"`,
          fix: () => fs.writeFileSync(readmeFile, [requiredFirstLine, ...rest].join('\n')),
        });
      }
    }
  }
}

/**
 * All packages must have a "maturity" declaration.
 *
 * The banner in the README must match the package maturity.
 *
 * As a way to seed the settings, if 'maturity' is missing but can
 * be auto-derived from 'stability', that will be the fix (otherwise
 * there is no fix).
 */
export class MaturitySetting extends ValidationRule {
  public readonly name = 'package-info/maturity';

  public validate(pkg: PackageJson): void {
    if (pkg.json.private) {
      // Does not apply to private packages!
      return;
    }

    if (pkg.json.features) {
      // Skip this in favour of the FeatureStabilityRule.
      return;
    }

    let maturity = pkg.json.maturity as string | undefined;
    const stability = pkg.json.stability as string | undefined;
    if (!maturity) {
      let fix;
      if (stability && ['stable', 'deprecated'].includes(stability)) {
        // We can autofix!
        fix = () => pkg.json.maturity = stability;
        maturity = stability;
      }

      pkg.report({
        ruleName: this.name,
        message: `Package is missing "maturity" setting (expected one of ${Object.keys(MATURITY_TO_STABILITY)})`,
        fix,
      });
    }

    if (pkg.json.deprecated && maturity !== 'deprecated') {
      pkg.report({
        ruleName: this.name,
        message: `Package is deprecated, but is marked with maturity "${maturity}"`,
        fix: () => pkg.json.maturity = 'deprecated',
      });
      maturity = 'deprecated';
    }

    const packageLevels = this.determinePackageLevels(pkg);

    const hasL1s = packageLevels.some(level => level === 'l1');
    const hasL2s = packageLevels.some(level => level === 'l2');
    if (hasL2s) {
      // validate that a package that contains L2s does not declare a 'cfn-only' maturity
      if (maturity === 'cfn-only') {
        pkg.report({
          ruleName: this.name,
          message: "Package that contains any L2s cannot declare a 'cfn-only' maturity",
          fix: () => pkg.json.maturity = 'experimental',
        });
      }
    } else if (hasL1s) {
      // validate that a package that contains only L1s declares a 'cfn-only' maturity
      if (maturity !== 'cfn-only') {
        pkg.report({
          ruleName: this.name,
          message: "Package that contains only L1s cannot declare a maturity other than 'cfn-only'",
          fix: () => pkg.json.maturity = 'cfn-only',
        });
      }
    }

    if (maturity) {
      this.validateReadmeHasBanner(pkg, maturity, packageLevels);
    }
  }

  private validateReadmeHasBanner(pkg: PackageJson, maturity: string, levelsPresent: string[]) {
    const badge = this.readmeBadge(maturity, levelsPresent);
    if (!badge) {
      // Somehow, we don't have a badge for this stability level
      return;
    }
    const readmeFile = path.join(pkg.packageRoot, 'README.md');
    if (!fs.existsSync(readmeFile)) {
      // Presence of the file is asserted by another rule
      return;
    }

    const readmeContent = fs.readFileSync(readmeFile, { encoding: 'utf8' });
    const badgeRegex = toRegExp(badge);
    if (!badgeRegex.test(readmeContent)) {
      // Removing a possible old, now invalid stability indication from the README.md before adding a new one
      const [title, ...body] = readmeContent.replace(/<!--BEGIN STABILITY BANNER-->(?:.|\n)+<!--END STABILITY BANNER-->\n+/m, '').split('\n');
      pkg.report({
        ruleName: this.name,
        message: `Missing stability banner for ${maturity} in README.md file`,
        fix: () => fs.writeFileSync(readmeFile, [title, badge, ...body].join('\n')),
      });
    }
  }

  private readmeBadge(maturity: string, levelsPresent: string[]) {
    const bannerContents = levelsPresent
      .map(level => fs.readFileSync(path.join(__dirname, 'banners', `${level}.${maturity}.md`), { encoding: 'utf-8' }).trim())
      .join('\n\n')
      .trim();

    const bannerLines = bannerContents.split('\n').map(s => s.trimRight());

    return [
      '<!--BEGIN STABILITY BANNER-->',
      '',
      '---',
      '',
      ...bannerLines,
      '',
      '---',
      '',
      '<!--END STABILITY BANNER-->',
      '',
    ].join('\n');
  }

  private determinePackageLevels(pkg: PackageJson): string[] {
    // Used to determine L1 by the presence of a .generated.ts file, but that depends
    // on the source having been built. Much more robust to look at the build INSTRUCTIONS
    // to see if this package has L1s.
    const hasL1 = !!pkg.json['cdk-build']?.cloudformation;

    const libFiles = glob.sync('lib/**/*.ts', {
      ignore: 'lib/**/*.d.ts', // ignore the generated TS declaration files
    });
    const hasL2 = libFiles.some(f => !f.endsWith('.generated.ts') && !f.endsWith('index.ts'));

    return [
      ...hasL1 ? ['l1'] : [],
      // If we don't have L1, then at least always paste in the L2 banner
      ...hasL2 || !hasL1 ? ['l2'] : [],
    ];
  }
}

const MATURITY_TO_STABILITY: Record<string, string> = {
  'cfn-only': 'experimental',
  'experimental': 'experimental',
  'developer-preview': 'experimental',
  'stable': 'stable',
  'deprecated': 'deprecated',
};

/**
 * There must be a stability setting, and it must match the package maturity.
 *
 * Maturity setting is leading here (as there are more options than the
 * stability setting), but the stability setting must be present for `jsii`
 * to properly read and encode it into the assembly.
 */
export class StabilitySetting extends ValidationRule {
  public readonly name = 'package-info/stability';

  public validate(pkg: PackageJson): void {
    if (pkg.json.private) {
      // Does not apply to private packages!
      return;
    }

    if (pkg.json.features) {
      // Skip this in favour of the FeatureStabilityRule.
      return;
    }

    const maturity = pkg.json.maturity as string | undefined;
    const stability = pkg.json.stability as string | undefined;

    const expectedStability = maturity ? MATURITY_TO_STABILITY[maturity] : undefined;
    if (!stability || (expectedStability && stability !== expectedStability)) {
      pkg.report({
        ruleName: this.name,
        message: `stability is '${stability}', but based on maturity is expected to be '${expectedStability}'`,
        fix: expectedStability ? (() => pkg.json.stability = expectedStability) : undefined,
      });
    }
  }
}

export class FeatureStabilityRule extends ValidationRule {
  public readonly name = 'package-info/feature-stability';
  private readonly badges: { [key: string]: string } = {
    'Not Implemented': 'https://img.shields.io/badge/not--implemented-black.svg?style=for-the-badge',
    'Experimental': 'https://img.shields.io/badge/experimental-important.svg?style=for-the-badge',
    'Developer Preview': 'https://img.shields.io/badge/developer--preview-informational.svg?style=for-the-badge',
    'Stable': 'https://img.shields.io/badge/stable-success.svg?style=for-the-badge',
  };

  public validate(pkg: PackageJson): void {
    if (pkg.json.private || !pkg.json.features) {
      return;
    }

    const featuresColumnWitdh = Math.max(
      13, // 'CFN Resources'.length
      ...pkg.json.features.map((feat: { name: string; }) => feat.name.length),
    );

    const stabilityBanner: string = [
      '<!--BEGIN STABILITY BANNER-->',
      '',
      '---',
      '',
      `Features${' '.repeat(featuresColumnWitdh - 8)} | Stability`,
      `--------${'-'.repeat(featuresColumnWitdh - 8)}-|-----------${'-'.repeat(Math.max(0, 100 - featuresColumnWitdh - 13))}`,
      ...this.featureEntries(pkg, featuresColumnWitdh),
      '',
      ...this.bannerNotices(pkg),
      '---',
      '',
      '<!--END STABILITY BANNER-->',
      '',
    ].join('\n');

    const readmeFile = path.join(pkg.packageRoot, 'README.md');
    if (!fs.existsSync(readmeFile)) {
      // Presence of the file is asserted by another rule
      return;
    }
    const readmeContent = fs.readFileSync(readmeFile, { encoding: 'utf8' });
    const stabilityRegex = toRegExp(stabilityBanner);
    if (!stabilityRegex.test(readmeContent)) {
      const [title, ...body] = readmeContent.replace(/<!--BEGIN STABILITY BANNER-->(?:.|\n)+<!--END STABILITY BANNER-->\n+/m, '').split('\n');
      pkg.report({
        ruleName: this.name,
        message: 'Stability banner does not match as expected',
        fix: () => fs.writeFileSync(readmeFile, [title, stabilityBanner, ...body].join('\n')),
      });
    }
  }

  private featureEntries(pkg: PackageJson, featuresColumnWitdh: number): string[] {
    const entries: string[] = [];
    if (pkg.json['cdk-build']?.cloudformation) {
      entries.push(`CFN Resources${' '.repeat(featuresColumnWitdh - 13)} | ![Stable](${this.badges.Stable})`);
    }
    pkg.json.features.forEach((feature: { [key: string]: string }) => {
      const badge = this.badges[feature.stability];
      if (!badge) {
        throw new Error(`Unknown stability - ${feature.stability}`);
      }
      entries.push(`${feature.name}${' '.repeat(featuresColumnWitdh - feature.name.length)} | ![${feature.stability}](${badge})`);
    });
    return entries;
  }

  private bannerNotices(pkg: PackageJson): string[] {
    const notices: string[] = [];
    if (pkg.json['cdk-build']?.cloudformation) {
      notices.push(readBannerFile('features-cfn-stable.md'));
      notices.push('');
    }

    const noticeOrder = ['Experimental', 'Developer Preview', 'Stable'];
    const stabilities = pkg.json.features.map((f: { [k: string]: string }) => f.stability);
    const filteredNotices = noticeOrder.filter(v => stabilities.includes(v));
    for (const notice of filteredNotices) {
      if (notices.length !== 0) {
        // This delimiter helps ensure proper parsing & rendering with various parsers
        notices.push('<!-- -->', '');
      }
      const lowerTrainCase = notice.toLowerCase().replace(/\s/g, '-');
      notices.push(readBannerFile(`features-${lowerTrainCase}.md`));
      notices.push('');
    }
    return notices;
  }
}

/**
 * Keywords must contain CDK keywords and be sorted
 */
export class CDKKeywords extends ValidationRule {
  public readonly name = 'package-info/keywords';

  public validate(pkg: PackageJson): void {
    if (!pkg.json.keywords) {
      pkg.report({
        ruleName: this.name,
        message: 'Must have keywords',
        fix: () => { pkg.json.keywords = []; },
      });
    }

    const keywords = pkg.json.keywords || [];

    if (keywords.indexOf('cdk') === -1) {
      pkg.report({
        ruleName: this.name,
        message: 'Keywords must mention CDK',
        fix: () => { pkg.json.keywords.splice(0, 0, 'cdk'); },
      });
    }

    if (keywords.indexOf('aws') === -1) {
      pkg.report({
        ruleName: this.name,
        message: 'Keywords must mention AWS',
        fix: () => { pkg.json.keywords.splice(0, 0, 'aws'); },
      });
    }
  }
}

/**
 * Requires projectReferences to be set in the jsii configuration.
 */
export class JSIIProjectReferences extends ValidationRule {
  public readonly name = 'jsii/project-references';

  public validate(pkg: PackageJson): void {
    if (!isJSII(pkg)) {
      return;
    }

    expectJSON(
      this.name,
      pkg,
      'jsii.projectReferences',
      pkg.json.name !== 'monocdk' && pkg.json.name !== 'aws-cdk-lib',
    );
  }
}

export class NoPeerDependenciesMonocdk extends ValidationRule {
  public readonly name = 'monocdk/no-peer';
  private readonly allowedPeer = ['constructs'];
  private readonly modules = ['monocdk', 'aws-cdk-lib'];

  public validate(pkg: PackageJson): void {
    if (!this.modules.includes(pkg.packageName)) {
      return;
    }

    const peers = Object.keys(pkg.peerDependencies).filter(peer => !this.allowedPeer.includes(peer));
    if (peers.length > 0) {
      pkg.report({
        ruleName: this.name,
        message: `Adding a peer dependency to the monolithic package ${pkg.packageName} is a breaking change, and thus not allowed.
         Added ${peers.join(' ')}`,
      });
    }
  }
}

/**
 * Validates that the same version of `constructs` is used wherever a dependency
 * is specified, so that they must all be udpated at the same time (through an
 * update to this rule).
 *
 * Note: v1 and v2 use different versions respectively.
 */
export class ConstructsVersion extends ValidationRule {
  public static readonly VERSION = cdkMajorVersion() === 2
    ? '10.0.0-pre.5'
    : '^3.3.69';

  public readonly name = 'deps/constructs';

  public validate(pkg: PackageJson) {
    const toCheck = new Array<string>();

    if ('constructs' in pkg.dependencies) {
      toCheck.push('dependencies');
    }
    if ('constructs' in pkg.devDependencies) {
      toCheck.push('devDependencies');
    }
    if ('constructs' in pkg.peerDependencies) {
      toCheck.push('peerDependencies');
    }

    for (const cfg of toCheck) {
      expectJSON(this.name, pkg, `${cfg}.constructs`, ConstructsVersion.VERSION);
    }
  }
}

/**
 * JSII Java package is required and must look sane
 */
export class JSIIJavaPackageIsRequired extends ValidationRule {
  public readonly name = 'jsii/java';

  public validate(pkg: PackageJson): void {
    if (!isJSII(pkg)) { return; }

    const moduleName = cdkModuleName(pkg.json.name);

    expectJSON(this.name, pkg, 'jsii.targets.java.maven.groupId', 'software.amazon.awscdk');
    expectJSON(this.name, pkg, 'jsii.targets.java.maven.artifactId', moduleName.mavenArtifactId, /-/g);

    const java = deepGet(pkg.json, ['jsii', 'targets', 'java', 'package']) as string | undefined;
    expectJSON(this.name, pkg, 'jsii.targets.java.package', moduleName.javaPackage, /\./g);
    if (java) {
      const expectedPrefix = moduleName.javaPackage.split('.').slice(0, 3).join('.');
      const actualPrefix = java.split('.').slice(0, 3).join('.');
      if (expectedPrefix !== actualPrefix) {
        pkg.report({
          ruleName: this.name,
          message: `JSII "java" package must share the first 3 elements of the expected one: ${expectedPrefix} vs ${actualPrefix}`,
          fix: () => deepSet(pkg.json, ['jsii', 'targets', 'java', 'package'], moduleName.javaPackage),
        });
      }
    }
  }
}

export class JSIIPythonTarget extends ValidationRule {
  public readonly name = 'jsii/python';

  public validate(pkg: PackageJson): void {
    if (!isJSII(pkg)) { return; }

    const moduleName = cdkModuleName(pkg.json.name);

    // See: https://github.com/aws/jsii/blob/master/docs/configuration.md#configuring-python

    expectJSON(this.name, pkg, 'jsii.targets.python.distName', moduleName.python.distName);
    expectJSON(this.name, pkg, 'jsii.targets.python.module', moduleName.python.module);
    expectJSON(this.name, pkg, 'jsii.targets.python.classifiers', ['Framework :: AWS CDK', 'Framework :: AWS CDK :: 1']);
  }
}

export class CDKPackage extends ValidationRule {
  public readonly name = 'package-info/scripts/package';

  public validate(pkg: PackageJson): void {
    // skip private packages
    if (pkg.json.private) { return; }

    const merkleMarker = '.LAST_PACKAGE';

    if (!shouldUseCDKBuildTools(pkg)) { return; }
    expectJSON(this.name, pkg, 'scripts.package', 'cdk-package');

    const outdir = 'dist';

    // if this is
    if (isJSII(pkg)) {
      expectJSON(this.name, pkg, 'jsii.outdir', outdir);
    }

    fileShouldContain(this.name, pkg, '.npmignore', outdir);
    fileShouldContain(this.name, pkg, '.gitignore', outdir);
    fileShouldContain(this.name, pkg, '.npmignore', merkleMarker);
    fileShouldContain(this.name, pkg, '.gitignore', merkleMarker);
  }
}

export class NoTsBuildInfo extends ValidationRule {
  public readonly name = 'npmignore/tsbuildinfo';

  public validate(pkg: PackageJson): void {
    // skip private packages
    if (pkg.json.private) { return; }

    // Stop 'tsconfig.tsbuildinfo' and regular '.tsbuildinfo' files from being
    // published to NPM.
    // We might at some point also want to strip tsconfig.json but for now,
    // the TypeScript DOCS BUILD needs to it to load the typescript source.
    fileShouldContain(this.name, pkg, '.npmignore', '*.tsbuildinfo');
  }
}

export class NoTestsInNpmPackage extends ValidationRule {
  public readonly name = 'npmignore/test';

  public validate(pkg: PackageJson): void {
    // skip private packages
    if (pkg.json.private) { return; }

    // Skip the CLI package, as its 'test' subdirectory is used at runtime.
    if (pkg.packageName === 'aws-cdk') { return; }

    // Exclude 'test/' directories from being packaged
    fileShouldContain(this.name, pkg, '.npmignore', 'test/');
  }
}

export class NoTsConfig extends ValidationRule {
  public readonly name = 'npmignore/tsconfig';

  public validate(pkg: PackageJson): void {
    // skip private packages
    if (pkg.json.private) { return; }

    fileShouldContain(this.name, pkg, '.npmignore', 'tsconfig.json');
  }
}

export class IncludeJsiiInNpmTarball extends ValidationRule {
  public readonly name = 'npmignore/jsii-included';

  public validate(pkg: PackageJson): void {
    // only jsii modules
    if (!isJSII(pkg)) { return; }

    // skip private packages
    if (pkg.json.private) { return; }

    fileShouldNotContain(this.name, pkg, '.npmignore', '.jsii');
    fileShouldContain(this.name, pkg, '.npmignore', '!.jsii'); // make sure .jsii is included
  }
}

/**
 * Verifies there is no dependency on "jsii" since it's defined at the repo
 * level.
 */
export class NoJsiiDep extends ValidationRule {
  public readonly name = 'dependencies/no-jsii';

  public validate(pkg: PackageJson): void {
    const predicate = (s: string) => s.startsWith('jsii');

    if (pkg.getDevDependency(predicate)) {
      pkg.report({
        ruleName: this.name,
        message: 'packages should not have a devDep on jsii since it is defined at the repo level',
        fix: () => pkg.removeDevDependency(predicate),
      });
    }
  }
}

/**
 * Verifies that the expected versions of node will be supported.
 */
export class NodeCompatibility extends ValidationRule {
  public readonly name = 'dependencies/node-version';

  public validate(pkg: PackageJson): void {
    const atTypesNode = pkg.getDevDependency('@types/node');
    if (atTypesNode && !atTypesNode.startsWith('^10.')) {
      pkg.report({
        ruleName: this.name,
        message: `packages must support node version 10 and up, but ${atTypesNode} is declared`,
        fix: () => pkg.addDevDependency('@types/node', '^10.17.5'),
      });
    }
  }
}

/**
 * Verifies that the ``@types/`` dependencies are correctly recorded in ``devDependencies`` and not ``dependencies``.
 */
export class NoAtTypesInDependencies extends ValidationRule {
  public readonly name = 'dependencies/at-types';

  public validate(pkg: PackageJson): void {
    const predicate = (s: string) => s.startsWith('@types/');
    for (const dependency of pkg.getDependencies(predicate)) {
      pkg.report({
        ruleName: this.name,
        message: `dependency on ${dependency.name}@${dependency.version} must be in devDependencies`,
        fix: () => {
          pkg.addDevDependency(dependency.name, dependency.version);
          pkg.removeDependency(predicate);
        },
      });
    }
  }
}

function isCdkModuleName(name: string) {
  return !!name.match(/^@aws-cdk\//);
}

/**
 * Computes the module name for various other purposes (java package, ...)
 */
function cdkModuleName(name: string) {
  const isCdkPkg = name === '@aws-cdk/core';
  const isLegacyCdkPkg = name === '@aws-cdk/cdk';

  name = name.replace(/^aws-cdk-/, '');
  name = name.replace(/^@aws-cdk\//, '');

  const dotnetSuffix = name.split('-')
    .map(s => s === 'aws' ? 'AWS' : caseUtils.pascal(s))
    .join('.');

  const pythonName = name.replace(/^@/g, '').replace(/\//g, '.').split('.').map(caseUtils.kebab).join('.');

  return {
    javaPackage: `software.amazon.awscdk${isLegacyCdkPkg ? '' : `.${name.replace(/^aws-/, 'services-').replace(/-/g, '.')}`}`,
    mavenArtifactId:
      isLegacyCdkPkg ? 'cdk'
        : isCdkPkg ? 'core'
          : name.startsWith('aws-') || name.startsWith('alexa-') ? name.replace(/^aws-/, '')
            : name.startsWith('cdk-') ? name
              : `cdk-${name}`,
    dotnetNamespace: `Amazon.CDK${isCdkPkg ? '' : `.${dotnetSuffix}`}`,
    python: {
      distName: `aws-cdk.${pythonName}`,
      module: `aws_cdk.${pythonName.replace(/-/g, '_')}`,
    },
  };
}

/**
 * JSII .NET namespace is required and must look sane
 */
export class JSIIDotNetNamespaceIsRequired extends ValidationRule {
  public readonly name = 'jsii/dotnet';

  public validate(pkg: PackageJson): void {
    if (!isJSII(pkg)) { return; }

    // skip the legacy @aws-cdk/cdk because we actually did not rename
    // the .NET module, so we are not publishing the deprecated one
    if (pkg.packageName === '@aws-cdk/cdk') { return; }

    const dotnet = deepGet(pkg.json, ['jsii', 'targets', 'dotnet', 'namespace']) as string | undefined;
    const moduleName = cdkModuleName(pkg.json.name);
    expectJSON(this.name, pkg, 'jsii.targets.dotnet.namespace', moduleName.dotnetNamespace, /\./g, /*case insensitive*/ true);

    if (dotnet) {
      const actualPrefix = dotnet.split('.').slice(0, 2).join('.');
      const expectedPrefix = moduleName.dotnetNamespace.split('.').slice(0, 2).join('.');
      if (actualPrefix !== expectedPrefix) {
        pkg.report({
          ruleName: this.name,
          message: `.NET namespace must share the first two segments of the default namespace, '${expectedPrefix}' vs '${actualPrefix}'`,
          fix: () => deepSet(pkg.json, ['jsii', 'targets', 'dotnet', 'namespace'], moduleName.dotnetNamespace),
        });
      }
    }
  }
}

/**
 * JSII .NET namespace is required and must look sane
 */
export class JSIIDotNetIconUrlIsRequired extends ValidationRule {
  public readonly name = 'jsii/dotnet/icon-url';

  public validate(pkg: PackageJson): void {
    if (!isJSII(pkg)) { return; }

    const CDK_LOGO_URL = 'https://raw.githubusercontent.com/aws/aws-cdk/master/logo/default-256-dark.png';
    expectJSON(this.name, pkg, 'jsii.targets.dotnet.iconUrl', CDK_LOGO_URL);
  }
}

/**
 * The package must depend on cdk-build-tools
 */
export class MustDependOnBuildTools extends ValidationRule {
  public readonly name = 'dependencies/build-tools';

  public validate(pkg: PackageJson): void {
    if (!shouldUseCDKBuildTools(pkg)) { return; }

    expectDevDependency(this.name,
      pkg,
      'cdk-build-tools',
      `${require('../../cdk-build-tools/package.json').version}`); // eslint-disable-line @typescript-eslint/no-require-imports
  }
}

/**
 * Build script must be 'cdk-build'
 */
export class MustUseCDKBuild extends ValidationRule {
  public readonly name = 'package-info/scripts/build';

  public validate(pkg: PackageJson): void {
    if (!shouldUseCDKBuildTools(pkg)) { return; }

    expectJSON(this.name, pkg, 'scripts.build', 'cdk-build');

    // cdk-build will write a hash file that we have to ignore.
    const merkleMarker = '.LAST_BUILD';
    fileShouldContain(this.name, pkg, '.gitignore', merkleMarker);
    fileShouldContain(this.name, pkg, '.npmignore', merkleMarker);
  }
}

/**
 * Dependencies in both regular and peerDependencies must agree in semver
 *
 * In particular, verify that depVersion satisfies peerVersion. This prevents
 * us from instructing NPM to construct impossible closures, where we say:
 *
 *    peerDependency: A@1.0.0
 *    dependency: A@2.0.0
 *
 * There is no version of A that would satisfy this.
 *
 * The other way around is not necessary--the depVersion can be bumped without
 * bumping the peerVersion (if the API didn't change this may be perfectly
 * valid). This prevents us from restricting a user's potential combinations of
 * libraries unnecessarily.
 */
export class RegularDependenciesMustSatisfyPeerDependencies extends ValidationRule {
  public readonly name = 'dependencies/peer-dependencies-satisfied';

  public validate(pkg: PackageJson): void {
    for (const [depName, peerVersion] of Object.entries(pkg.peerDependencies)) {
      const depVersion = pkg.dependencies[depName];
      if (depVersion === undefined) { continue; }

      // Make sure that depVersion satisfies peerVersion.
      if (!semver.intersects(depVersion, peerVersion)) {
        pkg.report({
          ruleName: this.name,
          message: `dependency ${depName}: concrete version ${depVersion} does not match peer version '${peerVersion}'`,
          fix: () => pkg.addPeerDependency(depName, depVersion),
        });
      }
    }
  }
}

/**
 * Check that dependencies on @aws-cdk/ packages use point versions (not version ranges)
 * and that they are also defined in `peerDependencies`.
 */
export class MustDependonCdkByPointVersions extends ValidationRule {
  public readonly name = 'dependencies/cdk-point-dependencies';

  public validate(pkg: PackageJson): void {
    // yes, ugly, but we have a bunch of references to other files in the repo.
    // we use the root package.json to determine what should be the version
    // across the repo: in local builds, this should be 0.0.0 and in CI builds
    // this would be the actual version of the repo after it's been aligned
    // using scripts/align-version.sh
    const expectedVersion = require('../../../package.json').version; // eslint-disable-line @typescript-eslint/no-require-imports
    const ignore = [
      '@aws-cdk/cloudformation-diff',
      '@aws-cdk/cfnspec',
      '@aws-cdk/cx-api',
      '@aws-cdk/cloud-assembly-schema',
      '@aws-cdk/region-info',
      '@aws-cdk/yaml-cfn',
    ];

    for (const [depName, depVersion] of Object.entries(pkg.dependencies)) {
      if (!isCdkModuleName(depName) || ignore.includes(depName)) {
        continue;
      }

      const peerDep = pkg.peerDependencies[depName];
      if (!peerDep) {
        pkg.report({
          ruleName: this.name,
          message: `dependency ${depName} must also appear in peerDependencies`,
          fix: () => pkg.addPeerDependency(depName, expectedVersion),
        });
      }

      if (peerDep !== expectedVersion) {
        pkg.report({
          ruleName: this.name,
          message: `peer dependency ${depName} should have the version ${expectedVersion}`,
          fix: () => pkg.addPeerDependency(depName, expectedVersion),
        });
      }

      if (depVersion !== expectedVersion) {
        pkg.report({
          ruleName: this.name,
          message: `dependency ${depName}: dependency version must be ${expectedVersion}`,
          fix: () => pkg.addDependency(depName, expectedVersion),
        });
      }
    }
  }
}

export class MustIgnoreSNK extends ValidationRule {
  public readonly name = 'ignore/strong-name-key';

  public validate(pkg: PackageJson): void {
    fileShouldContain(this.name, pkg, '.npmignore', '*.snk');
    fileShouldContain(this.name, pkg, '.gitignore', '*.snk');
  }
}

export class MustIgnoreJunitXml extends ValidationRule {
  public readonly name = 'ignore/junit';

  public validate(pkg: PackageJson): void {
    fileShouldContain(this.name, pkg, '.npmignore', 'junit.xml');
    fileShouldContain(this.name, pkg, '.gitignore', 'junit.xml');
  }
}

export class NpmIgnoreForJsiiModules extends ValidationRule {
  public readonly name = 'ignore/jsii';

  public validate(pkg: PackageJson): void {
    if (!isJSII(pkg)) { return; }

    fileShouldContain(this.name, pkg, '.npmignore',
      '*.ts',
      '!*.d.ts',
      '!*.js',
      'coverage',
      '.nyc_output',
      '*.tgz',
    );
  }
}

/**
 * Must use 'cdk-watch' command
 */
export class MustUseCDKWatch extends ValidationRule {
  public readonly name = 'package-info/scripts/watch';

  public validate(pkg: PackageJson): void {
    if (!shouldUseCDKBuildTools(pkg)) { return; }

    expectJSON(this.name, pkg, 'scripts.watch', 'cdk-watch');
  }
}

/**
 * Must have 'rosetta:extract' command if this package is JSII-enabled.
 */
export class MustHaveRosettaExtract extends ValidationRule {
  public readonly name = 'package-info/scripts/rosetta:extract';

  public validate(pkg: PackageJson): void {
    if (!isJSII(pkg)) { return; }

    expectJSON(this.name, pkg, 'scripts.rosetta:extract', 'yarn --silent jsii-rosetta extract');
  }
}

/**
 * Must use 'cdk-test' command
 */
export class MustUseCDKTest extends ValidationRule {
  public readonly name = 'package-info/scripts/test';

  public validate(pkg: PackageJson): void {
    if (!shouldUseCDKBuildTools(pkg)) { return; }
    if (!hasTestDirectory(pkg)) { return; }

    expectJSON(this.name, pkg, 'scripts.test', 'cdk-test');

    // 'cdk-test' will calculate coverage, so have the appropriate
    // files in .gitignore.
    fileShouldContain(this.name, pkg, '.gitignore', '.nyc_output');
    fileShouldContain(this.name, pkg, '.gitignore', 'coverage');
    fileShouldContain(this.name, pkg, '.gitignore', 'nyc.config.js');
  }
}

/**
 * Must declare minimum node version
 */
export class MustHaveNodeEnginesDeclaration extends ValidationRule {
  public readonly name = 'package-info/engines';

  public validate(pkg: PackageJson): void {
    expectJSON(this.name, pkg, 'engines.node', '>= 10.13.0 <13 || >=13.7.0');
  }
}

/**
 * Scripts that run integ tests must also have the individual 'integ' script to update them
 *
 * This commands comes from the dev-dependency cdk-integ-tools.
 */
export class MustHaveIntegCommand extends ValidationRule {
  public readonly name = 'package-info/scripts/integ';

  public validate(pkg: PackageJson): void {
    if (!hasIntegTests(pkg)) { return; }

    expectJSON(this.name, pkg, 'scripts.integ', 'cdk-integ');
    expectDevDependency(this.name,
      pkg,
      'cdk-integ-tools',
      `${require('../../cdk-integ-tools/package.json').version}`); // eslint-disable-line @typescript-eslint/no-require-imports
  }
}

/**
 * Checks API backwards compatibility against the latest released version.
 */
export class CompatScript extends ValidationRule {
  public readonly name = 'package-info/scripts/compat';

  public validate(pkg: PackageJson): void {
    if (!isJSII(pkg)) { return ; }

    expectJSON(this.name, pkg, 'scripts.compat', 'cdk-compat');
  }
}

export class PkgLintAsScript extends ValidationRule {
  public readonly name = 'package-info/scripts/pkglint';

  public validate(pkg: PackageJson): void {
    const script = 'pkglint -f';

    expectDevDependency(this.name, pkg, 'pkglint', `${require('../package.json').version}`); // eslint-disable-line @typescript-eslint/no-require-imports

    if (!pkg.npmScript('pkglint')) {
      pkg.report({
        ruleName: this.name,
        message: 'a script called "pkglint" must be included to allow fixing package linting issues',
        fix: () => pkg.changeNpmScript('pkglint', () => script),
      });
    }

    if (pkg.npmScript('pkglint') !== script) {
      pkg.report({
        ruleName: this.name,
        message: 'the pkglint script should be: ' + script,
        fix: () => pkg.changeNpmScript('pkglint', () => script),
      });
    }
  }
}

export class NoStarDeps extends ValidationRule {
  public readonly name = 'dependencies/no-star';

  public validate(pkg: PackageJson) {
    reportStarDeps(this.name, pkg.json.depedencies);
    reportStarDeps(this.name, pkg.json.devDependencies);

    function reportStarDeps(ruleName: string, deps?: any) {
      deps = deps || {};
      Object.keys(deps).forEach(d => {
        if (deps[d] === '*') {
          pkg.report({
            ruleName,
            message: `star dependency not allowed for ${d}`,
          });
        }
      });
    }
  }
}

interface VersionCount {
  version: string;
  count: number;
}

/**
 * All consumed versions of dependencies must be the same
 *
 * NOTE: this rule will only be useful when validating multiple package.jsons at the same time
 */
export class AllVersionsTheSame extends ValidationRule {
  public readonly name = 'dependencies/versions-consistent';

  private readonly ourPackages: {[pkg: string]: string} = {};
  private readonly usedDeps: {[pkg: string]: VersionCount[]} = {};

  public prepare(pkg: PackageJson): void {
    this.ourPackages[pkg.json.name] = pkg.json.version;
    this.recordDeps(pkg.json.dependencies);
    this.recordDeps(pkg.json.devDependencies);
  }

  public validate(pkg: PackageJson): void {
    this.validateDeps(pkg, 'dependencies');
    this.validateDeps(pkg, 'devDependencies');
  }

  private recordDeps(deps: {[pkg: string]: string} | undefined) {
    if (!deps) { return; }

    Object.keys(deps).forEach(dep => {
      this.recordDep(dep, deps[dep]);
    });
  }

  private validateDeps(pkg: PackageJson, section: string) {
    if (!pkg.json[section]) { return; }

    Object.keys(pkg.json[section]).forEach(dep => {
      this.validateDep(pkg, section, dep);
    });
  }

  private recordDep(dep: string, version: string) {
    if (version === '*') {
      // '*' does not give us info, so skip
      return;
    }

    if (!(dep in this.usedDeps)) {
      this.usedDeps[dep] = [];
    }

    const i = this.usedDeps[dep].findIndex(vc => vc.version === version);
    if (i === -1) {
      this.usedDeps[dep].push({ version, count: 1 });
    } else {
      this.usedDeps[dep][i].count += 1;
    }
  }

  private validateDep(pkg: PackageJson, depField: string, dep: string) {
    if (dep in this.ourPackages) {
      expectJSON(this.name, pkg, depField + '.' + dep, this.ourPackages[dep]);
      return;
    }

    // Otherwise, must match the majority version declaration. Might be empty if we only
    // have '*', in which case that's fine.
    if (!(dep in this.usedDeps)) { return; }

    const versions = this.usedDeps[dep];
    versions.sort((a, b) => b.count - a.count);
    expectJSON(this.name, pkg, depField + '.' + dep, versions[0].version);
  }
}

export class AwsLint extends ValidationRule {
  public readonly name = 'awslint';

  public validate(pkg: PackageJson) {
    if (!isJSII(pkg)) {
      return;
    }

    if (!isAWS(pkg)) {
      return;
    }

    expectJSON(this.name, pkg, 'scripts.awslint', 'cdk-awslint');
  }
}

export class Cfn2Ts extends ValidationRule {
  public readonly name = 'cfn2ts';

  public validate(pkg: PackageJson) {
    if (!isJSII(pkg) || !isAWS(pkg)) {
      return expectJSON(this.name, pkg, 'scripts.cfn2ts', undefined);
    }

    expectJSON(this.name, pkg, 'scripts.cfn2ts', 'cfn2ts');
  }
}

/**
 * Packages inside JSII packages (typically used for embedding Lambda handles)
 * must only have dev dependencies and their node_modules must have been
 * blacklisted for publishing
 *
 * We might loosen this at some point but we'll have to bundle all runtime dependencies
 * and we don't have good transitive license checks.
 */
export class PackageInJsiiPackageNoRuntimeDeps extends ValidationRule {
  public readonly name = 'lambda-packages-no-runtime-deps';

  public validate(pkg: PackageJson) {
    if (!isJSII(pkg)) { return; }

    for (const inner of findInnerPackages(pkg.packageRoot)) {
      const innerPkg = PackageJson.fromDirectory(inner);

      if (Object.keys(innerPkg.dependencies).length > 0) {
        pkg.report({
          ruleName: `${this.name}:1`,
          message: `NPM Package '${innerPkg.packageName}' inside jsii package can only have devDepencencies`,
        });
      }

      const nodeModulesRelPath = path.relative(pkg.packageRoot, innerPkg.packageRoot) + '/node_modules';
      fileShouldContain(`${this.name}:2`, pkg, '.npmignore', nodeModulesRelPath);
    }
  }
}

/**
 * Requires packages to have fast-fail build scripts, allowing to combine build, test and package in a single command.
 * This involves two targets: `build+test:pack` and `build+test` (to skip the pack).
 */
export class FastFailingBuildScripts extends ValidationRule {
  public readonly name = 'fast-failing-build-scripts';

  public validate(pkg: PackageJson) {
    const scripts = pkg.json.scripts || {};

    const hasTest = 'test' in scripts;
    const hasPack = 'package' in scripts;

    const cmdBuild = 'yarn build';
    expectJSON(this.name, pkg, 'scripts.build+test', hasTest ? [cmdBuild, 'yarn test'].join(' && ') : cmdBuild);

    const cmdBuildTest = 'yarn build+test';
    expectJSON(this.name, pkg, 'scripts.build+test+package', hasPack ? [cmdBuildTest, 'yarn package'].join(' && ') : cmdBuildTest);
  }
}

export class YarnNohoistBundledDependencies extends ValidationRule {
  public readonly name = 'yarn/nohoist-bundled-dependencies';

  public validate(pkg: PackageJson) {
    const bundled: string[] = pkg.json.bundleDependencies || pkg.json.bundledDependencies || [];
    if (bundled.length === 0) { return; }

    const repoPackageJson = path.resolve(__dirname, '../../../package.json');

    const nohoist: string[] = require(repoPackageJson).workspaces.nohoist; // eslint-disable-line @typescript-eslint/no-require-imports

    const missing = new Array<string>();
    for (const dep of bundled) {
      for (const entry of [`${pkg.packageName}/${dep}`, `${pkg.packageName}/${dep}/**`]) {
        if (nohoist.indexOf(entry) >= 0) { continue; }
        missing.push(entry);
      }
    }

    if (missing.length > 0) {
      pkg.report({
        ruleName: this.name,
        message: `Repository-level 'workspaces.nohoist' directive is missing: ${missing.join(', ')}`,
        fix: () => {
          const packageJson = require(repoPackageJson); // eslint-disable-line @typescript-eslint/no-require-imports
          packageJson.workspaces.nohoist = [...packageJson.workspaces.nohoist, ...missing].sort();
          fs.writeFileSync(repoPackageJson, `${JSON.stringify(packageJson, null, 2)}\n`, { encoding: 'utf8' });
        },
      });
    }
  }
}

export class ConstructsDependency extends ValidationRule {
  public readonly name = 'constructs/dependency';

  public validate(pkg: PackageJson) {
    const REQUIRED_VERSION = ConstructsVersion.VERSION;;

    if (pkg.devDependencies?.constructs && pkg.devDependencies?.constructs !== REQUIRED_VERSION) {
      pkg.report({
        ruleName: this.name,
        message: `"constructs" must have a version requirement ${REQUIRED_VERSION}`,
        fix: () => {
          pkg.addDevDependency('constructs', REQUIRED_VERSION);
        },
      });
    }

    if (pkg.dependencies.constructs && pkg.dependencies.constructs !== REQUIRED_VERSION) {
      pkg.report({
        ruleName: this.name,
        message: `"constructs" must have a version requirement ${REQUIRED_VERSION}`,
        fix: () => {
          pkg.addDependency('constructs', REQUIRED_VERSION);
        },
      });

      if (!pkg.peerDependencies.constructs || pkg.peerDependencies.constructs !== REQUIRED_VERSION) {
        pkg.report({
          ruleName: this.name,
          message: `"constructs" must have a version requirement ${REQUIRED_VERSION} in peerDependencies`,
          fix: () => {
            pkg.addPeerDependency('constructs', REQUIRED_VERSION);
          },
        });
      }
    }
  }
}

/**
 * Do not announce new versions of AWS CDK modules in awscdk.io because it is very very spammy
 * and actually causes the @awscdkio twitter account to be blocked.
 *
 * https://github.com/construct-catalog/catalog/issues/24
 * https://github.com/construct-catalog/catalog/pull/22
 */
export class DoNotAnnounceInCatalog extends ValidationRule {
  public readonly name = 'catalog/no-announce';

  public validate(pkg: PackageJson) {
    if (!isJSII(pkg)) { return; }

    if (pkg.json.awscdkio?.announce !== false) {
      pkg.report({
        ruleName: this.name,
        message: 'missing "awscdkio.announce: false" in package.json',
        fix: () => {
          pkg.json.awscdkio = pkg.json.awscdkio ?? { };
          pkg.json.awscdkio.announce = false;
        },
      });
    }
  }
}

export class EslintSetup extends ValidationRule {
  public readonly name = 'package-info/eslint';

  public validate(pkg: PackageJson) {
    const eslintrcFilename = '.eslintrc.js';
    if (!fs.existsSync(eslintrcFilename)) {
      pkg.report({
        ruleName: this.name,
        message: 'There must be a .eslintrc.js file at the root of the package',
        fix: () => {
          const rootRelative = path.relative(pkg.packageRoot, repoRoot(pkg.packageRoot));
          fs.writeFileSync(
            eslintrcFilename,
            [
              `const baseConfig = require('${rootRelative}/tools/cdk-build-tools/config/eslintrc');`,
              "baseConfig.parserOptions.project = __dirname + '/tsconfig.json';",
              'module.exports = baseConfig;',
            ].join('\n') + '\n',
          );
        },
      });
    }
    fileShouldContain(this.name, pkg, '.gitignore', '!.eslintrc.js');
    fileShouldContain(this.name, pkg, '.npmignore', '.eslintrc.js');
  }
}

export class JestSetup extends ValidationRule {
  public readonly name = 'package-info/jest.config';

  public validate(pkg: PackageJson): void {
    const cdkBuild = pkg.json['cdk-build'] || {};

    // check whether the package.json contains the "jest" key,
    // which we no longer use
    if (pkg.json.jest) {
      pkg.report({
        ruleName: this.name,
        message: 'Using Jest is set through a flag in the "cdk-build" key in package.json, the "jest" key is ignored',
        fix: () => {
          delete pkg.json.jest;
          cdkBuild.jest = true;
          pkg.json['cdk-build'] = cdkBuild;
        },
      });
    }

    // this rule should only be enforced for packages that use Jest for testing
    if (!cdkBuild.jest) {
      return;
    }

    const jestConfigFilename = 'jest.config.js';
    if (!fs.existsSync(jestConfigFilename)) {
      pkg.report({
        ruleName: this.name,
        message: 'There must be a jest.config.js file at the root of the package',
        fix: () => {
          const rootRelative = path.relative(pkg.packageRoot, repoRoot(pkg.packageRoot));
          fs.writeFileSync(
            jestConfigFilename,
            [
              `const baseConfig = require('${rootRelative}/tools/cdk-build-tools/config/jest.config');`,
              'module.exports = baseConfig;',
            ].join('\n') + '\n',
          );
        },
      });
    }
    fileShouldContain(this.name, pkg, '.gitignore', '!jest.config.js');
    fileShouldContain(this.name, pkg, '.npmignore', 'jest.config.js');
  }
}

export class UbergenPackageVisibility extends ValidationRule {
  public readonly name = 'ubergen/package-visibility';

  // These include dependencies of the CDK CLI (aws-cdk).
  private readonly publicPackages = [
    '@aws-cdk/cfnspec',
    '@aws-cdk/cloud-assembly-schema',
    '@aws-cdk/cloudformation-diff',
    '@aws-cdk/cx-api',
    '@aws-cdk/region-info',
    '@aws-cdk/yaml-cfn',
    'aws-cdk-lib',
    'aws-cdk',
    'awslint',
    'cdk',
    'cdk-assets',
  ];

  public validate(pkg: PackageJson): void {
    if (cdkMajorVersion() === 2) {
      // Only packages in the publicPackages list should be "public". Everything else should be private.
      if (this.publicPackages.includes(pkg.json.name) && pkg.json.private === true) {
        pkg.report({
          ruleName: this.name,
          message: 'Package must be public',
          fix: () => {
            delete pkg.json.private;
          },
        });
      } else if (!this.publicPackages.includes(pkg.json.name) && pkg.json.private !== true) {
        pkg.report({
          ruleName: this.name,
          message: 'Package must not be public',
          fix: () => {
            delete pkg.json.private;
            pkg.json.private = true;
          },
        });
      }
    } else {
      if (pkg.json.private && !pkg.json.ubergen?.exclude) {
        pkg.report({
          ruleName: this.name,
          message: 'ubergen.exclude must be configured for private packages',
          fix: () => {
            pkg.json.ubergen = {
              exclude: true,
            };
          },
        });
      }
    }
  }
}

/**
 * Determine whether this is a JSII package
 *
 * A package is a JSII package if there is 'jsii' section in the package.json
 */
function isJSII(pkg: PackageJson): boolean {
  return pkg.json.jsii;
}

/**
 * Indicates that this is an "AWS" package (i.e. that it it has a cloudformation source)
 * @param pkg
 */
function isAWS(pkg: PackageJson): boolean {
  return pkg.json['cdk-build']?.cloudformation != null;
}

/**
 * Determine whether the package has tests
 *
 * A package has tests if the root/test directory exists
 */
function hasTestDirectory(pkg: PackageJson) {
  return fs.existsSync(path.join(pkg.packageRoot, 'test'));
}

/**
 * Whether this package has integ tests
 *
 * A package has integ tests if it mentions 'cdk-integ' in the "test" script.
 */
function hasIntegTests(pkg: PackageJson) {
  if (!hasTestDirectory(pkg)) { return false; }

  const files = fs.readdirSync(path.join(pkg.packageRoot, 'test'));
  return files.some(p => p.startsWith('integ.'));
}

/**
 * Return whether this package should use CDK build tools
 */
function shouldUseCDKBuildTools(pkg: PackageJson) {
  const exclude = [
    'cdk-build-tools',
    'merkle-build',
    'awslint',
    'script-tests',
  ];

  return !exclude.includes(pkg.packageName);
}

function repoRoot(dir: string) {
  let root = dir;
  for (let i = 0; i < 50 && !fs.existsSync(path.join(root, 'yarn.lock')); i++) {
    root = path.dirname(root);
  }
  return root;
}

function toRegExp(str: string): RegExp {
  return new RegExp(str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\w+/g, '\\w+'));
}

function readBannerFile(file: string): string {
  return fs.readFileSync(path.join(__dirname, 'banners', file), { encoding: 'utf-8' }).trim();
}

function cdkMajorVersion() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const releaseJson = require(`${__dirname}/../../../release.json`);
  return releaseJson.majorVersion as number;
}
