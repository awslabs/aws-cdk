import * as autoscaling from '@aws-cdk/aws-autoscaling';
import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import * as logs from '@aws-cdk/aws-logs';
import * as s3 from '@aws-cdk/aws-s3';
import * as cloudmap from '@aws-cdk/aws-servicediscovery';
import * as ssm from '@aws-cdk/aws-ssm';
import { Duration, Lazy, IResource, Resource, Stack, Aspects, IAspect, IConstruct } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { InstanceDrainHook } from './drain-hook/instance-drain-hook';
import { ECSMetrics } from './ecs-canned-metrics.generated';
import { CfnCluster, CfnCapacityProvider, CfnClusterCapacityProviderAssociations } from './ecs.generated';

// v2 - keep this import as a separate section to reduce merge conflict when forward merging with the v2 branch.
// eslint-disable-next-line
import { Construct as CoreConstruct } from '@aws-cdk/core';

/**
 * The properties used to define an ECS cluster.
 */
export interface ClusterProps {
  /**
   * The name for the cluster.
   *
   * @default CloudFormation-generated name
   */
  readonly clusterName?: string;

  /**
   * The VPC where your ECS instances will be running or your ENIs will be deployed
   *
   * @default - creates a new VPC with two AZs
   */
  readonly vpc?: ec2.IVpc;

  /**
   * The service discovery namespace created in this cluster
   *
   * @default - no service discovery namespace created, you can use `addDefaultCloudMapNamespace` to add a
   * default service discovery namespace later.
   */
  readonly defaultCloudMapNamespace?: CloudMapNamespaceOptions;

  /**
   * The ec2 capacity to add to the cluster
   *
   * @default - no EC2 capacity will be added, you can use `addCapacity` to add capacity later.
   */
  readonly capacity?: AddCapacityOptions;

  /**
   * The capacity providers to add to the cluster
   *
   * @default - None. Currently only FARGATE and FARGATE_SPOT are supported.
   * @deprecated Use {@link ClusterProps.enableFargateCapacityProviders} instead.
   */
  readonly capacityProviders?: string[];

  /**
   * Whether to enable Fargate Capacity Providers
   *
   * @default false
   */
  readonly enableFargateCapacityProviders?: boolean;

  /**
   * If true CloudWatch Container Insights will be enabled for the cluster
   *
   * @default - Container Insights will be disabled for this cluser.
   */
  readonly containerInsights?: boolean;

  /**
   * The execute command configuration for the cluster
   *
   * @default - no configuration will be provided.
   */
  readonly executeCommandConfiguration?: ExecuteCommandConfiguration;
}

/**
 * The machine image type
 */
export enum MachineImageType {
  /**
   * Amazon ECS-optimized Amazon Linux 2 AMI
   */
  AMAZON_LINUX_2,
  /**
   * Bottlerocket AMI
   */
  BOTTLEROCKET
}

/**
 * A regional grouping of one or more container instances on which you can run tasks and services.
 */
export class Cluster extends Resource implements ICluster {
  /**
   * Import an existing cluster to the stack from its attributes.
   */
  public static fromClusterAttributes(scope: Construct, id: string, attrs: ClusterAttributes): ICluster {
    return new ImportedCluster(scope, id, attrs);
  }

  /**
   * Manage the allowed network connections for the cluster with Security Groups.
   */
  public readonly connections: ec2.Connections = new ec2.Connections();

  /**
   * The VPC associated with the cluster.
   */
  public readonly vpc: ec2.IVpc;

  /**
   * The Amazon Resource Name (ARN) that identifies the cluster.
   */
  public readonly clusterArn: string;

  /**
   * The name of the cluster.
   */
  public readonly clusterName: string;

  /**
   * The names of both ASG and Fargate capacity providers associated with the cluster.
   */
  private _capacityProviderNames: string[] = [];

  /**
   * The AWS Cloud Map namespace to associate with the cluster.
   */
  private _defaultCloudMapNamespace?: cloudmap.INamespace;

  /**
   * Specifies whether the cluster has EC2 instance capacity.
   */
  private _hasEc2Capacity: boolean = false;

  /**
   * The autoscaling group for added Ec2 capacity
   */
  private _autoscalingGroup?: autoscaling.IAutoScalingGroup;

  /**
   * The execute command configuration for the cluster
   */
  private _executeCommandConfiguration?: ExecuteCommandConfiguration;

  /**
   * Constructs a new instance of the Cluster class.
   */
  constructor(scope: Construct, id: string, props: ClusterProps = {}) {
    super(scope, id, {
      physicalName: props.clusterName,
    });

    /**
     * clusterSettings needs to be undefined if containerInsights is not explicitly set in order to allow any
     * containerInsights settings on the account to apply.  See:
     * https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ecs-cluster-clustersettings.html#cfn-ecs-cluster-clustersettings-value
    */
    let clusterSettings = undefined;
    if (props.containerInsights !== undefined) {
      clusterSettings = [{ name: 'containerInsights', value: props.containerInsights ? ContainerInsights.ENABLED : ContainerInsights.DISABLED }];
    }

    this._capacityProviderNames = props.capacityProviders ?? [];
    if (props.enableFargateCapacityProviders) {
      this.enableFargateCapacityProviders();
    }

    if (props.executeCommandConfiguration) {
      if ((props.executeCommandConfiguration.logging === ExecuteCommandLogging.OVERRIDE) !==
        (props.executeCommandConfiguration.logConfiguration !== undefined)) {
        throw new Error('Execute command log configuration must only be specified when logging is OVERRIDE.');
      }
      this._executeCommandConfiguration = props.executeCommandConfiguration;
    }

    const cluster = new CfnCluster(this, 'Resource', {
      clusterName: this.physicalName,
      clusterSettings,
      configuration: this._executeCommandConfiguration && this.renderExecuteCommandConfiguration(),
    });

    this.clusterArn = this.getResourceArnAttribute(cluster.attrArn, {
      service: 'ecs',
      resource: 'cluster',
      resourceName: this.physicalName,
    });
    this.clusterName = this.getResourceNameAttribute(cluster.ref);

    this.vpc = props.vpc || new ec2.Vpc(this, 'Vpc', { maxAzs: 2 });


    this._defaultCloudMapNamespace = props.defaultCloudMapNamespace !== undefined
      ? this.addDefaultCloudMapNamespace(props.defaultCloudMapNamespace)
      : undefined;

    this._autoscalingGroup = props.capacity !== undefined
      ? this.addCapacity('DefaultAutoScalingGroup', props.capacity)
      : undefined;

    // Only create cluster capacity provider associations if there are any EC2
    // capacity providers. Ordinarily we'd just add the construct to the tree
    // since it's harmless, but we'd prefer not to add unexpected new
    // resources to the stack which could surprise users working with
    // brown-field CDK apps and stacks.
    Aspects.of(this).add(new MaybeCreateCapacityProviderAssociations(this, id, this._capacityProviderNames));
  }

