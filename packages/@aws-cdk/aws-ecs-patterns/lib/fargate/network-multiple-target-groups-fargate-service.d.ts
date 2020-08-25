import { FargatePlatformVersion, FargateService, FargateTaskDefinition } from '@aws-cdk/aws-ecs';
import { NetworkTargetGroup } from '@aws-cdk/aws-elasticloadbalancingv2';
import { Construct } from '@aws-cdk/core';
import { NetworkMultipleTargetGroupsServiceBase, NetworkMultipleTargetGroupsServiceBaseProps } from '../base/network-multiple-target-groups-service-base';
/**
 * The properties for the NetworkMultipleTargetGroupsFargateService service.
 */
export interface NetworkMultipleTargetGroupsFargateServiceProps extends NetworkMultipleTargetGroupsServiceBaseProps {
    /**
     * The task definition to use for tasks in the service. Only one of TaskDefinition or TaskImageOptions must be specified.
     *
     * [disable-awslint:ref-via-interface]
     *
     * @default - none
     */
    readonly taskDefinition?: FargateTaskDefinition;
    /**
     * The number of cpu units used by the task.
     *
     * Valid values, which determines your range of valid values for the memory parameter:
     *
     * 256 (.25 vCPU) - Available memory values: 0.5GB, 1GB, 2GB
     *
     * 512 (.5 vCPU) - Available memory values: 1GB, 2GB, 3GB, 4GB
     *
     * 1024 (1 vCPU) - Available memory values: 2GB, 3GB, 4GB, 5GB, 6GB, 7GB, 8GB
     *
     * 2048 (2 vCPU) - Available memory values: Between 4GB and 16GB in 1GB increments
     *
     * 4096 (4 vCPU) - Available memory values: Between 8GB and 30GB in 1GB increments
     *
     * This default is set in the underlying FargateTaskDefinition construct.
     *
     * @default 256
     */
    readonly cpu?: number;
    /**
     * The amount (in MiB) of memory used by the task.
     *
     * This field is required and you must use one of the following values, which determines your range of valid values
     * for the cpu parameter:
     *
     * 512 (0.5 GB), 1024 (1 GB), 2048 (2 GB) - Available cpu values: 256 (.25 vCPU)
     *
     * 1024 (1 GB), 2048 (2 GB), 3072 (3 GB), 4096 (4 GB) - Available cpu values: 512 (.5 vCPU)
     *
     * 2048 (2 GB), 3072 (3 GB), 4096 (4 GB), 5120 (5 GB), 6144 (6 GB), 7168 (7 GB), 8192 (8 GB) - Available cpu values: 1024 (1 vCPU)
     *
     * Between 4096 (4 GB) and 16384 (16 GB) in increments of 1024 (1 GB) - Available cpu values: 2048 (2 vCPU)
     *
     * Between 8192 (8 GB) and 30720 (30 GB) in increments of 1024 (1 GB) - Available cpu values: 4096 (4 vCPU)
     *
     * This default is set in the underlying FargateTaskDefinition construct.
     *
     * @default 512
     */
    readonly memoryLimitMiB?: number;
    /**
     * Determines whether the service will be assigned a public IP address.
     *
     * @default false
     */
    readonly assignPublicIp?: boolean;
    /**
     * The platform version on which to run your service.
     *
     * If one is not specified, the LATEST platform version is used by default. For more information, see
     * [AWS Fargate Platform Versions](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/platform_versions.html)
     * in the Amazon Elastic Container Service Developer Guide.
     *
     * @default Latest
     */
    readonly platformVersion?: FargatePlatformVersion;
}
/**
 * A Fargate service running on an ECS cluster fronted by a network load balancer.
 */
export declare class NetworkMultipleTargetGroupsFargateService extends NetworkMultipleTargetGroupsServiceBase {
    /**
     * Determines whether the service will be assigned a public IP address.
     */
    readonly assignPublicIp: boolean;
    /**
     * The Fargate service in this construct.
     */
    readonly service: FargateService;
    /**
     * The Fargate task definition in this construct.
     */
    readonly taskDefinition: FargateTaskDefinition;
    /**
     * The default target group for the service.
     */
    readonly targetGroup: NetworkTargetGroup;
    /**
     * Constructs a new instance of the NetworkMultipleTargetGroupsFargateService class.
     */
    constructor(scope: Construct, id: string, props?: NetworkMultipleTargetGroupsFargateServiceProps);
    private createFargateService;
}
