// import * as cdk from '@aws-cdk/core';
import { Test } from 'nodeunit';
import * as codebuild from '../lib';

/* eslint-disable quote-props */
/* eslint-disable quotes */

export = {
  'Test BuildSpec merge': {
    'merge two simple specs'(test: Test) {
      const lhs = codebuild.BuildSpec.fromObject({
        phases: {
          pre_build: {
            commands: [
              'install',
            ],
          },
        },
      });
      const rhs = codebuild.BuildSpec.fromObject({
        phases: {
          build: {
            commands: 'build',
          },
        },
      });

      const merged = codebuild.mergeBuildSpecs(lhs, rhs);

      test.deepEqual((merged as any).spec, {
        phases: {
          pre_build: {
            commands: [
              'install',
            ],
          },
          build: {
            commands: [
              'build',
            ],
          },
        },
      });

      test.done();
    },

    'merge command lists'(test: Test) {
      const lhs = codebuild.BuildSpec.fromObject({
        phases: {
          build: {
            commands: [
              'build1',
            ],
          },
        },
      });
      const rhs = codebuild.BuildSpec.fromObject({
        phases: {
          build: {
            commands: 'build2',
          },
        },
      });

      const merged = codebuild.mergeBuildSpecs(lhs, rhs);

      test.deepEqual((merged as any).spec, {
        phases: {
          build: {
            commands: [
              'build1',
              'build2',
            ],
          },
        },
      });

      test.done();
    },

    'do not merge artifacts'(test: Test) {
      const lhs = codebuild.BuildSpec.fromObject({
        phases: {
          build: {
            commands: [
              'build1',
            ],
          },
        },
        artifacts: {
          'base-directory': 'subdir/cdk.out',
        },
      });
      const rhs = codebuild.BuildSpec.fromObject({
        phases: {
          build: {
            commands: [
              'build2',
            ],
          },
        },
        artifacts: {
          'base-directory': 'subdir/cdk.out',
        },
      });

      test.throws(() => {
        codebuild.mergeBuildSpecs(lhs, rhs);
      });
      test.done();
    },

    'merge complex example'(test: Test) {
      const cdkSpec = codebuild.BuildSpec.fromObject({
        env: {
          'variables': {
            NPM_TOKEN: 'supersecret',
          },
        },
        phases: {
          pre_build: {
            commands: [
              'install1',
            ],
          },
          build: {
            commands: [
              'build1',
              'test1',
              'cdk synth',
            ],
          },
        },
      });
      const userSpec = codebuild.BuildSpec.fromObject({
        version: 0.2,
        env: {
          'variables': {
            JAVA_HOME: '/usr/lib/jvm/java-8-openjdk-amd64',
          },
          'parameter-store': {
            LOGIN_PASSWORD: '/CodeBuild/dockerLoginPassword',
          },
        },
        phases: {
          install: {
            commands: [
              'echo Entered the install phase...',
              'apt-get update -y',
              'apt-get install -y maven',
            ],
            finally: [
              'echo This always runs even if the update or install command fails',
            ],
          },
          pre_build: {
            commands: [
              'echo Entered the pre_build phase...',
              'docker login -u User -p $LOGIN_PASSWORD',
            ],
            finally: [
              'echo This always runs even if the login command fails',
            ],
          },
          build: {
            commands: [
              'echo Entered the build phase...',
              'echo Build started on `date`',
              'mvn install',
            ],
            finally: [
              'echo This always runs even if the install command fails',
            ],
          },
          post_build: {
            commands: [
              'echo Entered the post_build phase...',
              'echo Build completed on `date`',
            ],
          },
        },
        reports: {
          'arn:aws:codebuild:your-region:your-aws-account-id:report-group/report-group-name-1': {
            'files': [
              '**/*',
            ],
            'base-directory': 'target/tests/reports',
            'discard-paths': 'no',
          },
          'reportGroupCucumberJson': {
            'files': [
              'cucumber/target/cucumber-tests.xml',
            ],
            'discard-paths': 'yes',
            'file-format': 'CUCUMBERJSON',
          },
        },
        artifacts: {
          'files': [
            'target/messageUtil-1.0.jar',
          ],
          'discard-paths': 'yes',
          'secondary-artifacts': {
            artifact1: {
              'files': [
                'target/artifact-1.0.jar',
              ],
              'discard-paths': 'yes',
            },
            artifact2: {
              'files': [
                'target/artifact-2.0.jar',
              ],
              'discard-paths': 'yes',
            },
          },
        },
        cache: {
          paths: [
            '/root/.m2/**/*',
          ],
        },
      });

      const merged = codebuild.mergeBuildSpecs(userSpec, cdkSpec);

      test.deepEqual((merged as any).spec, {
        version: 0.2,
        env: {
          'variables': {
            JAVA_HOME: '/usr/lib/jvm/java-8-openjdk-amd64',
            NPM_TOKEN: 'supersecret',
          },
          'parameter-store': {
            LOGIN_PASSWORD: '/CodeBuild/dockerLoginPassword',
          },
        },
        phases: {
          install: {
            commands: [
              'echo Entered the install phase...',
              'apt-get update -y',
              'apt-get install -y maven',
            ],
            finally: [
              'echo This always runs even if the update or install command fails',
            ],
          },
          pre_build: {
            commands: [
              'echo Entered the pre_build phase...',
              'docker login -u User -p $LOGIN_PASSWORD',
              'install1',
            ],
            finally: [
              'echo This always runs even if the login command fails',
            ],
          },
          build: {
            commands: [
              'echo Entered the build phase...',
              'echo Build started on `date`',
              'mvn install',
              'build1',
              'test1',
              'cdk synth',
            ],
            finally: [
              'echo This always runs even if the install command fails',
            ],
          },
          post_build: {
            commands: [
              'echo Entered the post_build phase...',
              'echo Build completed on `date`',
            ],
          },
        },
        reports: {
          'arn:aws:codebuild:your-region:your-aws-account-id:report-group/report-group-name-1': {
            'files': [
              '**/*',
            ],
            'base-directory': 'target/tests/reports',
            'discard-paths': 'no',
          },
          'reportGroupCucumberJson': {
            'files': [
              'cucumber/target/cucumber-tests.xml',
            ],
            'discard-paths': 'yes',
            'file-format': 'CUCUMBERJSON',
          },
        },
        artifacts: {
          'files': [
            'target/messageUtil-1.0.jar',
          ],
          'discard-paths': 'yes',
          'secondary-artifacts': {
            artifact1: {
              'files': [
                'target/artifact-1.0.jar',
              ],
              'discard-paths': 'yes',
            },
            artifact2: {
              'files': [
                'target/artifact-2.0.jar',
              ],
              'discard-paths': 'yes',
            },
          },
        },
        cache: {
          paths: [
            '/root/.m2/**/*',
          ],
        },
      });

      test.done();
    },

    'override duplicate reports'(test: Test) {
      const lhs = codebuild.BuildSpec.fromObject({
        phases: {
          pre_build: {
            commands: [
              'install',
            ],
          },
        },
        reports: {
          'report1': {
            'files': [
              'report1/a',
            ],
            'discard-paths': 'no',
            'base-directory': 'target/tests/reports',
          },
          'report2': {
            'files': [
              'cucumber/target/cucumber-tests.xml',
            ],
            'discard-paths': 'yes',
            'file-format': 'CUCUMBERJSON',
          },
        },
      });
      const rhs = codebuild.BuildSpec.fromObject({
        phases: {
          build: {
            commands: [
              'build',
            ],
          },
        },
        reports: {
          'report1': {
            'files': [
              'report1/b',
              'report1/b2',
            ],
            'base-directory': 'target/tests/reportsB',
          },
          'report3': {
            'files': [
              'cucumber/target/cucumber-tests.xml',
            ],
            'discard-paths': 'yes',
            'file-format': 'CUCUMBERJSON',
          },
        },
      });

      const merged = codebuild.mergeBuildSpecs(lhs, rhs);

      test.deepEqual((merged as any).spec, {
        phases: {
          pre_build: {
            commands: [
              'install',
            ],
          },
          build: {
            commands: [
              'build',
            ],
          },
        },
        reports: {
          'report1': {
            'files': [
              'report1/b',
              'report1/b2',
            ],
            'base-directory': 'target/tests/reportsB',
          },
          'report2': {
            'files': [
              'cucumber/target/cucumber-tests.xml',
            ],
            'discard-paths': 'yes',
            'file-format': 'CUCUMBERJSON',
          },
          'report3': {
            'files': [
              'cucumber/target/cucumber-tests.xml',
            ],
            'discard-paths': 'yes',
            'file-format': 'CUCUMBERJSON',
          },
        },
      });

      test.done();
    },
  },
};
