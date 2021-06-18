import * as iam from '@aws-cdk/aws-iam';
import * as cxschema from '@aws-cdk/cloud-assembly-schema';
import { Aws, ContextProvider, IResource, Lazy, Resource, Stack, Token } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { Connections, IConnectable } from './connections';
import { CfnVPCEndpoint } from './ec2.generated';
import { Peer } from './peer';
import { Port } from './port';
import { ISecurityGroup, SecurityGroup } from './security-group';
import { allRouteTableIds, flatten } from './util';
import { ISubnet, IVpc, SubnetSelection } from './vpc';

/**
 * A VPC endpoint.
 */
export interface IVpcEndpoint extends IResource {
  /**
   * The VPC endpoint identifier.
   * @attribute
   */
  readonly vpcEndpointId: string;
}

export abstract class VpcEndpoint extends Resource implements IVpcEndpoint {
  public abstract readonly vpcEndpointId: string;

  protected policyDocument?: iam.PolicyDocument;

  /**
   * Adds a statement to the policy document of the VPC endpoint. The statement
   * must have a Principal.
   *
   * Not all interface VPC endpoints support policy. For more information
   * see https://docs.aws.amazon.com/vpc/latest/userguide/vpce-interface.html
   *
   * @param statement the IAM statement to add
   */
  public addToPolicy(statement: iam.PolicyStatement) {
    if (!statement.hasPrincipal) {
      throw new Error('Statement must have a `Principal`.');
    }

    if (!this.policyDocument) {
      this.policyDocument = new iam.PolicyDocument();
    }

    this.policyDocument.addStatements(statement);
  }
}

/**
 * A gateway VPC endpoint.
 */
export interface IGatewayVpcEndpoint extends IVpcEndpoint {
}

/**
 * The type of VPC endpoint.
 */
export enum VpcEndpointType {
  /**
   * Interface
   *
   * An interface endpoint is an elastic network interface with a private IP
   * address that serves as an entry point for traffic destined to a supported
   * service.
   */
  INTERFACE = 'Interface',

  /**
   * Gateway
   *
   * A gateway endpoint is a gateway that is a target for a specified route in
   * your route table, used for traffic destined to a supported AWS service.
   */
  GATEWAY = 'Gateway'
}

/**
 * A service for a gateway VPC endpoint.
 */
export interface IGatewayVpcEndpointService {
  /**
   * The name of the service.
   */
  readonly name: string;
}

/**
 * An AWS service for a gateway VPC endpoint.
 */
export class GatewayVpcEndpointAwsService implements IGatewayVpcEndpointService {
  public static readonly DYNAMODB = new GatewayVpcEndpointAwsService('dynamodb');
  public static readonly S3 = new GatewayVpcEndpointAwsService('s3');

  /**
   * The name of the service.
   */
  public readonly name: string;

  constructor(name: string, prefix?: string) {
    this.name = `${prefix || 'com.amazonaws'}.${Aws.REGION}.${name}`;
  }
}

/**
 * Options to add a gateway endpoint to a VPC.
 */
export interface GatewayVpcEndpointOptions {
  /**
   * The service to use for this gateway VPC endpoint.
   */
  readonly service: IGatewayVpcEndpointService;

  /**
   * Where to add endpoint routing.
   *
   * By default, this endpoint will be routable from all subnets in the VPC.
   * Specify a list of subnet selection objects here to be more specific.
   *
   * @default - All subnets in the VPC
   * @example
   *
   * vpc.addGatewayEndpoint('DynamoDbEndpoint', {
   *   service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
   *   // Add only to ISOLATED subnets
   *   subnets: [
   *     { subnetType: ec2.SubnetType.ISOLATED }
   *   ]
   * });
   *
   *
   */
  readonly subnets?: SubnetSelection[]
}

/**
 * Construction properties for a GatewayVpcEndpoint.
 */
export interface GatewayVpcEndpointProps extends GatewayVpcEndpointOptions {
  /**
   * The VPC network in which the gateway endpoint will be used.
   */
  readonly vpc: IVpc
}

/**
 * A gateway VPC endpoint.
 * @resource AWS::EC2::VPCEndpoint
 */
export class GatewayVpcEndpoint extends VpcEndpoint implements IGatewayVpcEndpoint {
  public static fromGatewayVpcEndpointId(scope: Construct, id: string, gatewayVpcEndpointId: string): IGatewayVpcEndpoint {
    class Import extends VpcEndpoint {
      public vpcEndpointId = gatewayVpcEndpointId;
    }

    return new Import(scope, id);
  }

