import fs = require('fs-extra');
import path = require('path');
import { AWS_REGIONS, AWS_SERVICES } from './aws-entities';

async function main(): Promise<void> {
  const lines = [
    "import { Fact, FactName } from './region-info';",
    '',
    '// tslint:disable:object-literal-key-quotes',
    '// tslint:disable:max-line-length',
    '',
    '/**',
    ' * Built-in regional information, re-generated by `npm run build`.',
    ' *',
    ` * @generated ${new Date().toISOString()}`,
    ' */',
    'export class BuiltIns {',
    '  /**',
    '   * Registers all the built in regional data in the RegionInfo database.',
    '   */',
    '  public static register(): void {',
  ];

  const AWS_OLDER_REGIONS = new Set([
    'us-east-1',
    'us-west-1',
    'us-west-2',
    'ap-southeast-1',
    'ap-southeast-2',
    'ap-northeast-1',
    'sa-east-1'
  ]);

  const AWS_CDK_METADATA = new Set([
    'us-east-2',
    'us-east-1',
    'us-west-1',
    'us-west-2',
    'ap-south-1',
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
    'sa-east-1',
  ]);

  for (const region of AWS_REGIONS) {
    const partition = region.startsWith('cn-') ? 'aws-cn' : 'aws';
    registerFact(region, 'partition', partition);

    const domainSuffix = partition === 'aws' ? 'amazonaws.com' : 'amazonaws.com.cn';
    registerFact(region, 'domainSuffix', domainSuffix);

    registerFact(region, 'cdkMetadataResourceAvailable', AWS_CDK_METADATA.has(region) ? 'YES' : 'NO');

    registerFact(region, 's3StaticWebsiteEndpoint', AWS_OLDER_REGIONS.has(region)
      ? `s3-website-${region}.${domainSuffix}`
      : `s3-website.${region}.${domainSuffix}`);

    for (const service of AWS_SERVICES) {
      registerFact(region, ['servicePrincipal', service], servicePrincipal(region, service, domainSuffix));
    }
  }
  lines.push('  }');
  lines.push('');
  lines.push('  private constructor() {}'),
  lines.push('}');

  await fs.writeFile(path.resolve(__dirname, '..', 'lib', 'built-ins.generated.ts'), lines.join('\n'));

  function registerFact(region: string, name: string | string[], value: string) {
    const factName = typeof name === 'string' ? name : `${name[0]}(${name.slice(1).map(s => JSON.stringify(s)).join(', ')})`;
    lines.push(`    Fact.register({ region: ${JSON.stringify(region)}, name: FactName.${factName}, value: ${JSON.stringify(value)} });`);
  }

  function servicePrincipal(region: string, service: string, domainSuffix: string): string {
    switch (service) {
      // Services with a regional AND partitional principal
      case 'codedeploy':
      case 'logs':
        return `${service}.${region}.${domainSuffix}`;

      // Services with a partitional principal
      case 'application-autoscaling':
      case 'autoscaling':
      case 'ec2':
      case 'events':
      case 'lambda':
        return `${service}.${domainSuffix}`;

      // Services with a regional principal
      case 'states':
        return `${service}.${region}.amazonaws.com`;

      // Services with a universal principal across all regions/partitions
      case 'sns':
      case 'sqs':
      default:
        return `${service}.amazonaws.com`;
    }
  }
}

main().catch(e => {
  // tslint:disable-next-line: no-console
  console.error(e);
  process.exit(-1);
});
