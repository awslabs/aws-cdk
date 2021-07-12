export const AWS_OLDER_REGIONS = new Set([
  'us-east-1',
  'us-west-1',
  'us-west-2',
  'us-gov-west-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'sa-east-1',
  'eu-west-1',
]);

export const AWS_CDK_METADATA = new Set([
  'us-east-2',
  'us-east-1',
  'us-west-1',
  'us-west-2',
  // 'us-gov-east-1',
  // 'us-gov-west-1',
  // 'us-iso-east-1',
  // 'us-isob-east-1',
  'af-south-1',
  'ap-south-1',
  'ap-east-1',
  // 'ap-northeast-3',
  'ap-northeast-2',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ca-central-1',
  'cn-north-1',
  'cn-northwest-1',
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-north-1',
  'eu-south-1',
  'me-south-1',
  'sa-east-1',
]);

/**
 * The hosted zone Id if using an alias record in Route53.
 *
 * @see https://docs.aws.amazon.com/general/latest/gr/rande.html#s3_website_region_endpoints
 */
export const ROUTE_53_BUCKET_WEBSITE_ZONE_IDS: { [region: string]: string } = {
  'af-south-1': 'Z11KHD8FBVPUYU',
  'ap-east-1': 'ZNB98KWMFR0R6',
  'ap-northeast-1': 'Z2M4EHUR26P7ZW',
  'ap-northeast-2': 'Z3W03O7B5YMIYP',
  'ap-northeast-3': 'Z2YQB5RD63NC85',
  'ap-south-1': 'Z11RGJOFQNVJUP',
  'ap-southeast-1': 'Z3O0J2DXBE1FTB',
  'ap-southeast-2': 'Z1WCIGYICN2BYD',
  'ca-central-1': 'Z1QDHH18159H29',
  'eu-central-1': 'Z21DNDUVLTQW6Q',
  'eu-north-1': 'Z3BAZG2TWCNX0D',
  'eu-south-1': 'Z3IXVV8C73GIO3',
  'eu-west-1': 'Z1BKCTXD74EZPE',
  'eu-west-2': 'Z3GKZC51ZF0DB4',
  'eu-west-3': 'Z3R1K369G5AVDG',
  'me-south-1': 'Z1MPMWCPA7YB62',
  'sa-east-1': 'Z7KQH4QJS55SO',
  'us-east-1': 'Z3AQBSTGFYJSTF',
  'us-east-2': 'Z2O1EMRO9K5GLX',
  'us-gov-east-1': 'Z2NIFVYYW2VKV1',
  'us-gov-west-1': 'Z31GFT0UA1I2HV',
  'us-west-1': 'Z2F56UZL2M1ACD',
  'us-west-2': 'Z3BJ6K6RIION7M',
};

interface Region { partition: string, domainSuffix: string }

export const PARTITION_MAP: { [region: string]: Region } = {
  'default': { partition: 'aws', domainSuffix: 'amazonaws.com' },
  'cn-': { partition: 'aws-cn', domainSuffix: 'amazonaws.com.cn' },
  'us-gov-': { partition: 'aws-us-gov', domainSuffix: 'amazonaws.com' },
  'us-iso-': { partition: 'aws-iso', domainSuffix: 'c2s.ic.gov' },
  'us-isob-': { partition: 'aws-iso-b', domainSuffix: 'sc2s.sgov.gov' },
};

// https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-access-logs.html#access-logging-bucket-permissions
export const ELBV2_ACCOUNTS: { [region: string]: string } = {
  'af-south-1': '098369216593',
  'ap-east-1': '754344448648',
  'ap-northeast-1': '582318560864',
  'ap-northeast-2': '600734575887',
  'ap-northeast-3': '383597477331',
  'ap-south-1': '718504428378',
  'ap-southeast-1': '114774131450',
  'ap-southeast-2': '783225319266',
  'ca-central-1': '985666609251',
  'cn-north-1': '638102146993',
  'cn-northwest-1': '037604701340',
  'eu-central-1': '054676820928',
  'eu-north-1': '897822967062',
  'eu-south-1': '635631232127',
  'eu-west-1': '156460612806',
  'eu-west-2': '652711504416',
  'eu-west-3': '009996457667',
  'me-south-1': '076674570225',
  'sa-east-1': '507241528517',
  'us-east-1': '127311923021',
  'us-east-2': '033677994240',
  'us-gov-east-1': '190560391635',
  'us-gov-west-1': '048591011584',
  'us-west-1': '027434742980',
  'us-west-2': '797873946194',
};