  /**
   * The gateway VPC endpoint identifier.
   */
  public readonly vpcEndpointId: string;

  /**
   * The date and time the gateway VPC endpoint was created.
   * @attribute
   */
  public readonly vpcEndpointCreationTimestamp: string;

  /**
   * @attribute
   */
  public readonly vpcEndpointNetworkInterfaceIds: string[];

  /**
   * @attribute
   */
  public readonly vpcEndpointDnsEntries: string[];

  constructor(scope: Construct, id: string, props: GatewayVpcEndpointProps) {
    super(scope, id);

    const subnets: ISubnet[] = props.subnets
      ? flatten(props.subnets.map(s => props.vpc.selectSubnets(s).subnets))
      : [...props.vpc.privateSubnets, ...props.vpc.publicSubnets, ...props.vpc.isolatedSubnets];
    const routeTableIds = allRouteTableIds(subnets);

    if (routeTableIds.length === 0) {
      throw new Error('Can\'t add a gateway endpoint to VPC; route table IDs are not available');
    }

    const endpoint = new CfnVPCEndpoint(this, 'Resource', {
      policyDocument: Lazy.any({ produce: () => this.policyDocument }),
      routeTableIds,
      serviceName: props.service.name,
      vpcEndpointType: VpcEndpointType.GATEWAY,
      vpcId: props.vpc.vpcId,
    });

    this.vpcEndpointId = endpoint.ref;
    this.vpcEndpointCreationTimestamp = endpoint.attrCreationTimestamp;
    this.vpcEndpointDnsEntries = endpoint.attrDnsEntries;
    this.vpcEndpointNetworkInterfaceIds = endpoint.attrNetworkInterfaceIds;
  }
}

/**
 * A service for an interface VPC endpoint.
 */
export interface IInterfaceVpcEndpointService {
  /**
   * The name of the service.
   */
  readonly name: string;

  /**
   * The port of the service.
   */
  readonly port: number;

  /**
   * Whether Private DNS is supported by default.
   */
  readonly privateDnsDefault?: boolean;
}

/**
 * A custom-hosted service for an interface VPC endpoint.
 */
export class InterfaceVpcEndpointService implements IInterfaceVpcEndpointService {
  /**
   * The name of the service.
   */
  public readonly name: string;

  /**
   * The port of the service.
   */
  public readonly port: number;

  /**
   * Whether Private DNS is supported by default.
   */
  public readonly privateDnsDefault?: boolean = false;

  constructor(name: string, port?: number) {
    this.name = name;
    this.port = port || 443;
  }
}

/**
 * An AWS service for an interface VPC endpoint.
 */
