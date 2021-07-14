#!/bin/bash

function error {
  printf "\e[91;5;81m$@\e[0m\n"
}

function usage {
  echo "#######################################################################"
  echo "# run 'verify.integ.auth-apikey.sh [APIKEY] [ENDPOINT]' to run check  #"
  echo "#######################################################################"
}

if [[ -z $1 || -z $2 ]]; then
  error "Error: verification requires [APIKEY] [ENDPOINT]"
  usage
  exit 1
fi

echo "This should return { getTests: [] }: indicating that the data source is linked to the api"
curl -XPOST -H "Content-Type:application/graphql" -H "x-api-key:$1" -d '{ "query": "query { getTests { version } }" }" }' $2
echo ""