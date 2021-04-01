module %name%

go 1.16

require (
  github.com/aws/aws-cdk-go/awscdk v%cdk-version%-devpreview
  github.com/aws/constructs-go/constructs/v3 v3.3.71
  github.com/aws/jsii-runtime-go v1.26.0

  // for testing
  github.com/tidwall/gjson v1.7.4
  github.com/stretchr/testify v1.7.0
)