  /**
   * Enable the Fargate capacity providers for this cluster.
   */
  public enableFargateCapacityProviders() {
    for (const provider of ['FARGATE', 'FARGATE_SPOT']) {
      if (!this._capacityProviderNames.includes(provider)) {
        this._capacityProviderNames.push(provider);
      }
    }
  }

  private renderExecuteCommandConfiguration() : CfnCluster.ClusterConfigurationProperty {
    return {
      executeCommandConfiguration: {
        kmsKeyId: this._executeCommandConfiguration?.kmsKey?.keyArn,
        logConfiguration: this._executeCommandConfiguration?.logConfiguration && this.renderExecuteCommandLogConfiguration(),
        logging: this._executeCommandConfiguration?.logging,
      },
    };
  }

  private renderExecuteCommandLogConfiguration(): CfnCluster.ExecuteCommandLogConfigurationProperty {
    const logConfiguration = this._executeCommandConfiguration?.logConfiguration;
    if (logConfiguration?.s3EncryptionEnabled && !logConfiguration?.s3Bucket) {
      throw new Error('You must specify an S3 bucket name in the execute command log configuration to enable S3 encryption.');
    }
    if (logConfiguration?.cloudWatchEncryptionEnabled && !logConfiguration?.cloudWatchLogGroup) {
      throw new Error('You must specify a CloudWatch log group in the execute command log configuration to enable CloudWatch encryption.');
    }
    return {
      cloudWatchEncryptionEnabled: logConfiguration?.cloudWatchEncryptionEnabled,
      cloudWatchLogGroupName: logConfiguration?.cloudWatchLogGroup?.logGroupName,
      s3BucketName: logConfiguration?.s3Bucket?.bucketName,
      s3EncryptionEnabled: logConfiguration?.s3EncryptionEnabled,
      s3KeyPrefix: logConfiguration?.s3KeyPrefix,
    };
  }

  /**
   * Add an AWS Cloud Map DNS namespace for this cluster.
   * NOTE: HttpNamespaces are not supported, as ECS always requires a DNSConfig when registering an instance to a Cloud
   * Map service.
   */
  public addDefaultCloudMapNamespace(options: CloudMapNamespaceOptions): cloudmap.INamespace {
    if (this._defaultCloudMapNamespace !== undefined) {
      throw new Error('Can only add default namespace once.');
    }

    const namespaceType = options.type !== undefined
      ? options.type
      : cloudmap.NamespaceType.DNS_PRIVATE;

    const sdNamespace = namespaceType === cloudmap.NamespaceType.DNS_PRIVATE ?
      new cloudmap.PrivateDnsNamespace(this, 'DefaultServiceDiscoveryNamespace', {
        name: options.name,
        vpc: this.vpc,
      }) :
      new cloudmap.PublicDnsNamespace(this, 'DefaultServiceDiscoveryNamespace', {
        name: options.name,
      });

    this._defaultCloudMapNamespace = sdNamespace;

    return sdNamespace;
  }

  /**
   * Getter for namespace added to cluster
   */
  public get defaultCloudMapNamespace(): cloudmap.INamespace | undefined {
    return this._defaultCloudMapNamespace;
  }

  /**
   * This method adds compute capacity to a cluster by creating an AutoScalingGroup with the specified options.
   *
   * Returns the AutoScalingGroup so you can add autoscaling settings to it.
   *
   * @deprecated Use {@link Cluster.addAsgCapacityProvider} instead.
   */
  public addCapacity(id: string, options: AddCapacityOptions): autoscaling.AutoScalingGroup {
    if (options.machineImage && options.machineImageType) {
      throw new Error('You can only specify either machineImage or machineImageType, not both.');
    }

    const machineImage = options.machineImage ?? options.machineImageType === MachineImageType.BOTTLEROCKET ?
      new BottleRocketImage() : new EcsOptimizedAmi();

    const autoScalingGroup = new autoscaling.AutoScalingGroup(this, id, {
      vpc: this.vpc,
      machineImage,
      updateType: options.updateType || autoscaling.UpdateType.REPLACING_UPDATE,
      ...options,
    });

    this.addAutoScalingGroup(autoScalingGroup, {
      machineImageType: options.machineImageType,
      ...options,
    });

    return autoScalingGroup;
  }

