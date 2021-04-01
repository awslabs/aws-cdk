import * as autoscaling from '@aws-cdk/aws-autoscaling';
import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnDeploymentGroup } from '../codedeploy.generated';
import { AutoRollbackConfig } from '../rollback-config';
import { arnForDeploymentGroup, renderAlarmConfiguration, renderAutoRollbackConfiguration } from '../utils';
import { IServerApplication, ServerApplication } from './application';
import { IServerDeploymentConfig, ServerDeploymentConfig } from './deployment-config';
import { LoadBalancer, LoadBalancerGeneration } from './load-balancer';

export interface IServerDeploymentGroup extends cdk.IResource {
  readonly application: IServerApplication;
  readonly role?: iam.IRole;
  /**
   * @attribute
   */
  readonly deploymentGroupName: string;

  /**
   * @attribute
   */
  readonly deploymentGroupArn: string;
  readonly deploymentConfig: IServerDeploymentConfig;
  readonly autoScalingGroups?: autoscaling.IAutoScalingGroup[];
}

/**
 * Properties of a reference to a CodeDeploy EC2/on-premise Deployment Group.
 *
 * @see ServerDeploymentGroup#import
 */
export interface ServerDeploymentGroupAttributes {
  /**
   * The reference to the CodeDeploy EC2/on-premise Application
   * that this Deployment Group belongs to.
   */
  readonly application: IServerApplication;

  /**
   * The physical, human-readable name of the CodeDeploy EC2/on-premise Deployment Group
   * that we are referencing.
   */
  readonly deploymentGroupName: string;

  /**
   * The Deployment Configuration this Deployment Group uses.
   *
   * @default ServerDeploymentConfig#OneAtATime
   */
  readonly deploymentConfig?: IServerDeploymentConfig;
}

/**
 * Represents a reference to a CodeDeploy EC2/on-premise Deployment Group.
 *
 * If you're managing the Deployment Group alongside the rest of your CDK resources,
 * use the {@link ServerDeploymentGroup} class.
 *
 * If you want to reference an already existing Deployment Group,
 * or one defined in a different CDK Stack,
 * use the {@link #import} method.
 */
abstract class ServerDeploymentGroupBase extends cdk.Resource implements IServerDeploymentGroup {
  public abstract readonly application: IServerApplication;
  public abstract readonly role?: iam.IRole;
  public abstract readonly deploymentGroupName: string;
  public abstract readonly deploymentGroupArn: string;
  public readonly deploymentConfig: IServerDeploymentConfig;
  public abstract readonly autoScalingGroups?: autoscaling.IAutoScalingGroup[];

  constructor(scope: Construct, id: string, deploymentConfig?: IServerDeploymentConfig, props?: cdk.ResourceProps) {
    super(scope, id, props);
    this.deploymentConfig = deploymentConfig || ServerDeploymentConfig.ONE_AT_A_TIME;
  }
}

class ImportedServerDeploymentGroup extends ServerDeploymentGroupBase {
  public readonly application: IServerApplication;
  public readonly role?: iam.Role = undefined;
  public readonly deploymentGroupName: string;
  public readonly deploymentGroupArn: string;
  public readonly autoScalingGroups?: autoscaling.AutoScalingGroup[] = undefined;

  constructor(scope: Construct, id: string, props: ServerDeploymentGroupAttributes) {
    super(scope, id, props.deploymentConfig);

    this.application = props.application;
    this.deploymentGroupName = props.deploymentGroupName;
    this.deploymentGroupArn = arnForDeploymentGroup(props.application.applicationName, props.deploymentGroupName);
  }
}

/**
 * Represents a group of instance tags.
 * An instance will match a group if it has a tag matching
 * any of the group's tags by key and any of the provided values -
 * in other words, tag groups follow 'or' semantics.
 * If the value for a given key is an empty array,
 * an instance will match when it has a tag with the given key,
 * regardless of the value.
 * If the key is an empty string, any tag,
 * regardless of its key, with any of the given values, will match.
 */
export type InstanceTagGroup = {[key: string]: string[]};

/**
 * Represents a set of instance tag groups.
 * An instance will match a set if it matches all of the groups in the set -
 * in other words, sets follow 'and' semantics.
 * You can have a maximum of 3 tag groups inside a set.
 */
export class InstanceTagSet {
  private readonly _instanceTagGroups: InstanceTagGroup[];