export class InterfaceVpcEndpointAwsService implements IInterfaceVpcEndpointService {
  public static readonly SAGEMAKER_NOTEBOOK = new InterfaceVpcEndpointAwsService('notebook', 'aws.sagemaker');
  public static readonly ATHENA = new InterfaceVpcEndpointAwsService('athena');
  public static readonly CLOUDFORMATION = new InterfaceVpcEndpointAwsService('cloudformation');
  public static readonly CLOUDTRAIL = new InterfaceVpcEndpointAwsService('cloudtrail');
  public static readonly CODEBUILD = new InterfaceVpcEndpointAwsService('codebuild');
  public static readonly CODEBUILD_FIPS = new InterfaceVpcEndpointAwsService('codebuild-fips');
  public static readonly CODECOMMIT = new InterfaceVpcEndpointAwsService('codecommit');
  public static readonly CODECOMMIT_FIPS = new InterfaceVpcEndpointAwsService('codecommit-fips');
  public static readonly CODEPIPELINE = new InterfaceVpcEndpointAwsService('codepipeline');
  public static readonly CONFIG = new InterfaceVpcEndpointAwsService('config');
  public static readonly EC2 = new InterfaceVpcEndpointAwsService('ec2');
  public static readonly EC2_MESSAGES = new InterfaceVpcEndpointAwsService('ec2messages');
  public static readonly ECR = new InterfaceVpcEndpointAwsService('ecr.api');
  public static readonly ECR_DOCKER = new InterfaceVpcEndpointAwsService('ecr.dkr');
  public static readonly ECS = new InterfaceVpcEndpointAwsService('ecs');
  public static readonly ECS_AGENT = new InterfaceVpcEndpointAwsService('ecs-agent');
  public static readonly ECS_TELEMETRY = new InterfaceVpcEndpointAwsService('ecs-telemetry');
  public static readonly ELASTIC_FILESYSTEM = new InterfaceVpcEndpointAwsService('elasticfilesystem');
  public static readonly ELASTIC_FILESYSTEM_FIPS = new InterfaceVpcEndpointAwsService('elasticfilesystem-fips');
  public static readonly ELASTIC_INFERENCE_RUNTIME = new InterfaceVpcEndpointAwsService('elastic-inference.runtime');
  public static readonly ELASTIC_LOAD_BALANCING = new InterfaceVpcEndpointAwsService('elasticloadbalancing');
  public static readonly CLOUDWATCH_EVENTS = new InterfaceVpcEndpointAwsService('events');
  public static readonly APIGATEWAY = new InterfaceVpcEndpointAwsService('execute-api');
  public static readonly CODECOMMIT_GIT = new InterfaceVpcEndpointAwsService('git-codecommit');
  public static readonly CODECOMMIT_GIT_FIPS = new InterfaceVpcEndpointAwsService('git-codecommit-fips');
  public static readonly GLUE = new InterfaceVpcEndpointAwsService('glue');
  public static readonly KINESIS_STREAMS = new InterfaceVpcEndpointAwsService('kinesis-streams');
  public static readonly KINESIS_FIREHOSE = new InterfaceVpcEndpointAwsService('kinesis-firehose');
  public static readonly KMS = new InterfaceVpcEndpointAwsService('kms');
  public static readonly CLOUDWATCH_LOGS = new InterfaceVpcEndpointAwsService('logs');
  public static readonly CLOUDWATCH = new InterfaceVpcEndpointAwsService('monitoring');
  public static readonly RDS = new InterfaceVpcEndpointAwsService('rds');
  public static readonly SAGEMAKER_API = new InterfaceVpcEndpointAwsService('sagemaker.api');
  public static readonly SAGEMAKER_RUNTIME = new InterfaceVpcEndpointAwsService('sagemaker.runtime');
  public static readonly SAGEMAKER_RUNTIME_FIPS = new InterfaceVpcEndpointAwsService('sagemaker.runtime-fips');
  public static readonly SECRETS_MANAGER = new InterfaceVpcEndpointAwsService('secretsmanager');
  public static readonly SERVICE_CATALOG = new InterfaceVpcEndpointAwsService('servicecatalog');
  public static readonly SNS = new InterfaceVpcEndpointAwsService('sns');
  public static readonly SQS = new InterfaceVpcEndpointAwsService('sqs');
  public static readonly SSM = new InterfaceVpcEndpointAwsService('ssm');
  public static readonly SSM_MESSAGES = new InterfaceVpcEndpointAwsService('ssmmessages');
  public static readonly STS = new InterfaceVpcEndpointAwsService('sts');
  public static readonly TRANSFER = new InterfaceVpcEndpointAwsService('transfer.server');
  public static readonly STORAGE_GATEWAY = new InterfaceVpcEndpointAwsService('storagegateway');
  public static readonly REKOGNITION = new InterfaceVpcEndpointAwsService('rekognition');
  public static readonly REKOGNITION_FIPS = new InterfaceVpcEndpointAwsService('rekognition-fips');
  public static readonly STEP_FUNCTIONS = new InterfaceVpcEndpointAwsService('states');
  public static readonly LAMBDA = new InterfaceVpcEndpointAwsService('lambda');

  /**
   * The name of the service.
   */
  public readonly name: string;

  /**
   * The port of the service.
   */
  public readonly port: number;

  /**
   * Whether Private DNS is supported by default.
   */
  public readonly privateDnsDefault?: boolean = true;

  constructor(name: string, prefix?: string, port?: number) {
    const region = Lazy.uncachedString({
      produce: (context) => Stack.of(context.scope).region,
    });
    this.name = `${prefix || 'com.amazonaws'}.${region}.${name}`;
    this.port = port || 443;
  }
}

/**
 * Options to add an interface endpoint to a VPC.
 */
export interface InterfaceVpcEndpointOptions {
  /**
   * The service to use for this interface VPC endpoint.
   */
  readonly service: IInterfaceVpcEndpointService;

  /**
   * Whether to associate a private hosted zone with the specified VPC. This
   * allows you to make requests to the service using its default DNS hostname.
   *
   * @default set by the instance of IInterfaceVpcEndpointService, or true if
   * not defined by the instance of IInterfaceVpcEndpointService
   */
  readonly privateDnsEnabled?: boolean;

  /**
   * The subnets in which to create an endpoint network interface. At most one
   * per availability zone.
   *
   * @default - private subnets
   */
  readonly subnets?: SubnetSelection;

  /**
   * The security groups to associate with this interface VPC endpoint.
   *
   * @default - a new security group is created
   */
  readonly securityGroups?: ISecurityGroup[];