  /**
   * This method adds an Auto Scaling Group Capacity Provider to a cluster.
   *
   * @param provider the capacity provider to add to this cluster.
   */
  public addAsgCapacityProvider(provider: AsgCapacityProvider, options: AddAutoScalingGroupCapacityOptions = {}) {
    // Don't add the same capacity provider more than once.
    if (this._capacityProviderNames.includes(provider.capacityProviderName)) {
      return;
    }

    this._hasEc2Capacity = true;
    this.configureAutoScalingGroup(provider.autoScalingGroup, {
      ...options,
      // Don't enable the instance-draining lifecycle hook if managed termination protection is enabled
      taskDrainTime: provider.enableManagedTerminationProtection ? Duration.seconds(0) : options.taskDrainTime,
    });
    this.connections.connections.addSecurityGroup(...provider.autoScalingGroup.connections.securityGroups);

    this._capacityProviderNames.push(provider.capacityProviderName);
  }

  /**
   * This method adds compute capacity to a cluster using the specified AutoScalingGroup.
   *
   * @deprecated Use {@link Cluster.addAsgCapacityProvider} instead.
   * @param autoScalingGroup the ASG to add to this cluster.
   * [disable-awslint:ref-via-interface] is needed in order to install the ECS
   * agent by updating the ASGs user data.
   */
  public addAutoScalingGroup(autoScalingGroup: autoscaling.AutoScalingGroup, options: AddAutoScalingGroupCapacityOptions = {}) {
    this._hasEc2Capacity = true;
    this.connections.connections.addSecurityGroup(...autoScalingGroup.connections.securityGroups);
    this.configureAutoScalingGroup(autoScalingGroup, options);
  }

