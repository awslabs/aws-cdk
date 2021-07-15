# cdk-release

This is a repo-private tool that we use for performing a release:
bumping the version of the package(s),
generating the Changelog file(s),
creating a commit, etc.

We used to rely on [standard-version](https://www.npmjs.com/package/standard-version)
for this purpose, but our case is so (haha) non-standard,
with `aws-cdk-lib` excluding experimental modules,
and the need for separate Changelog files for V2 experimental modules,
that we decided we need a tool that we have full control over
(plus, `standard-version` has some problems too,
like messing up the headings,
and having problems with both V1 and V2 tags in the same repo).

This library is called from the
[`bump.js` file](../../scripts/bump.js),
which is called from the [`bump.sh` script](../../bump.sh),
which is called by a CodeBuild job that creates the 'bump'
PR every time we perform a CDK release.
