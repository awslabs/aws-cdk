#!/bin/bash
set -eu
scriptdir=$(cd $(dirname $0) && pwd)
$scriptdir/test-csharp.sh
$scriptdir/test-fsharp.sh
$scriptdir/test-java.sh
$scriptdir/test-javascript.sh
$scriptdir/test-python.sh
$scriptdir/test-typescript.sh
$scriptdir/test-go.sh

echo "SUCCESS"