  private configureAutoScalingGroup(autoScalingGroup: autoscaling.AutoScalingGroup, options: AddAutoScalingGroupCapacityOptions = {}) {
    if (autoScalingGroup.osType === ec2.OperatingSystemType.WINDOWS) {
      this.configureWindowsAutoScalingGroup(autoScalingGroup, options);
    } else {
      // Tie instances to cluster
      switch (options.machineImageType) {
        // Bottlerocket AMI
        case MachineImageType.BOTTLEROCKET: {
          autoScalingGroup.addUserData(
            // Connect to the cluster
            // Source: https://github.com/bottlerocket-os/bottlerocket/blob/develop/QUICKSTART-ECS.md#connecting-to-your-cluster
            '[settings.ecs]',
            `cluster = "${this.clusterName}"`,
          );
          // Enabling SSM
          // Source: https://github.com/bottlerocket-os/bottlerocket/blob/develop/QUICKSTART-ECS.md#enabling-ssm
          autoScalingGroup.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));
          // required managed policy
          autoScalingGroup.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonEC2ContainerServiceforEC2Role'));
          break;
        }
        default:
          // Amazon ECS-optimized AMI for Amazon Linux 2
          autoScalingGroup.addUserData(`echo ECS_CLUSTER=${this.clusterName} >> /etc/ecs/ecs.config`);
          if (!options.canContainersAccessInstanceRole) {
            // Deny containers access to instance metadata service
            // Source: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/instance_IAM_role.html
            autoScalingGroup.addUserData('sudo iptables --insert FORWARD 1 --in-interface docker+ --destination 169.254.169.254/32 --jump DROP');
            autoScalingGroup.addUserData('sudo service iptables save');
            // The following is only for AwsVpc networking mode, but doesn't hurt for the other modes.
            autoScalingGroup.addUserData('echo ECS_AWSVPC_BLOCK_IMDS=true >> /etc/ecs/ecs.config');
          }

          if (autoScalingGroup.spotPrice && options.spotInstanceDraining) {
            autoScalingGroup.addUserData('echo ECS_ENABLE_SPOT_INSTANCE_DRAINING=true >> /etc/ecs/ecs.config');
          }
      }
    }

    // ECS instances must be able to do these things
    // Source: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/instance_IAM_role.html
    // But, scoped down to minimal permissions required.
    //  Notes:
    //   - 'ecs:CreateCluster' removed. The cluster already exists.
    autoScalingGroup.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'ecs:DeregisterContainerInstance',
        'ecs:RegisterContainerInstance',
        'ecs:Submit*',
      ],
      resources: [
        this.clusterArn,
      ],
    }));
    autoScalingGroup.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        // These act on a cluster instance, and the instance doesn't exist until the service starts.
        // Thus, scope to the cluster using a condition.
        // See: https://docs.aws.amazon.com/IAM/latest/UserGuide/list_amazonelasticcontainerservice.html
        'ecs:Poll',
        'ecs:StartTelemetrySession',
      ],
      resources: ['*'],
      conditions: {
        ArnEquals: { 'ecs:cluster': this.clusterArn },
      },
    }));
    autoScalingGroup.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        // These do not support resource constraints, and must be resource '*'
        'ecs:DiscoverPollEndpoint',
        'ecr:GetAuthorizationToken',
        // Preserved for backwards compatibility.
        // Users are able to enable cloudwatch agent using CDK. Existing
        // customers might be installing CW agent as part of user-data so if we
        // remove these permissions we will break that customer use cases.
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: ['*'],
    }));

    // 0 disables, otherwise forward to underlying implementation which picks the sane default
    if (!options.taskDrainTime || options.taskDrainTime.toSeconds() !== 0) {
      new InstanceDrainHook(autoScalingGroup, 'DrainECSHook', {
        autoScalingGroup,
        cluster: this,
        drainTime: options.taskDrainTime,
        topicEncryptionKey: options.topicEncryptionKey,
      });
    }
  }

  /**
   * This method enables the Fargate or Fargate Spot capacity providers on the cluster.
   *
   * @param provider the capacity provider to add to this cluster.
   * @deprecated Use {@link enableFargateCapacityProviders} instead.
   * @see {@link addAsgCapacityProvider} to add an Auto Scaling Group capacity provider to the cluster.
   */
  public addCapacityProvider(provider: string) {
    if (!(provider === 'FARGATE' || provider === 'FARGATE_SPOT')) {
      throw new Error('CapacityProvider not supported');
    }

    if (!this._capacityProviderNames.includes(provider)) {
      this._capacityProviderNames.push(provider);
    }
  }

  private configureWindowsAutoScalingGroup(autoScalingGroup: autoscaling.AutoScalingGroup, options: AddAutoScalingGroupCapacityOptions = {}) {
    // clear the cache of the agent
    autoScalingGroup.addUserData('Remove-Item -Recurse C:\\ProgramData\\Amazon\\ECS\\Cache');

    // pull the latest ECS Tools
    autoScalingGroup.addUserData('Import-Module ECSTools');

    // set the cluster name environment variable
    autoScalingGroup.addUserData(`[Environment]::SetEnvironmentVariable("ECS_CLUSTER", "${this.clusterName}", "Machine")`);
    autoScalingGroup.addUserData('[Environment]::SetEnvironmentVariable("ECS_ENABLE_AWSLOGS_EXECUTIONROLE_OVERRIDE", "true", "Machine")');
    // tslint:disable-next-line: max-line-length
    autoScalingGroup.addUserData('[Environment]::SetEnvironmentVariable("ECS_AVAILABLE_LOGGING_DRIVERS", \'["json-file","awslogs"]\', "Machine")');

    // enable instance draining
    if (autoScalingGroup.spotPrice && options.spotInstanceDraining) {
      autoScalingGroup.addUserData('[Environment]::SetEnvironmentVariable("ECS_ENABLE_SPOT_INSTANCE_DRAINING", "true", "Machine")');
    }

    // enable task iam role
    if (!options.canContainersAccessInstanceRole) {
      autoScalingGroup.addUserData('[Environment]::SetEnvironmentVariable("ECS_ENABLE_TASK_IAM_ROLE", "true", "Machine")');
      autoScalingGroup.addUserData(`Initialize-ECSAgent -Cluster '${this.clusterName}' -EnableTaskIAMRole`);
    } else {
      autoScalingGroup.addUserData(`Initialize-ECSAgent -Cluster '${this.clusterName}'`);
    }
  }

  /**
   * Getter for autoscaling group added to cluster
   */
  public get autoscalingGroup(): autoscaling.IAutoScalingGroup | undefined {
    return this._autoscalingGroup;
  }

  /**
   * Whether the cluster has EC2 capacity associated with it
   */
  public get hasEc2Capacity(): boolean {
    return this._hasEc2Capacity;
  }

  /**
   * Getter for execute command configuration associated with the cluster.
   */
  public get executeCommandConfiguration(): ExecuteCommandConfiguration | undefined {
    return this._executeCommandConfiguration;
  }

  /**
   * This method returns the CloudWatch metric for this clusters CPU reservation.
   *
   * @default average over 5 minutes
   */
  public metricCpuReservation(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.cannedMetric(ECSMetrics.cpuReservationAverage, props);
  }

  /**
   * This method returns the CloudWatch metric for this clusters CPU utilization.
   *
   * @default average over 5 minutes
   */
  public metricCpuUtilization(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.cannedMetric(ECSMetrics.cpuUtilizationAverage, props);
  }

  /**
   * This method returns the CloudWatch metric for this clusters memory reservation.
   *
   * @default average over 5 minutes
   */
  public metricMemoryReservation(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.cannedMetric(ECSMetrics.memoryReservationAverage, props);
  }

  /**
   * This method returns the CloudWatch metric for this clusters memory utilization.
   *
   * @default average over 5 minutes
   */
  public metricMemoryUtilization(props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return this.cannedMetric(ECSMetrics.memoryUtilizationAverage, props);
  }

  /**
   * This method returns the specifed CloudWatch metric for this cluster.
   */
  public metric(metricName: string, props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return new cloudwatch.Metric({
      namespace: 'AWS/ECS',
      metricName,
      dimensions: { ClusterName: this.clusterName },
      ...props,
    }).attachTo(this);
  }

  private cannedMetric(
    fn: (dims: { ClusterName: string }) => cloudwatch.MetricProps,
    props?: cloudwatch.MetricOptions): cloudwatch.Metric {
    return new cloudwatch.Metric({
      ...fn({ ClusterName: this.clusterName }),
      ...props,
    }).attachTo(this);
  }
}

/**
 * ECS-optimized Windows version list
 */
export enum WindowsOptimizedVersion {
  SERVER_2019 = '2019',
  SERVER_2016 = '2016',
}

/*
 * TODO:v2.0.0
 *  * remove `export` keyword
 *  * remove @deprecated
 */
/**
 * The properties that define which ECS-optimized AMI is used.
 *
 * @deprecated see {@link EcsOptimizedImage}
 */
export interface EcsOptimizedAmiProps {
  /**
   * The Amazon Linux generation to use.
   *
   * @default AmazonLinuxGeneration.AmazonLinux2
   */
  readonly generation?: ec2.AmazonLinuxGeneration;

  /**
   * The Windows Server version to use.
   *
   * @default none, uses Linux generation
   */
  readonly windowsVersion?: WindowsOptimizedVersion;

  /**
   * The ECS-optimized AMI variant to use.
   *
   * @default AmiHardwareType.Standard
   */
  readonly hardwareType?: AmiHardwareType;
}

/*
 * TODO:v2.0.0 remove EcsOptimizedAmi
 */
/**
 * Construct a Linux or Windows machine image from the latest ECS Optimized AMI published in SSM
 *
 * @deprecated see {@link EcsOptimizedImage#amazonLinux}, {@link EcsOptimizedImage#amazonLinux} and {@link EcsOptimizedImage#windows}
 */
