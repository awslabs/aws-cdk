import * as crypto from 'crypto';
import { IVpcEndpointService } from '@aws-cdk/aws-ec2';
import { Fn } from '@aws-cdk/core';
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from '@aws-cdk/custom-resources';
import { Construct } from 'constructs';
import { IPublicHostedZone, TxtRecord } from '../lib';

// v2 - keep this import as a separate section to reduce merge conflict when forward merging with the v2 branch.
// eslint-disable-next-line
import { Construct as CoreConstruct } from '@aws-cdk/core';

/**
 * Properties to configure a VPC Endpoint Service domain name
 */
export interface VpcEndpointServiceDomainNameProps {

  /**
   * The VPC Endpoint Service to configure Private DNS for
   */
  readonly endpointService: IVpcEndpointService;

  /**
   * The domain name to use.
   *
   * This domain name must be verifiably owned by this account, or otherwise
   * delegated to this account.
   * @see https://docs.aws.amazon.com/vpc/latest/userguide/endpoint-services-dns-validation.html
   */
  readonly domainName: string;

  /**
   * The public hosted zone to use for the domain.
   */
  readonly publicHostedZone: IPublicHostedZone;
}

/**
 * A Private DNS configuration for a VPC endpoint service.
 */
export class VpcEndpointServiceDomainName extends CoreConstruct {

  // Track all domain names created, so someone doesn't accidentally associate two domains with a single service
  private static readonly endpointServices: IVpcEndpointService[] = [];

  // The way this class works is by using three custom resources and a TxtRecord in conjunction
  // The first custom resource tells the VPC endpoint service to use the given DNS name
  // The VPC endpoint service will then say:
  // "ok, create a TXT record using these two values to prove you own the domain"
  // The second custom resource retrieves these two values from the service
  // The TxtRecord is created from these two values
  // The third custom resource tells the VPC Endpoint Service to verify the domain ownership
  constructor(scope: Construct, id: string, props: VpcEndpointServiceDomainNameProps) {
    super(scope, id);

    // Make sure a user doesn't accidentally add multiple domains
    this.validateProps(props);
    VpcEndpointServiceDomainName.endpointServices.push(props.endpointService);

    const serviceId = props.endpointService.vpcEndpointServiceId;
    const privateDnsName = props.domainName;

    // Enable Private DNS on the endpoint service and retrieve the AWS-generated configuration
    const privateDnsConfiguration = this.getPrivateDnsConfiguration(id, serviceId, privateDnsName);

    // Tell AWS to verify that this account owns the domain attached to the service
    this.verifyPrivateDnsConfiguration(privateDnsConfiguration, props.publicHostedZone);

    // Finally, don't do any of the above before the endpoint service is created
    this.node.addDependency(props.endpointService);
  }

  private validateProps(props: VpcEndpointServiceDomainNameProps): void {
    if (VpcEndpointServiceDomainName.endpointServices.includes(props.endpointService)) {
      throw new Error(
        'Cannot create a VpcEndpointServiceDomainName for service ' +
        props.endpointService.node.uniqueId +
        ', another VpcEndpointServiceDomainName is already associated with it');
    }
  }

  /**
   * Sets up Custom Resources to make AWS calls to set up Private DNS on an endpoint service,
   * returning the values to use in a TxtRecord, which AWS uses to verify domain ownership.
   */
  private getPrivateDnsConfiguration(id: string, serviceId: string, privateDnsName: string): PrivateDnsConfiguration {

    // The custom resource which tells AWS to enable Private DNS on the given service, using the given domain name
    // AWS will generate a name/value pair for use in a TxtRecord, which is used to verify domain ownership.
    const enablePrivateDnsAction = {
      service: 'EC2',
      action: 'modifyVpcEndpointServiceConfiguration',
      parameters: {
        ServiceId: serviceId,
        PrivateDnsName: privateDnsName,
      },
      physicalResourceId: PhysicalResourceId.of(id),
    };
    const removePrivateDnsAction = {
      service: 'EC2',
      action: 'modifyVpcEndpointServiceConfiguration',
      parameters: {
        ServiceId: serviceId,
        RemovePrivateDnsName: true,
      },
    };
    const enable = new AwsCustomResource(this, 'EnableDns', {
      onCreate: enablePrivateDnsAction,
      onUpdate: enablePrivateDnsAction,
      onDelete: removePrivateDnsAction,
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });

    // Look up the name/value pair if the domain changes, or the service changes,
    // which would cause the values to be different. If the unique ID changes,
    // the resource may be entirely recreated, so we will need to look it up again.
    const lookup = hashcode(this.node.uniqueId + serviceId + privateDnsName);

    // Create the custom resource to look up the name/value pair generated by AWS
    // after the previous API call
    const retriveNameValuePairAction = {
      service: 'EC2',
      action: 'describeVpcEndpointServiceConfigurations',
      parameters: {
        ServiceIds: [serviceId],
      },
      physicalResourceId: PhysicalResourceId.of(lookup),
    };
    const getNames = new AwsCustomResource(this, 'GetNames', {
      onCreate: retriveNameValuePairAction,
      onUpdate: retriveNameValuePairAction,
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });

    // We only want to call and get the name/value pair after we've told AWS to enable Private DNS
    // If we call before then, we'll get an empty pair of values.
    getNames.node.addDependency(enable);

    // Get the references to the name/value pair associated with the endpoint service
    const name = getNames.getResponseField('ServiceConfigurations.0.PrivateDnsNameConfiguration.Name');
    const value = getNames.getResponseField('ServiceConfigurations.0.PrivateDnsNameConfiguration.Value');

    return { name, value, serviceId };
  }

  /**
   * Creates a Route53 entry and a Custom Resource which explicitly tells AWS to verify ownership
   * of the domain name attached to an endpoint service.
   */
  private verifyPrivateDnsConfiguration(config: PrivateDnsConfiguration, publicHostedZone: IPublicHostedZone) {
    // Create the TXT record in the provided hosted zone
    const verificationRecord = new TxtRecord(this, 'DnsVerificationRecord', {
      recordName: config.name,
      values: [config.value],
      zone: publicHostedZone,
    });

    // Tell the endpoint service to verify the domain ownership
    const startVerificationAction = {
      service: 'EC2',
      action: 'startVpcEndpointServicePrivateDnsVerification',
      parameters: {
        ServiceId: config.serviceId,
      },
      physicalResourceId: PhysicalResourceId.of(Fn.join(':', [config.name, config.value])),
    };
    const startVerification = new AwsCustomResource(this, 'StartVerification', {
      onCreate: startVerificationAction,
      onUpdate: startVerificationAction,
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });
    // Only verify after the record has been created
    startVerification.node.addDependency(verificationRecord);
  }
}

/**
 * Represent the name/value pair associated with a Private DNS enabled endpoint service
 */
interface PrivateDnsConfiguration {
  readonly name: string;
  readonly value: string;
  readonly serviceId: string;
}

/**
 * Hash a string
 */
function hashcode(s: string): string {
  const hash = crypto.createHash('md5');
  hash.update(s);
  return hash.digest('hex');
};