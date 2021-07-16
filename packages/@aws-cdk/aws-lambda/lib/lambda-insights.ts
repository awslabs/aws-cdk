/**
 * Version of Lambda Insights.
 */
export class LambdaInsightsLayerVersion {

  /**
   * Use the insight version associated with the provided ARN. Make sure the ARN is associated
   * with same region as your function
   *
   * @see https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Lambda-Insights-extension-versions.html
   */
  public static fromInsightVersionArn(arn: string): LambdaInsightsLayerVersion {
    return new LambdaInsightsLayerVersion(arn);
  }

  /**
   * Use the insight version associated with the given region and version.
   */
  public static fromVersionAndRegion(props: LambdaInsightsVersionProps): LambdaInsightsLayerVersion {
    return new LambdaInsightsLayerVersion(
      LambdaInsightsVersionLookup.fromVersionAndRegion(props.insightsVersion, props.region));
  }

  /**
   * The ARN of the Lambda insights lambda layer.
   */
  readonly layerVersionArn: string;

  private constructor(arn: string) {
    this.layerVersionArn = arn;
  }
}

/**
 * Available versions of Lambda Insights
 */
export enum LambdaInsightsVersion {

  /**
   * 1.0.98.0
   */
  VERSION_1_0_98_0 = '1.0.98.0',

  /**
   * 1.0.89.0
   */
  VERSION_1_0_89_0 = '1.0.89.0',

  /**
   * 1.0.86.0
   */
  VERSION_1_0_86_0 = '1.0.86.0',

  /**
   * 1.0.54.0
   */
  VERSION_1_0_54_0 = '1.0.54.0'
}

/**
 * Properties that define a Lambda Insights version.
 */
export interface LambdaInsightsVersionProps {

  /**
   * The version of Lambda Insights to use, like 1.0.98.0
   * @see https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Lambda-Insights-extension-versions.html
   */
  readonly insightsVersion: LambdaInsightsVersion;

  /**
   * Region that Lambda Insights will be used in.
   */
  readonly region: string;
}


/**
 * Lookup of known lambda insights versions. These come from
 * https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Lambda-Insights-extension-versions.html
 */
class LambdaInsightsVersionLookup {

  public static fromVersionAndRegion(version: string, region: string): string {
    if (!this.lookupTable.hasOwnProperty(version)) {
      throw new Error(`Insights version ${version} is not a valid version, available versions are ${Object.keys(this.lookupTable)}`);
    }
    if (!this.lookupTable[version].hasOwnProperty(region)) {
      throw new Error(`Insights version ${version} is not supported in region ${region}`);
    }
    return this.lookupTable[version][region];
  }

