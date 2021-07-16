#!/bin/bash

function error {
  printf "\e[91;5;81m$@\e[0m\n"
}

function usage {
  echo "##################################################################################"
  echo "# run 'verify.integ.appsync-lambda.sh --start' to deploy                         #"
  echo "# run 'verify.integ.appsync-lambda.sh --check [APIKEY] [ENDPOINT]' to run check  #"
  echo "# run 'verify.integ.appsync-lambda.sh --clean' to clean up stack                 #"
  echo "##################################################################################"
}

if [[ "$1" == "--start" ]]; then
  cdk deploy --app "node integ.appsync-lambda.js"
elif [[ "$1" == "--check" ]]; then
  if [[ -z $2 || -z $3 ]]; then
    error "Error: --check flag requires [APIKEY] [ENDPOINT]"
    usage
    exit 1
  fi
  echo THIS TEST SHOULD PRODUCE A LIST OF BOOKS
  curl -XPOST -H "Content-Type:application/graphql" -H "x-api-key:$2" -d '{ "query": "query { allPosts { id author title relatedPosts { id title } } }" }" }' $3 | json_pp
  echo ""
elif [[ "$1" == "--clean" ]];then
  cdk destroy --app "node integ.appsync-lambda.js"
else
  error "Error: use flags --start, --check, --clean"
  usage
  exit 1
fi