// https://aws.amazon.com/releasenotes/available-deep-learning-containers-images
export const DLC_REPOSITORY_ACCOUNTS: { [region: string]: string } = {
  'ap-east-1': '871362719292',
  'ap-northeast-1': '763104351884',
  'ap-northeast-2': '763104351884',
  'ap-south-1': '763104351884',
  'ap-southeast-1': '763104351884',
  'ap-southeast-2': '763104351884',
  'ca-central-1': '763104351884',
  'cn-north-1': '727897471807',
  'cn-northwest-1': '727897471807',
  'eu-central-1': '763104351884',
  'eu-north-1': '763104351884',
  'eu-west-1': '763104351884',
  'eu-west-2': '763104351884',
  'eu-west-3': '763104351884',
  'me-south-1': '217643126080',
  'sa-east-1': '763104351884',
  'us-east-1': '763104351884',
  'us-east-2': '763104351884',
  'us-west-1': '763104351884',
  'us-west-2': '763104351884',
};

// https://docs.aws.amazon.com/app-mesh/latest/userguide/envoy.html
export const APPMESH_ECR_ACCOUNTS: { [region: string]: string } = {
  'af-south-1': '924023996002',
  'ap-east-1': '856666278305',
  'ap-northeast-1': '840364872350',
  'ap-northeast-2': '840364872350',
  'ap-northeast-3': '840364872350',
  'ap-south-1': '840364872350',
  'ap-southeast-1': '840364872350',
  'ap-southeast-2': '840364872350',
  'ca-central-1': '840364872350',
  'eu-central-1': '840364872350',
  'eu-north-1': '840364872350',
  'eu-south-1': '422531588944',
  'eu-west-1': '840364872350',
  'eu-west-2': '840364872350',
  'eu-west-3': '840364872350',
  'me-south-1': '772975370895',
  'sa-east-1': '840364872350',
  'us-east-1': '840364872350',
  'us-east-2': '840364872350',
  'us-west-1': '840364872350',
  'us-west-2': '840364872350',
};

// https://docs.aws.amazon.com/firehose/latest/dev/controlling-access.html#using-iam-rs-vpc
export const FIREHOSE_CIDR_BLOCKS: { [region: string]: string } = {
  'us-east-1': '52.70.63.192',
  'us-east-2': '13.58.135.96',
  'us-west-1': '13.57.135.192',
  'us-west-2': '52.89.255.224',
  // TODO: the rest of the regions
  /*'': '18.253.138.96', //for AWS GovCloud (US-East)
'': '52.61.204.160', //for AWS GovCloud (US-West)
'': '35.183.92.128', //for Canada (Central)
'': '18.162.221.32', //for Asia Pacific (Hong Kong)
'': '13.232.67.32', //for Asia Pacific (Mumbai)
'': '13.209.1.64', //for Asia Pacific (Seoul)
'': '13.228.64.192', //for Asia Pacific (Singapore)
'': '13.210.67.224', //for Asia Pacific (Sydney)
'': '13.113.196.224', //for Asia Pacific (Tokyo)
'': '52.81.151.32', //for China (Beijing)
'': '161.189.23.64', //for China (Ningxia)
'': '35.158.127.160', //for Europe (Frankfurt)
'': '52.19.239.192', //for Europe (Ireland)
'': '18.130.1.96', //for Europe (London)
'': '35.180.1.96', //for Europe (Paris)
'': '13.53.63.224', //for Europe (Stockholm)
'': '15.185.91.0', //for Middle East (Bahrain)
'': '18.228.1.128', //for South America (São Paulo)
'': '15.161.135.128', //for Europe (Milan)
'': '13.244.121.224', //for Africa (Cape Town)
'': '13.208.177.192', //for Asia Pacific (Osaka)
*/
};