export class EcsOptimizedAmi implements ec2.IMachineImage {
  private readonly generation?: ec2.AmazonLinuxGeneration;
  private readonly windowsVersion?: WindowsOptimizedVersion;
  private readonly hwType: AmiHardwareType;

  private readonly amiParameterName: string;

  /**
   * Constructs a new instance of the EcsOptimizedAmi class.
   */
  constructor(props?: EcsOptimizedAmiProps) {
    this.hwType = (props && props.hardwareType) || AmiHardwareType.STANDARD;
    if (props && props.generation) { // generation defined in the props object
      if (props.generation === ec2.AmazonLinuxGeneration.AMAZON_LINUX && this.hwType !== AmiHardwareType.STANDARD) {
        throw new Error('Amazon Linux does not support special hardware type. Use Amazon Linux 2 instead');
      } else if (props.windowsVersion) {
        throw new Error('"windowsVersion" and Linux image "generation" cannot be both set');
      } else {
        this.generation = props.generation;
      }
    } else if (props && props.windowsVersion) {
      if (this.hwType !== AmiHardwareType.STANDARD) {
        throw new Error('Windows Server does not support special hardware type');
      } else {
        this.windowsVersion = props.windowsVersion;
      }
    } else { // generation not defined in props object
      // always default to Amazon Linux v2 regardless of HW
      this.generation = ec2.AmazonLinuxGeneration.AMAZON_LINUX_2;
    }

    // set the SSM parameter name
    this.amiParameterName = '/aws/service/ecs/optimized-ami/'
      + (this.generation === ec2.AmazonLinuxGeneration.AMAZON_LINUX ? 'amazon-linux/' : '')
      + (this.generation === ec2.AmazonLinuxGeneration.AMAZON_LINUX_2 ? 'amazon-linux-2/' : '')
      + (this.windowsVersion ? `windows_server/${this.windowsVersion}/english/full/` : '')
      + (this.hwType === AmiHardwareType.GPU ? 'gpu/' : '')
      + (this.hwType === AmiHardwareType.ARM ? 'arm64/' : '')
      + 'recommended/image_id';
  }

  /**
   * Return the correct image
   */
  public getImage(scope: CoreConstruct): ec2.MachineImageConfig {
    const ami = ssm.StringParameter.valueForTypedStringParameter(scope, this.amiParameterName, ssm.ParameterType.AWS_EC2_IMAGE_ID);
    const osType = this.windowsVersion ? ec2.OperatingSystemType.WINDOWS : ec2.OperatingSystemType.LINUX;
    return {
      imageId: ami,
      osType,
      userData: ec2.UserData.forOperatingSystem(osType),
    };
  }
}

/**
 * Construct a Linux or Windows machine image from the latest ECS Optimized AMI published in SSM
 */
export class EcsOptimizedImage implements ec2.IMachineImage {
  /**
   * Construct an Amazon Linux 2 image from the latest ECS Optimized AMI published in SSM
   *
   * @param hardwareType ECS-optimized AMI variant to use
   */
  public static amazonLinux2(hardwareType = AmiHardwareType.STANDARD): EcsOptimizedImage {
    return new EcsOptimizedImage({ generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2, hardwareType });
  }

  /**
   * Construct an Amazon Linux AMI image from the latest ECS Optimized AMI published in SSM
   */
  public static amazonLinux(): EcsOptimizedImage {
    return new EcsOptimizedImage({ generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX });
  }

  /**
   * Construct a Windows image from the latest ECS Optimized AMI published in SSM
   *
   * @param windowsVersion Windows Version to use
   */
  public static windows(windowsVersion: WindowsOptimizedVersion): EcsOptimizedImage {
    return new EcsOptimizedImage({ windowsVersion });
  }

  private readonly generation?: ec2.AmazonLinuxGeneration;
  private readonly windowsVersion?: WindowsOptimizedVersion;
  private readonly hwType?: AmiHardwareType;

  private readonly amiParameterName: string;

  /**
   * Constructs a new instance of the EcsOptimizedAmi class.
   */
  private constructor(props: EcsOptimizedAmiProps) {
    this.hwType = props && props.hardwareType;

    if (props.windowsVersion) {
      this.windowsVersion = props.windowsVersion;
    } else if (props.generation) {
      this.generation = props.generation;
    } else {
      throw new Error('This error should never be thrown');
    }

    // set the SSM parameter name
    this.amiParameterName = '/aws/service/ecs/optimized-ami/'
      + (this.generation === ec2.AmazonLinuxGeneration.AMAZON_LINUX ? 'amazon-linux/' : '')
      + (this.generation === ec2.AmazonLinuxGeneration.AMAZON_LINUX_2 ? 'amazon-linux-2/' : '')
      + (this.windowsVersion ? `windows_server/${this.windowsVersion}/english/full/` : '')
      + (this.hwType === AmiHardwareType.GPU ? 'gpu/' : '')
      + (this.hwType === AmiHardwareType.ARM ? 'arm64/' : '')
      + 'recommended/image_id';
  }

  /**
   * Return the correct image
   */
  public getImage(scope: CoreConstruct): ec2.MachineImageConfig {
    const ami = ssm.StringParameter.valueForTypedStringParameter(scope, this.amiParameterName, ssm.ParameterType.AWS_EC2_IMAGE_ID);
    const osType = this.windowsVersion ? ec2.OperatingSystemType.WINDOWS : ec2.OperatingSystemType.LINUX;
    return {
      imageId: ami,
      osType,
      userData: ec2.UserData.forOperatingSystem(osType),
    };
  }
}

/**
 * Amazon ECS variant
 */