  constructor(...instanceTagGroups: InstanceTagGroup[]) {
    if (instanceTagGroups.length > 3) {
      throw new Error('An instance tag set can have a maximum of 3 instance tag groups, ' +
        `but ${instanceTagGroups.length} were provided`);
    }
    this._instanceTagGroups = instanceTagGroups;
  }

  public get instanceTagGroups(): InstanceTagGroup[] {
    return this._instanceTagGroups.slice();
  }
}

/**
 * Construction properties for {@link ServerDeploymentGroup}.
 */
export interface ServerDeploymentGroupProps {
  /**
   * The CodeDeploy EC2/on-premise Application this Deployment Group belongs to.
   *
   * @default - A new Application will be created.
   */
  readonly application?: IServerApplication;

  /**
   * The service Role of this Deployment Group.
   *
   * @default - A new Role will be created.
   */
  readonly role?: iam.IRole;

  /**
   * The physical, human-readable name of the CodeDeploy Deployment Group.
   *
   * @default - An auto-generated name will be used.
   */
  readonly deploymentGroupName?: string;

  /**
   * The EC2/on-premise Deployment Configuration to use for this Deployment Group.
   *
   * @default ServerDeploymentConfig#OneAtATime
   */
  readonly deploymentConfig?: IServerDeploymentConfig;

  /**
   * The auto-scaling groups belonging to this Deployment Group.
   *
   * Auto-scaling groups can also be added after the Deployment Group is created
   * using the {@link #addAutoScalingGroup} method.
   *
   * [disable-awslint:ref-via-interface] is needed because we update userdata
   * for ASGs to install the codedeploy agent.
   *
   * @default []
   */
  readonly autoScalingGroups?: autoscaling.IAutoScalingGroup[];

  /**
   * If you've provided any auto-scaling groups with the {@link #autoScalingGroups} property,
   * you can set this property to add User Data that installs the CodeDeploy agent on the instances.
   *
   * @default true
   * @see https://docs.aws.amazon.com/codedeploy/latest/userguide/codedeploy-agent-operations-install.html
   */
  readonly installAgent?: boolean;

  /**
   * The load balancer to place in front of this Deployment Group.
   * Can be created from either a classic Elastic Load Balancer,
   * or an Application Load Balancer / Network Load Balancer Target Group.
   *
   * @default - Deployment Group will not have a load balancer defined.
   */
  readonly loadBalancer?: LoadBalancer;

  /**
   * All EC2 instances matching the given set of tags when a deployment occurs will be added to this Deployment Group.
   *
   * @default - No additional EC2 instances will be added to the Deployment Group.
   */
  readonly ec2InstanceTags?: InstanceTagSet;

  /**
   * All on-premise instances matching the given set of tags when a deployment occurs will be added to this Deployment Group.
   *
   * @default - No additional on-premise instances will be added to the Deployment Group.
   */
  readonly onPremiseInstanceTags?: InstanceTagSet;

  /**
   * The CloudWatch alarms associated with this Deployment Group.
   * CodeDeploy will stop (and optionally roll back)
   * a deployment if during it any of the alarms trigger.
   *
   * Alarms can also be added after the Deployment Group is created using the {@link #addAlarm} method.
   *
   * @default []
   * @see https://docs.aws.amazon.com/codedeploy/latest/userguide/monitoring-create-alarms.html
   */
  readonly alarms?: cloudwatch.IAlarm[];

  /**
   * Whether to continue a deployment even if fetching the alarm status from CloudWatch failed.
   *
   * @default false
   */
  readonly ignorePollAlarmsFailure?: boolean;

  /**
   * The auto-rollback configuration for this Deployment Group.
   *
   * @default - default AutoRollbackConfig.
   */
  readonly autoRollback?: AutoRollbackConfig;
}

/**
 * A CodeDeploy Deployment Group that deploys to EC2/on-premise instances.
 * @resource AWS::CodeDeploy::DeploymentGroup
 */
export class ServerDeploymentGroup extends ServerDeploymentGroupBase {
  /**
   * Import an EC2/on-premise Deployment Group defined either outside the CDK app,
   * or in a different region.
   *
   * @param scope the parent Construct for this new Construct
   * @param id the logical ID of this new Construct
   * @param attrs the properties of the referenced Deployment Group
   * @returns a Construct representing a reference to an existing Deployment Group
   */
  public static fromServerDeploymentGroupAttributes(
    scope: Construct,
    id: string,
    attrs: ServerDeploymentGroupAttributes): IServerDeploymentGroup {
    return new ImportedServerDeploymentGroup(scope, id, attrs);
  }