  private static readonly lookupTable: { [key: string]: any } = {
    '1.0.98.0': {
      'us-east-1': 'arn:aws:lambda:us-east-1:580247275435:layer:LambdaInsightsExtension:14',
      'us-east-2': 'arn:aws:lambda:us-east-2:580247275435:layer:LambdaInsightsExtension:14',
      'us-west-1': 'arn:aws:lambda:us-west-1:580247275435:layer:LambdaInsightsExtension:14',
      'us-west-2': 'arn:aws:lambda:us-west-2:580247275435:layer:LambdaInsightsExtension:14',
      'af-south-1': 'arn:aws:lambda:af-south-1:012438385374:layer:LambdaInsightsExtension:8',
      'ap-east-1': 'arn:aws:lambda:ap-east-1:519774774795:layer:LambdaInsightsExtension:8',
      'ap-south-1': 'arn:aws:lambda:ap-south-1:580247275435:layer:LambdaInsightsExtension:14',
      'ap-northeast-2': 'arn:aws:lambda:ap-northeast-2:580247275435:layer:LambdaInsightsExtension:14',
      'ap-southeast-1': 'arn:aws:lambda:ap-southeast-1:580247275435:layer:LambdaInsightsExtension:14',
      'ap-southeast-2': 'arn:aws:lambda:ap-southeast-2:580247275435:layer:LambdaInsightsExtension:14',
      'ap-northeast-1': 'arn:aws:lambda:ap-northeast-1:580247275435:layer:LambdaInsightsExtension:14',
      'ca-central-1': 'arn:aws:lambda:ca-central-1:580247275435:layer:LambdaInsightsExtension:14',
      'cn-north-1': 'arn:aws-cn:lambda:cn-north-1:488211338238:layer:LambdaInsightsExtension:8',
      'cn-northwest-1': 'arn:aws-cn:lambda:cn-northwest-1:488211338238:layer:LambdaInsightsExtension:8',
      'eu-central-1': 'arn:aws:lambda:eu-central-1:580247275435:layer:LambdaInsightsExtension:14',
      'eu-west-1': 'arn:aws:lambda:eu-west-1:580247275435:layer:LambdaInsightsExtension:14',
      'eu-west-2': 'arn:aws:lambda:eu-west-2:580247275435:layer:LambdaInsightsExtension:14',
      'eu-south-1': 'arn:aws:lambda:eu-south-1:339249233099:layer:LambdaInsightsExtension:8',
      'eu-west-3': 'arn:aws:lambda:eu-west-3:580247275435:layer:LambdaInsightsExtension:14',
      'eu-north-1': 'arn:aws:lambda:eu-north-1:580247275435:layer:LambdaInsightsExtension:14',
      'me-south-1': 'arn:aws:lambda:me-south-1:285320876703:layer:LambdaInsightsExtension:8',
      'sa-east-1': 'arn:aws:lambda:sa-east-1:580247275435:layer:LambdaInsightsExtension:14',
    },
    '1.0.89.0': {
      'us-east-1': 'arn:aws:lambda:us-east-1:580247275435:layer:LambdaInsightsExtension:12',
      'us-east-2': 'arn:aws:lambda:us-east-2:580247275435:layer:LambdaInsightsExtension:12',
      'us-west-1': 'arn:aws:lambda:us-west-1:580247275435:layer:LambdaInsightsExtension:12',
      'us-west-2': 'arn:aws:lambda:us-west-2:580247275435:layer:LambdaInsightsExtension:12',
      'ap-south-1': 'arn:aws:lambda:ap-south-1:580247275435:layer:LambdaInsightsExtension:12',
      'ap-northeast-2': 'arn:aws:lambda:ap-northeast-2:580247275435:layer:LambdaInsightsExtension:12',
      'ap-southeast-1': 'arn:aws:lambda:ap-southeast-1:580247275435:layer:LambdaInsightsExtension:12',
      'ap-southeast-2': 'arn:aws:lambda:ap-southeast-2:580247275435:layer:LambdaInsightsExtension:12',
      'ap-northeast-1': 'arn:aws:lambda:ap-northeast-1:580247275435:layer:LambdaInsightsExtension:12',
      'ca-central-1': 'arn:aws:lambda:ca-central-1:580247275435:layer:LambdaInsightsExtension:12',
      'eu-central-1': 'arn:aws:lambda:eu-central-1:580247275435:layer:LambdaInsightsExtension:12',
      'eu-west-1': 'arn:aws:lambda:eu-west-1:580247275435:layer:LambdaInsightsExtension:12',
      'eu-west-2': 'arn:aws:lambda:eu-west-2:580247275435:layer:LambdaInsightsExtension:12',
      'eu-west-3': 'arn:aws:lambda:eu-west-3:580247275435:layer:LambdaInsightsExtension:12',
      'eu-north-1': 'arn:aws:lambda:eu-north-1:580247275435:layer:LambdaInsightsExtension:12',
      'sa-east-1': 'arn:aws:lambda:sa-east-1:580247275435:layer:LambdaInsightsExtension:12',
    },
    '1.0.86.0': {
      'us-east-1': 'arn:aws:lambda:us-east-1:580247275435:layer:LambdaInsightsExtension:11',
      'us-east-2': 'arn:aws:lambda:us-east-2:580247275435:layer:LambdaInsightsExtension:11',
      'us-west-1': 'arn:aws:lambda:us-west-1:580247275435:layer:LambdaInsightsExtension:11',
      'us-west-2': 'arn:aws:lambda:us-west-2:580247275435:layer:LambdaInsightsExtension:11',
      'ap-south-1': 'arn:aws:lambda:ap-south-1:580247275435:layer:LambdaInsightsExtension:11',
      'ap-northeast-2': 'arn:aws:lambda:ap-northeast-2:580247275435:layer:LambdaInsightsExtension:11',
      'ap-southeast-1': 'arn:aws:lambda:ap-southeast-1:580247275435:layer:LambdaInsightsExtension:11',
      'ap-southeast-2': 'arn:aws:lambda:ap-southeast-2:580247275435:layer:LambdaInsightsExtension:11',
      'ap-northeast-1': 'arn:aws:lambda:ap-northeast-1:580247275435:layer:LambdaInsightsExtension:11',
      'ca-central-1': 'arn:aws:lambda:ca-central-1:580247275435:layer:LambdaInsightsExtension:11',
      'eu-central-1': 'arn:aws:lambda:eu-central-1:580247275435:layer:LambdaInsightsExtension:11',
      'eu-west-1': 'arn:aws:lambda:eu-west-1:580247275435:layer:LambdaInsightsExtension:11',
      'eu-west-2': 'arn:aws:lambda:eu-west-2:580247275435:layer:LambdaInsightsExtension:11',
      'eu-west-3': 'arn:aws:lambda:eu-west-3:580247275435:layer:LambdaInsightsExtension:11',
      'eu-north-1': 'arn:aws:lambda:eu-north-1:580247275435:layer:LambdaInsightsExtension:11',
      'sa-east-1': 'arn:aws:lambda:sa-east-1:580247275435:layer:LambdaInsightsExtension:11',
    },
    '1.0.54.0': {
      'us-east-1': 'arn:aws:lambda:us-east-1:580247275435:layer:LambdaInsightsExtension:2',
      'us-east-2': 'arn:aws:lambda:us-east-2:580247275435:layer:LambdaInsightsExtension:2',
      'us-west-1': 'arn:aws:lambda:us-west-1:580247275435:layer:LambdaInsightsExtension:2',
      'us-west-2': 'arn:aws:lambda:us-west-2:580247275435:layer:LambdaInsightsExtension:2',
      'ap-south-1': 'arn:aws:lambda:ap-south-1:580247275435:layer:LambdaInsightsExtension:2',
      'ap-northeast-2': 'arn:aws:lambda:ap-northeast-2:580247275435:layer:LambdaInsightsExtension:2',
      'ap-southeast-1': 'arn:aws:lambda:ap-southeast-1:580247275435:layer:LambdaInsightsExtension:2',
      'ap-southeast-2': 'arn:aws:lambda:ap-southeast-2:580247275435:layer:LambdaInsightsExtension:2',
      'ap-northeast-1': 'arn:aws:lambda:ap-northeast-1:580247275435:layer:LambdaInsightsExtension:2',
      'ca-central-1': 'arn:aws:lambda:ca-central-1:580247275435:layer:LambdaInsightsExtension:2',
      'eu-central-1': 'arn:aws:lambda:eu-central-1:580247275435:layer:LambdaInsightsExtension:2',
      'eu-west-1': 'arn:aws:lambda:eu-west-1:580247275435:layer:LambdaInsightsExtension:2',
      'eu-west-2': 'arn:aws:lambda:eu-west-2:580247275435:layer:LambdaInsightsExtension:2',
      'eu-west-3': 'arn:aws:lambda:eu-west-3:580247275435:layer:LambdaInsightsExtension:2',
      'eu-north-1': 'arn:aws:lambda:eu-north-1:580247275435:layer:LambdaInsightsExtension:2',
      'sa-east-1': 'arn:aws:lambda:sa-east-1:580247275435:layer:LambdaInsightsExtension:2',
    },
  }
}