export enum BottlerocketEcsVariant {
  /**
   * aws-ecs-1 variant
   */
  AWS_ECS_1 = 'aws-ecs-1'

}

/**
 * Properties for BottleRocketImage
 */
export interface BottleRocketImageProps {
  /**
   * The Amazon ECS variant to use.
   * Only `aws-ecs-1` is currently available
   *
   * @default - BottlerocketEcsVariant.AWS_ECS_1
   */
  readonly variant?: BottlerocketEcsVariant;
}

/**
 * Construct an Bottlerocket image from the latest AMI published in SSM
 */
export class BottleRocketImage implements ec2.IMachineImage {
  private readonly amiParameterName: string;
  /**
   * Amazon ECS variant for Bottlerocket AMI
   */
  private readonly variant: string;

  /**
   * Constructs a new instance of the BottleRocketImage class.
   */
  public constructor(props: BottleRocketImageProps = {}) {
    this.variant = props.variant ?? BottlerocketEcsVariant.AWS_ECS_1;

    // set the SSM parameter name
    this.amiParameterName = `/aws/service/bottlerocket/${this.variant}/x86_64/latest/image_id`;
  }

  /**
   * Return the correct image
   */
  public getImage(scope: CoreConstruct): ec2.MachineImageConfig {
    const ami = ssm.StringParameter.valueForStringParameter(scope, this.amiParameterName);
    return {
      imageId: ami,
      osType: ec2.OperatingSystemType.LINUX,
      userData: ec2.UserData.custom(''),
    };
  }
}

/**
 * A regional grouping of one or more container instances on which you can run tasks and services.
 */
export interface ICluster extends IResource {
  /**
   * The name of the cluster.
   * @attribute
   */
  readonly clusterName: string;

  /**
   * The Amazon Resource Name (ARN) that identifies the cluster.
   * @attribute
   */
  readonly clusterArn: string;

  /**
   * The VPC associated with the cluster.
   */
  readonly vpc: ec2.IVpc;

  /**
   * Manage the allowed network connections for the cluster with Security Groups.
   */
  readonly connections: ec2.Connections;

  /**
   * Specifies whether the cluster has EC2 instance capacity.
   */
  readonly hasEc2Capacity: boolean;

  /**
   * The AWS Cloud Map namespace to associate with the cluster.
   */
  readonly defaultCloudMapNamespace?: cloudmap.INamespace;

  /**
   * The autoscaling group added to the cluster if capacity is associated to the cluster
   */
  readonly autoscalingGroup?: autoscaling.IAutoScalingGroup;

  /**
   * The execute command configuration for the cluster
   */
  readonly executeCommandConfiguration?: ExecuteCommandConfiguration;
}

/**
 * The properties to import from the ECS cluster.
 */
export interface ClusterAttributes {
  /**
   * The name of the cluster.
   */
  readonly clusterName: string;

  /**
   * The Amazon Resource Name (ARN) that identifies the cluster.
   *
   * @default Derived from clusterName
   */
  readonly clusterArn?: string;

  /**
   * The VPC associated with the cluster.
   */
  readonly vpc: ec2.IVpc;

  /**
   * The security groups associated with the container instances registered to the cluster.
   */
  readonly securityGroups: ec2.ISecurityGroup[];

  /**
   * Specifies whether the cluster has EC2 instance capacity.
   *
   * @default true
   */
  readonly hasEc2Capacity?: boolean;

  /**
   * The AWS Cloud Map namespace to associate with the cluster.
   *
   * @default - No default namespace
   */
  readonly defaultCloudMapNamespace?: cloudmap.INamespace;

  /**
   * Autoscaling group added to the cluster if capacity is added
   *
   * @default - No default autoscaling group
   */
  readonly autoscalingGroup?: autoscaling.IAutoScalingGroup;

  /**
   * The execute command configuration for the cluster
   *
   * @default - none.
   */
  readonly executeCommandConfiguration?: ExecuteCommandConfiguration;
}

/**
 * An Cluster that has been imported
 */
class ImportedCluster extends Resource implements ICluster {
  /**
   * Name of the cluster
   */
  public readonly clusterName: string;

  /**
   * ARN of the cluster
   */
  public readonly clusterArn: string;

  /**
   * VPC that the cluster instances are running in
   */
  public readonly vpc: ec2.IVpc;

  /**
   * Security group of the cluster instances
   */
  public readonly connections = new ec2.Connections();

  /**
   * Whether the cluster has EC2 capacity
   */
  public readonly hasEc2Capacity: boolean;

  /**
   * Cloudmap namespace created in the cluster
   */
  private _defaultCloudMapNamespace?: cloudmap.INamespace;

  /**
   * The execute command configuration for the cluster
   */
  private _executeCommandConfiguration?: ExecuteCommandConfiguration;

  /**
   * Constructs a new instance of the ImportedCluster class.
   */
  constructor(scope: Construct, id: string, props: ClusterAttributes) {
    super(scope, id);
    this.clusterName = props.clusterName;
    this.vpc = props.vpc;
    this.hasEc2Capacity = props.hasEc2Capacity !== false;
    this._defaultCloudMapNamespace = props.defaultCloudMapNamespace;
    this._executeCommandConfiguration = props.executeCommandConfiguration;

    this.clusterArn = props.clusterArn ?? Stack.of(this).formatArn({
      service: 'ecs',
      resource: 'cluster',
      resourceName: props.clusterName,
    });

    this.connections = new ec2.Connections({
      securityGroups: props.securityGroups,
    });
  }

  public get defaultCloudMapNamespace(): cloudmap.INamespace | undefined {
    return this._defaultCloudMapNamespace;
  }

  public get executeCommandConfiguration(): ExecuteCommandConfiguration | undefined {
    return this._executeCommandConfiguration;
  }
}

