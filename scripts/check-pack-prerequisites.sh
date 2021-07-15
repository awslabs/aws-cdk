#!/bin/bash
set -euo pipefail

scriptdir=$(cd $(dirname $0) && pwd)
source ${scriptdir}/check-build-prerequisites.sh

# Testing with this to simulate different installed apps:
# docker run -it -v ~/Source/aws-cdk:/var/cdk ubuntu bash

# Note: Don't use \d in regex, it doesn't work on Macs without GNU tools installed
# Use [0-9] instead

die() { echo "$*" 1>&2 ; exit 1; }
wrong_version() { echo "Found $app version $app_v. Install $app >= $app_min" 1>&2; exit 1; }

check_which() {
    local app=$1
    local min=$2

    echo -e "Checking if $app is installed... \c"

    w=$(which ${app}) || w=""

    if [ -z "$w" ] || [ "$w" == "$app not found" ]
    then
        die "Missing dependency: $app. Install $app >= $min"
    else
        echo "Ok"
    fi
}

app=""
app_min=""
app_v=""

# [Java OpenJDK 8, 11, 14]

# Follow "More Info" on a new Mac when trying javac, install latest Oracle:
# javac 14.0.1

# apt install default-jdk on Ubuntu
# javac 11.0.7

# Install Coretto 8 from Amazon web site
# javac --version fails
# javac -version
# javac 1.8.0_252
# Old javac versions output version to stderr... why

app="javac"
app_min="1.8.0"
check_which $app $app_min
app_v=$(${app} -version 2>&1)
echo -e "Checking javac version... \c"
# 1.8
if [ $(echo $app_v | grep -c -E "1\.8\.[0-9].*") -eq 1 ]
then
    echo "Ok"
else
    # 11 or 14 or 15 or 16
    if [ $(echo $app_v | grep -c -E "1[1-6]\.[0-9]\.[0-9].*") -eq 1 ]
    then
        echo "Ok"
    else
        wrong_version
    fi
fi

# [Apache Maven >= 3.6.0, < 4.0]
app="mvn"
app_min="3.6.0"
check_which $app $app_min
app_v=$(${app} --version)
echo -e "Checking mvn version... \c"
if [ $(echo $app_v | grep -c -E "3\.[6789]\.[0-9].*") -eq 1 ]
then
    echo "Ok"
else
    wrong_version
fi

# [.NET Core SDK 3.1.*]
app="dotnet"
app_min="3.1.0"
check_which $app $app_min
app_v=$(${app} --list-sdks)
echo -e "Checking $app version... \c"
if [ $(echo $app_v | grep -c -E "3\.1\.[0-9].*|[4-9]\..*") -eq 1 ]
then
    echo "Ok"
else
    wrong_version
fi

# [Python >= 3.6.5, < 4.0]
app="python3"
app_min="3.6.5"
check_which $app $app_min
app_v=$(${app} --version)
echo -e "Checking $app version... \c"
if [ $(echo $app_v | grep -c -E "3\.[6789]\.[0-9].*") -eq 1 ]
then
    echo "Ok"
else
    wrong_version
fi
