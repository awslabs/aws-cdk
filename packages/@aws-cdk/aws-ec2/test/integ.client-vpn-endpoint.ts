import * as path from 'path';
import * as logs from '@aws-cdk/aws-logs';
import { App, CustomResource, CustomResourceProvider, CustomResourceProviderRuntime, RemovalPolicy, Stack, StackProps } from '@aws-cdk/core';
import { Construct } from 'constructs';
import * as ec2 from '../lib';

// keep this import separate from other imports to reduce chance for merge conflicts with v2-main
// eslint-disable-next-line no-duplicate-imports, import/order
import { Construct as CoreConstruct } from '@aws-cdk/core';

class TestStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Import server and client certificates in ACM
    const certificates = new ImportCertificates(this, 'ImportCertificates');

    const vpc = new ec2.Vpc(this, 'Vpc', { maxAzs: 2, natGateways: 0 });
    vpc.node.addDependency(certificates); // ensure certificates are deleted last, when not in use anymore

    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      removalPolicy: RemovalPolicy.DESTROY,
    });

    vpc.addClientVpnEndpoint('Endpoint', {
      cidr: '10.100.0.0/16',
      serverCertificateArn: certificates.serverCertificateArn,
      clientCertificateArn: certificates.clientCertificateArn,
      logGroup,
    });
  }
}

const IMPORT_CERTIFICATES_RESOURCE_TYPE = 'Custom::ACMImportCertificates';

class ImportCertificates extends CoreConstruct {
  public readonly serverCertificateArn: string;
  public readonly clientCertificateArn: string;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const serviceToken = CustomResourceProvider.getOrCreate(this, IMPORT_CERTIFICATES_RESOURCE_TYPE, {
      codeDirectory: path.join(__dirname, 'import-certificates-handler'),
      runtime: CustomResourceProviderRuntime.NODEJS_12,
      policyStatements: [{
        Effect: 'Allow',
        Action: ['acm:ImportCertificate', 'acm:DeleteCertificate'],
        Resource: '*',
      }],
    });

    const createCertificates = new CustomResource(this, 'CreateCertificates', {
      resourceType: IMPORT_CERTIFICATES_RESOURCE_TYPE,
      serviceToken,
    });
    this.serverCertificateArn = createCertificates.getAttString('ClientCertificateArn');
    this.clientCertificateArn = createCertificates.getAttString('ServerCertificateArn');

    new CustomResource(this, 'DeleteCertificates', {
      resourceType: IMPORT_CERTIFICATES_RESOURCE_TYPE,
      serviceToken,
      properties: {
        ServerCertificateArn: this.serverCertificateArn,
        ClientCertificateArn: this.clientCertificateArn,
      },
    });
  }
}

const app = new App();
new TestStack(app, 'cdk-ec2-client-vpn-endpoint');
app.synth();
