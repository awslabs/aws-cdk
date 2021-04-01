#!/bin/bash
#------------------------------------------------------------------
# setup
#------------------------------------------------------------------
set -eu
scriptdir=$(cd $(dirname $0) && pwd)
source ${scriptdir}/common.bash

header Go

#------------------------------------------------------------------

if [[ "${1:-}" == "" ]]; then
    templates="app"
else
    templates="$@"
fi

for template in $templates; do
    echo "Trying Go template $template"

    setup

    cdk init -l go $template
    cdk synth
done
