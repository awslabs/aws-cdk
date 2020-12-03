#!/bin/bash
# Runs "npm package" in all modules. This will produce a "dist/" directory in each module.
# Then, calls pack-collect.sh to merge all outputs into a root ./pack directory, which is
# later read by bundle-beta.sh.
set -eu
set -x
export PATH=$PWD/node_modules/.bin:$PATH
export NODE_OPTIONS="--max-old-space-size=4096 ${NODE_OPTIONS:-}"
root=$PWD

# Get version and changelog file name (these require that .versionrc.json would have been generated)
version=$(node -p "require('./scripts/resolve-version').version")
changelog_file=$(node -p "require('./scripts/resolve-version').changelogFile")
marker=$(node -p "require('./scripts/resolve-version').marker")

PACMAK=${PACMAK:-jsii-pacmak}
ROSETTA=${ROSETTA:-jsii-rosetta}
TMPDIR=${TMPDIR:-$(dirname $(mktemp -u))}
distdir="$PWD/dist"
rm -fr ${distdir}
mkdir -p ${distdir}

# Split out jsii, non-jsii and monolothic packages. Jsii packages will be built all at once.
# The jsii monolithic packages will be run in parallel to the jsii packages 
# Non-jsii packages will be run individually.
echo "Collecting package list..." >&2
scripts/list-packages $TMPDIR/jsii.txt $TMPDIR/nonjsii.txt $TMPDIR/jsii-monolithic.txt

# Return lerna scopes from a package list
function lerna_scopes() {
  while [[ "${1:-}" != "" ]]; do
    echo "--scope $1 "
    shift
  done
}

# Compile examples with respect to "decdk" directory, as all packages will
# be symlinked there so they can all be included.
echo "Extracting code samples" >&2
node --experimental-worker $(which $ROSETTA) \
  --compile \
  --output samples.tabl.json \
  --directory packages/decdk \
  $(cat $TMPDIR/jsii.txt)

# Jsii packaging (all at once using jsii-pacmak)
# execute monocdk packaging in parallel
echo "Packaging jsii modules" >&2
$PACMAK \
  --verbose \
  --rosetta-tablet samples.tabl.json \
  $(cat $TMPDIR/jsii.txt) &


echo "Packaging mono jsii modules" >&2
$PACMAK \
  --verbose \
  $(cat $TMPDIR/jsii-monolithic.txt) &

wait

# Non-jsii packaging, which means running 'package' in every individual
# module
echo "Packaging non-jsii modules" >&2
lerna run $(lerna_scopes $(cat $TMPDIR/nonjsii.txt)) --sort --concurrency=1 --stream package

# Finally rsync all 'dist' directories together into a global 'dist' directory
for dir in $(find packages -name dist | grep -v node_modules | grep -v run-wrappers); do
  echo "Merging ${dir} into ${distdir}" >&2
  rsync -a $dir/ ${distdir}/
done

# Remove a JSII aggregate POM that may have snuk past
rm -rf dist/java/software/amazon/jsii

# Get commit from CodePipeline (or git, if we are in CodeBuild)
# If CODEBUILD_RESOLVED_SOURCE_VERSION is not defined (i.e. local
# build or CodePipeline build), use the HEAD commit hash).
commit="${CODEBUILD_RESOLVED_SOURCE_VERSION:-}"
if [ -z "${commit}" ]; then
  commit="$(git rev-parse --verify HEAD)"
fi

cat > ${distdir}/build.json <<HERE
{
  "name": "aws-cdk",
  "version": "${version}",
  "commit": "${commit}"
}
HERE

# copy CHANGELOG.md to dist/ for github releases
cp ${changelog_file} ${distdir}/CHANGELOG.md

# defensive: make sure our artifacts don't use the version marker (this means
# that "pack" will always fails when building in a dev environment)
# when we get to 10.0.0, we can fix this...
if find dist/ | grep -F "${marker}"; then
  echo "ERROR: build artifacts use the version marker '${marker}' instead of a real version."
  echo "This is expected for builds in a development environment but should not happen in CI builds!"
  exit 1
fi

# for posterity, print all files in dist
echo "=============================================================================================="
echo " dist contents"
echo "=============================================================================================="
find dist/