/**
 * The properties for adding an AutoScalingGroup.
 */
export interface AddAutoScalingGroupCapacityOptions {
  /**
   * Specifies whether the containers can access the container instance role.
   *
   * @default false
   */
  readonly canContainersAccessInstanceRole?: boolean;

  /**
   * The time period to wait before force terminating an instance that is draining.
   *
   * This creates a Lambda function that is used by a lifecycle hook for the
   * AutoScalingGroup that will delay instance termination until all ECS tasks
   * have drained from the instance. Set to 0 to disable task draining.
   *
   * Set to 0 to disable task draining.
   *
   * @deprecated The lifecycle draining hook is not configured if using the EC2 Capacity Provider. Enable managed termination protection instead.
   * @default Duration.minutes(5)
   */
  readonly taskDrainTime?: Duration;

  /**
   * Specify whether to enable Automated Draining for Spot Instances running Amazon ECS Services.
   * For more information, see [Using Spot Instances](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/container-instance-spot.html).
   *
   * @default false
   */
  readonly spotInstanceDraining?: boolean

  /**
   * If {@link AddAutoScalingGroupCapacityOptions.taskDrainTime} is non-zero, then the ECS cluster creates an
   * SNS Topic to as part of a system to drain instances of tasks when the instance is being shut down.
   * If this property is provided, then this key will be used to encrypt the contents of that SNS Topic.
   * See [SNS Data Encryption](https://docs.aws.amazon.com/sns/latest/dg/sns-data-encryption.html) for more information.
   *
   * @default The SNS Topic will not be encrypted.
   */
  readonly topicEncryptionKey?: kms.IKey;


  /**
   * Specify the machine image type.
   *
   * @default MachineImageType.AMAZON_LINUX_2
   */
  readonly machineImageType?: MachineImageType;
}

/**
 * The properties for adding instance capacity to an AutoScalingGroup.
 */
export interface AddCapacityOptions extends AddAutoScalingGroupCapacityOptions, autoscaling.CommonAutoScalingGroupProps {
  /**
   * The EC2 instance type to use when launching instances into the AutoScalingGroup.
   */
  readonly instanceType: ec2.InstanceType;

  /**
   * The ECS-optimized AMI variant to use. For more information, see
   * [Amazon ECS-optimized AMIs](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-optimized_AMI.html).
   * You must define either `machineImage` or `machineImageType`, not both.
   *
   * @default - Amazon Linux 2
   */
  readonly machineImage?: ec2.IMachineImage;
}

/**
 * The options for creating an AWS Cloud Map namespace.
 */
export interface CloudMapNamespaceOptions {
  /**
   * The name of the namespace, such as example.com.
   */
  readonly name: string;

  /**
   * The type of CloudMap Namespace to create.
   *
   * @default PrivateDns
   */
  readonly type?: cloudmap.NamespaceType;

  /**
   * The VPC to associate the namespace with. This property is required for private DNS namespaces.
   *
   * @default VPC of the cluster for Private DNS Namespace, otherwise none
   */
  readonly vpc?: ec2.IVpc;
}

/**
 * The ECS-optimized AMI variant to use. For more information, see
 * [Amazon ECS-optimized AMIs](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-optimized_AMI.html).
 */
export enum AmiHardwareType {

  /**
   * Use the standard Amazon ECS-optimized AMI.
   */
  STANDARD = 'Standard',

  /**
   * Use the Amazon ECS GPU-optimized AMI.
   */
  GPU = 'GPU',

  /**
   * Use the Amazon ECS-optimized Amazon Linux 2 (arm64) AMI.
   */
  ARM = 'ARM64',
}

enum ContainerInsights {
  /**
   * Enable CloudWatch Container Insights for the cluster
   */

  ENABLED = 'enabled',

  /**
   * Disable CloudWatch Container Insights for the cluster
   */
  DISABLED = 'disabled',
}

/**
 * A Capacity Provider strategy to use for the service.
 *
 * NOTE: defaultCapacityProviderStrategy on cluster not currently supported.
 */
export interface CapacityProviderStrategy {
  /**
   * The name of the capacity provider.
   */
  readonly capacityProvider: string;

  /**
   * The base value designates how many tasks, at a minimum, to run on the specified capacity provider. Only one
   * capacity provider in a capacity provider strategy can have a base defined. If no value is specified, the default
   * value of 0 is used.
   *
   * @default - none
   */
  readonly base?: number;

  /**
   * The weight value designates the relative percentage of the total number of tasks launched that should use the
   * specified
capacity provider. The weight value is taken into consideration after the base value, if defined, is satisfied.
   *
   * @default - 0
   */
  readonly weight?: number;
}

/**
 * The details of the execute command configuration. For more information, see
 * [ExecuteCommandConfiguration] https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ecs-cluster-executecommandconfiguration.html
 */
export interface ExecuteCommandConfiguration {
  /**
   * The AWS Key Management Service key ID to encrypt the data between the local client and the container.
   *
   * @default - none
   */
  readonly kmsKey?: kms.IKey,

  /**
   * The log configuration for the results of the execute command actions. The logs can be sent to CloudWatch Logs or an Amazon S3 bucket.
   *
   * @default - none
   */
  readonly logConfiguration?: ExecuteCommandLogConfiguration,

  /**
   * The log settings to use for logging the execute command session.
   *
   * @default - none
   */
  readonly logging?: ExecuteCommandLogging,
}

/**
 * The log settings to use to for logging the execute command session. For more information, see
 * [Logging] https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ecs-cluster-executecommandconfiguration.html#cfn-ecs-cluster-executecommandconfiguration-logging
 */