  public readonly application: IServerApplication;
  public readonly role?: iam.IRole;
  public readonly deploymentGroupArn: string;
  public readonly deploymentGroupName: string;

  private readonly _autoScalingGroups: autoscaling.IAutoScalingGroup[];
  private readonly installAgent: boolean;
  private readonly codeDeployBucket: s3.IBucket;
  private readonly alarms: cloudwatch.IAlarm[];

  constructor(scope: Construct, id: string, props: ServerDeploymentGroupProps = {}) {
    super(scope, id, props.deploymentConfig, {
      physicalName: props.deploymentGroupName,
    });

    this.application = props.application || new ServerApplication(this, 'Application', {
      applicationName: props.deploymentGroupName === cdk.PhysicalName.GENERATE_IF_NEEDED ? cdk.PhysicalName.GENERATE_IF_NEEDED : undefined,
    });

    this.role = props.role || new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('codedeploy.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSCodeDeployRole')],
    });

    this._autoScalingGroups = props.autoScalingGroups || [];
    this.installAgent = props.installAgent ?? true;
    this.codeDeployBucket = s3.Bucket.fromBucketName(this, 'Bucket', `aws-codedeploy-${cdk.Stack.of(this).region}`);
    for (const asg of this._autoScalingGroups) {
      this.addCodeDeployAgentInstallUserData(asg);
    }

    this.alarms = props.alarms || [];

    const resource = new CfnDeploymentGroup(this, 'Resource', {
      applicationName: this.application.applicationName,
      deploymentGroupName: this.physicalName,
      serviceRoleArn: this.role.roleArn,
      deploymentConfigName: props.deploymentConfig &&
        props.deploymentConfig.deploymentConfigName,
      autoScalingGroups: cdk.Lazy.list({ produce: () => this._autoScalingGroups.map(asg => asg.autoScalingGroupName) }, { omitEmpty: true }),
      loadBalancerInfo: this.loadBalancerInfo(props.loadBalancer),
      deploymentStyle: props.loadBalancer === undefined
        ? undefined
        : {
          deploymentOption: 'WITH_TRAFFIC_CONTROL',
        },
      ec2TagSet: this.ec2TagSet(props.ec2InstanceTags),
      onPremisesTagSet: this.onPremiseTagSet(props.onPremiseInstanceTags),
      alarmConfiguration: cdk.Lazy.any({ produce: () => renderAlarmConfiguration(this.alarms, props.ignorePollAlarmsFailure) }),
      autoRollbackConfiguration: cdk.Lazy.any({ produce: () => renderAutoRollbackConfiguration(this.alarms, props.autoRollback) }),
    });

    this.deploymentGroupName = this.getResourceNameAttribute(resource.ref);
    this.deploymentGroupArn = this.getResourceArnAttribute(arnForDeploymentGroup(this.application.applicationName, resource.ref), {
      service: 'codedeploy',
      resource: 'deploymentgroup',
      resourceName: `${this.application.applicationName}/${this.physicalName}`,
      sep: ':',
    });
  }

  /**
   * Adds an additional auto-scaling group to this Deployment Group.
   *
   * @param asg the auto-scaling group to add to this Deployment Group.
   * [disable-awslint:ref-via-interface] is needed in order to install the code
   * deploy agent by updating the ASGs user data.
   */
  public addAutoScalingGroup(asg: autoscaling.AutoScalingGroup): void {
    this._autoScalingGroups.push(asg);
    this.addCodeDeployAgentInstallUserData(asg);
  }

  /**
   * Associates an additional alarm with this Deployment Group.
   *
   * @param alarm the alarm to associate with this Deployment Group
   */
  public addAlarm(alarm: cloudwatch.IAlarm): void {
    this.alarms.push(alarm);
  }

  public get autoScalingGroups(): autoscaling.IAutoScalingGroup[] | undefined {
    return this._autoScalingGroups.slice();
  }

  private addCodeDeployAgentInstallUserData(asg: autoscaling.IAutoScalingGroup): void {
    if (!this.installAgent) {
      return;
    }

    this.codeDeployBucket.grantRead(asg, 'latest/*');

    switch (asg.osType) {
      case ec2.OperatingSystemType.LINUX:
        asg.addUserData(
          'set +e', // make sure we don't exit on the `which` failing
          'PKG_CMD=`which yum 2>/dev/null`',
          'set -e', // continue with failing on error
          'if [ -z "$PKG_CMD" ]; then',
          'PKG_CMD=apt-get',
          'else',
          'PKG_CMD=yum',
          'fi',
          '$PKG_CMD update -y',
          'set +e', // make sure we don't exit on the next command failing (we check its exit code below)
          '$PKG_CMD install -y ruby2.0',
          'RUBY2_INSTALL=$?',
          'set -e', // continue with failing on error
          'if [ $RUBY2_INSTALL -ne 0 ]; then',
          '$PKG_CMD install -y ruby',
          'fi',
          'AWS_CLI_PACKAGE_NAME=awscli',
          'if [ "$PKG_CMD" = "yum" ]; then',
          'AWS_CLI_PACKAGE_NAME=aws-cli',
          'fi',
          '$PKG_CMD install -y $AWS_CLI_PACKAGE_NAME',
          'TMP_DIR=`mktemp -d`',
          'cd $TMP_DIR',
          `aws s3 cp s3://aws-codedeploy-${cdk.Stack.of(this).region}/latest/install . --region ${cdk.Stack.of(this).region}`,
          'chmod +x ./install',
          './install auto',
          'rm -fr $TMP_DIR',
        );
        break;
      case ec2.OperatingSystemType.WINDOWS:
        asg.addUserData(
          'Set-Variable -Name TEMPDIR -Value (New-TemporaryFile).DirectoryName',
          `aws s3 cp s3://aws-codedeploy-${cdk.Stack.of(this).region}/latest/codedeploy-agent.msi $TEMPDIR\\codedeploy-agent.msi`,
          'cd $TEMPDIR',
          '.\\codedeploy-agent.msi /quiet /l c:\\temp\\host-agent-install-log.txt',
        );
        break;
    }
  }

  private loadBalancerInfo(loadBalancer?: LoadBalancer):
  CfnDeploymentGroup.LoadBalancerInfoProperty | undefined {
    if (!loadBalancer) {
      return undefined;
    }

    switch (loadBalancer.generation) {
      case LoadBalancerGeneration.FIRST:
        return {
          elbInfoList: [
            { name: loadBalancer.name },
          ],
        };
      case LoadBalancerGeneration.SECOND:
        return {
          targetGroupInfoList: [
            { name: loadBalancer.name },
          ],
        };
    }
  }

  private ec2TagSet(tagSet?: InstanceTagSet):
  CfnDeploymentGroup.EC2TagSetProperty | undefined {
    if (!tagSet || tagSet.instanceTagGroups.length === 0) {
      return undefined;
    }

    return {
      ec2TagSetList: tagSet.instanceTagGroups.map(tagGroup => {
        return {
          ec2TagGroup: this.tagGroup2TagsArray(tagGroup) as
            CfnDeploymentGroup.EC2TagFilterProperty[],
        };
      }),
    };
  }

  private onPremiseTagSet(tagSet?: InstanceTagSet):
  CfnDeploymentGroup.OnPremisesTagSetProperty | undefined {
    if (!tagSet || tagSet.instanceTagGroups.length === 0) {
      return undefined;
    }

    return {
      onPremisesTagSetList: tagSet.instanceTagGroups.map(tagGroup => {
        return {
          onPremisesTagGroup: this.tagGroup2TagsArray(tagGroup),
        };
      }),
    };
  }

  private tagGroup2TagsArray(tagGroup: InstanceTagGroup): CfnDeploymentGroup.TagFilterProperty[] {
    const tagsInGroup = new Array<CfnDeploymentGroup.TagFilterProperty>();
    for (const tagKey in tagGroup) {
      if (tagGroup.hasOwnProperty(tagKey)) {
        const tagValues = tagGroup[tagKey];
        if (tagKey.length > 0) {
          if (tagValues.length > 0) {
            for (const tagValue of tagValues) {
              tagsInGroup.push({
                key: tagKey,
                value: tagValue,
                type: 'KEY_AND_VALUE',
              });
            }
          } else {
            tagsInGroup.push({
              key: tagKey,
              type: 'KEY_ONLY',
            });
          }
        } else {
          if (tagValues.length > 0) {
            for (const tagValue of tagValues) {
              tagsInGroup.push({
                value: tagValue,
                type: 'VALUE_ONLY',
              });
            }
          } else {
            throw new Error('Cannot specify both an empty key and no values for an instance tag filter');
          }
        }
      }
    }
    return tagsInGroup;
  }
}
