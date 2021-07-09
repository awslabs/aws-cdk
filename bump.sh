#!/bin/bash
# --------------------------------------------------------------------------------------------------
#
# This script is intended to be used to bump the version of the CDK modules, update package.json,
# package-lock.json, and create a commit.
#
# to start a version bump, run:
#     bump.sh <version | version Type>
#
# If a version is not provided, the 'minor' version will be bumped.
# The version can be an explicit version _or_ one of:
# 'major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', or 'prerelease'.
#
# --------------------------------------------------------------------------------------------------
set -euo pipefail
scriptdir=$(cd $(dirname $0) && pwd)
cd ${scriptdir}
yarn install --frozen-lockfile
if [[ "${LEGACY_BUMP:-}" == "" ]]; then
  #  if we're using 'cdk-release' for the bump, build that package, including all of its dependencies
  npx lerna run build --include-dependencies --scope cdk-release
fi
${scriptdir}/scripts/bump.js ${1:-minor}
