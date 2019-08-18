import { PolicyStatement } from "@aws-cdk/aws-iam";
import { CfnOutput, Construct } from "@aws-cdk/core";
import { AmazonLinuxGeneration, AmazonLinuxImage, InstanceClass, InstanceSize, InstanceType } from ".";
import { Instance } from "./instance";
import { ISecurityGroup } from "./security-group";
import { IVpc, SubnetType } from "./vpc";

/**
 * Properties of the bastion host
 */
export interface BastionHostProps {

    /**
     * In which AZ to place the instance within the VPC
     *
     * @default - Random zone.
     */
    readonly availabilityZone?: string;

    /**
     * VPC to launch the instance in.
     */
    readonly vpc: IVpc;

    /**
     * The name of the instance
     *
     * @default - CDK generated name
     */
    readonly instanceName?: string;

    /**
     * Use public subnet instead of private one
     *
     * @default - false
     */
    readonly publicSubnets?: boolean;

    /**
     * Security Group to assign to this instance
     *
     * @default - create new security group
     */
    readonly securityGroup?: ISecurityGroup;
}

export class BastionHost extends Instance {
    constructor(scope: Construct, id: string, props: BastionHostProps) {
        super(scope, id, {
            vpc: props.vpc,
            availabilityZone: props.availabilityZone,
            securityGroup: props.securityGroup,
            instanceName: props.instanceName || 'BastionHost',
            instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.NANO),
            machineImage: new AmazonLinuxImage({ generation: AmazonLinuxGeneration.AMAZON_LINUX_2 }),
            vpcSubnets: props.publicSubnets ? { subnetType: SubnetType.PUBLIC } : { subnetType: SubnetType.PRIVATE },
        });
        this.addToRolePolicy(new PolicyStatement({
            actions: [
                'ssmmessages:*',
                'ssm:UpdateInstanceInformation',
                'ec2messages:*'
            ],
            resources: ['*'],
        }));
        this.addUserData('yum install -y https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/linux_amd64/amazon-ssm-agent.rpm');

        new CfnOutput(this, 'BastionHostId', {
            description: 'Instance ID of the bastion host. Use this to connect via SSM',
            value: this.instanceId,
        });
    }
}