  /**
   * Whether to automatically allow VPC traffic to the endpoint
   *
   * If enabled, all traffic to the endpoint from within the VPC will be
   * automatically allowed. This is done based on the VPC's CIDR range.
   *
   * @default true
   */
  readonly open?: boolean;

  /**
   * Limit to only those availability zones where the endpoint service can be created
   *
   * Setting this to 'true' requires a lookup to be performed at synthesis time. Account
   * and region must be set on the containing stack for this to work.
   *
   * @default false
   */
  readonly lookupSupportedAzs?: boolean;
}

/**
 * Construction properties for an InterfaceVpcEndpoint.
 */
export interface InterfaceVpcEndpointProps extends InterfaceVpcEndpointOptions {
  /**
   * The VPC network in which the interface endpoint will be used.
   */
  readonly vpc: IVpc
}

/**
 * An interface VPC endpoint.
 */
export interface IInterfaceVpcEndpoint extends IVpcEndpoint, IConnectable {
}

/**
 * A interface VPC endpoint.
 * @resource AWS::EC2::VPCEndpoint
 */
export class InterfaceVpcEndpoint extends VpcEndpoint implements IInterfaceVpcEndpoint {
  /**
   * Imports an existing interface VPC endpoint.
   */
  public static fromInterfaceVpcEndpointAttributes(scope: Construct, id: string, attrs: InterfaceVpcEndpointAttributes): IInterfaceVpcEndpoint {
    const securityGroups = attrs.securityGroupId
      ? [SecurityGroup.fromSecurityGroupId(scope, 'SecurityGroup', attrs.securityGroupId)]
      : attrs.securityGroups;

    class Import extends Resource implements IInterfaceVpcEndpoint {
      public readonly vpcEndpointId = attrs.vpcEndpointId;
      public readonly connections = new Connections({
        defaultPort: Port.tcp(attrs.port),
        securityGroups,
      });
    }

    return new Import(scope, id);
  }

  /**
   * The interface VPC endpoint identifier.
   */
  public readonly vpcEndpointId: string;

  /**
   * The date and time the interface VPC endpoint was created.
   * @attribute
   */
  public readonly vpcEndpointCreationTimestamp: string;

  /**
   * The DNS entries for the interface VPC endpoint.
   * @attribute
   */
  public readonly vpcEndpointDnsEntries: string[];

  /**
   * One or more network interfaces for the interface VPC endpoint.
   * @attribute
   */
  public readonly vpcEndpointNetworkInterfaceIds: string[];

  /**
   * The identifier of the first security group associated with this interface
   * VPC endpoint.
   *
   * @deprecated use the `connections` object
   */
  public readonly securityGroupId: string;

  /**
   * Access to network connections.
   */
  public readonly connections: Connections;

  constructor(scope: Construct, id: string, props: InterfaceVpcEndpointProps) {
    super(scope, id);

    const securityGroups = props.securityGroups || [new SecurityGroup(this, 'SecurityGroup', {
      vpc: props.vpc,
    })];

    this.securityGroupId = securityGroups[0].securityGroupId;
    this.connections = new Connections({
      defaultPort: Port.tcp(props.service.port),
      securityGroups,
    });

    if (props.open !== false) {
      this.connections.allowDefaultPortFrom(Peer.ipv4(props.vpc.vpcCidrBlock));
    }

    // Determine which subnets to place the endpoint in
    const subnetIds = this.endpointSubnets(props);

    const endpoint = new CfnVPCEndpoint(this, 'Resource', {
      privateDnsEnabled: props.privateDnsEnabled ?? props.service.privateDnsDefault ?? true,
      policyDocument: Lazy.any({ produce: () => this.policyDocument }),
      securityGroupIds: securityGroups.map(s => s.securityGroupId),
      serviceName: props.service.name,
      vpcEndpointType: VpcEndpointType.INTERFACE,
      subnetIds,
      vpcId: props.vpc.vpcId,
    });

    this.vpcEndpointId = endpoint.ref;
    this.vpcEndpointCreationTimestamp = endpoint.attrCreationTimestamp;
    this.vpcEndpointDnsEntries = endpoint.attrDnsEntries;
    this.vpcEndpointNetworkInterfaceIds = endpoint.attrNetworkInterfaceIds;
  }