export enum ExecuteCommandLogging {
  /**
   * The execute command session is not logged.
   */
  NONE = 'NONE',

  /**
   * The awslogs configuration in the task definition is used. If no logging parameter is specified, it defaults to this value. If no awslogs log driver is configured in the task definition, the output won't be logged.
   */
  DEFAULT = 'DEFAULT',

  /**
   * Specify the logging details as a part of logConfiguration.
   */
  OVERRIDE = 'OVERRIDE',
}

/**
 * The log configuration for the results of the execute command actions. The logs can be sent to CloudWatch Logs and/ or an Amazon S3 bucket.
 * For more information, see [ExecuteCommandLogConfiguration] https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ecs-cluster-executecommandlogconfiguration.html
 */
export interface ExecuteCommandLogConfiguration {
  /**
   * Whether or not to enable encryption on the CloudWatch logs.
   *
   * @default - encryption will be disabled.
   */
  readonly cloudWatchEncryptionEnabled?: boolean,

  /**
   * The name of the CloudWatch log group to send logs to. The CloudWatch log group must already be created.
   * @default - none
   */
  readonly cloudWatchLogGroup?: logs.ILogGroup,

  /**
   * The name of the S3 bucket to send logs to. The S3 bucket must already be created.
   *
   * @default - none
   */
  readonly s3Bucket?: s3.IBucket,

  /**
   * Whether or not to enable encryption on the CloudWatch logs.
   *
   * @default - encryption will be disabled.
   */
  readonly s3EncryptionEnabled?: boolean,

  /**
   * An optional folder in the S3 bucket to place logs in.
   *
   * @default - none
   */
  readonly s3KeyPrefix?: string
}

/**
 * The options for creating an Auto Scaling Group Capacity Provider.
 */
export interface AsgCapacityProviderProps extends AddAutoScalingGroupCapacityOptions {
  /**
   * The name for the capacity provider.
   *
   * @default CloudFormation-generated name
   */
  readonly capacityProviderName?: string;

  /**
   * The autoscaling group to add as a Capacity Provider.
   */
  readonly autoScalingGroup: autoscaling.IAutoScalingGroup;

  /**
   * Whether to enable managed scaling
   *
   * @default true
   */
  readonly enableManagedScaling?: boolean;

  /**
   * Whether to enable managed termination protection
   *
   * @default true
   */
  readonly enableManagedTerminationProtection?: boolean;

  /**
   * Maximum scaling step size. In most cases this should be left alone.
   *
   * @default 1000
   */
  readonly maximumScalingStepSize?: number;

  /**
   * Minimum scaling step size. In most cases this should be left alone.
   *
   * @default 1
   */
  readonly minimumScalingStepSize?: number;

  /**
   * Target capacity percent. In most cases this should be left alone.
   *
   * @default 100
   */
  readonly targetCapacityPercent?: number;
}

/**
 * An Auto Scaling Group Capacity Provider. This allows an ECS cluster to target
 * a specific EC2 Auto Scaling Group for the placement of tasks. Optionally (and
 * recommended), ECS can manage the number of instances in the ASG to fit the
 * tasks, and can ensure that instances are not prematurely terminated while
 * there are still tasks running on them.
 */
export class AsgCapacityProvider extends CoreConstruct {
  /**
   * Capacity provider name
   * @default Chosen by CloudFormation
   */
  readonly capacityProviderName: string;

  /**
   * Auto Scaling Group
   */
  readonly autoScalingGroup: autoscaling.AutoScalingGroup;

  /**
   * Whether managed termination protection is enabled
   */
  readonly enableManagedTerminationProtection?: boolean;

  constructor(scope: Construct, id: string, props: AsgCapacityProviderProps) {
    super(scope, id);

    this.autoScalingGroup = props.autoScalingGroup as autoscaling.AutoScalingGroup;

    this.enableManagedTerminationProtection =
      props.enableManagedTerminationProtection === undefined ? true : props.enableManagedTerminationProtection;

    if (this.enableManagedTerminationProtection) {
      this.autoScalingGroup.protectNewInstancesFromScaleIn();
    }

    const capacityProvider = new CfnCapacityProvider(this, id, {
      name: props.capacityProviderName,
      autoScalingGroupProvider: {
        autoScalingGroupArn: this.autoScalingGroup.autoScalingGroupName,
        managedScaling: props.enableManagedScaling === false ? undefined : {
          status: 'ENABLED',
          targetCapacity: props.targetCapacityPercent || 100,
          maximumScalingStepSize: props.maximumScalingStepSize,
          minimumScalingStepSize: props.minimumScalingStepSize,
        },
        managedTerminationProtection: this.enableManagedTerminationProtection ? 'ENABLED' : 'DISABLED',
      },
    });

    this.capacityProviderName = capacityProvider.ref;
  }
}

/**
 * A visitor that adds a capacity provider association to a Cluster only if
 * the caller created any EC2 Capacity Providers.
 */
class MaybeCreateCapacityProviderAssociations implements IAspect {
  private scope: CoreConstruct;
  private id: string;
  private capacityProviders: string[]
  private resource?: CfnClusterCapacityProviderAssociations

  constructor(scope: CoreConstruct, id: string, capacityProviders: string[] ) {
    this.scope = scope;
    this.id = id;
    this.capacityProviders = capacityProviders;
  }

  public visit(node: IConstruct): void {
    if (node instanceof Cluster) {
      if (this.capacityProviders.length > 0 && !this.resource) {
        const resource = new CfnClusterCapacityProviderAssociations(this.scope, this.id, {
          cluster: node.clusterName,
          defaultCapacityProviderStrategy: [],
          capacityProviders: Lazy.list({ produce: () => this.capacityProviders }),
        });
        this.resource = resource;
      }
    }
  }
}