  /**
   * Determine which subnets to place the endpoint in. This is in its own function
   * because there's a lot of code.
   */
  private endpointSubnets(props: InterfaceVpcEndpointProps) {
    const lookupSupportedAzs = props.lookupSupportedAzs ?? false;
    const subnetSelection = props.vpc.selectSubnets({ ...props.subnets, onePerAz: true });
    const subnets = subnetSelection.subnets;

    // Sanity check the subnet count
    if (subnetSelection.subnets.length == 0) {
      throw new Error('Cannot create a VPC Endpoint with no subnets');
    }

    // If we aren't going to lookup supported AZs we'll exit early, returning the subnetIds from the provided subnet selection
    if (!lookupSupportedAzs) {
      return subnetSelection.subnetIds;
    }

    // Some service names, such as AWS service name references, use Tokens to automatically fill in the region
    // If it is an InterfaceVpcEndpointAwsService, then the reference will be resolvable since it only references the region
    const isAwsService = Token.isUnresolved(props.service.name) && props.service instanceof InterfaceVpcEndpointAwsService;

    // Determine what service name gets pass to the context provider
    // If it is an AWS service it will have a REGION token
    const lookupServiceName = isAwsService ? Stack.of(this).resolve(props.service.name) : props.service.name;

    // Check that the lookup will work
    this.validateCanLookupSupportedAzs(subnets, lookupServiceName);

    // Do the actual lookup for AZs
    const availableAZs = this.availableAvailabilityZones(lookupServiceName);
    const filteredSubnets = subnets.filter(s => availableAZs.includes(s.availabilityZone));

    // Throw an error if the lookup filtered out all subnets
    // VpcEndpoints must be created with at least one AZ
    if (filteredSubnets.length == 0) {
      throw new Error(`lookupSupportedAzs returned ${availableAZs} but subnets have AZs ${subnets.map(s => s.availabilityZone)}`);
    }
    return filteredSubnets.map(s => s.subnetId);
  }

  /**
   * Sanity checking when looking up AZs for an endpoint service, to make sure it won't fail
   */
  private validateCanLookupSupportedAzs(subnets: ISubnet[], serviceName: string) {
    // Having any of these be true will cause the AZ lookup to fail at synthesis time
    const agnosticAcct = Token.isUnresolved(this.stack.account);
    const agnosticRegion = Token.isUnresolved(this.stack.region);
    const agnosticService = Token.isUnresolved(serviceName);

    // Having subnets with Token AZs can cause the endpoint to be created with no subnets, failing at deployment time
    const agnosticSubnets = subnets.some(s => Token.isUnresolved(s.availabilityZone));
    const agnosticSubnetList = Token.isUnresolved(subnets.map(s => s.availabilityZone));

    // Context provider cannot make an AWS call without an account/region
    if (agnosticAcct || agnosticRegion) {
      throw new Error('Cannot look up VPC endpoint availability zones if account/region are not specified');
    }

    // The AWS call will fail if there is a Token in the service name
    if (agnosticService) {
      throw new Error(`Cannot lookup AZs for a service name with a Token: ${serviceName}`);
    }

    // The AWS call return strings for AZs, like us-east-1a, us-east-1b, etc
    // If the subnet AZs are Tokens, a string comparison between the subnet AZs and the AZs from the AWS call
    // will not match
    if (agnosticSubnets || agnosticSubnetList) {
      const agnostic = subnets.filter(s => Token.isUnresolved(s.availabilityZone));
      throw new Error(`lookupSupportedAzs cannot filter on subnets with Token AZs: ${agnostic}`);
    }
  }

  private availableAvailabilityZones(serviceName: string): string[] {
    // Here we check what AZs the endpoint service is available in
    // If for whatever reason we can't retrieve the AZs, and no context is set,
    // we will fall back to all AZs
    const availableAZs = ContextProvider.getValue(this, {
      provider: cxschema.ContextProvider.ENDPOINT_SERVICE_AVAILABILITY_ZONE_PROVIDER,
      dummyValue: this.stack.availabilityZones,
      props: { serviceName },
    }).value;
    if (!Array.isArray(availableAZs)) {
      throw new Error(`Discovered AZs for endpoint service ${serviceName} must be an array`);
    }
    return availableAZs;
  }
}

/**
 * Construction properties for an ImportedInterfaceVpcEndpoint.
 */
export interface InterfaceVpcEndpointAttributes {
  /**
   * The interface VPC endpoint identifier.
   */
  readonly vpcEndpointId: string;

  /**
   * The identifier of the security group associated with the interface VPC endpoint.
   *
   * @deprecated use `securityGroups` instead
   */
  readonly securityGroupId?: string;

  /**
   * The security groups associated with the interface VPC endpoint.
   *
   */
  readonly securityGroups?: ISecurityGroup[];

  /**
   * The port of the service of the interface VPC endpoint.
   */
  readonly port: number;
}
