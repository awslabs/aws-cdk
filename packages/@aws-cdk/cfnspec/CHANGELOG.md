# CloudFormation Resource Specification v31.1.0

## New Resource Types

* AWS::FIS::ExperimentTemplate
* AWS::S3ObjectLambda::AccessPoint
* AWS::S3ObjectLambda::AccessPointPolicy

## Attribute Changes

* AWS::Backup::BackupSelection Id (__added__)
* AWS::RDS::DBProxy VpcId (__added__)

## Property Changes

* AWS::EC2::LaunchTemplate TagSpecifications.ItemType (__added__)
* AWS::EC2::LaunchTemplate TagSpecifications.Type (__changed__)
  * Old: TagSpecifications
  * New: List
* AWS::ServiceCatalogAppRegistry::AttributeGroup Attributes.Type (__deleted__)
* AWS::ServiceCatalogAppRegistry::AttributeGroup Attributes.PrimitiveType (__added__)
* AWS::ServiceDiscovery::Service Type (__added__)

## Property Type Changes

* AWS::EC2::LaunchTemplate.TagSpecifications (__removed__)
* AWS::ServiceCatalogAppRegistry::AttributeGroup.Attributes (__removed__)
* AWS::Backup::BackupSelection.BackupSelectionResourceType IamRoleArn.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::Backup::BackupSelection.BackupSelectionResourceType ListOfTags.DuplicatesAllowed (__added__)
* AWS::Backup::BackupSelection.BackupSelectionResourceType ListOfTags.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::Backup::BackupSelection.BackupSelectionResourceType Resources.DuplicatesAllowed (__added__)
* AWS::Backup::BackupSelection.BackupSelectionResourceType Resources.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::Backup::BackupSelection.BackupSelectionResourceType SelectionName.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::Backup::BackupSelection.ConditionResourceType ConditionKey.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::Backup::BackupSelection.ConditionResourceType ConditionType.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::Backup::BackupSelection.ConditionResourceType ConditionValue.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::SSM::MaintenanceWindowTarget.Targets Values.Required (__changed__)
  * Old: false
  * New: true
* AWS::SSM::MaintenanceWindowTask.Target Values.Required (__changed__)
  * Old: false
  * New: true


# CloudFormation Resource Specification v31.0.0

## New Resource Types

* AWS::CE::AnomalyMonitor
* AWS::CE::AnomalySubscription
* AWS::CertificateManager::Account
* AWS::ECS::ClusterCapacityProviderAssociations
* AWS::RDS::DBProxyEndpoint

## Attribute Changes

* AWS::SSM::ResourceDataSync SyncName (__added__)

## Property Changes

* AWS::AppSync::GraphQLApi LambdaAuthorizerConfig (__added__)
* AWS::Backup::BackupPlan BackupPlanTags.PrimitiveType (__deleted__)
* AWS::Backup::BackupPlan BackupPlanTags.PrimitiveItemType (__added__)
* AWS::Backup::BackupPlan BackupPlanTags.Type (__added__)
* AWS::DynamoDB::Table KinesisStreamSpecification (__deleted__)
* AWS::DynamoDB::Table ContributorInsightsSpecification (__added__)
* AWS::EC2::LaunchTemplate TagSpecifications (__added__)
* AWS::ECS::CapacityProvider AutoScalingGroupProvider.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::ECS::Cluster Configuration (__added__)
* AWS::ECS::Service EnableExecuteCommand (__added__)
* AWS::EFS::FileSystem AvailabilityZoneName (__added__)

## Property Type Changes

* AWS::DynamoDB::Table.KinesisStreamSpecification (__removed__)
* AWS::AppSync::GraphQLApi.LambdaAuthorizerConfig (__added__)
* AWS::DynamoDB::Table.ContributorInsightsSpecification (__added__)
* AWS::EC2::LaunchTemplate.TagSpecifications (__added__)
* AWS::ECS::Cluster.ClusterConfiguration (__added__)
* AWS::ECS::Cluster.ExecuteCommandConfiguration (__added__)
* AWS::ECS::Cluster.ExecuteCommandLogConfiguration (__added__)
* AWS::AppSync::GraphQLApi.AdditionalAuthenticationProvider LambdaAuthorizerConfig (__added__)
* AWS::Backup::BackupPlan.BackupPlanResourceType AdvancedBackupSettings.DuplicatesAllowed (__added__)
* AWS::Backup::BackupPlan.BackupPlanResourceType BackupPlanRule.DuplicatesAllowed (__added__)
* AWS::Backup::BackupPlan.BackupRuleResourceType CopyActions.DuplicatesAllowed (__added__)
* AWS::Backup::BackupPlan.BackupRuleResourceType RecoveryPointTags.PrimitiveType (__deleted__)
* AWS::Backup::BackupPlan.BackupRuleResourceType RecoveryPointTags.PrimitiveItemType (__added__)
* AWS::Backup::BackupPlan.BackupRuleResourceType RecoveryPointTags.Type (__added__)
* AWS::DynamoDB::Table.GlobalSecondaryIndex ContributorInsightsSpecification (__added__)
* AWS::ECS::CapacityProvider.AutoScalingGroupProvider ManagedScaling.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::ECS::CapacityProvider.AutoScalingGroupProvider ManagedTerminationProtection.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::ECS::CapacityProvider.ManagedScaling MaximumScalingStepSize.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::ECS::CapacityProvider.ManagedScaling MinimumScalingStepSize.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::ECS::CapacityProvider.ManagedScaling Status.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::ECS::CapacityProvider.ManagedScaling TargetCapacity.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::GameLift::Alias.RoutingStrategy Type.Required (__changed__)
  * Old: false
  * New: true
* AWS::IoT::TopicRule.S3Action CannedAcl (__added__)
* AWS::IoT::TopicRule.TopicRulePayload Actions.DuplicatesAllowed (__deleted__)
* AWS::IoT::TopicRule.TopicRulePayload RuleDisabled.Required (__changed__)
  * Old: true
  * New: false
* AWS::SSM::ResourceDataSync.AwsOrganizationsSource OrganizationSourceType.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::SSM::ResourceDataSync.AwsOrganizationsSource OrganizationalUnits.DuplicatesAllowed (__added__)
* AWS::SSM::ResourceDataSync.SyncSource SourceRegions.DuplicatesAllowed (__added__)
* AWS::SSM::ResourceDataSync.SyncSource SourceType.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable


# CloudFormation Resource Specification v30.1.0

## New Resource Types

* AWS::Events::ApiDestination
* AWS::Events::Connection
* AWS::IoT::AccountAuditConfiguration
* AWS::IoT::CustomMetric
* AWS::IoT::Dimension
* AWS::IoT::MitigationAction
* AWS::IoT::ScheduledAudit
* AWS::IoT::SecurityProfile
* AWS::S3Outposts::AccessPoint
* AWS::S3Outposts::Bucket
* AWS::S3Outposts::BucketPolicy
* AWS::S3Outposts::Endpoint

## Attribute Changes

* AWS::Athena::WorkGroup EffectiveEngineVersion (__added__)

## Property Changes

* AWS::Backup::BackupVault BackupVaultTags.PrimitiveType (__deleted__)
* AWS::Backup::BackupVault BackupVaultTags.PrimitiveItemType (__added__)
* AWS::Backup::BackupVault BackupVaultTags.Type (__added__)
* AWS::Cloud9::EnvironmentEC2 ImageId (__added__)
* AWS::CloudFormation::ModuleVersion ModuleName.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::CloudFormation::ModuleVersion ModulePackage.Required (__changed__)
  * Old: false
  * New: true
* AWS::DataBrew::Dataset Format (__added__)
* AWS::Detective::MemberInvitation DisableEmailNotification (__added__)
* AWS::IVS::Channel RecordingConfigurationArn (__deleted__)
* AWS::SecretsManager::Secret ReplicaRegions (__added__)
* AWS::ServiceDiscovery::HttpNamespace Tags.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::ServiceDiscovery::PrivateDnsNamespace Tags.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::ServiceDiscovery::PublicDnsNamespace Tags.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::ServiceDiscovery::Service Tags.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable

## Property Type Changes

* AWS::Athena::WorkGroup.EngineVersion (__added__)
* AWS::SecretsManager::Secret.ReplicaRegion (__added__)
* AWS::Athena::WorkGroup.WorkGroupConfiguration EngineVersion (__added__)
* AWS::Athena::WorkGroup.WorkGroupConfigurationUpdates EngineVersion (__added__)
* AWS::Backup::BackupVault.NotificationObjectType BackupVaultEvents.DuplicatesAllowed (__added__)


# CloudFormation Resource Specification v30.0.0

## New Resource Types

* AWS::EC2::TransitGatewayConnect
* AWS::EKS::Addon
* AWS::EMR::Studio
* AWS::EMR::StudioSessionMapping
* AWS::IAM::OIDCProvider
* AWS::IAM::SAMLProvider
* AWS::IAM::ServerCertificate
* AWS::IAM::VirtualMFADevice
* AWS::SageMaker::Image
* AWS::SageMaker::ImageVersion

## Attribute Changes

* AWS::IoTSiteWise::Portal PortalStatus (__deleted__)
* AWS::MediaPackage::Channel HlsIngest (__deleted__)
* AWS::QuickSight::Dashboard Version (__deleted__)
* AWS::QuickSight::Template Version (__deleted__)
* AWS::QuickSight::Theme Version (__deleted__)
* AWS::S3::AccessPoint PolicyStatus (__deleted__)
* AWS::SageMaker::Project ServiceCatalogProvisionedProductDetails (__deleted__)
* AWS::ServiceCatalog::CloudFormationProvisionedProduct Outputs (__deleted__)

## Property Changes

* AWS::ECR::PublicRepository Tags (__added__)
* AWS::IVS::Channel RecordingConfigurationArn (__added__)
* AWS::IoTSiteWise::AssetModel AssetModelCompositeModels (__added__)
* AWS::IoTSiteWise::Portal PortalAuthMode (__added__)
* AWS::SageMaker::Model InferenceExecutionConfig (__added__)

## Property Type Changes

* AWS::IoTSiteWise::Portal.MonitorErrorDetails (__removed__)
* AWS::IoTSiteWise::Portal.PortalStatus (__removed__)
* AWS::MediaPackage::Channel.HlsIngest (__removed__)
* AWS::MediaPackage::Channel.IngestEndpoint (__removed__)
* AWS::QuickSight::Dashboard.DashboardError (__removed__)
* AWS::QuickSight::Dashboard.DashboardVersion (__removed__)
* AWS::QuickSight::Dashboard.Sheet (__removed__)
* AWS::QuickSight::Template.ColumnGroupColumnSchema (__removed__)
* AWS::QuickSight::Template.ColumnGroupSchema (__removed__)
* AWS::QuickSight::Template.ColumnSchema (__removed__)
* AWS::QuickSight::Template.DataSetConfiguration (__removed__)
* AWS::QuickSight::Template.DataSetSchema (__removed__)
* AWS::QuickSight::Template.Sheet (__removed__)
* AWS::QuickSight::Template.TemplateError (__removed__)
* AWS::QuickSight::Template.TemplateVersion (__removed__)
* AWS::QuickSight::Theme.ThemeError (__removed__)
* AWS::QuickSight::Theme.ThemeVersion (__removed__)
* AWS::IoTSiteWise::AccessPolicy.IamRole (__added__)
* AWS::IoTSiteWise::AccessPolicy.IamUser (__added__)
* AWS::IoTSiteWise::AssetModel.AssetModelCompositeModel (__added__)
* AWS::SageMaker::Model.InferenceExecutionConfig (__added__)
* AWS::ACMPCA::Certificate.Validity Value.PrimitiveType (__changed__)
  * Old: Integer
  * New: Double
* AWS::CodeBuild::ReportGroup.S3ReportExportConfig BucketOwner (__added__)
* AWS::IoTSiteWise::AccessPolicy.AccessPolicyIdentity IamRole (__added__)
* AWS::IoTSiteWise::AccessPolicy.AccessPolicyIdentity IamUser (__added__)
* AWS::IoTSiteWise::AssetModel.AssetModelProperty DataTypeSpec (__added__)
* AWS::Pinpoint::Campaign.CampaignSmsMessage EntityId (__added__)
* AWS::Pinpoint::Campaign.CampaignSmsMessage TemplateId (__added__)
* AWS::Synthetics::Canary.Code Handler.Required (__changed__)
  * Old: false
  * New: true
* AWS::Synthetics::Canary.RunConfig TimeoutInSeconds.Required (__changed__)
  * Old: true
  * New: false


# CloudFormation Resource Specification v29.0.0

## New Resource Types

## Attribute Changes

* AWS::EC2::TransitGatewayMulticastDomainAssociation State (__added__)
* AWS::EC2::TransitGatewayMulticastGroupMember TransitGatewayAttachmentId (__added__)
* AWS::EC2::TransitGatewayMulticastGroupSource TransitGatewayAttachmentId (__added__)
* AWS::IoTWireless::ServiceProfile LoRaWANResponse (__deleted__)
* AWS::IoTWireless::ServiceProfile ChannelMask (__added__)
* AWS::IoTWireless::ServiceProfile DevStatusReqFreq (__added__)
* AWS::IoTWireless::ServiceProfile DlBucketSize (__added__)
* AWS::IoTWireless::ServiceProfile DlRate (__added__)
* AWS::IoTWireless::ServiceProfile DlRatePolicy (__added__)
* AWS::IoTWireless::ServiceProfile DrMax (__added__)
* AWS::IoTWireless::ServiceProfile DrMin (__added__)
* AWS::IoTWireless::ServiceProfile HrAllowed (__added__)
* AWS::IoTWireless::ServiceProfile MinGwDiversity (__added__)
* AWS::IoTWireless::ServiceProfile NwkGeoLoc (__added__)
* AWS::IoTWireless::ServiceProfile PrAllowed (__added__)
* AWS::IoTWireless::ServiceProfile RaAllowed (__added__)
* AWS::IoTWireless::ServiceProfile ReportDevStatusBattery (__added__)
* AWS::IoTWireless::ServiceProfile ReportDevStatusMargin (__added__)
* AWS::IoTWireless::ServiceProfile TargetPer (__added__)
* AWS::IoTWireless::ServiceProfile UlBucketSize (__added__)
* AWS::IoTWireless::ServiceProfile UlRate (__added__)
* AWS::IoTWireless::ServiceProfile UlRatePolicy (__added__)
* AWS::IoTWireless::WirelessDevice ThingArn (__deleted__)
* AWS::IoTWireless::WirelessGateway ThingArn (__deleted__)
* AWS::IoTWireless::WirelessGateway ThingName (__added__)

## Property Changes

* AWS::CodeBuild::Project ConcurrentBuildLimit (__added__)
* AWS::DataBrew::Job JobSample (__added__)
* AWS::DynamoDB::Table KinesisStreamSpecification (__added__)
* AWS::EC2::TransitGatewayMulticastDomain TransitGatewayId.Required (__changed__)
  * Old: false
  * New: true
* AWS::EC2::TransitGatewayMulticastDomainAssociation State (__deleted__)
* AWS::EC2::TransitGatewayMulticastDomainAssociation SubnetId.Required (__changed__)
  * Old: false
  * New: true
* AWS::EC2::TransitGatewayMulticastDomainAssociation TransitGatewayAttachmentId.Required (__changed__)
  * Old: false
  * New: true
* AWS::EC2::TransitGatewayMulticastDomainAssociation TransitGatewayMulticastDomainId.Required (__changed__)
  * Old: false
  * New: true
* AWS::EC2::TransitGatewayMulticastGroupMember TransitGatewayAttachmentId (__deleted__)
* AWS::EC2::TransitGatewayMulticastGroupMember GroupIpAddress.Required (__changed__)
  * Old: false
  * New: true
* AWS::EC2::TransitGatewayMulticastGroupMember NetworkInterfaceId.Required (__changed__)
  * Old: false
  * New: true
* AWS::EC2::TransitGatewayMulticastGroupMember TransitGatewayMulticastDomainId.Required (__changed__)
  * Old: false
  * New: true
* AWS::EC2::TransitGatewayMulticastGroupSource TransitGatewayAttachmentId (__deleted__)
* AWS::EC2::TransitGatewayMulticastGroupSource GroupIpAddress.Required (__changed__)
  * Old: false
  * New: true
* AWS::EC2::TransitGatewayMulticastGroupSource NetworkInterfaceId.Required (__changed__)
  * Old: false
  * New: true
* AWS::EC2::TransitGatewayMulticastGroupSource TransitGatewayMulticastDomainId.Required (__changed__)
  * Old: false
  * New: true
* AWS::ElastiCache::GlobalReplicationGroup CacheParameterGroupName (__added__)
* AWS::ElasticLoadBalancingV2::TargetGroup ProtocolVersion (__added__)
* AWS::ImageBuilder::Image ContainerRecipeArn (__added__)
* AWS::ImageBuilder::Image ImageRecipeArn.Required (__changed__)
  * Old: true
  * New: false
* AWS::ImageBuilder::ImagePipeline ContainerRecipeArn (__added__)
* AWS::ImageBuilder::ImagePipeline ImageRecipeArn.Required (__changed__)
  * Old: true
  * New: false
* AWS::IoTAnalytics::Dataset LateDataRules (__added__)
* AWS::IoTWireless::WirelessDevice ThingArn (__added__)
* AWS::IoTWireless::WirelessGateway ThingName (__deleted__)
* AWS::IoTWireless::WirelessGateway ThingArn (__added__)
* AWS::StepFunctions::StateMachine Definition (__added__)

## Property Type Changes

* AWS::IoTWireless::ServiceProfile.LoRaWANGetServiceProfileInfo (__removed__)
* AWS::DynamoDB::Table.KinesisStreamSpecification (__added__)
* AWS::IoTAnalytics::Dataset.DeltaTimeSessionWindowConfiguration (__added__)
* AWS::IoTAnalytics::Dataset.LateDataRule (__added__)
* AWS::IoTAnalytics::Dataset.LateDataRuleConfiguration (__added__)
* AWS::StepFunctions::StateMachine.Definition (__added__)
* AWS::CodeCommit::Repository.Code BranchName.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::ElasticLoadBalancingV2::TargetGroup.Matcher GrpcCode (__added__)
* AWS::FSx::FileSystem.WindowsConfiguration Aliases (__added__)
* AWS::FSx::FileSystem.WindowsConfiguration ThroughputCapacity.Required (__changed__)
  * Old: false
  * New: true
* AWS::IoTWireless::ServiceProfile.LoRaWANServiceProfile ChannelMask (__added__)
* AWS::IoTWireless::ServiceProfile.LoRaWANServiceProfile DevStatusReqFreq (__added__)
* AWS::IoTWireless::ServiceProfile.LoRaWANServiceProfile DlBucketSize (__added__)
* AWS::IoTWireless::ServiceProfile.LoRaWANServiceProfile DlRate (__added__)
* AWS::IoTWireless::ServiceProfile.LoRaWANServiceProfile DlRatePolicy (__added__)
* AWS::IoTWireless::ServiceProfile.LoRaWANServiceProfile DrMax (__added__)
* AWS::IoTWireless::ServiceProfile.LoRaWANServiceProfile DrMin (__added__)
* AWS::IoTWireless::ServiceProfile.LoRaWANServiceProfile HrAllowed (__added__)
* AWS::IoTWireless::ServiceProfile.LoRaWANServiceProfile MinGwDiversity (__added__)
* AWS::IoTWireless::ServiceProfile.LoRaWANServiceProfile NwkGeoLoc (__added__)
* AWS::IoTWireless::ServiceProfile.LoRaWANServiceProfile PrAllowed (__added__)
* AWS::IoTWireless::ServiceProfile.LoRaWANServiceProfile RaAllowed (__added__)
* AWS::IoTWireless::ServiceProfile.LoRaWANServiceProfile ReportDevStatusBattery (__added__)
* AWS::IoTWireless::ServiceProfile.LoRaWANServiceProfile ReportDevStatusMargin (__added__)
* AWS::IoTWireless::ServiceProfile.LoRaWANServiceProfile TargetPer (__added__)
* AWS::IoTWireless::ServiceProfile.LoRaWANServiceProfile UlBucketSize (__added__)
* AWS::IoTWireless::ServiceProfile.LoRaWANServiceProfile UlRate (__added__)
* AWS::IoTWireless::ServiceProfile.LoRaWANServiceProfile UlRatePolicy (__added__)
* AWS::Pinpoint::Campaign.CampaignSmsMessage OriginationNumber (__added__)


# CloudFormation Resource Specification v28.0.0

## New Resource Types

* AWS::CloudFormation::ResourceDefaultVersion
* AWS::CloudFormation::ResourceVersion
* AWS::EC2::TransitGatewayMulticastDomain
* AWS::EC2::TransitGatewayMulticastDomainAssociation
* AWS::EC2::TransitGatewayMulticastGroupMember
* AWS::EC2::TransitGatewayMulticastGroupSource
* AWS::SageMaker::App
* AWS::SageMaker::AppImageConfig
* AWS::SageMaker::Domain
* AWS::SageMaker::UserProfile
* AWS::ServiceCatalog::ServiceAction
* AWS::ServiceCatalog::ServiceActionAssociation

## Attribute Changes

* AWS::ApiGateway::ApiKey APIKeyId (__added__)

## Property Changes

* AWS::DMS::Endpoint DocDbSettings (__added__)
* AWS::DMS::Endpoint IbmDb2Settings (__added__)
* AWS::DMS::Endpoint MicrosoftSqlServerSettings (__added__)
* AWS::DMS::Endpoint MySqlSettings (__added__)
* AWS::DMS::Endpoint OracleSettings (__added__)
* AWS::DMS::Endpoint PostgreSqlSettings (__added__)
* AWS::DMS::Endpoint RedshiftSettings (__added__)
* AWS::DMS::Endpoint SybaseSettings (__added__)
* AWS::ECS::Cluster Configuration (__deleted__)
* AWS::ECS::Service EnableExecuteCommand (__deleted__)
* AWS::ManagedBlockchain::Node MemberId.Required (__changed__)
  * Old: true
  * New: false
* AWS::MediaLive::Channel Vpc (__added__)

## Property Type Changes

* AWS::ECS::Cluster.ClusterConfiguration (__removed__)
* AWS::ECS::Cluster.ExecuteCommandConfiguration (__removed__)
* AWS::ECS::Cluster.ExecuteCommandLogConfiguration (__removed__)
* AWS::AppMesh::VirtualGateway.SubjectAlternativeNameMatchers (__added__)
* AWS::AppMesh::VirtualGateway.SubjectAlternativeNames (__added__)
* AWS::AppMesh::VirtualGateway.VirtualGatewayClientTlsCertificate (__added__)
* AWS::AppMesh::VirtualGateway.VirtualGatewayListenerTlsSdsCertificate (__added__)
* AWS::AppMesh::VirtualGateway.VirtualGatewayListenerTlsValidationContext (__added__)
* AWS::AppMesh::VirtualGateway.VirtualGatewayListenerTlsValidationContextTrust (__added__)
* AWS::AppMesh::VirtualGateway.VirtualGatewayTlsValidationContextSdsTrust (__added__)
* AWS::AppMesh::VirtualNode.ClientTlsCertificate (__added__)
* AWS::AppMesh::VirtualNode.ListenerTlsSdsCertificate (__added__)
* AWS::AppMesh::VirtualNode.ListenerTlsValidationContext (__added__)
* AWS::AppMesh::VirtualNode.ListenerTlsValidationContextTrust (__added__)
* AWS::AppMesh::VirtualNode.SubjectAlternativeNameMatchers (__added__)
* AWS::AppMesh::VirtualNode.SubjectAlternativeNames (__added__)
* AWS::AppMesh::VirtualNode.TlsValidationContextSdsTrust (__added__)
* AWS::DMS::Endpoint.DocDbSettings (__added__)
* AWS::DMS::Endpoint.IbmDb2Settings (__added__)
* AWS::DMS::Endpoint.MicrosoftSqlServerSettings (__added__)
* AWS::DMS::Endpoint.MySqlSettings (__added__)
* AWS::DMS::Endpoint.OracleSettings (__added__)
* AWS::DMS::Endpoint.PostgreSqlSettings (__added__)
* AWS::DMS::Endpoint.RedshiftSettings (__added__)
* AWS::DMS::Endpoint.SybaseSettings (__added__)
* AWS::MediaLive::Channel.VpcOutputSettings (__added__)
* AWS::AppMesh::VirtualGateway.VirtualGatewayClientPolicyTls Certificate (__added__)
* AWS::AppMesh::VirtualGateway.VirtualGatewayListenerTls Validation (__added__)
* AWS::AppMesh::VirtualGateway.VirtualGatewayListenerTlsCertificate SDS (__added__)
* AWS::AppMesh::VirtualGateway.VirtualGatewayTlsValidationContext SubjectAlternativeNames (__added__)
* AWS::AppMesh::VirtualGateway.VirtualGatewayTlsValidationContextTrust SDS (__added__)
* AWS::AppMesh::VirtualNode.ClientPolicyTls Certificate (__added__)
* AWS::AppMesh::VirtualNode.ListenerTls Validation (__added__)
* AWS::AppMesh::VirtualNode.ListenerTlsCertificate SDS (__added__)
* AWS::AppMesh::VirtualNode.TlsValidationContext SubjectAlternativeNames (__added__)
* AWS::AppMesh::VirtualNode.TlsValidationContextTrust SDS (__added__)
* AWS::DMS::Endpoint.MongoDbSettings SecretsManagerAccessRoleArn (__added__)
* AWS::DMS::Endpoint.MongoDbSettings SecretsManagerSecretId (__added__)


# CloudFormation Resource Specification v27.0.0

## New Resource Types

* AWS::ECR::RegistryPolicy
* AWS::ECR::ReplicationConfiguration
* AWS::ElastiCache::GlobalReplicationGroup
* AWS::ImageBuilder::ContainerRecipe

## Attribute Changes

* AWS::IoTWireless::ServiceProfile LoRaWANResponse (__added__)
* AWS::MWAA::Environment CreatedAt (__deleted__)
* AWS::MWAA::Environment LastUpdate (__deleted__)
* AWS::MWAA::Environment Name (__deleted__)
* AWS::MWAA::Environment ServiceRoleArn (__deleted__)
* AWS::MWAA::Environment Status (__deleted__)
* AWS::MWAA::Environment WebserverUrl (__added__)

## Property Changes

* AWS::AppMesh::GatewayRoute GatewayRouteName.Required (__changed__)
  * Old: true
  * New: false
* AWS::AppMesh::Mesh MeshName.Required (__changed__)
  * Old: true
  * New: false
* AWS::AppMesh::Route RouteName.Required (__changed__)
  * Old: true
  * New: false
* AWS::AppMesh::VirtualGateway VirtualGatewayName.Required (__changed__)
  * Old: true
  * New: false
* AWS::AppMesh::VirtualNode VirtualNodeName.Required (__changed__)
  * Old: true
  * New: false
* AWS::AppMesh::VirtualRouter VirtualRouterName.Required (__changed__)
  * Old: true
  * New: false
* AWS::Cassandra::Keyspace Tags (__added__)
* AWS::Cassandra::Table PointInTimeRecoveryEnabled (__added__)
* AWS::Cassandra::Table Tags (__added__)
* AWS::CloudWatch::MetricStream OutputFormat (__added__)
* AWS::ECS::Service EnableExecuteCommand (__added__)
* AWS::ECS::Service PlatformVersion.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::IoTWireless::Destination NextToken (__deleted__)
* AWS::IoTWireless::Destination Name.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::IoTWireless::DeviceProfile LoRaWANDeviceProfile (__deleted__)
* AWS::IoTWireless::DeviceProfile NextToken (__deleted__)
* AWS::IoTWireless::DeviceProfile LoRaWAN (__added__)
* AWS::IoTWireless::ServiceProfile LoRaWANGetServiceProfileInfo (__deleted__)
* AWS::IoTWireless::ServiceProfile LoRaWANServiceProfile (__deleted__)
* AWS::IoTWireless::ServiceProfile NextToken (__deleted__)
* AWS::IoTWireless::ServiceProfile LoRaWAN (__added__)
* AWS::IoTWireless::WirelessDevice LoRaWANDevice (__deleted__)
* AWS::IoTWireless::WirelessDevice NextToken (__deleted__)
* AWS::IoTWireless::WirelessDevice LastUplinkReceivedAt (__added__)
* AWS::IoTWireless::WirelessDevice LoRaWAN (__added__)
* AWS::IoTWireless::WirelessGateway LoRaWANGateway (__deleted__)
* AWS::IoTWireless::WirelessGateway NextToken (__deleted__)
* AWS::IoTWireless::WirelessGateway LastUplinkReceivedAt (__added__)
* AWS::IoTWireless::WirelessGateway LoRaWAN (__added__)
* AWS::MWAA::Environment WebserverUrl (__deleted__)
* AWS::MWAA::Environment Name (__added__)
* AWS::MWAA::Environment KmsKey.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::MWAA::Environment NetworkConfiguration.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::SageMaker::Model InferenceExecutionConfig (__deleted__)

## Property Type Changes

* AWS::IoTWireless::WirelessDevice.AbpV10X (__removed__)
* AWS::IoTWireless::WirelessDevice.OtaaV10X (__removed__)
* AWS::IoTWireless::WirelessDevice.SessionKeysAbpV10X (__removed__)
* AWS::MWAA::Environment.LastUpdate (__removed__)
* AWS::MWAA::Environment.SecurityGroupList (__removed__)
* AWS::MWAA::Environment.SubnetList (__removed__)
* AWS::MWAA::Environment.UpdateError (__removed__)
* AWS::SageMaker::Model.InferenceExecutionConfig (__removed__)
* AWS::DataBrew::Job.CsvOutputOptions (__added__)
* AWS::DataBrew::Job.OutputFormatOptions (__added__)
* AWS::IoTWireless::WirelessDevice.AbpV10x (__added__)
* AWS::IoTWireless::WirelessDevice.OtaaV10x (__added__)
* AWS::IoTWireless::WirelessDevice.SessionKeysAbpV10x (__added__)
* AWS::Cognito::UserPoolClient.AnalyticsConfiguration ApplicationArn (__added__)
* AWS::DataBrew::Job.Output FormatOptions (__added__)
* AWS::IoTWireless::WirelessDevice.LoRaWANDevice AbpV10X (__deleted__)
* AWS::IoTWireless::WirelessDevice.LoRaWANDevice OtaaV10X (__deleted__)
* AWS::IoTWireless::WirelessDevice.LoRaWANDevice AbpV10x (__added__)
* AWS::IoTWireless::WirelessDevice.LoRaWANDevice OtaaV10x (__added__)
* AWS::MWAA::Environment.NetworkConfiguration SecurityGroupIds.PrimitiveItemType (__added__)
* AWS::MWAA::Environment.NetworkConfiguration SecurityGroupIds.Type (__changed__)
  * Old: SecurityGroupList
  * New: List
* AWS::MWAA::Environment.NetworkConfiguration SecurityGroupIds.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::MWAA::Environment.NetworkConfiguration SubnetIds.PrimitiveItemType (__added__)
* AWS::MWAA::Environment.NetworkConfiguration SubnetIds.Type (__changed__)
  * Old: SubnetList
  * New: List
* AWS::MediaPackage::PackagingConfiguration.CmafEncryption SpekeKeyProvider.Type (__added__)
* AWS::MediaPackage::PackagingConfiguration.DashEncryption SpekeKeyProvider.Type (__added__)
* AWS::MediaPackage::PackagingConfiguration.HlsEncryption SpekeKeyProvider.Type (__added__)
* AWS::MediaPackage::PackagingConfiguration.MssEncryption SpekeKeyProvider.Type (__added__)


# CloudFormation Resource Specification v26.0.0

## New Resource Types

* AWS::LookoutVision::Project
* AWS::SageMaker::FeatureGroup

## Attribute Changes

* AWS::MediaConnect::FlowVpcInterface FlowArn (__deleted__)
* AWS::MediaConnect::FlowVpcInterface Name (__deleted__)
* AWS::S3::AccessPoint NetworkOrigin (__added__)
* AWS::S3::AccessPoint PolicyStatus (__added__)

## Property Changes

* AWS::ACMPCA::Certificate ApiPassthrough (__added__)
* AWS::ACMPCA::Certificate ValidityNotBefore (__added__)
* AWS::AmazonMQ::Configuration AuthenticationStrategy (__added__)
* AWS::ApiGatewayV2::Stage AccessPolicyId (__added__)
* AWS::ECS::Cluster Configuration (__added__)
* AWS::Kinesis::Stream Tags.DuplicatesAllowed (__changed__)
  * Old: false
  * New: true
* AWS::MediaConnect::FlowVpcInterface FlowArn (__added__)
* AWS::MediaConnect::FlowVpcInterface Name (__added__)
* AWS::S3::AccessPoint NetworkOrigin (__deleted__)
* AWS::S3::AccessPoint PolicyStatus (__deleted__)
* AWS::SSM::MaintenanceWindowTask MaxConcurrency.Required (__changed__)
  * Old: true
  * New: false
* AWS::SSM::MaintenanceWindowTask MaxErrors.Required (__changed__)
  * Old: true
  * New: false
* AWS::SSM::MaintenanceWindowTask Targets.Required (__changed__)
  * Old: true
  * New: false
* AWS::SSO::InstanceAccessControlAttributeConfiguration InstanceAccessControlAttributeConfiguration (__deleted__)
* AWS::SageMaker::Device Tags.ItemType (__changed__)
  * Old: Json
  * New: Tag
* AWS::SageMaker::Device Tags.Type (__changed__)
  * Old: Tag
  * New: List
* AWS::SageMaker::DeviceFleet Tags.ItemType (__changed__)
  * Old: Json
  * New: Tag
* AWS::SageMaker::DeviceFleet Tags.Type (__changed__)
  * Old: Tag
  * New: List
* AWS::SageMaker::Model InferenceExecutionConfig (__added__)

## Property Type Changes

* AWS::ACMPCA::Certificate.ApiPassthrough (__added__)
* AWS::ACMPCA::Certificate.CertificatePolicyList (__added__)
* AWS::ACMPCA::Certificate.EdiPartyName (__added__)
* AWS::ACMPCA::Certificate.ExtendedKeyUsage (__added__)
* AWS::ACMPCA::Certificate.ExtendedKeyUsageList (__added__)
* AWS::ACMPCA::Certificate.Extensions (__added__)
* AWS::ACMPCA::Certificate.GeneralName (__added__)
* AWS::ACMPCA::Certificate.GeneralNameList (__added__)
* AWS::ACMPCA::Certificate.KeyUsage (__added__)
* AWS::ACMPCA::Certificate.OtherName (__added__)
* AWS::ACMPCA::Certificate.PolicyInformation (__added__)
* AWS::ACMPCA::Certificate.PolicyQualifierInfo (__added__)
* AWS::ACMPCA::Certificate.PolicyQualifierInfoList (__added__)
* AWS::ACMPCA::Certificate.Qualifier (__added__)
* AWS::ACMPCA::Certificate.Subject (__added__)
* AWS::AppFlow::Flow.IdFieldNamesList (__added__)
* AWS::ECS::Cluster.ClusterConfiguration (__added__)
* AWS::ECS::Cluster.ExecuteCommandConfiguration (__added__)
* AWS::ECS::Cluster.ExecuteCommandLogConfiguration (__added__)
* AWS::SageMaker::Model.InferenceExecutionConfig (__added__)
* AWS::AppFlow::Flow.SalesforceDestinationProperties IdFieldNames (__added__)
* AWS::AppFlow::Flow.SalesforceDestinationProperties WriteOperationType (__added__)
* AWS::DLM::LifecyclePolicy.CreateRule Location (__added__)
* AWS::DLM::LifecyclePolicy.CrossRegionCopyRule Target (__added__)
* AWS::DLM::LifecyclePolicy.CrossRegionCopyRule TargetRegion.Required (__changed__)
  * Old: true
  * New: false
* AWS::DLM::LifecyclePolicy.PolicyDetails ResourceLocations (__added__)


# CloudFormation Resource Specification v24.0.0

## New Resource Types

* AWS::EMRContainers::VirtualCluster
* AWS::QuickSight::Analysis
* AWS::QuickSight::Dashboard
* AWS::QuickSight::Template
* AWS::QuickSight::Theme
* AWS::ServiceCatalogAppRegistry::Application
* AWS::ServiceCatalogAppRegistry::AttributeGroup
* AWS::ServiceCatalogAppRegistry::AttributeGroupAssociation
* AWS::ServiceCatalogAppRegistry::ResourceAssociation

## Attribute Changes

* AWS::LicenseManager::Grant Version (__added__)
* AWS::LicenseManager::License Version (__added__)

## Property Changes

* AWS::ElastiCache::User Authentication (__deleted__)
* AWS::ElastiCache::User UserGroupIds (__deleted__)
* AWS::ElastiCache::UserGroup PendingChanges (__deleted__)
* AWS::ElastiCache::UserGroup ReplicationGroupIds (__deleted__)
* AWS::IoTAnalytics::Datastore FileFormatConfiguration (__added__)
* AWS::Kinesis::Stream Tags.DuplicatesAllowed (__changed__)
  * Old: true
  * New: false
* AWS::LicenseManager::Grant ClientToken (__deleted__)
* AWS::LicenseManager::Grant Filters (__deleted__)
* AWS::LicenseManager::Grant GrantArns (__deleted__)
* AWS::LicenseManager::Grant GrantStatus (__deleted__)
* AWS::LicenseManager::Grant GrantedOperations (__deleted__)
* AWS::LicenseManager::Grant GranteePrincipalArn (__deleted__)
* AWS::LicenseManager::Grant MaxResults (__deleted__)
* AWS::LicenseManager::Grant NextToken (__deleted__)
* AWS::LicenseManager::Grant ParentArn (__deleted__)
* AWS::LicenseManager::Grant SourceVersion (__deleted__)
* AWS::LicenseManager::Grant StatusReason (__deleted__)
* AWS::LicenseManager::Grant Tags (__deleted__)
* AWS::LicenseManager::Grant Version (__deleted__)
* AWS::LicenseManager::License ClientToken (__deleted__)
* AWS::LicenseManager::License Filters (__deleted__)
* AWS::LicenseManager::License LicenseArns (__deleted__)
* AWS::LicenseManager::License MaxResults (__deleted__)
* AWS::LicenseManager::License NextToken (__deleted__)
* AWS::LicenseManager::License SourceVersion (__deleted__)
* AWS::LicenseManager::License Tags (__deleted__)
* AWS::LicenseManager::License Version (__deleted__)
* AWS::LicenseManager::License LicenseName.Required (__changed__)
  * Old: false
  * New: true
* AWS::LicenseManager::License ProductName.Required (__changed__)
  * Old: false
  * New: true
* AWS::MSK::Cluster BrokerNodeGroupInfo.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::S3::AccessPoint CreationDate (__deleted__)
* AWS::ServiceCatalog::PortfolioShare ShareTagOptions (__added__)

## Property Type Changes

* AWS::ElastiCache::User.Authentication (__removed__)
* AWS::ElastiCache::UserGroup.UserGroupPendingChanges (__removed__)
* AWS::LicenseManager::Grant.Filter (__removed__)
* AWS::LicenseManager::Grant.StringList (__removed__)
* AWS::LicenseManager::License.Filter (__removed__)
* AWS::LicenseManager::License.Rule (__removed__)
* AWS::LicenseManager::License.RuleList (__removed__)
* AWS::LicenseManager::License.StringList (__removed__)
* AWS::NetworkFirewall::FirewallPolicy.CustomActions (__removed__)
* AWS::NetworkFirewall::FirewallPolicy.Dimensions (__removed__)
* AWS::NetworkFirewall::FirewallPolicy.StatefulRuleGroupReferences (__removed__)
* AWS::NetworkFirewall::FirewallPolicy.StatelessActions (__removed__)
* AWS::NetworkFirewall::FirewallPolicy.StatelessRuleGroupReferences (__removed__)
* AWS::NetworkFirewall::LoggingConfiguration.LogDestinationConfigs (__removed__)
* AWS::NetworkFirewall::RuleGroup.Addresses (__removed__)
* AWS::NetworkFirewall::RuleGroup.CustomActions (__removed__)
* AWS::NetworkFirewall::RuleGroup.Dimensions (__removed__)
* AWS::NetworkFirewall::RuleGroup.Flags (__removed__)
* AWS::NetworkFirewall::RuleGroup.PortRanges (__removed__)
* AWS::NetworkFirewall::RuleGroup.ProtocolNumbers (__removed__)
* AWS::NetworkFirewall::RuleGroup.RuleOptions (__removed__)
* AWS::NetworkFirewall::RuleGroup.StatefulRules (__removed__)
* AWS::NetworkFirewall::RuleGroup.StatelessRules (__removed__)
* AWS::NetworkFirewall::RuleGroup.TCPFlags (__removed__)
* AWS::NetworkFirewall::RuleGroup.TargetTypes (__removed__)
* AWS::NetworkFirewall::RuleGroup.VariableDefinitionList (__removed__)
* AWS::IoTAnalytics::Datastore.Column (__added__)
* AWS::IoTAnalytics::Datastore.FileFormatConfiguration (__added__)
* AWS::IoTAnalytics::Datastore.JsonConfiguration (__added__)
* AWS::IoTAnalytics::Datastore.ParquetConfiguration (__added__)
* AWS::IoTAnalytics::Datastore.SchemaDefinition (__added__)
* AWS::Kendra::DataSource.ExcludeMimeTypesList (__added__)
* AWS::Kendra::DataSource.ExcludeSharedDrivesList (__added__)
* AWS::Kendra::DataSource.ExcludeUserAccountsList (__added__)
* AWS::Kendra::DataSource.GoogleDriveConfiguration (__added__)
* AWS::Kendra::DataSource.DataSourceConfiguration GoogleDriveConfiguration (__added__)
* AWS::LicenseManager::License.Entitlement CheckoutRules (__deleted__)
* AWS::MSK::Cluster.BrokerNodeGroupInfo InstanceType.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::NetworkFirewall::FirewallPolicy.FirewallPolicy StatefulRuleGroupReferences.DuplicatesAllowed (__added__)
* AWS::NetworkFirewall::FirewallPolicy.FirewallPolicy StatefulRuleGroupReferences.ItemType (__added__)
* AWS::NetworkFirewall::FirewallPolicy.FirewallPolicy StatefulRuleGroupReferences.Type (__changed__)
  * Old: StatefulRuleGroupReferences
  * New: List
* AWS::NetworkFirewall::FirewallPolicy.FirewallPolicy StatelessCustomActions.DuplicatesAllowed (__added__)
* AWS::NetworkFirewall::FirewallPolicy.FirewallPolicy StatelessCustomActions.ItemType (__added__)
* AWS::NetworkFirewall::FirewallPolicy.FirewallPolicy StatelessCustomActions.Type (__changed__)
  * Old: CustomActions
  * New: List
* AWS::NetworkFirewall::FirewallPolicy.FirewallPolicy StatelessDefaultActions.DuplicatesAllowed (__added__)
* AWS::NetworkFirewall::FirewallPolicy.FirewallPolicy StatelessDefaultActions.PrimitiveItemType (__added__)
* AWS::NetworkFirewall::FirewallPolicy.FirewallPolicy StatelessDefaultActions.Type (__changed__)
  * Old: StatelessActions
  * New: List
* AWS::NetworkFirewall::FirewallPolicy.FirewallPolicy StatelessFragmentDefaultActions.DuplicatesAllowed (__added__)
* AWS::NetworkFirewall::FirewallPolicy.FirewallPolicy StatelessFragmentDefaultActions.PrimitiveItemType (__added__)
* AWS::NetworkFirewall::FirewallPolicy.FirewallPolicy StatelessFragmentDefaultActions.Type (__changed__)
  * Old: StatelessActions
  * New: List
* AWS::NetworkFirewall::FirewallPolicy.FirewallPolicy StatelessRuleGroupReferences.DuplicatesAllowed (__added__)
* AWS::NetworkFirewall::FirewallPolicy.FirewallPolicy StatelessRuleGroupReferences.ItemType (__added__)
* AWS::NetworkFirewall::FirewallPolicy.FirewallPolicy StatelessRuleGroupReferences.Type (__changed__)
  * Old: StatelessRuleGroupReferences
  * New: List
* AWS::NetworkFirewall::FirewallPolicy.PublishMetricAction Dimensions.DuplicatesAllowed (__added__)
* AWS::NetworkFirewall::FirewallPolicy.PublishMetricAction Dimensions.ItemType (__added__)
* AWS::NetworkFirewall::FirewallPolicy.PublishMetricAction Dimensions.Type (__changed__)
  * Old: Dimensions
  * New: List
* AWS::NetworkFirewall::LoggingConfiguration.LoggingConfiguration LogDestinationConfigs.ItemType (__added__)
* AWS::NetworkFirewall::LoggingConfiguration.LoggingConfiguration LogDestinationConfigs.Type (__changed__)
  * Old: LogDestinationConfigs
  * New: List
* AWS::NetworkFirewall::RuleGroup.IPSet Definition.DuplicatesAllowed (__added__)
* AWS::NetworkFirewall::RuleGroup.IPSet Definition.PrimitiveItemType (__added__)
* AWS::NetworkFirewall::RuleGroup.IPSet Definition.Type (__changed__)
  * Old: VariableDefinitionList
  * New: List
* AWS::NetworkFirewall::RuleGroup.MatchAttributes DestinationPorts.DuplicatesAllowed (__added__)
* AWS::NetworkFirewall::RuleGroup.MatchAttributes DestinationPorts.ItemType (__added__)
* AWS::NetworkFirewall::RuleGroup.MatchAttributes DestinationPorts.Type (__changed__)
  * Old: PortRanges
  * New: List
* AWS::NetworkFirewall::RuleGroup.MatchAttributes Destinations.DuplicatesAllowed (__added__)
* AWS::NetworkFirewall::RuleGroup.MatchAttributes Destinations.ItemType (__added__)
* AWS::NetworkFirewall::RuleGroup.MatchAttributes Destinations.Type (__changed__)
  * Old: Addresses
  * New: List
* AWS::NetworkFirewall::RuleGroup.MatchAttributes Protocols.DuplicatesAllowed (__added__)
* AWS::NetworkFirewall::RuleGroup.MatchAttributes Protocols.PrimitiveItemType (__added__)
* AWS::NetworkFirewall::RuleGroup.MatchAttributes Protocols.Type (__changed__)
  * Old: ProtocolNumbers
  * New: List
* AWS::NetworkFirewall::RuleGroup.MatchAttributes SourcePorts.DuplicatesAllowed (__added__)
* AWS::NetworkFirewall::RuleGroup.MatchAttributes SourcePorts.ItemType (__added__)
* AWS::NetworkFirewall::RuleGroup.MatchAttributes SourcePorts.Type (__changed__)
  * Old: PortRanges
  * New: List
* AWS::NetworkFirewall::RuleGroup.MatchAttributes Sources.DuplicatesAllowed (__added__)
* AWS::NetworkFirewall::RuleGroup.MatchAttributes Sources.ItemType (__added__)
* AWS::NetworkFirewall::RuleGroup.MatchAttributes Sources.Type (__changed__)
  * Old: Addresses
  * New: List
* AWS::NetworkFirewall::RuleGroup.MatchAttributes TCPFlags.DuplicatesAllowed (__added__)
* AWS::NetworkFirewall::RuleGroup.MatchAttributes TCPFlags.ItemType (__added__)
* AWS::NetworkFirewall::RuleGroup.MatchAttributes TCPFlags.Type (__changed__)
  * Old: TCPFlags
  * New: List
* AWS::NetworkFirewall::RuleGroup.PortSet Definition.DuplicatesAllowed (__added__)
* AWS::NetworkFirewall::RuleGroup.PortSet Definition.PrimitiveItemType (__added__)
* AWS::NetworkFirewall::RuleGroup.PortSet Definition.Type (__changed__)
  * Old: VariableDefinitionList
  * New: List
* AWS::NetworkFirewall::RuleGroup.PublishMetricAction Dimensions.DuplicatesAllowed (__added__)
* AWS::NetworkFirewall::RuleGroup.PublishMetricAction Dimensions.ItemType (__added__)
* AWS::NetworkFirewall::RuleGroup.PublishMetricAction Dimensions.Type (__changed__)
  * Old: Dimensions
  * New: List
* AWS::NetworkFirewall::RuleGroup.RulesSource StatefulRules.DuplicatesAllowed (__added__)
* AWS::NetworkFirewall::RuleGroup.RulesSource StatefulRules.ItemType (__added__)
* AWS::NetworkFirewall::RuleGroup.RulesSource StatefulRules.Type (__changed__)
  * Old: StatefulRules
  * New: List
* AWS::NetworkFirewall::RuleGroup.RulesSourceList TargetTypes.DuplicatesAllowed (__added__)
* AWS::NetworkFirewall::RuleGroup.RulesSourceList TargetTypes.PrimitiveItemType (__added__)
* AWS::NetworkFirewall::RuleGroup.RulesSourceList TargetTypes.Type (__changed__)
  * Old: TargetTypes
  * New: List
* AWS::NetworkFirewall::RuleGroup.StatefulRule RuleOptions.DuplicatesAllowed (__added__)
* AWS::NetworkFirewall::RuleGroup.StatefulRule RuleOptions.ItemType (__added__)
* AWS::NetworkFirewall::RuleGroup.StatefulRule RuleOptions.Type (__changed__)
  * Old: RuleOptions
  * New: List
* AWS::NetworkFirewall::RuleGroup.StatelessRulesAndCustomActions CustomActions.DuplicatesAllowed (__added__)
* AWS::NetworkFirewall::RuleGroup.StatelessRulesAndCustomActions CustomActions.ItemType (__added__)
* AWS::NetworkFirewall::RuleGroup.StatelessRulesAndCustomActions CustomActions.Type (__changed__)
  * Old: CustomActions
  * New: List
* AWS::NetworkFirewall::RuleGroup.StatelessRulesAndCustomActions StatelessRules.DuplicatesAllowed (__added__)
* AWS::NetworkFirewall::RuleGroup.StatelessRulesAndCustomActions StatelessRules.ItemType (__added__)
* AWS::NetworkFirewall::RuleGroup.StatelessRulesAndCustomActions StatelessRules.Type (__changed__)
  * Old: StatelessRules
  * New: List
* AWS::NetworkFirewall::RuleGroup.TCPFlagField Flags.DuplicatesAllowed (__added__)
* AWS::NetworkFirewall::RuleGroup.TCPFlagField Flags.PrimitiveItemType (__added__)
* AWS::NetworkFirewall::RuleGroup.TCPFlagField Flags.Type (__changed__)
  * Old: Flags
  * New: List
* AWS::NetworkFirewall::RuleGroup.TCPFlagField Masks.DuplicatesAllowed (__added__)
* AWS::NetworkFirewall::RuleGroup.TCPFlagField Masks.PrimitiveItemType (__added__)
* AWS::NetworkFirewall::RuleGroup.TCPFlagField Masks.Type (__changed__)
  * Old: Flags
  * New: List


# CloudFormation Resource Specification v23.0.0

## New Resource Types

* AWS::Config::StoredQuery
* AWS::DataSync::Agent
* AWS::DataSync::LocationEFS
* AWS::DataSync::LocationFSxWindows
* AWS::DataSync::LocationNFS
* AWS::DataSync::LocationObjectStorage
* AWS::DataSync::LocationS3
* AWS::DataSync::LocationSMB
* AWS::DataSync::Task
* AWS::MediaConnect::Flow
* AWS::MediaConnect::FlowEntitlement
* AWS::MediaConnect::FlowOutput
* AWS::MediaConnect::FlowSource
* AWS::MediaConnect::FlowVpcInterface
* AWS::Route53::DNSSEC
* AWS::Route53::KeySigningKey
* AWS::Route53Resolver::ResolverDNSSECConfig

## Attribute Changes

* AWS::ApiGateway::ClientCertificate ClientCertificateId (__added__)
* AWS::AuditManager::Assessment arn (__deleted__)
* AWS::AuditManager::Assessment assessmentId (__deleted__)
* AWS::AuditManager::Assessment creationTime (__deleted__)
* AWS::AuditManager::Assessment delegations (__deleted__)
* AWS::AuditManager::Assessment frameworkId (__deleted__)
* AWS::AuditManager::Assessment Arn (__added__)
* AWS::AuditManager::Assessment AssessmentId (__added__)
* AWS::AuditManager::Assessment CreationTime (__added__)
* AWS::AuditManager::Assessment Delegations (__added__)
* AWS::AuditManager::Assessment FrameworkId (__added__)
* AWS::EC2::NetworkInsightsAnalysis StatusMessage (__added__)
* AWS::ElastiCache::User Authentication (__deleted__)
* AWS::ElastiCache::User UserGroupIds (__deleted__)
* AWS::ElastiCache::UserGroup PendingChanges (__deleted__)
* AWS::ElastiCache::UserGroup ReplicationGroupIds (__deleted__)
* AWS::ElasticLoadBalancingV2::ListenerRule IsDefault (__added__)
* AWS::ElasticLoadBalancingV2::ListenerRule RuleArn (__added__)
* AWS::SageMaker::Device DeviceFleetName (__deleted__)
* AWS::SageMaker::DeviceFleet DeviceFleetName (__deleted__)

## Property Changes

* AWS::ACMPCA::CertificateAuthority CsrExtensions (__added__)
* AWS::ApiGatewayV2::Integration ResponseParameters (__added__)
* AWS::Athena::DataCatalog Tags.ItemType (__added__)
* AWS::Athena::DataCatalog Tags.Type (__changed__)
  * Old: Tags
  * New: List
* AWS::Athena::WorkGroup Tags.ItemType (__added__)
* AWS::Athena::WorkGroup Tags.Type (__changed__)
  * Old: Tags
  * New: List
* AWS::AuditManager::Assessment assessmentReportsDestination (__deleted__)
* AWS::AuditManager::Assessment awsAccount (__deleted__)
* AWS::AuditManager::Assessment description (__deleted__)
* AWS::AuditManager::Assessment frameworkId (__deleted__)
* AWS::AuditManager::Assessment name (__deleted__)
* AWS::AuditManager::Assessment roles (__deleted__)
* AWS::AuditManager::Assessment scope (__deleted__)
* AWS::AuditManager::Assessment status (__deleted__)
* AWS::AuditManager::Assessment tags (__deleted__)
* AWS::AuditManager::Assessment AssessmentReportsDestination (__added__)
* AWS::AuditManager::Assessment AwsAccount (__added__)
* AWS::AuditManager::Assessment Description (__added__)
* AWS::AuditManager::Assessment FrameworkId (__added__)
* AWS::AuditManager::Assessment Name (__added__)
* AWS::AuditManager::Assessment Roles (__added__)
* AWS::AuditManager::Assessment Scope (__added__)
* AWS::AuditManager::Assessment Status (__added__)
* AWS::AuditManager::Assessment Tags (__added__)
* AWS::EC2::CarrierGateway Tags.DuplicatesAllowed (__added__)
* AWS::EC2::CarrierGateway Tags.ItemType (__added__)
* AWS::EC2::CarrierGateway Tags.Type (__changed__)
  * Old: Tags
  * New: List
* AWS::EC2::LocalGatewayRouteTableVPCAssociation Tags.DuplicatesAllowed (__added__)
* AWS::EC2::LocalGatewayRouteTableVPCAssociation Tags.ItemType (__added__)
* AWS::EC2::LocalGatewayRouteTableVPCAssociation Tags.Type (__changed__)
  * Old: Tags
  * New: List
* AWS::EC2::NetworkInsightsAnalysis StatusMessage (__deleted__)
* AWS::ECR::PublicRepository RepositoryPolicyText.PrimitiveType (__added__)
* AWS::ECR::Repository RepositoryPolicyText.PrimitiveType (__added__)
* AWS::ElastiCache::User Authentication (__added__)
* AWS::ElastiCache::User UserGroupIds (__added__)
* AWS::ElastiCache::User Passwords.DuplicatesAllowed (__added__)
* AWS::ElastiCache::User Passwords.PrimitiveItemType (__added__)
* AWS::ElastiCache::User Passwords.Type (__changed__)
  * Old: PasswordList
  * New: List
* AWS::ElastiCache::UserGroup PendingChanges (__added__)
* AWS::ElastiCache::UserGroup ReplicationGroupIds (__added__)
* AWS::ElastiCache::UserGroup UserIds.DuplicatesAllowed (__added__)
* AWS::ElastiCache::UserGroup UserIds.PrimitiveItemType (__added__)
* AWS::ElastiCache::UserGroup UserIds.Type (__changed__)
  * Old: UserIdList
  * New: List
* AWS::GameLift::GameServerGroup InstanceDefinitions.ItemType (__added__)
* AWS::GameLift::GameServerGroup InstanceDefinitions.Type (__changed__)
  * Old: InstanceDefinitions
  * New: List
* AWS::GameLift::GameServerGroup Tags.ItemType (__added__)
* AWS::GameLift::GameServerGroup Tags.Type (__changed__)
  * Old: Tags
  * New: List
* AWS::GameLift::GameServerGroup VpcSubnets.PrimitiveItemType (__added__)
* AWS::GameLift::GameServerGroup VpcSubnets.Type (__changed__)
  * Old: VpcSubnets
  * New: List
* AWS::IoT::Authorizer Tags.ItemType (__added__)
* AWS::IoT::Authorizer Tags.Type (__changed__)
  * Old: Tags
  * New: List
* AWS::IoT::Authorizer TokenSigningPublicKeys.PrimitiveItemType (__added__)
* AWS::IoT::Authorizer TokenSigningPublicKeys.Type (__changed__)
  * Old: TokenSigningPublicKeys
  * New: Map
* AWS::IoT::DomainConfiguration Tags.ItemType (__added__)
* AWS::IoT::DomainConfiguration Tags.Type (__changed__)
  * Old: Tags
  * New: List
* AWS::IoT::ProvisioningTemplate Tags.ItemType (__added__)
* AWS::IoT::ProvisioningTemplate Tags.Type (__changed__)
  * Old: Tags
  * New: List
* AWS::KMS::Key KeyPolicy.PrimitiveType (__added__)
* AWS::Kendra::DataSource Tags.ItemType (__added__)
* AWS::Kendra::DataSource Tags.Type (__changed__)
  * Old: TagList
  * New: List
* AWS::Kendra::Faq Tags.ItemType (__added__)
* AWS::Kendra::Faq Tags.Type (__changed__)
  * Old: TagList
  * New: List
* AWS::Kendra::Index DocumentMetadataConfigurations.ItemType (__added__)
* AWS::Kendra::Index DocumentMetadataConfigurations.Type (__changed__)
  * Old: DocumentMetadataConfigurationList
  * New: List
* AWS::Kendra::Index Tags.ItemType (__added__)
* AWS::Kendra::Index Tags.Type (__changed__)
  * Old: TagList
  * New: List
* AWS::Kendra::Index UserTokenConfigurations.ItemType (__added__)
* AWS::Kendra::Index UserTokenConfigurations.Type (__changed__)
  * Old: UserTokenConfigurationList
  * New: List
* AWS::LicenseManager::Grant AllowedOperations.DuplicatesAllowed (__added__)
* AWS::LicenseManager::Grant AllowedOperations.PrimitiveItemType (__added__)
* AWS::LicenseManager::Grant AllowedOperations.Type (__changed__)
  * Old: AllowedOperationList
  * New: List
* AWS::LicenseManager::Grant Filters.DuplicatesAllowed (__added__)
* AWS::LicenseManager::Grant Filters.ItemType (__added__)
* AWS::LicenseManager::Grant Filters.Type (__changed__)
  * Old: FilterList
  * New: List
* AWS::LicenseManager::Grant GrantArns.DuplicatesAllowed (__added__)
* AWS::LicenseManager::Grant GrantArns.PrimitiveItemType (__added__)
* AWS::LicenseManager::Grant GrantArns.Type (__changed__)
  * Old: ArnList
  * New: List
* AWS::LicenseManager::Grant GrantedOperations.DuplicatesAllowed (__added__)
* AWS::LicenseManager::Grant GrantedOperations.PrimitiveItemType (__added__)
* AWS::LicenseManager::Grant GrantedOperations.Type (__changed__)
  * Old: AllowedOperationList
  * New: List
* AWS::LicenseManager::Grant Principals.DuplicatesAllowed (__added__)
* AWS::LicenseManager::Grant Principals.PrimitiveItemType (__added__)
* AWS::LicenseManager::Grant Principals.Type (__changed__)
  * Old: ArnList
  * New: List
* AWS::LicenseManager::Grant Tags.DuplicatesAllowed (__added__)
* AWS::LicenseManager::Grant Tags.ItemType (__added__)
* AWS::LicenseManager::Grant Tags.Type (__changed__)
  * Old: TagList
  * New: List
* AWS::LicenseManager::License Entitlements.DuplicatesAllowed (__added__)
* AWS::LicenseManager::License Entitlements.ItemType (__added__)
* AWS::LicenseManager::License Entitlements.Type (__changed__)
  * Old: EntitlementList
  * New: List
* AWS::LicenseManager::License Filters.DuplicatesAllowed (__added__)
* AWS::LicenseManager::License Filters.ItemType (__added__)
* AWS::LicenseManager::License Filters.Type (__changed__)
  * Old: FilterList
  * New: List
* AWS::LicenseManager::License LicenseArns.DuplicatesAllowed (__added__)
* AWS::LicenseManager::License LicenseArns.PrimitiveItemType (__added__)
* AWS::LicenseManager::License LicenseArns.Type (__changed__)
  * Old: ArnList
  * New: List
* AWS::LicenseManager::License LicenseMetadata.DuplicatesAllowed (__added__)
* AWS::LicenseManager::License LicenseMetadata.ItemType (__added__)
* AWS::LicenseManager::License LicenseMetadata.Type (__changed__)
  * Old: MetadataList
  * New: List
* AWS::LicenseManager::License Tags.DuplicatesAllowed (__added__)
* AWS::LicenseManager::License Tags.ItemType (__added__)
* AWS::LicenseManager::License Tags.Type (__changed__)
  * Old: TagList
  * New: List
* AWS::MediaLive::Channel CdiInputSpecification (__added__)
* AWS::SSO::InstanceAccessControlAttributeConfiguration AccessControlAttributes (__added__)
* AWS::SSO::InstanceAccessControlAttributeConfiguration InstanceAccessControlAttributeConfiguration.Required (__changed__)
  * Old: true
  * New: false
* AWS::SSO::InstanceAccessControlAttributeConfiguration InstanceArn.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::SSO::PermissionSet InlinePolicy.PrimitiveType (__changed__)
  * Old: String
  * New: Json
* AWS::SageMaker::Device DeviceFleetName (__added__)
* AWS::SageMaker::DeviceFleet DeviceFleetName (__added__)
* AWS::SageMaker::ModelPackageGroup ModelPackageGroupPolicy.PrimitiveType (__added__)
* AWS::StepFunctions::StateMachine DefinitionSubstitutions.PrimitiveItemType (__added__)
* AWS::StepFunctions::StateMachine DefinitionSubstitutions.Type (__changed__)
  * Old: DefinitionSubstitutions
  * New: Map
* AWS::Transfer::Server Domain (__added__)
* AWS::Transfer::User PosixProfile (__added__)

## Property Type Changes

* AWS::Athena::DataCatalog.Tags (__removed__)
* AWS::Athena::WorkGroup.Tags (__removed__)
* AWS::AuditManager::Assessment.AWSAccounts (__removed__)
* AWS::AuditManager::Assessment.AWSServices (__removed__)
* AWS::AuditManager::Assessment.Delegations (__removed__)
* AWS::AuditManager::Assessment.Roles (__removed__)
* AWS::AuditManager::Assessment.Tags (__removed__)
* AWS::EC2::CarrierGateway.Tags (__removed__)
* AWS::EC2::LocalGatewayRouteTableVPCAssociation.Tags (__removed__)
* AWS::ElastiCache::User.PasswordList (__removed__)
* AWS::ElastiCache::User.UserGroupIdList (__removed__)
* AWS::ElastiCache::UserGroup.ReplicationGroupIdList (__removed__)
* AWS::ElastiCache::UserGroup.UserIdList (__removed__)
* AWS::GameLift::GameServerGroup.InstanceDefinitions (__removed__)
* AWS::GameLift::GameServerGroup.Tags (__removed__)
* AWS::GameLift::GameServerGroup.VpcSubnets (__removed__)
* AWS::IoT::Authorizer.Tags (__removed__)
* AWS::IoT::Authorizer.TokenSigningPublicKeys (__removed__)
* AWS::IoT::DomainConfiguration.Tags (__removed__)
* AWS::IoT::ProvisioningTemplate.Tags (__removed__)
* AWS::Kendra::DataSource.TagList (__removed__)
* AWS::Kendra::Faq.TagList (__removed__)
* AWS::Kendra::Index.DocumentMetadataConfigurationList (__removed__)
* AWS::Kendra::Index.TagList (__removed__)
* AWS::Kendra::Index.UserTokenConfigurationList (__removed__)
* AWS::LicenseManager::Grant.AllowedOperationList (__removed__)
* AWS::LicenseManager::Grant.ArnList (__removed__)
* AWS::LicenseManager::Grant.FilterList (__removed__)
* AWS::LicenseManager::Grant.TagList (__removed__)
* AWS::LicenseManager::License.ArnList (__removed__)
* AWS::LicenseManager::License.EntitlementList (__removed__)
* AWS::LicenseManager::License.FilterList (__removed__)
* AWS::LicenseManager::License.MetadataList (__removed__)
* AWS::LicenseManager::License.TagList (__removed__)
* AWS::StepFunctions::StateMachine.DefinitionSubstitutions (__removed__)
* AWS::ACMPCA::CertificateAuthority.AccessDescription (__added__)
* AWS::ACMPCA::CertificateAuthority.AccessMethod (__added__)
* AWS::ACMPCA::CertificateAuthority.CsrExtensions (__added__)
* AWS::ACMPCA::CertificateAuthority.EdiPartyName (__added__)
* AWS::ACMPCA::CertificateAuthority.GeneralName (__added__)
* AWS::ACMPCA::CertificateAuthority.KeyUsage (__added__)
* AWS::ACMPCA::CertificateAuthority.OtherName (__added__)
* AWS::ACMPCA::CertificateAuthority.SubjectInformationAccess (__added__)
* AWS::ApiGatewayV2::Integration.ResponseParameter (__added__)
* AWS::ApiGatewayV2::Integration.ResponseParameterList (__added__)
* AWS::MediaLive::Channel.AncillarySourceSettings (__added__)
* AWS::MediaLive::Channel.AudioSilenceFailoverSettings (__added__)
* AWS::MediaLive::Channel.CdiInputSpecification (__added__)
* AWS::MediaLive::Channel.FailoverCondition (__added__)
* AWS::MediaLive::Channel.FailoverConditionSettings (__added__)
* AWS::MediaLive::Channel.InputLossFailoverSettings (__added__)
* AWS::MediaLive::Channel.Mpeg2FilterSettings (__added__)
* AWS::MediaLive::Channel.Mpeg2Settings (__added__)
* AWS::MediaLive::Channel.RawSettings (__added__)
* AWS::MediaLive::Channel.VideoBlackFailoverSettings (__added__)
* AWS::MediaLive::Channel.WavSettings (__added__)
* AWS::SSO::InstanceAccessControlAttributeConfiguration.AccessControlAttribute (__added__)
* AWS::SSO::InstanceAccessControlAttributeConfiguration.AccessControlAttributeValue (__added__)
* AWS::SSO::InstanceAccessControlAttributeConfiguration.AccessControlAttributeValueSourceList (__added__)
* AWS::Transfer::User.PosixProfile (__added__)
* AWS::AuditManager::Assessment.AWSAccount emailAddress (__deleted__)
* AWS::AuditManager::Assessment.AWSAccount id (__deleted__)
* AWS::AuditManager::Assessment.AWSAccount name (__deleted__)
* AWS::AuditManager::Assessment.AWSAccount EmailAddress (__added__)
* AWS::AuditManager::Assessment.AWSAccount Id (__added__)
* AWS::AuditManager::Assessment.AWSAccount Name (__added__)
* AWS::AuditManager::Assessment.AWSService serviceName (__deleted__)
* AWS::AuditManager::Assessment.AWSService ServiceName (__added__)
* AWS::AuditManager::Assessment.AssessmentReportsDestination destination (__deleted__)
* AWS::AuditManager::Assessment.AssessmentReportsDestination destinationType (__deleted__)
* AWS::AuditManager::Assessment.AssessmentReportsDestination Destination (__added__)
* AWS::AuditManager::Assessment.AssessmentReportsDestination DestinationType (__added__)
* AWS::AuditManager::Assessment.Delegation assessmentId (__deleted__)
* AWS::AuditManager::Assessment.Delegation assessmentName (__deleted__)
* AWS::AuditManager::Assessment.Delegation comment (__deleted__)
* AWS::AuditManager::Assessment.Delegation controlSetId (__deleted__)
* AWS::AuditManager::Assessment.Delegation createdBy (__deleted__)
* AWS::AuditManager::Assessment.Delegation creationTime (__deleted__)
* AWS::AuditManager::Assessment.Delegation id (__deleted__)
* AWS::AuditManager::Assessment.Delegation lastUpdated (__deleted__)
* AWS::AuditManager::Assessment.Delegation roleArn (__deleted__)
* AWS::AuditManager::Assessment.Delegation roleType (__deleted__)
* AWS::AuditManager::Assessment.Delegation status (__deleted__)
* AWS::AuditManager::Assessment.Delegation AssessmentId (__added__)
* AWS::AuditManager::Assessment.Delegation AssessmentName (__added__)
* AWS::AuditManager::Assessment.Delegation Comment (__added__)
* AWS::AuditManager::Assessment.Delegation ControlSetId (__added__)
* AWS::AuditManager::Assessment.Delegation CreatedBy (__added__)
* AWS::AuditManager::Assessment.Delegation CreationTime (__added__)
* AWS::AuditManager::Assessment.Delegation Id (__added__)
* AWS::AuditManager::Assessment.Delegation LastUpdated (__added__)
* AWS::AuditManager::Assessment.Delegation RoleArn (__added__)
* AWS::AuditManager::Assessment.Delegation RoleType (__added__)
* AWS::AuditManager::Assessment.Delegation Status (__added__)
* AWS::AuditManager::Assessment.Role roleArn (__deleted__)
* AWS::AuditManager::Assessment.Role roleType (__deleted__)
* AWS::AuditManager::Assessment.Role RoleArn (__added__)
* AWS::AuditManager::Assessment.Role RoleType (__added__)
* AWS::AuditManager::Assessment.Scope awsAccounts (__deleted__)
* AWS::AuditManager::Assessment.Scope awsServices (__deleted__)
* AWS::AuditManager::Assessment.Scope AwsAccounts (__added__)
* AWS::AuditManager::Assessment.Scope AwsServices (__added__)
* AWS::EC2::LaunchTemplate.Ebs Throughput (__added__)
* AWS::ElasticLoadBalancingV2::ListenerRule.Action AuthenticateCognitoConfig.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-actions.html#cfn-elasticloadbalancingv2-listenerrule-action-authenticatecognitoconfig
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-action.html#cfn-elasticloadbalancingv2-listenerrule-action-authenticatecognitoconfig
* AWS::ElasticLoadBalancingV2::ListenerRule.Action AuthenticateOidcConfig.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-actions.html#cfn-elasticloadbalancingv2-listenerrule-action-authenticateoidcconfig
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-action.html#cfn-elasticloadbalancingv2-listenerrule-action-authenticateoidcconfig
* AWS::ElasticLoadBalancingV2::ListenerRule.Action FixedResponseConfig.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-actions.html#cfn-elasticloadbalancingv2-listenerrule-action-fixedresponseconfig
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-action.html#cfn-elasticloadbalancingv2-listenerrule-action-fixedresponseconfig
* AWS::ElasticLoadBalancingV2::ListenerRule.Action ForwardConfig.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-actions.html#cfn-elasticloadbalancingv2-listenerrule-action-forwardconfig
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-action.html#cfn-elasticloadbalancingv2-listenerrule-action-forwardconfig
* AWS::ElasticLoadBalancingV2::ListenerRule.Action Order.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-actions.html#cfn-elasticloadbalancingv2-listenerrule-action-order
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-action.html#cfn-elasticloadbalancingv2-listenerrule-action-order
* AWS::ElasticLoadBalancingV2::ListenerRule.Action RedirectConfig.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-actions.html#cfn-elasticloadbalancingv2-listenerrule-action-redirectconfig
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-action.html#cfn-elasticloadbalancingv2-listenerrule-action-redirectconfig
* AWS::ElasticLoadBalancingV2::ListenerRule.Action TargetGroupArn.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-actions.html#cfn-elasticloadbalancingv2-listener-actions-targetgrouparn
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-action.html#cfn-elasticloadbalancingv2-listenerrule-action-targetgrouparn
* AWS::ElasticLoadBalancingV2::ListenerRule.Action Type.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-actions.html#cfn-elasticloadbalancingv2-listener-actions-type
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-action.html#cfn-elasticloadbalancingv2-listenerrule-action-type
* AWS::ElasticLoadBalancingV2::ListenerRule.AuthenticateCognitoConfig AuthenticationRequestExtraParams.DuplicatesAllowed (__deleted__)
* AWS::ElasticLoadBalancingV2::ListenerRule.AuthenticateCognitoConfig SessionTimeout.PrimitiveType (__changed__)
  * Old: Long
  * New: Integer
* AWS::ElasticLoadBalancingV2::ListenerRule.AuthenticateOidcConfig UseExistingClientSecret (__added__)
* AWS::ElasticLoadBalancingV2::ListenerRule.AuthenticateOidcConfig AuthenticationRequestExtraParams.DuplicatesAllowed (__deleted__)
* AWS::ElasticLoadBalancingV2::ListenerRule.AuthenticateOidcConfig SessionTimeout.PrimitiveType (__changed__)
  * Old: Long
  * New: Integer
* AWS::ElasticLoadBalancingV2::ListenerRule.RuleCondition Field.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-conditions.html#cfn-elasticloadbalancingv2-listenerrule-conditions-field
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-rulecondition.html#cfn-elasticloadbalancingv2-listenerrule-rulecondition-field
* AWS::ElasticLoadBalancingV2::ListenerRule.RuleCondition HostHeaderConfig.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-conditions.html#cfn-elasticloadbalancingv2-listenerrule-rulecondition-hostheaderconfig
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-rulecondition.html#cfn-elasticloadbalancingv2-listenerrule-rulecondition-hostheaderconfig
* AWS::ElasticLoadBalancingV2::ListenerRule.RuleCondition HttpHeaderConfig.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-conditions.html#cfn-elasticloadbalancingv2-listenerrule-rulecondition-httpheaderconfig
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-rulecondition.html#cfn-elasticloadbalancingv2-listenerrule-rulecondition-httpheaderconfig
* AWS::ElasticLoadBalancingV2::ListenerRule.RuleCondition HttpRequestMethodConfig.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-conditions.html#cfn-elasticloadbalancingv2-listenerrule-rulecondition-httprequestmethodconfig
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-rulecondition.html#cfn-elasticloadbalancingv2-listenerrule-rulecondition-httprequestmethodconfig
* AWS::ElasticLoadBalancingV2::ListenerRule.RuleCondition PathPatternConfig.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-conditions.html#cfn-elasticloadbalancingv2-listenerrule-rulecondition-pathpatternconfig
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-rulecondition.html#cfn-elasticloadbalancingv2-listenerrule-rulecondition-pathpatternconfig
* AWS::ElasticLoadBalancingV2::ListenerRule.RuleCondition QueryStringConfig.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-conditions.html#cfn-elasticloadbalancingv2-listenerrule-rulecondition-querystringconfig
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-rulecondition.html#cfn-elasticloadbalancingv2-listenerrule-rulecondition-querystringconfig
* AWS::ElasticLoadBalancingV2::ListenerRule.RuleCondition SourceIpConfig.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-conditions.html#cfn-elasticloadbalancingv2-listenerrule-rulecondition-sourceipconfig
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-rulecondition.html#cfn-elasticloadbalancingv2-listenerrule-rulecondition-sourceipconfig
* AWS::ElasticLoadBalancingV2::ListenerRule.RuleCondition Values.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-conditions.html#cfn-elasticloadbalancingv2-listenerrule-conditions-values
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listenerrule-rulecondition.html#cfn-elasticloadbalancingv2-listenerrule-rulecondition-values
* AWS::ImageBuilder::DistributionConfiguration.Distribution ContainerDistributionConfiguration (__added__)
* AWS::IoTWireless::WirelessDevice.AbpV10X DevAddr.Required (__changed__)
  * Old: false
  * New: true
* AWS::IoTWireless::WirelessDevice.AbpV10X SessionKeys.Required (__changed__)
  * Old: false
  * New: true
* AWS::IoTWireless::WirelessDevice.AbpV11 DevAddr.Required (__changed__)
  * Old: false
  * New: true
* AWS::IoTWireless::WirelessDevice.AbpV11 SessionKeys.Required (__changed__)
  * Old: false
  * New: true
* AWS::IoTWireless::WirelessDevice.OtaaV10X AppEui.Required (__changed__)
  * Old: false
  * New: true
* AWS::IoTWireless::WirelessDevice.OtaaV10X AppKey.Required (__changed__)
  * Old: false
  * New: true
* AWS::IoTWireless::WirelessDevice.OtaaV11 AppKey.Required (__changed__)
  * Old: false
  * New: true
* AWS::IoTWireless::WirelessDevice.OtaaV11 JoinEui.Required (__changed__)
  * Old: false
  * New: true
* AWS::IoTWireless::WirelessDevice.OtaaV11 NwkKey.Required (__changed__)
  * Old: false
  * New: true
* AWS::IoTWireless::WirelessDevice.SessionKeysAbpV10X AppSKey.Required (__changed__)
  * Old: false
  * New: true
* AWS::IoTWireless::WirelessDevice.SessionKeysAbpV10X NwkSKey.Required (__changed__)
  * Old: false
  * New: true
* AWS::IoTWireless::WirelessDevice.SessionKeysAbpV11 AppSKey.Required (__changed__)
  * Old: false
  * New: true
* AWS::IoTWireless::WirelessDevice.SessionKeysAbpV11 FNwkSIntKey.Required (__changed__)
  * Old: false
  * New: true
* AWS::IoTWireless::WirelessDevice.SessionKeysAbpV11 NwkSEncKey.Required (__changed__)
  * Old: false
  * New: true
* AWS::IoTWireless::WirelessDevice.SessionKeysAbpV11 SNwkSIntKey.Required (__changed__)
  * Old: false
  * New: true
* AWS::IoTWireless::WirelessGateway.LoRaWANGateway GatewayEui.Required (__changed__)
  * Old: false
  * New: true
* AWS::IoTWireless::WirelessGateway.LoRaWANGateway RfRegion.Required (__changed__)
  * Old: false
  * New: true
* AWS::MediaLive::Channel.ArchiveContainerSettings RawSettings (__added__)
* AWS::MediaLive::Channel.AudioCodecSettings WavSettings (__added__)
* AWS::MediaLive::Channel.AutomaticInputFailoverSettings ErrorClearTimeMsec (__added__)
* AWS::MediaLive::Channel.AutomaticInputFailoverSettings FailoverConditions (__added__)
* AWS::MediaLive::Channel.CaptionSelectorSettings AncillarySourceSettings (__added__)
* AWS::MediaLive::Channel.HlsGroupSettings DiscontinuityTags (__added__)
* AWS::MediaLive::Channel.HlsGroupSettings IncompleteSegmentBehavior (__added__)
* AWS::MediaLive::Channel.RtmpGroupSettings AdMarkers (__added__)
* AWS::MediaLive::Channel.VideoCodecSettings Mpeg2Settings (__added__)

# Serverless Application Model (SAM) Resource Specification v2016-10-31

## New Resource Types


## Attribute Changes


## Property Changes

* AWS::Serverless::LayerVersion ContentUri.PrimitiveType (__deleted__)
* AWS::Serverless::LayerVersion ContentUri.PrimitiveTypes (__added__)
* AWS::Serverless::LayerVersion ContentUri.Types (__added__)

## Property Type Changes

* AWS::Serverless::LayerVersion.S3Location (__added__)

# CloudFormation Resource Specification v22.0.0

## New Resource Types

* AWS::AuditManager::Assessment
* AWS::CloudFormation::ModuleDefaultVersion
* AWS::CloudFormation::ModuleVersion
* AWS::DevOpsGuru::NotificationChannel
* AWS::DevOpsGuru::ResourceCollection
* AWS::EC2::NetworkInsightsAnalysis
* AWS::EC2::NetworkInsightsPath
* AWS::ECR::PublicRepository
* AWS::ElastiCache::User
* AWS::ElastiCache::UserGroup
* AWS::GreengrassV2::ComponentVersion
* AWS::IoTSiteWise::AccessPolicy
* AWS::IoTSiteWise::Dashboard
* AWS::IoTSiteWise::Portal
* AWS::IoTSiteWise::Project
* AWS::IoTWireless::Destination
* AWS::IoTWireless::DeviceProfile
* AWS::IoTWireless::ServiceProfile
* AWS::IoTWireless::WirelessDevice
* AWS::IoTWireless::WirelessGateway
* AWS::LicenseManager::Grant
* AWS::LicenseManager::License
* AWS::MWAA::Environment
* AWS::SSO::InstanceAccessControlAttributeConfiguration
* AWS::SageMaker::DataQualityJobDefinition
* AWS::SageMaker::Device
* AWS::SageMaker::DeviceFleet
* AWS::SageMaker::ModelBiasJobDefinition
* AWS::SageMaker::ModelExplainabilityJobDefinition
* AWS::SageMaker::ModelPackageGroup
* AWS::SageMaker::ModelQualityJobDefinition
* AWS::SageMaker::Pipeline
* AWS::SageMaker::Project

## Attribute Changes

* AWS::NetworkFirewall::LoggingConfiguration FirewallArn (__deleted__)
* AWS::NetworkFirewall::LoggingConfiguration FirewallName (__deleted__)
* AWS::NetworkFirewall::RuleGroup RuleGroupId (__added__)
* AWS::SageMaker::MonitoringSchedule MonitoringScheduleArn (__added__)

## Property Changes

* AWS::AutoScaling::LaunchConfiguration MetadataOptions.Type (__changed__)
  * Old: MetadataOption
  * New: MetadataOptions
* AWS::Batch::JobDefinition PlatformCapabilities (__added__)
* AWS::Batch::JobDefinition PropagateTags (__added__)
* AWS::CloudFormation::StackSet PermissionModel.Required (__changed__)
  * Old: false
  * New: true
* AWS::CloudFormation::StackSet StackSetName.Required (__changed__)
  * Old: false
  * New: true
* AWS::CodeArtifact::Domain EncryptionKey (__added__)
* AWS::CodeArtifact::Repository DomainName (__added__)
* AWS::CodeArtifact::Repository DomainOwner (__added__)
* AWS::CodeGuruReviewer::RepositoryAssociation Tags (__added__)
* AWS::DLM::LifecyclePolicy Tags (__added__)
* AWS::EC2::Instance EnclaveOptions (__added__)
* AWS::EC2::Volume Throughput (__added__)
* AWS::EKS::Nodegroup CapacityType (__added__)
* AWS::ElastiCache::ReplicationGroup UserGroupIds (__added__)
* AWS::Events::Archive ArchiveName (__added__)
* AWS::IoT::TopicRuleDestination VpcProperties (__added__)
* AWS::Kendra::Index UserContextPolicy (__added__)
* AWS::Kendra::Index UserTokenConfigurations (__added__)
* AWS::Lambda::EventSourceMapping FunctionResponseTypes (__added__)
* AWS::Lambda::EventSourceMapping SelfManagedEventSource (__added__)
* AWS::Lambda::EventSourceMapping EventSourceArn.Required (__changed__)
  * Old: true
  * New: false
* AWS::Lambda::Function ImageConfig (__added__)
* AWS::Lambda::Function PackageType (__added__)
* AWS::Lambda::Function Handler.Required (__changed__)
  * Old: true
  * New: false
* AWS::Lambda::Function Runtime.Required (__changed__)
  * Old: true
  * New: false
* AWS::NetworkFirewall::Firewall Tags.DuplicatesAllowed (__added__)
* AWS::NetworkFirewall::Firewall Tags.ItemType (__added__)
* AWS::NetworkFirewall::Firewall Tags.Type (__changed__)
  * Old: Tags
  * New: List
* AWS::NetworkFirewall::FirewallPolicy Tags.DuplicatesAllowed (__added__)
* AWS::NetworkFirewall::FirewallPolicy Tags.ItemType (__added__)
* AWS::NetworkFirewall::FirewallPolicy Tags.Type (__changed__)
  * Old: Tags
  * New: List
* AWS::NetworkFirewall::LoggingConfiguration FirewallArn (__added__)
* AWS::NetworkFirewall::LoggingConfiguration FirewallName (__added__)
* AWS::NetworkFirewall::RuleGroup RuleGroupId (__deleted__)
* AWS::NetworkFirewall::RuleGroup Tags.DuplicatesAllowed (__added__)
* AWS::NetworkFirewall::RuleGroup Tags.ItemType (__added__)
* AWS::NetworkFirewall::RuleGroup Tags.Type (__changed__)
  * Old: Tags
  * New: List
* AWS::SageMaker::Endpoint DeploymentConfig (__added__)
* AWS::SageMaker::MonitoringSchedule MonitoringScheduleArn (__deleted__)
* AWS::SageMaker::MonitoringSchedule MonitoringScheduleName.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable

## Property Type Changes

* AWS::AutoScaling::LaunchConfiguration.MetadataOption (__removed__)
* AWS::Glue::Database.DataLakePrincipal (__removed__)
* AWS::Glue::Database.PrincipalPrivileges (__removed__)
* AWS::NetworkFirewall::Firewall.Tags (__removed__)
* AWS::NetworkFirewall::FirewallPolicy.Tags (__removed__)
* AWS::NetworkFirewall::RuleGroup.Tags (__removed__)
* AWS::Transfer::Server.SecurityGroupId (__removed__)
* AWS::AppFlow::Flow.IncrementalPullConfig (__added__)
* AWS::AppFlow::Flow.UpsolverDestinationProperties (__added__)
* AWS::AppFlow::Flow.UpsolverS3OutputFormatConfig (__added__)
* AWS::ApplicationInsights::Application.JMXPrometheusExporter (__added__)
* AWS::AutoScaling::LaunchConfiguration.MetadataOptions (__added__)
* AWS::Batch::JobDefinition.FargatePlatformConfiguration (__added__)
* AWS::Batch::JobDefinition.NetworkConfiguration (__added__)
* AWS::Cognito::UserPool.CustomEmailSender (__added__)
* AWS::Cognito::UserPool.CustomSMSSender (__added__)
* AWS::EC2::Instance.EnclaveOptions (__added__)
* AWS::EC2::SpotFleet.SpotCapacityRebalance (__added__)
* AWS::EC2::SpotFleet.SpotMaintenanceStrategies (__added__)
* AWS::ECS::Service.DeploymentCircuitBreaker (__added__)
* AWS::Glue::Partition.SchemaId (__added__)
* AWS::Glue::Partition.SchemaReference (__added__)
* AWS::Glue::Table.SchemaId (__added__)
* AWS::Glue::Table.SchemaReference (__added__)
* AWS::IoT::TopicRuleDestination.VpcDestinationProperties (__added__)
* AWS::Kendra::DataSource.ConfluenceAttachmentConfiguration (__added__)
* AWS::Kendra::DataSource.ConfluenceAttachmentFieldMappingsList (__added__)
* AWS::Kendra::DataSource.ConfluenceAttachmentToIndexFieldMapping (__added__)
* AWS::Kendra::DataSource.ConfluenceBlogConfiguration (__added__)
* AWS::Kendra::DataSource.ConfluenceBlogFieldMappingsList (__added__)
* AWS::Kendra::DataSource.ConfluenceBlogToIndexFieldMapping (__added__)
* AWS::Kendra::DataSource.ConfluenceConfiguration (__added__)
* AWS::Kendra::DataSource.ConfluencePageConfiguration (__added__)
* AWS::Kendra::DataSource.ConfluencePageFieldMappingsList (__added__)
* AWS::Kendra::DataSource.ConfluencePageToIndexFieldMapping (__added__)
* AWS::Kendra::DataSource.ConfluenceSpaceConfiguration (__added__)
* AWS::Kendra::DataSource.ConfluenceSpaceFieldMappingsList (__added__)
* AWS::Kendra::DataSource.ConfluenceSpaceList (__added__)
* AWS::Kendra::DataSource.ConfluenceSpaceToIndexFieldMapping (__added__)
* AWS::Kendra::Index.JsonTokenTypeConfiguration (__added__)
* AWS::Kendra::Index.JwtTokenTypeConfiguration (__added__)
* AWS::Kendra::Index.UserTokenConfiguration (__added__)
* AWS::Kendra::Index.UserTokenConfigurationList (__added__)
* AWS::Lambda::EventSourceMapping.Endpoints (__added__)
* AWS::Lambda::EventSourceMapping.SelfManagedEventSource (__added__)
* AWS::Lambda::Function.ImageConfig (__added__)
* AWS::S3::Bucket.ReplicaModifications (__added__)
* AWS::SageMaker::Endpoint.Alarm (__added__)
* AWS::SageMaker::Endpoint.AutoRollbackConfig (__added__)
* AWS::SageMaker::Endpoint.BlueGreenUpdatePolicy (__added__)
* AWS::SageMaker::Endpoint.CapacitySize (__added__)
* AWS::SageMaker::Endpoint.DeploymentConfig (__added__)
* AWS::SageMaker::Endpoint.TrafficRoutingConfig (__added__)
* AWS::AppFlow::Flow.DestinationConnectorProperties Upsolver (__added__)
* AWS::AppFlow::Flow.SourceFlowConfig IncrementalPullConfig (__added__)
* AWS::ApplicationInsights::Application.ConfigurationDetails JMXPrometheusExporter (__added__)
* AWS::Batch::ComputeEnvironment.ComputeResources InstanceRole.Required (__changed__)
  * Old: true
  * New: false
* AWS::Batch::ComputeEnvironment.ComputeResources InstanceTypes.Required (__changed__)
  * Old: true
  * New: false
* AWS::Batch::ComputeEnvironment.ComputeResources MinvCpus.Required (__changed__)
  * Old: true
  * New: false
* AWS::Batch::ComputeEnvironment.ComputeResources SecurityGroupIds.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::Batch::ComputeEnvironment.ComputeResources Subnets.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::Batch::JobDefinition.ContainerProperties FargatePlatformConfiguration (__added__)
* AWS::Batch::JobDefinition.ContainerProperties NetworkConfiguration (__added__)
* AWS::Cognito::UserPool.LambdaConfig CustomEmailSender (__added__)
* AWS::Cognito::UserPool.LambdaConfig CustomSMSSender (__added__)
* AWS::Cognito::UserPool.LambdaConfig KMSKeyID (__added__)
* AWS::EC2::SpotFleet.LaunchTemplateOverrides Priority (__added__)
* AWS::EC2::SpotFleet.SpotFleetRequestConfigData InstancePoolsToUseCount (__added__)
* AWS::EC2::SpotFleet.SpotFleetRequestConfigData OnDemandAllocationStrategy (__added__)
* AWS::EC2::SpotFleet.SpotFleetRequestConfigData OnDemandMaxTotalPrice (__added__)
* AWS::EC2::SpotFleet.SpotFleetRequestConfigData OnDemandTargetCapacity (__added__)
* AWS::EC2::SpotFleet.SpotFleetRequestConfigData SpotMaintenanceStrategies (__added__)
* AWS::EC2::SpotFleet.SpotFleetRequestConfigData SpotMaxTotalPrice (__added__)
* AWS::ECS::Service.DeploymentConfiguration DeploymentCircuitBreaker (__added__)
* AWS::Elasticsearch::Domain.DomainEndpointOptions CustomEndpoint (__added__)
* AWS::Elasticsearch::Domain.DomainEndpointOptions CustomEndpointCertificateArn (__added__)
* AWS::Elasticsearch::Domain.DomainEndpointOptions CustomEndpointEnabled (__added__)
* AWS::Glue::Database.DatabaseInput CreateTableDefaultPermissions (__deleted__)
* AWS::Glue::Partition.StorageDescriptor SchemaReference (__added__)
* AWS::Glue::Table.StorageDescriptor SchemaReference (__added__)
* AWS::Kendra::DataSource.DataSourceConfiguration ConfluenceConfiguration (__added__)
* AWS::Kendra::DataSource.OneDriveConfiguration DisableLocalGroups (__added__)
* AWS::Kendra::DataSource.SharePointConfiguration DisableLocalGroups (__added__)
* AWS::Lambda::Function.Code ImageUri (__added__)
* AWS::S3::Bucket.ServerSideEncryptionRule BucketKeyEnabled (__added__)
* AWS::S3::Bucket.SourceSelectionCriteria ReplicaModifications (__added__)
* AWS::SageMaker::MonitoringSchedule.MonitoringScheduleConfig MonitoringJobDefinitionName (__added__)
* AWS::SageMaker::MonitoringSchedule.MonitoringScheduleConfig MonitoringType (__added__)
* AWS::SageMaker::MonitoringSchedule.MonitoringScheduleConfig MonitoringJobDefinition.Required (__changed__)
  * Old: true
  * New: false
* AWS::Transfer::Server.EndpointDetails SecurityGroupIds.ItemType (__deleted__)
* AWS::Transfer::Server.EndpointDetails SecurityGroupIds.PrimitiveItemType (__added__)

# Serverless Application Model (SAM) Resource Specification v2016-10-31

## New Resource Types


## Attribute Changes


## Property Changes

* AWS::Serverless::Function ProvisionedConcurrencyConfig (__added__)

## Property Type Changes

* AWS::Serverless::Function.ProvisionedConcurrencyConfig (__added__)

# CloudFormation Resource Specification v21.0.0

## New Resource Types

* AWS::CloudFront::KeyGroup
* AWS::CloudFront::PublicKey
* AWS::Glue::Registry
* AWS::Glue::Schema
* AWS::Glue::SchemaVersion
* AWS::Glue::SchemaVersionMetadata
* AWS::IoT::TopicRuleDestination
* AWS::Lambda::CodeSigningConfig
* AWS::NetworkFirewall::Firewall
* AWS::NetworkFirewall::FirewallPolicy
* AWS::NetworkFirewall::LoggingConfiguration
* AWS::NetworkFirewall::RuleGroup
* AWS::S3::StorageLens
* AWS::Signer::ProfilePermission
* AWS::Signer::SigningProfile

## Attribute Changes

* AWS::SageMaker::MonitoringSchedule CreationTime (__added__)
* AWS::SageMaker::MonitoringSchedule LastModifiedTime (__added__)

## Property Changes

* AWS::Amplify::App CustomHeaders (__added__)
* AWS::DataBrew::Recipe ProjectName (__deleted__)
* AWS::DataBrew::Recipe Version (__deleted__)
* AWS::Events::EventBusPolicy Statement (__added__)
* AWS::Events::EventBusPolicy Action.Required (__changed__)
  * Old: true
  * New: false
* AWS::Events::EventBusPolicy Principal.Required (__changed__)
  * Old: true
  * New: false
* AWS::Glue::MLTransform TransformEncryption (__added__)
* AWS::KMS::Key KeySpec (__added__)
* AWS::Lambda::Function CodeSigningConfigArn (__added__)
* AWS::SageMaker::MonitoringSchedule CreationTime (__deleted__)
* AWS::SageMaker::MonitoringSchedule LastModifiedTime (__deleted__)

## Property Type Changes

* AWS::Batch::ComputeEnvironment.Ec2ConfigurationObject (__added__)
* AWS::DLM::LifecyclePolicy.Action (__added__)
* AWS::DLM::LifecyclePolicy.CrossRegionCopyAction (__added__)
* AWS::DLM::LifecyclePolicy.EncryptionConfiguration (__added__)
* AWS::DLM::LifecyclePolicy.EventParameters (__added__)
* AWS::DLM::LifecyclePolicy.EventSource (__added__)
* AWS::DLM::LifecyclePolicy.ShareRule (__added__)
* AWS::EC2::LaunchTemplate.EnclaveOptions (__added__)
* AWS::Glue::Database.DataLakePrincipal (__added__)
* AWS::Glue::Database.DatabaseIdentifier (__added__)
* AWS::Glue::Database.PrincipalPrivileges (__added__)
* AWS::Glue::MLTransform.MLUserDataEncryption (__added__)
* AWS::Glue::MLTransform.TransformEncryption (__added__)
* AWS::Glue::Table.TableIdentifier (__added__)
* AWS::SageMaker::Model.MultiModelConfig (__added__)
* AWS::Batch::ComputeEnvironment.ComputeResources Ec2Configuration (__added__)
* AWS::CloudFront::Distribution.CacheBehavior TrustedKeyGroups (__added__)
* AWS::CloudFront::Distribution.DefaultCacheBehavior TrustedKeyGroups (__added__)
* AWS::DLM::LifecyclePolicy.PolicyDetails Actions (__added__)
* AWS::DLM::LifecyclePolicy.PolicyDetails EventSource (__added__)
* AWS::DLM::LifecyclePolicy.PolicyDetails ResourceTypes.Required (__changed__)
  * Old: true
  * New: false
* AWS::DLM::LifecyclePolicy.PolicyDetails Schedules.Required (__changed__)
  * Old: true
  * New: false
* AWS::DLM::LifecyclePolicy.PolicyDetails TargetTags.Required (__changed__)
  * Old: true
  * New: false
* AWS::DLM::LifecyclePolicy.Schedule ShareRules (__added__)
* AWS::DataBrew::Recipe.RecipeStep Action.PrimitiveType (__deleted__)
* AWS::EC2::LaunchTemplate.LaunchTemplateData EnclaveOptions (__added__)
* AWS::Glue::Connection.ConnectionInput ConnectionProperties.Required (__changed__)
  * Old: true
  * New: false
* AWS::Glue::Crawler.S3Target ConnectionName (__added__)
* AWS::Glue::Database.DatabaseInput CreateTableDefaultPermissions (__added__)
* AWS::Glue::Database.DatabaseInput TargetDatabase (__added__)
* AWS::Glue::Table.TableInput TargetTable (__added__)
* AWS::SageMaker::Model.ContainerDefinition MultiModelConfig (__added__)
* AWS::Synthetics::Canary.RunConfig EnvironmentVariables (__added__)


# CloudFormation Resource Specification v20.3.0

## New Resource Types

* AWS::DataBrew::Dataset
* AWS::DataBrew::Job
* AWS::DataBrew::Project
* AWS::DataBrew::Recipe
* AWS::DataBrew::Schedule

## Attribute Changes

* AWS::ElasticLoadBalancingV2::Listener ListenerArn (__added__)

## Property Changes

* AWS::CodeStar::GitHubRepository ConnectionArn (__added__)
* AWS::CodeStar::GitHubRepository RepositoryAccessToken.Required (__changed__)
  * Old: true
  * New: false
* AWS::DMS::ReplicationInstance AvailabilityZone.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::EC2::ClientVpnEndpoint ClientConnectOptions (__added__)
* AWS::EC2::VPCEndpointService GatewayLoadBalancerArns (__added__)
* AWS::ElasticLoadBalancingV2::Listener AlpnPolicy.DuplicatesAllowed (__deleted__)
* AWS::Lambda::EventSourceMapping PartialBatchResponse (__added__)
* AWS::Lambda::EventSourceMapping TumblingWindowInSeconds (__added__)

## Property Type Changes

* AWS::AppMesh::VirtualGateway.VirtualGatewayConnectionPool (__added__)
* AWS::AppMesh::VirtualGateway.VirtualGatewayGrpcConnectionPool (__added__)
* AWS::AppMesh::VirtualGateway.VirtualGatewayHttp2ConnectionPool (__added__)
* AWS::AppMesh::VirtualGateway.VirtualGatewayHttpConnectionPool (__added__)
* AWS::AppMesh::VirtualNode.OutlierDetection (__added__)
* AWS::AppMesh::VirtualNode.VirtualNodeConnectionPool (__added__)
* AWS::AppMesh::VirtualNode.VirtualNodeGrpcConnectionPool (__added__)
* AWS::AppMesh::VirtualNode.VirtualNodeHttp2ConnectionPool (__added__)
* AWS::AppMesh::VirtualNode.VirtualNodeHttpConnectionPool (__added__)
* AWS::AppMesh::VirtualNode.VirtualNodeTcpConnectionPool (__added__)
* AWS::EC2::ClientVpnEndpoint.ClientConnectOptions (__added__)
* AWS::AppFlow::ConnectorProfile.SalesforceConnectorProfileCredentials ClientCredentialsArn (__added__)
* AWS::AppMesh::VirtualGateway.VirtualGatewayListener ConnectionPool (__added__)
* AWS::AppMesh::VirtualNode.Listener ConnectionPool (__added__)
* AWS::AppMesh::VirtualNode.Listener OutlierDetection (__added__)
* AWS::ElasticLoadBalancingV2::Listener.Action AuthenticateCognitoConfig.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listener-defaultactions.html#cfn-elasticloadbalancingv2-listener-action-authenticatecognitoconfig
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listener-action.html#cfn-elasticloadbalancingv2-listener-action-authenticatecognitoconfig
* AWS::ElasticLoadBalancingV2::Listener.Action AuthenticateOidcConfig.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listener-defaultactions.html#cfn-elasticloadbalancingv2-listener-action-authenticateoidcconfig
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listener-action.html#cfn-elasticloadbalancingv2-listener-action-authenticateoidcconfig
* AWS::ElasticLoadBalancingV2::Listener.Action FixedResponseConfig.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listener-defaultactions.html#cfn-elasticloadbalancingv2-listener-action-fixedresponseconfig
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listener-action.html#cfn-elasticloadbalancingv2-listener-action-fixedresponseconfig
* AWS::ElasticLoadBalancingV2::Listener.Action ForwardConfig.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listener-defaultactions.html#cfn-elasticloadbalancingv2-listener-action-forwardconfig
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listener-action.html#cfn-elasticloadbalancingv2-listener-action-forwardconfig
* AWS::ElasticLoadBalancingV2::Listener.Action Order.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listener-defaultactions.html#cfn-elasticloadbalancingv2-listener-action-order
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listener-action.html#cfn-elasticloadbalancingv2-listener-action-order
* AWS::ElasticLoadBalancingV2::Listener.Action RedirectConfig.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listener-defaultactions.html#cfn-elasticloadbalancingv2-listener-action-redirectconfig
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listener-action.html#cfn-elasticloadbalancingv2-listener-action-redirectconfig
* AWS::ElasticLoadBalancingV2::Listener.Action TargetGroupArn.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listener-defaultactions.html#cfn-elasticloadbalancingv2-listener-defaultactions-targetgrouparn
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listener-action.html#cfn-elasticloadbalancingv2-listener-action-targetgrouparn
* AWS::ElasticLoadBalancingV2::Listener.Action Type.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listener-defaultactions.html#cfn-elasticloadbalancingv2-listener-defaultactions-type
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listener-action.html#cfn-elasticloadbalancingv2-listener-action-type
* AWS::ElasticLoadBalancingV2::Listener.AuthenticateCognitoConfig AuthenticationRequestExtraParams.DuplicatesAllowed (__deleted__)
* AWS::ElasticLoadBalancingV2::Listener.AuthenticateCognitoConfig SessionTimeout.PrimitiveType (__changed__)
  * Old: Long
  * New: String
* AWS::ElasticLoadBalancingV2::Listener.AuthenticateOidcConfig AuthenticationRequestExtraParams.DuplicatesAllowed (__deleted__)
* AWS::ElasticLoadBalancingV2::Listener.AuthenticateOidcConfig SessionTimeout.PrimitiveType (__changed__)
  * Old: Long
  * New: String
* AWS::ElasticLoadBalancingV2::Listener.Certificate CertificateArn.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listener-certificates.html#cfn-elasticloadbalancingv2-listener-certificates-certificatearn
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticloadbalancingv2-listener-certificate.html#cfn-elasticloadbalancingv2-listener-certificate-certificatearn


# CloudFormation Resource Specification v20.2.0

## New Resource Types

* AWS::CloudWatch::MetricStream
* AWS::Events::Archive
* AWS::IoT::DomainConfiguration
* AWS::RDS::GlobalCluster

## Attribute Changes


## Property Changes

* AWS::CodeArtifact::Domain Tags (__added__)
* AWS::CodeArtifact::Repository Tags (__added__)
* AWS::Kendra::DataSource DataSourceConfiguration.Required (__changed__)
  * Old: true
  * New: false
* AWS::Kendra::DataSource RoleArn.Required (__changed__)
  * Old: true
  * New: false
* AWS::S3::Bucket IntelligentTieringConfigurations (__added__)
* AWS::S3::Bucket OwnershipControls (__added__)
* AWS::SecretsManager::ResourcePolicy BlockPublicPolicy (__added__)

## Property Type Changes

* AWS::Batch::JobDefinition.EvaluateOnExit (__added__)
* AWS::S3::Bucket.IntelligentTieringConfiguration (__added__)
* AWS::S3::Bucket.OwnershipControls (__added__)
* AWS::S3::Bucket.OwnershipControlsRule (__added__)
* AWS::S3::Bucket.Tiering (__added__)
* AWS::Batch::JobDefinition.RetryStrategy EvaluateOnExit (__added__)
* AWS::EC2::LaunchTemplate.CapacityReservationTarget CapacityReservationResourceGroupArn (__added__)
* AWS::EC2::LaunchTemplate.NetworkInterface AssociateCarrierIpAddress (__added__)
* AWS::EC2::LaunchTemplate.NetworkInterface NetworkCardIndex (__added__)
* AWS::Kendra::DataSource.S3DataSourceConfiguration InclusionPatterns (__added__)


# CloudFormation Resource Specification v20.0.0

## New Resource Types

* AWS::IVS::Channel
* AWS::IVS::PlaybackKeyPair
* AWS::IVS::StreamKey
* AWS::IoTSiteWise::Asset
* AWS::IoTSiteWise::AssetModel
* AWS::IoTSiteWise::Gateway
* AWS::MediaPackage::Asset
* AWS::MediaPackage::Channel
* AWS::MediaPackage::OriginEndpoint
* AWS::MediaPackage::PackagingConfiguration
* AWS::MediaPackage::PackagingGroup

## Attribute Changes

* AWS::AutoScaling::AutoScalingGroup LaunchConfigurationName (__added__)
* AWS::AutoScaling::AutoScalingGroup LaunchTemplateSpecification (__added__)
* AWS::AutoScaling::AutoScalingGroup MixedInstancesPolicy (__added__)
* AWS::AutoScaling::AutoScalingGroup PlacementGroup (__added__)
* AWS::AutoScaling::AutoScalingGroup VPCZoneIdentifier (__added__)
* AWS::EC2::Subnet OutpostArn (__added__)

## Property Changes

* AWS::AmazonMQ::Broker LdapMetadata (__deleted__)
* AWS::AppSync::ApiKey ApiKeyId (__added__)
* AWS::AppSync::FunctionConfiguration SyncConfig (__added__)
* AWS::Athena::NamedQuery WorkGroup (__added__)
* AWS::AutoScaling::AutoScalingGroup CapacityRebalance (__added__)
* AWS::AutoScaling::LaunchConfiguration MetadataOptions (__added__)
* AWS::Batch::ComputeEnvironment Tags (__added__)
* AWS::Batch::JobDefinition Tags (__added__)
* AWS::Batch::JobQueue Tags (__added__)
* AWS::EC2::ClientVpnEndpoint SelfServicePortal (__added__)
* AWS::EC2::Route CarrierGatewayId (__added__)
* AWS::EC2::Route LocalGatewayId (__added__)
* AWS::EC2::Route VpcEndpointId (__added__)
* AWS::EC2::Subnet OutpostArn (__added__)
* AWS::EC2::VPCEndpointService ApplianceLoadBalancerArns (__deleted__)
* AWS::EMR::Cluster LogEncryptionKmsKeyId (__added__)
* AWS::EMR::Cluster ManagedScalingPolicy (__added__)
* AWS::EMR::Cluster StepConcurrencyLevel (__added__)
* AWS::ElastiCache::ReplicationGroup GlobalReplicationGroupId (__added__)
* AWS::ElastiCache::ReplicationGroup MultiAZEnabled.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::ElasticLoadBalancingV2::Listener Port.Required (__changed__)
  * Old: true
  * New: false
* AWS::ElasticLoadBalancingV2::Listener Protocol.Required (__changed__)
  * Old: true
  * New: false
* AWS::ElasticLoadBalancingV2::LoadBalancer SubnetMappings.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::GameLift::MatchmakingConfiguration FlexMatchMode (__added__)
* AWS::GameLift::MatchmakingConfiguration GameSessionQueueArns.Required (__changed__)
  * Old: true
  * New: false
* AWS::GlobalAccelerator::EndpointGroup PortOverrides (__added__)
* AWS::KinesisFirehose::DeliveryStream DeliveryStreamEncryptionConfigurationInput (__added__)
* AWS::KinesisFirehose::DeliveryStream Tags (__added__)
* AWS::KinesisFirehose::DeliveryStream KinesisStreamSourceConfiguration.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::LakeFormation::DataLakeSettings TrustedResourceOwners (__added__)
* AWS::Lambda::EventSourceMapping Queues (__added__)
* AWS::Lambda::EventSourceMapping SourceAccessConfigurations (__added__)
* AWS::Logs::LogGroup KmsKeyId (__added__)
* AWS::Logs::LogGroup LogGroupName.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-logs-loggroup.html#cfn-cwl-loggroup-loggroupname
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-logs-loggroup.html#cfn-logs-loggroup-loggroupname
* AWS::Logs::LogGroup RetentionInDays.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-logs-loggroup.html#cfn-cwl-loggroup-retentionindays
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-logs-loggroup.html#cfn-logs-loggroup-retentionindays
* AWS::RDS::DBCluster GlobalClusterIdentifier (__added__)
* AWS::RDS::DBCluster Engine.UpdateType (__changed__)
  * Old: Immutable
  * New: Conditional
* AWS::RDS::DBCluster EngineVersion.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::RDS::DBInstance Engine.UpdateType (__changed__)
  * Old: Immutable
  * New: Conditional
* AWS::SNS::Subscription SubscriptionRoleArn (__added__)
* AWS::SNS::Topic FifoTopic (__added__)

## Property Type Changes

* AWS::AmazonMQ::Broker.InterBrokerCred (__removed__)
* AWS::AmazonMQ::Broker.LdapMetadata (__removed__)
* AWS::AmazonMQ::Broker.ServerMetadata (__removed__)
* AWS::AppSync::FunctionConfiguration.LambdaConflictHandlerConfig (__added__)
* AWS::AppSync::FunctionConfiguration.SyncConfig (__added__)
* AWS::AutoScaling::LaunchConfiguration.MetadataOption (__added__)
* AWS::CloudFront::Distribution.OriginShield (__added__)
* AWS::EMR::Cluster.ComputeLimits (__added__)
* AWS::EMR::Cluster.ManagedScalingPolicy (__added__)
* AWS::EMR::Cluster.OnDemandProvisioningSpecification (__added__)
* AWS::EMR::InstanceFleetConfig.OnDemandProvisioningSpecification (__added__)
* AWS::Events::Rule.DeadLetterConfig (__added__)
* AWS::Events::Rule.RedshiftDataParameters (__added__)
* AWS::Events::Rule.RetryPolicy (__added__)
* AWS::GlobalAccelerator::EndpointGroup.PortOverride (__added__)
* AWS::KinesisFirehose::DeliveryStream.DeliveryStreamEncryptionConfigurationInput (__added__)
* AWS::Lambda::EventSourceMapping.SourceAccessConfiguration (__added__)
* AWS::SageMaker::Model.ImageConfig (__added__)
* AWS::Transfer::Server.SecurityGroupId (__added__)
* AWS::AutoScaling::AutoScalingGroup.LaunchTemplateOverrides LaunchTemplateSpecification (__added__)
* AWS::CloudFront::Distribution.Origin OriginShield (__added__)
* AWS::DLM::LifecyclePolicy.Parameters NoReboot (__added__)
* AWS::EC2::ClientVpnEndpoint.FederatedAuthenticationRequest SelfServiceSAMLProviderArn (__added__)
* AWS::EMR::Cluster.InstanceFleetProvisioningSpecifications OnDemandSpecification (__added__)
* AWS::EMR::Cluster.InstanceFleetProvisioningSpecifications SpotSpecification.Required (__changed__)
  * Old: true
  * New: false
* AWS::EMR::Cluster.SpotProvisioningSpecification AllocationStrategy (__added__)
* AWS::EMR::InstanceFleetConfig.InstanceFleetProvisioningSpecifications OnDemandSpecification (__added__)
* AWS::EMR::InstanceFleetConfig.InstanceFleetProvisioningSpecifications SpotSpecification.Required (__changed__)
  * Old: true
  * New: false
* AWS::EMR::InstanceFleetConfig.SpotProvisioningSpecification AllocationStrategy (__added__)
* AWS::ElasticLoadBalancingV2::LoadBalancer.SubnetMapping IPv6Address (__added__)
* AWS::ElasticLoadBalancingV2::TargetGroup.Matcher HttpCode.Required (__changed__)
  * Old: true
  * New: false
* AWS::Elasticsearch::Domain.ElasticsearchClusterConfig WarmCount (__added__)
* AWS::Elasticsearch::Domain.ElasticsearchClusterConfig WarmEnabled (__added__)
* AWS::Elasticsearch::Domain.ElasticsearchClusterConfig WarmType (__added__)
* AWS::Events::Rule.Target DeadLetterConfig (__added__)
* AWS::Events::Rule.Target RedshiftDataParameters (__added__)
* AWS::Events::Rule.Target RetryPolicy (__added__)
* AWS::KinesisFirehose::DeliveryStream.KinesisStreamSourceConfiguration KinesisStreamARN.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::KinesisFirehose::DeliveryStream.KinesisStreamSourceConfiguration RoleARN.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::S3::Bucket.Metrics EventThreshold.Required (__changed__)
  * Old: true
  * New: false
* AWS::S3::Bucket.SourceSelectionCriteria SseKmsEncryptedObjects.Required (__changed__)
  * Old: true
  * New: false
* AWS::SageMaker::Model.ContainerDefinition ImageConfig (__added__)
* AWS::Transfer::Server.EndpointDetails SecurityGroupIds (__added__)


# CloudFormation Resource Specification v18.7.0

## New Resource Types

* AWS::CodeArtifact::Domain
* AWS::CodeArtifact::Repository
* AWS::Timestream::Database
* AWS::Timestream::Table

## Attribute Changes

* AWS::ImageBuilder::Component Name (__deleted__)
* AWS::ImageBuilder::DistributionConfiguration Name (__deleted__)
* AWS::ImageBuilder::ImagePipeline Name (__deleted__)
* AWS::ImageBuilder::ImageRecipe Name (__deleted__)
* AWS::ImageBuilder::InfrastructureConfiguration Name (__deleted__)

## Property Changes

* AWS::ImageBuilder::Component Name (__added__)
* AWS::ImageBuilder::DistributionConfiguration Name (__added__)
* AWS::ImageBuilder::ImagePipeline Name (__added__)
* AWS::ImageBuilder::ImageRecipe Name (__added__)
* AWS::ImageBuilder::InfrastructureConfiguration Name (__added__)
* AWS::KMS::Key KeyUsage.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable

## Property Type Changes



# CloudFormation Resource Specification v18.6.0

## New Resource Types

* AWS::WorkSpaces::ConnectionAlias

## Attribute Changes

* AWS::ImageBuilder::Component Name (__added__)
* AWS::ImageBuilder::DistributionConfiguration Name (__added__)
* AWS::ImageBuilder::Image Name (__added__)
* AWS::ImageBuilder::ImagePipeline Name (__added__)
* AWS::ImageBuilder::ImageRecipe Name (__added__)
* AWS::ImageBuilder::InfrastructureConfiguration Name (__added__)

## Property Changes

* AWS::ApiGateway::DomainName DomainName.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::Config::ConformancePack DeliveryS3Bucket.Required (__changed__)
  * Old: true
  * New: false
* AWS::Config::OrganizationConformancePack DeliveryS3Bucket.Required (__changed__)
  * Old: true
  * New: false
* AWS::ImageBuilder::Component Name (__deleted__)
* AWS::ImageBuilder::DistributionConfiguration Name (__deleted__)
* AWS::ImageBuilder::ImagePipeline Name (__deleted__)
* AWS::ImageBuilder::ImageRecipe Name (__deleted__)
* AWS::ImageBuilder::InfrastructureConfiguration Name (__deleted__)
* AWS::Kendra::Faq FileFormat (__added__)
* AWS::StepFunctions::Activity Arn (__deleted__)
* AWS::StepFunctions::Activity Name (__added__)
* AWS::StepFunctions::Activity Tags.DuplicatesAllowed (__deleted__)

## Property Type Changes

* AWS::Backup::BackupPlan.AdvancedBackupSettingResourceType (__added__)
* AWS::Backup::BackupPlan.BackupPlanResourceType AdvancedBackupSettings (__added__)
* AWS::CloudFront::CachePolicy.ParametersInCacheKeyAndForwardedToOrigin EnableAcceptEncodingBrotli (__added__)
* AWS::CodeBuild::Project.ProjectTriggers BuildType (__added__)
* AWS::ECS::Service.NetworkConfiguration AwsVpcConfiguration (__deleted__)
* AWS::ECS::Service.NetworkConfiguration AwsvpcConfiguration (__added__)
* AWS::Synthetics::Canary.RunConfig ActiveTracing (__added__)


# CloudFormation Resource Specification v18.5.0

## New Resource Types


## Attribute Changes


## Property Changes

* AWS::Amplify::Branch EnablePerformanceMode (__added__)
* AWS::AppStream::Fleet IamRoleArn (__added__)
* AWS::AppStream::Fleet StreamView (__added__)
* AWS::AppStream::ImageBuilder IamRoleArn (__added__)
* AWS::EKS::Cluster KubernetesNetworkConfig (__added__)
* AWS::StepFunctions::Activity Name (__deleted__)
* AWS::StepFunctions::Activity Arn (__added__)
* AWS::StepFunctions::Activity Tags.DuplicatesAllowed (__added__)

## Property Type Changes

* AWS::Batch::JobDefinition.LogConfiguration (__added__)
* AWS::Batch::JobDefinition.Secret (__added__)
* AWS::Batch::JobDefinition.Tmpfs (__added__)
* AWS::EKS::Cluster.KubernetesNetworkConfig (__added__)
* AWS::Amplify::App.AutoBranchCreationConfig EnablePerformanceMode (__added__)
* AWS::Batch::JobDefinition.ContainerProperties ExecutionRoleArn (__added__)
* AWS::Batch::JobDefinition.ContainerProperties LogConfiguration (__added__)
* AWS::Batch::JobDefinition.ContainerProperties Secrets (__added__)
* AWS::Batch::JobDefinition.LinuxParameters InitProcessEnabled (__added__)
* AWS::Batch::JobDefinition.LinuxParameters MaxSwap (__added__)
* AWS::Batch::JobDefinition.LinuxParameters SharedMemorySize (__added__)
* AWS::Batch::JobDefinition.LinuxParameters Swappiness (__added__)
* AWS::Batch::JobDefinition.LinuxParameters Tmpfs (__added__)
* AWS::CloudFront::CachePolicy.CachePolicyConfig DefaultTTL.Required (__changed__)
  * Old: false
  * New: true
* AWS::CloudFront::CachePolicy.CachePolicyConfig MaxTTL.Required (__changed__)
  * Old: false
  * New: true
* AWS::CloudFront::CachePolicy.CachePolicyConfig ParametersInCacheKeyAndForwardedToOrigin.Required (__changed__)
  * Old: false
  * New: true


# CloudFormation Resource Specification v18.4.0

## New Resource Types

* AWS::AppFlow::ConnectorProfile
* AWS::AppFlow::Flow
* AWS::CloudFormation::StackSet

## Attribute Changes

* AWS::ApiGatewayV2::Api ApiEndpoint (__added__)
* AWS::Route53::HostedZone Id (__added__)
* AWS::Route53::HostedZone NameServers.DuplicatesAllowed (__added__)

## Property Changes

* AWS::ApiGateway::DomainName MutualTlsAuthentication (__added__)
* AWS::ApiGatewayV2::Api DisableExecuteApiEndpoint (__added__)
* AWS::ApiGatewayV2::DomainName MutualTlsAuthentication (__added__)
* AWS::CodeBuild::ReportGroup DeleteReports (__added__)
* AWS::EC2::VPCEndpointService ApplianceLoadBalancerArns (__added__)
* AWS::EC2::VPCEndpointService NetworkLoadBalancerArns.Required (__changed__)
  * Old: true
  * New: false
* AWS::ECS::Service CapacityProviderStrategy (__added__)
* AWS::ECS::Service ServiceArn (__added__)
* AWS::ECS::Service LoadBalancers.DuplicatesAllowed (__deleted__)
* AWS::ECS::Service PlacementConstraints.DuplicatesAllowed (__deleted__)
* AWS::ECS::Service PlacementStrategies.DuplicatesAllowed (__deleted__)
* AWS::ECS::Service ServiceRegistries.DuplicatesAllowed (__deleted__)
* AWS::ECS::Service Tags.DuplicatesAllowed (__deleted__)
* AWS::MediaLive::Channel EncoderSettings.PrimitiveType (__deleted__)
* AWS::MediaLive::Channel EncoderSettings.Type (__added__)
* AWS::MediaLive::Input InputDevices (__added__)
* AWS::Route53::HostedZone HostedZoneTags.DuplicatesAllowed (__changed__)
  * Old: true
  * New: false
* AWS::Route53::HostedZone VPCs.DuplicatesAllowed (__changed__)
  * Old: true
  * New: false
* AWS::Route53::HostedZone VPCs.UpdateType (__changed__)
  * Old: Conditional
  * New: Mutable

## Property Type Changes

* AWS::ApiGateway::DomainName.MutualTlsAuthentication (__added__)
* AWS::ApiGatewayV2::DomainName.MutualTlsAuthentication (__added__)
* AWS::ECS::Service.CapacityProviderStrategyItem (__added__)
* AWS::LakeFormation::Permissions.TableWildcard (__added__)
* AWS::MediaLive::Channel.AacSettings (__added__)
* AWS::MediaLive::Channel.Ac3Settings (__added__)
* AWS::MediaLive::Channel.ArchiveContainerSettings (__added__)
* AWS::MediaLive::Channel.ArchiveGroupSettings (__added__)
* AWS::MediaLive::Channel.ArchiveOutputSettings (__added__)
* AWS::MediaLive::Channel.AribDestinationSettings (__added__)
* AWS::MediaLive::Channel.AudioChannelMapping (__added__)
* AWS::MediaLive::Channel.AudioCodecSettings (__added__)
* AWS::MediaLive::Channel.AudioDescription (__added__)
* AWS::MediaLive::Channel.AudioNormalizationSettings (__added__)
* AWS::MediaLive::Channel.AudioOnlyHlsSettings (__added__)
* AWS::MediaLive::Channel.AudioTrack (__added__)
* AWS::MediaLive::Channel.AudioTrackSelection (__added__)
* AWS::MediaLive::Channel.AutomaticInputFailoverSettings (__added__)
* AWS::MediaLive::Channel.AvailBlanking (__added__)
* AWS::MediaLive::Channel.AvailConfiguration (__added__)
* AWS::MediaLive::Channel.AvailSettings (__added__)
* AWS::MediaLive::Channel.BlackoutSlate (__added__)
* AWS::MediaLive::Channel.BurnInDestinationSettings (__added__)
* AWS::MediaLive::Channel.CaptionDescription (__added__)
* AWS::MediaLive::Channel.CaptionDestinationSettings (__added__)
* AWS::MediaLive::Channel.CaptionLanguageMapping (__added__)
* AWS::MediaLive::Channel.ColorSpacePassthroughSettings (__added__)
* AWS::MediaLive::Channel.DvbNitSettings (__added__)
* AWS::MediaLive::Channel.DvbSdtSettings (__added__)
* AWS::MediaLive::Channel.DvbSubDestinationSettings (__added__)
* AWS::MediaLive::Channel.DvbTdtSettings (__added__)
* AWS::MediaLive::Channel.Eac3Settings (__added__)
* AWS::MediaLive::Channel.EbuTtDDestinationSettings (__added__)
* AWS::MediaLive::Channel.EmbeddedDestinationSettings (__added__)
* AWS::MediaLive::Channel.EmbeddedPlusScte20DestinationSettings (__added__)
* AWS::MediaLive::Channel.EncoderSettings (__added__)
* AWS::MediaLive::Channel.FeatureActivations (__added__)
* AWS::MediaLive::Channel.FecOutputSettings (__added__)
* AWS::MediaLive::Channel.Fmp4HlsSettings (__added__)
* AWS::MediaLive::Channel.FrameCaptureGroupSettings (__added__)
* AWS::MediaLive::Channel.FrameCaptureOutputSettings (__added__)
* AWS::MediaLive::Channel.FrameCaptureSettings (__added__)
* AWS::MediaLive::Channel.GlobalConfiguration (__added__)
* AWS::MediaLive::Channel.H264ColorSpaceSettings (__added__)
* AWS::MediaLive::Channel.H264FilterSettings (__added__)
* AWS::MediaLive::Channel.H264Settings (__added__)
* AWS::MediaLive::Channel.H265ColorSpaceSettings (__added__)
* AWS::MediaLive::Channel.H265FilterSettings (__added__)
* AWS::MediaLive::Channel.H265Settings (__added__)
* AWS::MediaLive::Channel.Hdr10Settings (__added__)
* AWS::MediaLive::Channel.HlsAkamaiSettings (__added__)
* AWS::MediaLive::Channel.HlsBasicPutSettings (__added__)
* AWS::MediaLive::Channel.HlsCdnSettings (__added__)
* AWS::MediaLive::Channel.HlsGroupSettings (__added__)
* AWS::MediaLive::Channel.HlsMediaStoreSettings (__added__)
* AWS::MediaLive::Channel.HlsOutputSettings (__added__)
* AWS::MediaLive::Channel.HlsSettings (__added__)
* AWS::MediaLive::Channel.HlsWebdavSettings (__added__)
* AWS::MediaLive::Channel.InputChannelLevel (__added__)
* AWS::MediaLive::Channel.InputLocation (__added__)
* AWS::MediaLive::Channel.InputLossBehavior (__added__)
* AWS::MediaLive::Channel.KeyProviderSettings (__added__)
* AWS::MediaLive::Channel.M2tsSettings (__added__)
* AWS::MediaLive::Channel.M3u8Settings (__added__)
* AWS::MediaLive::Channel.MediaPackageGroupSettings (__added__)
* AWS::MediaLive::Channel.MediaPackageOutputSettings (__added__)
* AWS::MediaLive::Channel.Mp2Settings (__added__)
* AWS::MediaLive::Channel.MsSmoothGroupSettings (__added__)
* AWS::MediaLive::Channel.MsSmoothOutputSettings (__added__)
* AWS::MediaLive::Channel.MultiplexGroupSettings (__added__)
* AWS::MediaLive::Channel.MultiplexOutputSettings (__added__)
* AWS::MediaLive::Channel.NielsenConfiguration (__added__)
* AWS::MediaLive::Channel.Output (__added__)
* AWS::MediaLive::Channel.OutputGroup (__added__)
* AWS::MediaLive::Channel.OutputGroupSettings (__added__)
* AWS::MediaLive::Channel.OutputLocationRef (__added__)
* AWS::MediaLive::Channel.OutputSettings (__added__)
* AWS::MediaLive::Channel.PassThroughSettings (__added__)
* AWS::MediaLive::Channel.Rec601Settings (__added__)
* AWS::MediaLive::Channel.Rec709Settings (__added__)
* AWS::MediaLive::Channel.RemixSettings (__added__)
* AWS::MediaLive::Channel.RtmpCaptionInfoDestinationSettings (__added__)
* AWS::MediaLive::Channel.RtmpGroupSettings (__added__)
* AWS::MediaLive::Channel.RtmpOutputSettings (__added__)
* AWS::MediaLive::Channel.Scte20PlusEmbeddedDestinationSettings (__added__)
* AWS::MediaLive::Channel.Scte27DestinationSettings (__added__)
* AWS::MediaLive::Channel.Scte35SpliceInsert (__added__)
* AWS::MediaLive::Channel.Scte35TimeSignalApos (__added__)
* AWS::MediaLive::Channel.SmpteTtDestinationSettings (__added__)
* AWS::MediaLive::Channel.StandardHlsSettings (__added__)
* AWS::MediaLive::Channel.StaticKeySettings (__added__)
* AWS::MediaLive::Channel.TeletextDestinationSettings (__added__)
* AWS::MediaLive::Channel.TemporalFilterSettings (__added__)
* AWS::MediaLive::Channel.TimecodeConfig (__added__)
* AWS::MediaLive::Channel.TtmlDestinationSettings (__added__)
* AWS::MediaLive::Channel.UdpContainerSettings (__added__)
* AWS::MediaLive::Channel.UdpGroupSettings (__added__)
* AWS::MediaLive::Channel.UdpOutputSettings (__added__)
* AWS::MediaLive::Channel.VideoCodecSettings (__added__)
* AWS::MediaLive::Channel.VideoDescription (__added__)
* AWS::MediaLive::Channel.WebvttDestinationSettings (__added__)
* AWS::MediaLive::Input.InputDeviceRequest (__added__)
* AWS::MediaLive::Input.InputDeviceSettings (__added__)
* AWS::ApiGatewayV2::DomainName.DomainNameConfiguration SecurityPolicy (__added__)
* AWS::ECS::Service.AwsVpcConfiguration SecurityGroups.DuplicatesAllowed (__deleted__)
* AWS::ECS::Service.AwsVpcConfiguration Subnets.DuplicatesAllowed (__deleted__)
* AWS::ECS::Service.AwsVpcConfiguration Subnets.Required (__changed__)
  * Old: true
  * New: false
* AWS::ECS::Service.LoadBalancer ContainerName.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ecs-service-loadbalancers.html#cfn-ecs-service-loadbalancers-containername
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ecs-service-loadbalancer.html#cfn-ecs-service-loadbalancer-containername
* AWS::ECS::Service.LoadBalancer ContainerPort.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ecs-service-loadbalancers.html#cfn-ecs-service-loadbalancers-containerport
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ecs-service-loadbalancer.html#cfn-ecs-service-loadbalancer-containerport
* AWS::ECS::Service.LoadBalancer ContainerPort.Required (__changed__)
  * Old: true
  * New: false
* AWS::ECS::Service.LoadBalancer LoadBalancerName.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ecs-service-loadbalancers.html#cfn-ecs-service-loadbalancers-loadbalancername
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ecs-service-loadbalancer.html#cfn-ecs-service-loadbalancer-loadbalancername
* AWS::ECS::Service.LoadBalancer TargetGroupArn.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ecs-service-loadbalancers.html#cfn-ecs-service-loadbalancers-targetgrouparn
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ecs-service-loadbalancer.html#cfn-ecs-service-loadbalancer-targetgrouparn
* AWS::ECS::Service.NetworkConfiguration AwsvpcConfiguration (__deleted__)
* AWS::ECS::Service.NetworkConfiguration AwsVpcConfiguration (__added__)
* AWS::LakeFormation::Permissions.DataLocationResource CatalogId (__added__)
* AWS::LakeFormation::Permissions.DatabaseResource CatalogId (__added__)
* AWS::LakeFormation::Permissions.TableResource CatalogId (__added__)
* AWS::LakeFormation::Permissions.TableResource TableWildcard (__added__)
* AWS::LakeFormation::Permissions.TableWithColumnsResource CatalogId (__added__)
* AWS::MediaLive::Channel.AudioSelectorSettings AudioTrackSelection (__added__)
* AWS::MediaLive::Channel.InputAttachment AutomaticInputFailoverSettings (__added__)
* AWS::MediaLive::Channel.InputSettings Smpte2038DataPreference (__added__)
* AWS::Route53::HostedZone.HostedZoneTag Key.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-route53-hostedzone-hostedzonetags.html#cfn-route53-hostedzonetags-key
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-route53-hostedzone-hostedzonetag.html#cfn-route53-hostedzone-hostedzonetag-key
* AWS::Route53::HostedZone.HostedZoneTag Value.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-route53-hostedzone-hostedzonetags.html#cfn-route53-hostedzonetags-value
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-route53-hostedzone-hostedzonetag.html#cfn-route53-hostedzone-hostedzonetag-value
* AWS::Route53::HostedZone.VPC VPCId.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-route53-hostedzone-hostedzonevpcs.html#cfn-route53-hostedzone-hostedzonevpcs-vpcid
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-route53-hostedzone-vpc.html#cfn-route53-hostedzone-vpc-vpcid
* AWS::Route53::HostedZone.VPC VPCRegion.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-route53-hostedzone-hostedzonevpcs.html#cfn-route53-hostedzone-hostedzonevpcs-vpcregion
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-route53-hostedzone-vpc.html#cfn-route53-hostedzone-vpc-vpcregion


# CloudFormation Resource Specification v18.3.0

## New Resource Types

* AWS::ApplicationInsights::Application
* AWS::CloudFront::CachePolicy
* AWS::CloudFront::OriginRequestPolicy
* AWS::CloudFront::RealtimeLogConfig
* AWS::CodeGuruReviewer::RepositoryAssociation
* AWS::EC2::CarrierGateway
* AWS::EKS::FargateProfile
* AWS::GameLift::GameServerGroup
* AWS::IoT::Authorizer
* AWS::Kendra::DataSource
* AWS::Kendra::Faq
* AWS::Kendra::Index
* AWS::Route53Resolver::ResolverQueryLoggingConfig
* AWS::Route53Resolver::ResolverQueryLoggingConfigAssociation
* AWS::SSO::Assignment
* AWS::SSO::PermissionSet
* AWS::SageMaker::MonitoringSchedule

## Attribute Changes

* AWS::GameLift::Alias AliasId (__added__)
* AWS::IoT::Certificate Id (__added__)
* AWS::KMS::Key KeyId (__added__)
* AWS::Lambda::EventSourceMapping Id (__added__)
* AWS::OpsWorksCM::Server Id (__added__)
* AWS::Route53::HealthCheck HealthCheckId (__added__)
* AWS::StepFunctions::StateMachine Arn (__added__)

## Property Changes

* AWS::ApiGatewayV2::Authorizer AuthorizerPayloadFormatVersion (__added__)
* AWS::ApiGatewayV2::Authorizer EnableSimpleResponses (__added__)
* AWS::ApiGatewayV2::Integration IntegrationSubtype (__added__)
* AWS::Cognito::UserPoolClient AccessTokenValidity (__added__)
* AWS::Cognito::UserPoolClient IdTokenValidity (__added__)
* AWS::Cognito::UserPoolClient TokenValidityUnits (__added__)
* AWS::EC2::NetworkInterface Ipv6Addresses.DuplicatesAllowed (__added__)
* AWS::EC2::NetworkInterface Ipv6Addresses.ItemType (__added__)
* AWS::EC2::NetworkInterface Ipv6Addresses.Type (__changed__)
  * Old: InstanceIpv6Address
  * New: List
* AWS::EC2::TransitGateway MulticastSupport (__added__)
* AWS::ECR::Repository ImageScanningConfiguration (__added__)
* AWS::ECR::Repository ImageTagMutability (__added__)
* AWS::ECR::Repository RepositoryPolicyText.PrimitiveType (__deleted__)
* AWS::ECR::Repository Tags.DuplicatesAllowed (__changed__)
  * Old: true
  * New: false
* AWS::ECS::TaskDefinition TaskDefinitionStatus (__deleted__)
* AWS::EKS::Nodegroup LaunchTemplate (__added__)
* AWS::GuardDuty::Detector DataSources (__added__)
* AWS::IoT::Certificate CACertificatePem (__added__)
* AWS::IoT::Certificate CertificateMode (__added__)
* AWS::IoT::Certificate CertificatePem (__added__)
* AWS::IoT::Certificate CertificateSigningRequest.Required (__changed__)
  * Old: true
  * New: false
* AWS::KMS::Key KeyPolicy.PrimitiveType (__deleted__)
* AWS::KMS::Key Tags.DuplicatesAllowed (__changed__)
  * Old: true
  * New: false
* AWS::Lambda::EventSourceMapping Topics (__added__)
* AWS::Neptune::DBCluster AssociatedRoles (__added__)
* AWS::OpsWorksCM::Server EngineAttributes.DuplicatesAllowed (__added__)
* AWS::OpsWorksCM::Server SecurityGroupIds.DuplicatesAllowed (__added__)
* AWS::OpsWorksCM::Server SubnetIds.DuplicatesAllowed (__added__)
* AWS::OpsWorksCM::Server Tags.DuplicatesAllowed (__added__)
* AWS::Route53::HealthCheck HealthCheckConfig.Type (__deleted__)
* AWS::Route53::HealthCheck HealthCheckConfig.PrimitiveType (__added__)
* AWS::Route53::HealthCheck HealthCheckConfig.UpdateType (__changed__)
  * Old: Conditional
  * New: Mutable
* AWS::Route53::HealthCheck HealthCheckTags.DuplicatesAllowed (__changed__)
  * Old: true
  * New: false
* AWS::SNS::Topic FifoTopic (__deleted__)
* AWS::SageMaker::Model EnableNetworkIsolation (__added__)
* AWS::ServiceCatalog::CloudFormationProvisionedProduct PathName (__added__)
* AWS::StepFunctions::StateMachine StateMachineType.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::StepFunctions::StateMachine Tags.DuplicatesAllowed (__added__)
* AWS::Transfer::Server SecurityPolicyName (__added__)

## Property Type Changes

* AWS::ECS::TaskDefinition.EfsVolumeConfiguration (__removed__)
* AWS::ECS::TaskDefinition.Options (__removed__)
* AWS::Route53::HealthCheck.AlarmIdentifier (__removed__)
* AWS::Route53::HealthCheck.HealthCheckConfig (__removed__)
* AWS::Cognito::UserPoolClient.TokenValidityUnits (__added__)
* AWS::ECS::TaskDefinition.EFSVolumeConfiguration (__added__)
* AWS::ECS::TaskDefinition.EnvironmentFile (__added__)
* AWS::EKS::Nodegroup.LaunchTemplateSpecification (__added__)
* AWS::GuardDuty::Detector.CFNDataSourceConfigurations (__added__)
* AWS::GuardDuty::Detector.CFNS3LogsConfiguration (__added__)
* AWS::MSK::Cluster.Sasl (__added__)
* AWS::MSK::Cluster.Scram (__added__)
* AWS::Macie::FindingsFilter.FindingsFilterListItem (__added__)
* AWS::Neptune::DBCluster.DBClusterRole (__added__)
* AWS::SSM::Association.ParameterValues (__added__)
* AWS::CloudFront::Distribution.CacheBehavior RealtimeLogConfigArn (__added__)
* AWS::CloudFront::Distribution.DefaultCacheBehavior RealtimeLogConfigArn (__added__)
* AWS::CodeCommit::Repository.Code BranchName (__added__)
* AWS::ECS::TaskDefinition.ContainerDefinition EnvironmentFiles (__added__)
* AWS::ECS::TaskDefinition.AuthorizationConfig Iam (__deleted__)
* AWS::ECS::TaskDefinition.AuthorizationConfig IAM (__added__)
* AWS::ECS::TaskDefinition.AuthorizationConfig AccessPointId.Documentation (__changed__)
  * Old: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/efs-volumes.html#specify-efs-config
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-ecs-taskdefinition-authorizationconfig.html#cfn-ecs-taskdefinition-authorizationconfig-accesspointid
* AWS::ECS::TaskDefinition.FirelensConfiguration Options.PrimitiveItemType (__added__)
* AWS::ECS::TaskDefinition.FirelensConfiguration Options.Type (__changed__)
  * Old: Options
  * New: Map
* AWS::ECS::TaskDefinition.LogConfiguration Options.PrimitiveItemType (__added__)
* AWS::ECS::TaskDefinition.LogConfiguration Options.Type (__changed__)
  * Old: Options
  * New: Map
* AWS::ECS::TaskDefinition.Volume EfsVolumeConfiguration (__deleted__)
* AWS::ECS::TaskDefinition.Volume EFSVolumeConfiguration (__added__)
* AWS::FSx::FileSystem.LustreConfiguration DriveCacheType (__added__)
* AWS::GameLift::Alias.RoutingStrategy Type.Required (__changed__)
  * Old: true
  * New: false
* AWS::Lambda::EventSourceMapping.DestinationConfig OnFailure.Required (__changed__)
  * Old: true
  * New: false
* AWS::Lambda::EventSourceMapping.OnFailure Destination.Required (__changed__)
  * Old: true
  * New: false
* AWS::MSK::Cluster.ClientAuthentication Sasl (__added__)
* AWS::Route53::HealthCheck.HealthCheckTag Key.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-route53-healthcheck-healthchecktag.html#cfn-route53-healthchecktags-key
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-route53-healthcheck-healthchecktag.html#cfn-route53-healthcheck-healthchecktag-key
* AWS::Route53::HealthCheck.HealthCheckTag Value.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-route53-healthcheck-healthchecktag.html#cfn-route53-healthchecktags-value
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-route53-healthcheck-healthchecktag.html#cfn-route53-healthcheck-healthchecktag-value
* AWS::StepFunctions::StateMachine.CloudWatchLogsLogGroup LogGroupArn.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-stepfunctions-statemachine-logdestination-cloudwatchlogsloggroup.html#cfn-stepfunctions-statemachine-logdestination-cloudwatchlogsloggroup-loggrouparn
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-stepfunctions-statemachine-cloudwatchlogsloggroup.html#cfn-stepfunctions-statemachine-cloudwatchlogsloggroup-loggrouparn
* AWS::StepFunctions::StateMachine.CloudWatchLogsLogGroup LogGroupArn.Required (__changed__)
  * Old: true
  * New: false
* AWS::StepFunctions::StateMachine.TracingConfiguration Enabled.Required (__changed__)
  * Old: true
  * New: false


# CloudFormation Resource Specification v16.3.0

## New Resource Types

* AWS::ApiGatewayV2::ApiGatewayManagedOverrides
* AWS::ApiGatewayV2::VpcLink
* AWS::AppMesh::GatewayRoute
* AWS::AppMesh::VirtualGateway

## Attribute Changes

* AWS::ECS::TaskDefinition TaskDefinitionArn (__added__)
* AWS::EFS::FileSystem Arn (__added__)

## Property Changes

* AWS::AmazonMQ::Broker AuthenticationStrategy (__added__)
* AWS::AmazonMQ::Broker LdapMetadata (__added__)
* AWS::AmazonMQ::Broker LdapServerMetadata (__added__)
* AWS::ApiGateway::DomainName DomainName.Required (__changed__)
  * Old: true
  * New: false
* AWS::ApiGateway::DomainName DomainName.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::ApiGateway::DomainName Tags.DuplicatesAllowed (__deleted__)
* AWS::CodeBuild::Project BuildBatchConfig (__added__)
* AWS::CodeBuild::ReportGroup Type.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::CodeGuruProfiler::ProfilingGroup AnomalyDetectionNotificationConfiguration (__added__)
* AWS::CodeGuruProfiler::ProfilingGroup Tags (__added__)
* AWS::CodeStarConnections::Connection HostArn (__added__)
* AWS::CodeStarConnections::Connection ProviderType.Required (__changed__)
  * Old: true
  * New: false
* AWS::EC2::FlowLog LogFormat (__added__)
* AWS::EC2::FlowLog MaxAggregationInterval (__added__)
* AWS::EC2::FlowLog Tags (__added__)
* AWS::ECS::TaskDefinition TaskDefinitionStatus (__added__)
* AWS::ECS::TaskDefinition Tags.DuplicatesAllowed (__deleted__)
* AWS::EFS::FileSystem BackupPolicy (__added__)
* AWS::ImageBuilder::InfrastructureConfiguration ResourceTags (__added__)
* AWS::IoT::ProvisioningTemplate Tags.ItemType (__deleted__)
* AWS::IoT::ProvisioningTemplate Tags.Type (__changed__)
  * Old: List
  * New: Tags
* AWS::KinesisFirehose::DeliveryStream HttpEndpointDestinationConfiguration (__added__)
* AWS::SecretsManager::RotationSchedule HostedRotationLambda (__added__)
* AWS::StepFunctions::StateMachine TracingConfiguration (__added__)

## Property Type Changes

* AWS::AmazonMQ::Broker.InterBrokerCred (__added__)
* AWS::AmazonMQ::Broker.LdapMetadata (__added__)
* AWS::AmazonMQ::Broker.LdapServerMetadata (__added__)
* AWS::AmazonMQ::Broker.ServerMetadata (__added__)
* AWS::CodeBuild::Project.BatchRestrictions (__added__)
* AWS::CodeBuild::Project.ProjectBuildBatchConfig (__added__)
* AWS::CodeGuruProfiler::ProfilingGroup.Channel (__added__)
* AWS::ECS::TaskDefinition.Options (__added__)
* AWS::EFS::FileSystem.BackupPolicy (__added__)
* AWS::IoT::ProvisioningTemplate.Tags (__added__)
* AWS::KinesisFirehose::DeliveryStream.HttpEndpointCommonAttribute (__added__)
* AWS::KinesisFirehose::DeliveryStream.HttpEndpointConfiguration (__added__)
* AWS::KinesisFirehose::DeliveryStream.HttpEndpointDestinationConfiguration (__added__)
* AWS::KinesisFirehose::DeliveryStream.HttpEndpointRequestConfiguration (__added__)
* AWS::KinesisFirehose::DeliveryStream.RetryOptions (__added__)
* AWS::SecretsManager::RotationSchedule.HostedRotationLambda (__added__)
* AWS::StepFunctions::StateMachine.TracingConfiguration (__added__)
* AWS::ApiGateway::DomainName.EndpointConfiguration Types.DuplicatesAllowed (__deleted__)
* AWS::CloudFront::Distribution.CacheBehavior CachePolicyId (__added__)
* AWS::CloudFront::Distribution.CacheBehavior OriginRequestPolicyId (__added__)
* AWS::CloudFront::Distribution.CacheBehavior ForwardedValues.Required (__changed__)
  * Old: true
  * New: false
* AWS::CloudFront::Distribution.DefaultCacheBehavior CachePolicyId (__added__)
* AWS::CloudFront::Distribution.DefaultCacheBehavior OriginRequestPolicyId (__added__)
* AWS::CloudFront::Distribution.DefaultCacheBehavior ForwardedValues.Required (__changed__)
  * Old: true
  * New: false
* AWS::ECS::TaskDefinition.ContainerDefinition Command.DuplicatesAllowed (__deleted__)
* AWS::ECS::TaskDefinition.ContainerDefinition DependsOn.DuplicatesAllowed (__deleted__)
* AWS::ECS::TaskDefinition.ContainerDefinition DnsSearchDomains.DuplicatesAllowed (__deleted__)
* AWS::ECS::TaskDefinition.ContainerDefinition DnsServers.DuplicatesAllowed (__deleted__)
* AWS::ECS::TaskDefinition.ContainerDefinition DockerLabels.DuplicatesAllowed (__deleted__)
* AWS::ECS::TaskDefinition.ContainerDefinition DockerSecurityOptions.DuplicatesAllowed (__deleted__)
* AWS::ECS::TaskDefinition.ContainerDefinition EntryPoint.DuplicatesAllowed (__deleted__)
* AWS::ECS::TaskDefinition.ContainerDefinition ExtraHosts.DuplicatesAllowed (__deleted__)
* AWS::ECS::TaskDefinition.ContainerDefinition ResourceRequirements.DuplicatesAllowed (__deleted__)
* AWS::ECS::TaskDefinition.ContainerDefinition Secrets.DuplicatesAllowed (__deleted__)
* AWS::ECS::TaskDefinition.ContainerDefinition SystemControls.DuplicatesAllowed (__deleted__)
* AWS::ECS::TaskDefinition.ContainerDefinition Ulimits.DuplicatesAllowed (__deleted__)
* AWS::ECS::TaskDefinition.ContainerDependency Condition.Required (__changed__)
  * Old: true
  * New: false
* AWS::ECS::TaskDefinition.ContainerDependency ContainerName.Required (__changed__)
  * Old: true
  * New: false
* AWS::ECS::TaskDefinition.Device HostPath.Required (__changed__)
  * Old: true
  * New: false
* AWS::ECS::TaskDefinition.DockerVolumeConfiguration DriverOpts.DuplicatesAllowed (__deleted__)
* AWS::ECS::TaskDefinition.DockerVolumeConfiguration Labels.DuplicatesAllowed (__deleted__)
* AWS::ECS::TaskDefinition.FirelensConfiguration Options.DuplicatesAllowed (__deleted__)
* AWS::ECS::TaskDefinition.FirelensConfiguration Options.PrimitiveItemType (__deleted__)
* AWS::ECS::TaskDefinition.FirelensConfiguration Options.Type (__changed__)
  * Old: Map
  * New: Options
* AWS::ECS::TaskDefinition.FirelensConfiguration Type.Required (__changed__)
  * Old: true
  * New: false
* AWS::ECS::TaskDefinition.HealthCheck Command.DuplicatesAllowed (__deleted__)
* AWS::ECS::TaskDefinition.HealthCheck Command.Required (__changed__)
  * Old: true
  * New: false
* AWS::ECS::TaskDefinition.HostEntry Hostname.Required (__changed__)
  * Old: true
  * New: false
* AWS::ECS::TaskDefinition.HostEntry IpAddress.Required (__changed__)
  * Old: true
  * New: false
* AWS::ECS::TaskDefinition.KernelCapabilities Add.DuplicatesAllowed (__deleted__)
* AWS::ECS::TaskDefinition.KernelCapabilities Drop.DuplicatesAllowed (__deleted__)
* AWS::ECS::TaskDefinition.LinuxParameters Devices.DuplicatesAllowed (__deleted__)
* AWS::ECS::TaskDefinition.LinuxParameters Tmpfs.DuplicatesAllowed (__deleted__)
* AWS::ECS::TaskDefinition.LogConfiguration Options.DuplicatesAllowed (__deleted__)
* AWS::ECS::TaskDefinition.LogConfiguration Options.PrimitiveItemType (__deleted__)
* AWS::ECS::TaskDefinition.LogConfiguration Options.Type (__changed__)
  * Old: Map
  * New: Options
* AWS::ECS::TaskDefinition.LogConfiguration SecretOptions.DuplicatesAllowed (__deleted__)
* AWS::ECS::TaskDefinition.SystemControl Namespace.Required (__changed__)
  * Old: true
  * New: false
* AWS::ECS::TaskDefinition.SystemControl Value.Required (__changed__)
  * Old: true
  * New: false
* AWS::ECS::TaskDefinition.Tmpfs MountOptions.DuplicatesAllowed (__deleted__)
* AWS::FSx::FileSystem.LustreConfiguration AutoImportPolicy (__added__)
* AWS::ImageBuilder::DistributionConfiguration.Distribution Region.Required (__changed__)
  * Old: false
  * New: true

# Serverless Application Model (SAM) Resource Specification v2016-10-31

## New Resource Types

* AWS::Serverless::StateMachine

## Attribute Changes


## Property Changes

* AWS::Serverless::Function FileSystemConfigs (__added__)

## Property Type Changes

* AWS::Serverless::Function.FileSystemConfig (__added__)


# Serverless Application Model (SAM) Resource Specification v2016-10-31

## New Resource Types


## Attribute Changes


## Property Changes


## Property Type Changes

* AWS::Serverless::Function.DestinationConfig (__added__)
* AWS::Serverless::Function.OnFailure (__added__)
* AWS::Serverless::Function.DynamoDBEvent BisectBatchOnFunctionError (__added__)
* AWS::Serverless::Function.DynamoDBEvent DestinationConfig (__added__)
* AWS::Serverless::Function.DynamoDBEvent MaximumBatchingWindowInSeconds (__added__)
* AWS::Serverless::Function.DynamoDBEvent MaximumRecordAgeInSeconds (__added__)
* AWS::Serverless::Function.DynamoDBEvent MaximumRetryAttempts (__added__)
* AWS::Serverless::Function.DynamoDBEvent ParallelizationFactor (__added__)

# CloudFormation Resource Specification v16.1.0

## New Resource Types

* AWS::Athena::DataCatalog
* AWS::EC2::PrefixList
* AWS::QLDB::Stream

## Attribute Changes

* AWS::Amplify::Domain AutoSubDomainCreationPatterns (__added__)
* AWS::Amplify::Domain AutoSubDomainIAMRole (__added__)
* AWS::Amplify::Domain EnableAutoSubDomain (__added__)
* AWS::RDS::DBProxyTargetGroup TargetGroupName (__deleted__)
* AWS::ServiceCatalog::CloudFormationProvisionedProduct Outputs (__added__)
* AWS::ServiceCatalog::CloudFormationProvisionedProduct ProvisionedProductId (__added__)

## Property Changes

* AWS::Amplify::App EnableBranchAutoDeletion (__added__)
* AWS::Amplify::Domain AutoSubDomainCreationPatterns (__added__)
* AWS::Amplify::Domain AutoSubDomainIAMRole (__added__)
* AWS::Amplify::Domain EnableAutoSubDomain (__added__)
* AWS::AutoScaling::AutoScalingGroup NewInstancesProtectedFromScaleIn (__added__)
* AWS::CodeGuruProfiler::ProfilingGroup ComputePlatform (__added__)
* AWS::ElastiCache::ReplicationGroup MultiAZEnabled.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::ElasticLoadBalancingV2::Listener AlpnPolicy (__added__)
* AWS::Elasticsearch::Domain AdvancedSecurityOptions (__added__)
* AWS::Elasticsearch::Domain DomainEndpointOptions (__added__)
* AWS::FSx::FileSystem StorageCapacity.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::ImageBuilder::Component SupportedOsVersions (__added__)
* AWS::ImageBuilder::Image EnhancedImageMetadataEnabled (__added__)
* AWS::ImageBuilder::ImagePipeline EnhancedImageMetadataEnabled (__added__)
* AWS::ImageBuilder::ImageRecipe WorkingDirectory (__added__)
* AWS::Lambda::Function FileSystemConfigs (__added__)
* AWS::RDS::DBProxyTargetGroup TargetGroupName (__added__)
* AWS::RDS::DBProxyTargetGroup DBProxyName.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::Route53::HealthCheck HealthCheckConfig.UpdateType (__changed__)
  * Old: Mutable
  * New: Conditional
* AWS::SSM::Association ApplyOnlyAtCronInterval (__added__)
* AWS::SageMaker::EndpointConfig DataCaptureConfig (__added__)
* AWS::ServiceCatalog::CloudFormationProvisionedProduct NotificationArns.DuplicatesAllowed (__added__)
* AWS::ServiceDiscovery::HttpNamespace Tags.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::ServiceDiscovery::PrivateDnsNamespace Tags.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::ServiceDiscovery::PublicDnsNamespace Tags.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::ServiceDiscovery::Service Tags.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::Synthetics::Canary RunConfig.Required (__changed__)
  * Old: true
  * New: false

## Property Type Changes

* AWS::CodeBuild::Project.BuildStatusConfig (__added__)
* AWS::Elasticsearch::Domain.AdvancedSecurityOptionsInput (__added__)
* AWS::Elasticsearch::Domain.DomainEndpointOptions (__added__)
* AWS::Elasticsearch::Domain.MasterUserOptions (__added__)
* AWS::Lambda::Function.FileSystemConfig (__added__)
* AWS::SageMaker::EndpointConfig.CaptureContentTypeHeader (__added__)
* AWS::SageMaker::EndpointConfig.CaptureOption (__added__)
* AWS::SageMaker::EndpointConfig.DataCaptureConfig (__added__)
* AWS::WAFv2::RuleGroup.ForwardedIPConfiguration (__added__)
* AWS::WAFv2::RuleGroup.IPSetForwardedIPConfiguration (__added__)
* AWS::WAFv2::WebACL.ForwardedIPConfiguration (__added__)
* AWS::WAFv2::WebACL.IPSetForwardedIPConfiguration (__added__)
* AWS::CodeBuild::Project.Source BuildStatusConfig (__added__)
* AWS::FSx::FileSystem.LustreConfiguration AutomaticBackupRetentionDays (__added__)
* AWS::FSx::FileSystem.LustreConfiguration CopyTagsToBackups (__added__)
* AWS::FSx::FileSystem.LustreConfiguration DailyAutomaticBackupStartTime (__added__)
* AWS::FSx::FileSystem.WindowsConfiguration ThroughputCapacity.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::SageMaker::Model.ContainerDefinition ModelPackageName (__added__)
* AWS::SageMaker::Model.ContainerDefinition Image.Required (__changed__)
  * Old: true
  * New: false
* AWS::ServiceCatalog::CloudFormationProvisionedProduct.ProvisioningParameter Key.Required (__changed__)
  * Old: false
  * New: true
* AWS::ServiceCatalog::CloudFormationProvisionedProduct.ProvisioningParameter Value.Required (__changed__)
  * Old: false
  * New: true
* AWS::ServiceCatalog::CloudFormationProvisionedProduct.ProvisioningPreferences StackSetAccounts.DuplicatesAllowed (__added__)
* AWS::ServiceCatalog::CloudFormationProvisionedProduct.ProvisioningPreferences StackSetRegions.DuplicatesAllowed (__added__)
* AWS::Synthetics::Canary.RunConfig MemoryInMB (__added__)
* AWS::Synthetics::Canary.Schedule DurationInSeconds.Required (__changed__)
  * Old: true
  * New: false
* AWS::WAFv2::RuleGroup.GeoMatchStatement ForwardedIPConfig (__added__)
* AWS::WAFv2::RuleGroup.IPSetReferenceStatement IPSetForwardedIPConfig (__added__)
* AWS::WAFv2::RuleGroup.RateBasedStatementOne ForwardedIPConfig (__added__)
* AWS::WAFv2::RuleGroup.RateBasedStatementTwo ForwardedIPConfig (__added__)
* AWS::WAFv2::WebACL.GeoMatchStatement ForwardedIPConfig (__added__)
* AWS::WAFv2::WebACL.IPSetReferenceStatement IPSetForwardedIPConfig (__added__)
* AWS::WAFv2::WebACL.RateBasedStatementOne ForwardedIPConfig (__added__)
* AWS::WAFv2::WebACL.RateBasedStatementTwo ForwardedIPConfig (__added__)


# CloudFormation Resource Specification v16.0.0

## New Resource Types

* AWS::AppConfig::HostedConfigurationVersion
* AWS::ECS::CapacityProvider

## Removed Resource Types

* AWS::EC2::PrefixList

## Attribute Changes

* AWS::EC2::FlowLog Id (__added__)

## Property Changes

* AWS::ECS::Cluster CapacityProviders (__added__)
* AWS::ECS::Cluster DefaultCapacityProviderStrategy (__added__)
* AWS::SSM::MaintenanceWindow ScheduleOffset (__added__)
* AWS::SSM::MaintenanceWindowTask TaskType.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::ServiceDiscovery::HttpNamespace Tags (__added__)
* AWS::ServiceDiscovery::PrivateDnsNamespace Tags (__added__)
* AWS::ServiceDiscovery::PublicDnsNamespace Tags (__added__)
* AWS::ServiceDiscovery::Service Tags (__added__)
* AWS::WAFv2::WebACLAssociation ResourceArn.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::WAFv2::WebACLAssociation WebACLArn.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable

## Property Type Changes

* AWS::AppMesh::Route.GrpcTimeout (__added__)
* AWS::AppMesh::Route.HttpTimeout (__added__)
* AWS::AppMesh::Route.TcpTimeout (__added__)
* AWS::AppMesh::VirtualNode.Duration (__added__)
* AWS::AppMesh::VirtualNode.GrpcTimeout (__added__)
* AWS::AppMesh::VirtualNode.HttpTimeout (__added__)
* AWS::AppMesh::VirtualNode.ListenerTimeout (__added__)
* AWS::AppMesh::VirtualNode.TcpTimeout (__added__)
* AWS::ECS::Cluster.CapacityProviderStrategyItem (__added__)
* AWS::AppMesh::Route.GrpcRoute Timeout (__added__)
* AWS::AppMesh::Route.HttpRoute Timeout (__added__)
* AWS::AppMesh::Route.TcpRoute Timeout (__added__)
* AWS::AppMesh::VirtualNode.Listener Timeout (__added__)
* AWS::FMS::Policy.IEMap ORGUNIT (__added__)

# Serverless Application Model (SAM) Resource Specification v2016-10-31

## New Resource Types


## Attribute Changes


## Property Changes

* AWS::Serverless::Api OpenApiVersion (__added__)

## Property Type Changes

* AWS::Serverless::Function.EventBridgeRuleEvent (__added__)
* AWS::Serverless::Function.EventSource Properties.Types (__changed__)
  * Added EventBridgeRuleEvent

# CloudFormation Resource Specification v15.1.0

## New Resource Types

* AWS::EC2::PrefixList
* AWS::EFS::AccessPoint
* AWS::IoT::ProvisioningTemplate
* AWS::RDS::DBProxy
* AWS::RDS::DBProxyTargetGroup

## Attribute Changes

* AWS::Chatbot::SlackChannelConfiguration Arn (__added__)
* AWS::EFS::FileSystem FileSystemId (__added__)
* AWS::ElastiCache::ReplicationGroup ReaderEndPoint.Address (__added__)
* AWS::ElastiCache::ReplicationGroup ReaderEndPoint.Port (__added__)
* AWS::ImageBuilder::Image OutputResources (__deleted__)

## Property Changes

* AWS::CertificateManager::Certificate CertificateAuthorityArn (__added__)
* AWS::CertificateManager::Certificate CertificateTransparencyLoggingPreference (__added__)
* AWS::Chatbot::SlackChannelConfiguration Arn (__deleted__)
* AWS::CodeGuruProfiler::ProfilingGroup AgentPermissions (__added__)
* AWS::DynamoDB::Table SSESpecification.UpdateType (__changed__)
  * Old: Conditional
  * New: Mutable
* AWS::EC2::Volume OutpostArn (__added__)
* AWS::EFS::FileSystem FileSystemPolicy (__added__)
* AWS::EFS::FileSystem LifecyclePolicies.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-efs-filesystem.html#cfn-elasticfilesystem-filesystem-lifecyclepolicies
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-efs-filesystem.html#cfn-efs-filesystem-lifecyclepolicies
* AWS::EFS::FileSystem ProvisionedThroughputInMibps.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-efs-filesystem.html#cfn-elasticfilesystem-filesystem-provisionedthroughputinmibps
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-efs-filesystem.html#cfn-efs-filesystem-provisionedthroughputinmibps
* AWS::EFS::FileSystem ThroughputMode.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-efs-filesystem.html#cfn-elasticfilesystem-filesystem-throughputmode
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-efs-filesystem.html#cfn-efs-filesystem-throughputmode
* AWS::ElastiCache::ReplicationGroup MultiAZEnabled (__added__)
* AWS::MSK::Cluster ConfigurationInfo.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::MSK::Cluster KafkaVersion.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::RDS::DBInstance MultiAZ.UpdateType (__changed__)
  * Old: Mutable
  * New: Conditional
* AWS::SNS::Topic ContentBasedDeduplication (__added__)
* AWS::SNS::Topic FifoTopic (__added__)

## Property Type Changes

* AWS::EC2::ClientVpnEndpoint.FederatedAuthenticationRequest (__added__)
* AWS::Events::Rule.HttpParameters (__added__)
* AWS::KinesisFirehose::DeliveryStream.RedshiftRetryOptions (__added__)
* AWS::KinesisFirehose::DeliveryStream.VpcConfiguration (__added__)
* AWS::S3::Bucket.DeleteMarkerReplication (__added__)
* AWS::S3::Bucket.Metrics (__added__)
* AWS::S3::Bucket.ReplicationRuleAndOperator (__added__)
* AWS::S3::Bucket.ReplicationRuleFilter (__added__)
* AWS::S3::Bucket.ReplicationTime (__added__)
* AWS::S3::Bucket.ReplicationTimeValue (__added__)
* AWS::CertificateManager::Certificate.DomainValidationOption HostedZoneId (__added__)
* AWS::CertificateManager::Certificate.DomainValidationOption ValidationDomain.Required (__changed__)
  * Old: true
  * New: false
* AWS::CloudFront::Distribution.Origin ConnectionAttempts (__added__)
* AWS::CloudFront::Distribution.Origin ConnectionTimeout (__added__)
* AWS::CloudWatch::Alarm.MetricDataQuery Period (__added__)
* AWS::EC2::ClientVpnEndpoint.ClientAuthenticationRequest FederatedAuthentication (__added__)
* AWS::ECS::TaskDefinition.InferenceAccelerator DevicePolicy (__deleted__)
* AWS::EFS::FileSystem.ElasticFileSystemTag Key.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-efs-filesystem-filesystemtags.html#cfn-efs-filesystem-filesystemtags-key
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-efs-filesystem-elasticfilesystemtag.html#cfn-efs-filesystem-elasticfilesystemtag-key
* AWS::EFS::FileSystem.ElasticFileSystemTag Value.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-efs-filesystem-filesystemtags.html#cfn-efs-filesystem-filesystemtags-value
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-efs-filesystem-elasticfilesystemtag.html#cfn-efs-filesystem-elasticfilesystemtag-value
* AWS::EFS::FileSystem.LifecyclePolicy TransitionToIA.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-elasticfilesystem-filesystem-lifecyclepolicy.html#cfn-elasticfilesystem-filesystem-lifecyclepolicy-transitiontoia
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-efs-filesystem-lifecyclepolicy.html#cfn-efs-filesystem-lifecyclepolicy-transitiontoia
* AWS::ElasticLoadBalancingV2::LoadBalancer.SubnetMapping PrivateIPv4Address (__added__)
* AWS::ElasticLoadBalancingV2::LoadBalancer.SubnetMapping AllocationId.Required (__changed__)
  * Old: true
  * New: false
* AWS::Events::Rule.Target HttpParameters (__added__)
* AWS::KinesisFirehose::DeliveryStream.BufferingHints IntervalInSeconds.Required (__changed__)
  * Old: true
  * New: false
* AWS::KinesisFirehose::DeliveryStream.BufferingHints SizeInMBs.Required (__changed__)
  * Old: true
  * New: false
* AWS::KinesisFirehose::DeliveryStream.DataFormatConversionConfiguration Enabled.Required (__changed__)
  * Old: true
  * New: false
* AWS::KinesisFirehose::DeliveryStream.DataFormatConversionConfiguration InputFormatConfiguration.Required (__changed__)
  * Old: true
  * New: false
* AWS::KinesisFirehose::DeliveryStream.DataFormatConversionConfiguration OutputFormatConfiguration.Required (__changed__)
  * Old: true
  * New: false
* AWS::KinesisFirehose::DeliveryStream.DataFormatConversionConfiguration SchemaConfiguration.Required (__changed__)
  * Old: true
  * New: false
* AWS::KinesisFirehose::DeliveryStream.ElasticsearchBufferingHints IntervalInSeconds.Required (__changed__)
  * Old: true
  * New: false
* AWS::KinesisFirehose::DeliveryStream.ElasticsearchBufferingHints SizeInMBs.Required (__changed__)
  * Old: true
  * New: false
* AWS::KinesisFirehose::DeliveryStream.ElasticsearchDestinationConfiguration ClusterEndpoint (__added__)
* AWS::KinesisFirehose::DeliveryStream.ElasticsearchDestinationConfiguration VpcConfiguration (__added__)
* AWS::KinesisFirehose::DeliveryStream.ElasticsearchDestinationConfiguration BufferingHints.Required (__changed__)
  * Old: true
  * New: false
* AWS::KinesisFirehose::DeliveryStream.ElasticsearchDestinationConfiguration DomainARN.Required (__changed__)
  * Old: true
  * New: false
* AWS::KinesisFirehose::DeliveryStream.ElasticsearchDestinationConfiguration IndexRotationPeriod.Required (__changed__)
  * Old: true
  * New: false
* AWS::KinesisFirehose::DeliveryStream.ElasticsearchDestinationConfiguration RetryOptions.Required (__changed__)
  * Old: true
  * New: false
* AWS::KinesisFirehose::DeliveryStream.ElasticsearchDestinationConfiguration S3BackupMode.Required (__changed__)
  * Old: true
  * New: false
* AWS::KinesisFirehose::DeliveryStream.ElasticsearchDestinationConfiguration TypeName.Required (__changed__)
  * Old: true
  * New: false
* AWS::KinesisFirehose::DeliveryStream.ElasticsearchRetryOptions DurationInSeconds.Required (__changed__)
  * Old: true
  * New: false
* AWS::KinesisFirehose::DeliveryStream.ExtendedS3DestinationConfiguration BufferingHints.Required (__changed__)
  * Old: true
  * New: false
* AWS::KinesisFirehose::DeliveryStream.ExtendedS3DestinationConfiguration CompressionFormat.Required (__changed__)
  * Old: true
  * New: false
* AWS::KinesisFirehose::DeliveryStream.InputFormatConfiguration Deserializer.Required (__changed__)
  * Old: true
  * New: false
* AWS::KinesisFirehose::DeliveryStream.OpenXJsonSerDe ColumnToJsonKeyMappings.DuplicatesAllowed (__deleted__)
* AWS::KinesisFirehose::DeliveryStream.OutputFormatConfiguration Serializer.Required (__changed__)
  * Old: true
  * New: false
* AWS::KinesisFirehose::DeliveryStream.Processor Parameters.Required (__changed__)
  * Old: true
  * New: false
* AWS::KinesisFirehose::DeliveryStream.RedshiftDestinationConfiguration RetryOptions (__added__)
* AWS::KinesisFirehose::DeliveryStream.RedshiftDestinationConfiguration S3BackupConfiguration (__added__)
* AWS::KinesisFirehose::DeliveryStream.RedshiftDestinationConfiguration S3BackupMode (__added__)
* AWS::KinesisFirehose::DeliveryStream.S3DestinationConfiguration BufferingHints.Required (__changed__)
  * Old: true
  * New: false
* AWS::KinesisFirehose::DeliveryStream.S3DestinationConfiguration CompressionFormat.Required (__changed__)
  * Old: true
  * New: false
* AWS::KinesisFirehose::DeliveryStream.SchemaConfiguration CatalogId.Required (__changed__)
  * Old: true
  * New: false
* AWS::KinesisFirehose::DeliveryStream.SchemaConfiguration DatabaseName.Required (__changed__)
  * Old: true
  * New: false
* AWS::KinesisFirehose::DeliveryStream.SchemaConfiguration Region.Required (__changed__)
  * Old: true
  * New: false
* AWS::KinesisFirehose::DeliveryStream.SchemaConfiguration RoleARN.Required (__changed__)
  * Old: true
  * New: false
* AWS::KinesisFirehose::DeliveryStream.SchemaConfiguration TableName.Required (__changed__)
  * Old: true
  * New: false
* AWS::KinesisFirehose::DeliveryStream.SchemaConfiguration VersionId.Required (__changed__)
  * Old: true
  * New: false
* AWS::KinesisFirehose::DeliveryStream.SplunkRetryOptions DurationInSeconds.Required (__changed__)
  * Old: true
  * New: false
* AWS::MSK::Cluster.ConfigurationInfo Arn.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::MSK::Cluster.ConfigurationInfo Revision.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::S3::Bucket.ReplicationDestination Metrics (__added__)
* AWS::S3::Bucket.ReplicationDestination ReplicationTime (__added__)
* AWS::S3::Bucket.ReplicationRule DeleteMarkerReplication (__added__)
* AWS::S3::Bucket.ReplicationRule Filter (__added__)
* AWS::S3::Bucket.ReplicationRule Priority (__added__)
* AWS::S3::Bucket.ReplicationRule Prefix.Required (__changed__)
  * Old: true
  * New: false


# CloudFormation Resource Specification v14.4.0

## New Resource Types

* AWS::GlobalAccelerator::Accelerator
* AWS::GlobalAccelerator::EndpointGroup
* AWS::GlobalAccelerator::Listener
* AWS::ImageBuilder::Component
* AWS::ImageBuilder::DistributionConfiguration
* AWS::ImageBuilder::Image
* AWS::ImageBuilder::ImagePipeline
* AWS::ImageBuilder::ImageRecipe
* AWS::ImageBuilder::InfrastructureConfiguration
* AWS::Macie::CustomDataIdentifier
* AWS::Macie::FindingsFilter
* AWS::Macie::Session

## Attribute Changes

* AWS::Athena::NamedQuery NamedQueryId (__added__)
* AWS::SSM::Association AssociationId (__added__)

## Property Changes

* AWS::Cloud9::EnvironmentEC2 ConnectionType (__added__)
* AWS::CodeStarConnections::Connection Tags (__added__)
* AWS::DMS::Endpoint NeptuneSettings (__added__)
* AWS::DMS::ReplicationTask TaskData (__added__)
* AWS::ECS::Cluster ClusterSettings.DuplicatesAllowed (__deleted__)
* AWS::ECS::Cluster ClusterSettings.ItemType (__changed__)
  * Old: ClusterSetting
  * New: ClusterSettings
* AWS::ECS::Cluster Tags.DuplicatesAllowed (__deleted__)
* AWS::Neptune::DBCluster RestoreToTime (__added__)
* AWS::Neptune::DBCluster RestoreType (__added__)
* AWS::Neptune::DBCluster SourceDBClusterIdentifier (__added__)
* AWS::Neptune::DBCluster UseLatestRestorableTime (__added__)
* AWS::SSM::Association AutomationTargetParameterName (__added__)
* AWS::SSM::Association ComplianceSeverity (__added__)
* AWS::SSM::Association MaxConcurrency (__added__)
* AWS::SSM::Association MaxErrors (__added__)
* AWS::SSM::Association SyncCompliance (__added__)
* AWS::SSM::Association WaitForSuccessTimeoutSeconds (__added__)
* AWS::SSM::Association InstanceId.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::SSM::Association Name.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::SSM::Association Parameters.DuplicatesAllowed (__deleted__)
* AWS::SSM::Association Targets.DuplicatesAllowed (__deleted__)
* AWS::SSM::Association Targets.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::SSM::Parameter DataType (__added__)
* AWS::ServiceCatalog::CloudFormationProduct ReplaceProvisioningArtifacts (__added__)
* AWS::StepFunctions::StateMachine DefinitionS3Location (__added__)
* AWS::StepFunctions::StateMachine DefinitionSubstitutions (__added__)
* AWS::StepFunctions::StateMachine DefinitionString.Required (__changed__)
  * Old: true
  * New: false
* AWS::Synthetics::Canary RunConfig.Required (__changed__)
  * Old: false
  * New: true

## Property Type Changes

* AWS::EC2::LaunchTemplate.CapacityReservationPreference (__removed__)
* AWS::ECS::Cluster.ClusterSetting (__removed__)
* AWS::SSM::Association.ParameterValues (__removed__)
* AWS::DMS::Endpoint.NeptuneSettings (__added__)
* AWS::ECS::Cluster.ClusterSettings (__added__)
* AWS::StepFunctions::StateMachine.DefinitionSubstitutions (__added__)
* AWS::StepFunctions::StateMachine.S3Location (__added__)
* AWS::DLM::LifecyclePolicy.CreateRule CronExpression (__added__)
* AWS::DLM::LifecyclePolicy.CreateRule Interval.Required (__changed__)
  * Old: true
  * New: false
* AWS::DLM::LifecyclePolicy.CreateRule IntervalUnit.Required (__changed__)
  * Old: true
  * New: false
* AWS::DLM::LifecyclePolicy.CrossRegionCopyRetainRule Interval.Required (__changed__)
  * Old: false
  * New: true
* AWS::DLM::LifecyclePolicy.CrossRegionCopyRetainRule IntervalUnit.Required (__changed__)
  * Old: false
  * New: true
* AWS::DLM::LifecyclePolicy.CrossRegionCopyRule Encrypted.Required (__changed__)
  * Old: false
  * New: true
* AWS::DLM::LifecyclePolicy.CrossRegionCopyRule TargetRegion.Required (__changed__)
  * Old: false
  * New: true
* AWS::EC2::LaunchTemplate.CapacityReservationSpecification CapacityReservationPreference.Type (__deleted__)
* AWS::EC2::LaunchTemplate.CapacityReservationSpecification CapacityReservationPreference.PrimitiveType (__added__)
* AWS::SSM::Association.S3OutputLocation OutputS3Region (__added__)
* AWS::SSM::Association.Target Key.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::SSM::Association.Target Values.DuplicatesAllowed (__deleted__)
* AWS::SSM::Association.Target Values.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable


# CloudFormation Resource Specification v14.1.0

## New Resource Types

* AWS::EventSchemas::RegistryPolicy

## Attribute Changes

* AWS::Synthetics::Canary Name (__deleted__)

## Property Changes

* AWS::MediaStore::Container MetricPolicy (__added__)
* AWS::MediaStore::Container Tags (__added__)
* AWS::Synthetics::Canary Name (__added__)

## Property Type Changes

* AWS::IoTEvents::DetectorModel.AssetPropertyTimestamp (__added__)
* AWS::IoTEvents::DetectorModel.AssetPropertyValue (__added__)
* AWS::IoTEvents::DetectorModel.AssetPropertyVariant (__added__)
* AWS::IoTEvents::DetectorModel.DynamoDB (__added__)
* AWS::IoTEvents::DetectorModel.DynamoDBv2 (__added__)
* AWS::IoTEvents::DetectorModel.IotSiteWise (__added__)
* AWS::IoTEvents::DetectorModel.Payload (__added__)
* AWS::MediaStore::Container.MetricPolicy (__added__)
* AWS::MediaStore::Container.MetricPolicyRule (__added__)
* AWS::IoTEvents::DetectorModel.Action DynamoDB (__added__)
* AWS::IoTEvents::DetectorModel.Action DynamoDBv2 (__added__)
* AWS::IoTEvents::DetectorModel.Action IotSiteWise (__added__)
* AWS::IoTEvents::DetectorModel.Firehose Payload (__added__)
* AWS::IoTEvents::DetectorModel.IotEvents Payload (__added__)
* AWS::IoTEvents::DetectorModel.IotTopicPublish Payload (__added__)
* AWS::IoTEvents::DetectorModel.Lambda Payload (__added__)
* AWS::IoTEvents::DetectorModel.Sns Payload (__added__)
* AWS::IoTEvents::DetectorModel.Sqs Payload (__added__)


# CloudFormation Resource Specification v14.0.0

## New Resource Types

* AWS::CE::CostCategory
* AWS::Synthetics::Canary

## Attribute Changes

* AWS::FSx::FileSystem LustreMountName (__added__)

## Property Changes

* AWS::ResourceGroups::Group Tags.ItemType (__changed__)
  * Old: Json
  * New: Tag
* AWS::StepFunctions::StateMachine TracingConfiguration (__deleted__)
* AWS::Transfer::Server Certificate (__added__)
* AWS::Transfer::Server Protocols (__added__)

## Property Type Changes

* AWS::StepFunctions::StateMachine.TracingConfiguration (__removed__)
* AWS::Transfer::Server.Protocol (__added__)
* AWS::WAFv2::RuleGroup.ByteMatchStatement SearchString.Required (__changed__)
  * Old: true
  * New: false
* AWS::WAFv2::WebACL.ByteMatchStatement SearchString.Required (__changed__)
  * Old: true
  * New: false


# CloudFormation Resource Specification v13.0.0

## New Resource Types


## Removed Resource Types

* AWS::ImageBuilder::Component
* AWS::ImageBuilder::DistributionConfiguration
* AWS::ImageBuilder::ImagePipeline
* AWS::ImageBuilder::ImageRecipe
* AWS::ImageBuilder::InfrastructureConfiguration

## Attribute Changes


## Property Changes

* AWS::DocDB::DBCluster DeletionProtection (__added__)
* AWS::MediaConvert::JobTemplate HopDestinations (__added__)

## Property Type Changes

* AWS::LakeFormation::Permissions.ColumnWildcard (__added__)
* AWS::LakeFormation::Permissions.DataLocationResource (__added__)
* AWS::LakeFormation::Permissions.TableWithColumnsResource (__added__)
* AWS::MediaConvert::JobTemplate.HopDestination (__added__)
* AWS::SSM::PatchBaseline.PatchStringDate (__added__)
* AWS::LakeFormation::Permissions.Resource DataLocationResource (__added__)
* AWS::LakeFormation::Permissions.Resource TableWithColumnsResource (__added__)
* AWS::SSM::PatchBaseline.Rule ApproveUntilDate (__added__)


# CloudFormation Resource Specification v12.3.0

## New Resource Types

* AWS::ImageBuilder::Component
* AWS::ImageBuilder::DistributionConfiguration
* AWS::ImageBuilder::ImagePipeline
* AWS::ImageBuilder::ImageRecipe
* AWS::ImageBuilder::InfrastructureConfiguration

## Attribute Changes


## Property Changes

* AWS::Glue::DevEndpoint PublicKeys (__added__)
* AWS::Glue::MLTransform Tags (__added__)

## Property Type Changes



# CloudFormation Resource Specification v12.2.0

## New Resource Types

* AWS::Detective::Graph
* AWS::Detective::MemberInvitation

## Attribute Changes


## Property Changes

* AWS::CloudWatch::InsightRule Tags (__added__)
* AWS::CodeBuild::ReportGroup Tags (__added__)
* AWS::FSx::FileSystem StorageType (__added__)
* AWS::KinesisAnalyticsV2::Application Tags (__added__)
* AWS::StepFunctions::StateMachine TracingConfiguration (__added__)

## Property Type Changes

* AWS::EC2::EC2Fleet.TagRequest (__removed__)
* AWS::CloudWatch::InsightRule.Tags (__added__)
* AWS::EC2::EC2Fleet.CapacityReservationOptionsRequest (__added__)
* AWS::EC2::EC2Fleet.Placement (__added__)
* AWS::StepFunctions::StateMachine.TracingConfiguration (__added__)
* AWS::Batch::JobDefinition.ContainerProperties Memory.Required (__changed__)
  * Old: true
  * New: false
* AWS::Batch::JobDefinition.ContainerProperties Vcpus.Required (__changed__)
  * Old: true
  * New: false
* AWS::EC2::EC2Fleet.FleetLaunchTemplateConfigRequest LaunchTemplateSpecification.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::EC2::EC2Fleet.FleetLaunchTemplateConfigRequest Overrides.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::EC2::EC2Fleet.FleetLaunchTemplateOverridesRequest Placement (__added__)
* AWS::EC2::EC2Fleet.FleetLaunchTemplateOverridesRequest AvailabilityZone.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::EC2::EC2Fleet.FleetLaunchTemplateOverridesRequest InstanceType.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::EC2::EC2Fleet.FleetLaunchTemplateOverridesRequest MaxPrice.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::EC2::EC2Fleet.FleetLaunchTemplateOverridesRequest Priority.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::EC2::EC2Fleet.FleetLaunchTemplateOverridesRequest SubnetId.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::EC2::EC2Fleet.FleetLaunchTemplateOverridesRequest WeightedCapacity.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::EC2::EC2Fleet.FleetLaunchTemplateSpecificationRequest LaunchTemplateId.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::EC2::EC2Fleet.FleetLaunchTemplateSpecificationRequest LaunchTemplateName.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::EC2::EC2Fleet.FleetLaunchTemplateSpecificationRequest Version.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::EC2::EC2Fleet.OnDemandOptionsRequest CapacityReservationOptions (__added__)
* AWS::EC2::EC2Fleet.OnDemandOptionsRequest MaxTotalPrice (__added__)
* AWS::EC2::EC2Fleet.OnDemandOptionsRequest MinTargetCapacity (__added__)
* AWS::EC2::EC2Fleet.OnDemandOptionsRequest SingleAvailabilityZone (__added__)
* AWS::EC2::EC2Fleet.OnDemandOptionsRequest SingleInstanceType (__added__)
* AWS::EC2::EC2Fleet.OnDemandOptionsRequest AllocationStrategy.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::EC2::EC2Fleet.SpotOptionsRequest MaxTotalPrice (__added__)
* AWS::EC2::EC2Fleet.SpotOptionsRequest MinTargetCapacity (__added__)
* AWS::EC2::EC2Fleet.SpotOptionsRequest SingleAvailabilityZone (__added__)
* AWS::EC2::EC2Fleet.SpotOptionsRequest SingleInstanceType (__added__)
* AWS::EC2::EC2Fleet.SpotOptionsRequest AllocationStrategy.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::EC2::EC2Fleet.SpotOptionsRequest InstanceInterruptionBehavior.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::EC2::EC2Fleet.SpotOptionsRequest InstancePoolsToUseCount.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::EC2::EC2Fleet.TagSpecification ResourceType.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::EC2::EC2Fleet.TagSpecification Tags.ItemType (__changed__)
  * Old: TagRequest
  * New: Tag
* AWS::EC2::EC2Fleet.TagSpecification Tags.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable
* AWS::IoTEvents::DetectorModel.SetTimer DurationExpression (__added__)


# CloudFormation Resource Specification v12.0.0

## New Resource Types


## Attribute Changes


## Property Changes

* AWS::ApiGatewayV2::Integration ConnectionId (__added__)
* AWS::AutoScaling::AutoScalingGroup MaxInstanceLifetime (__added__)
* AWS::EC2::Volume MultiAttachEnabled (__added__)

## Property Type Changes

* AWS::IoT::TopicRule.AssetPropertyTimestamp (__added__)
* AWS::IoT::TopicRule.AssetPropertyValue (__added__)
* AWS::IoT::TopicRule.AssetPropertyVariant (__added__)
* AWS::IoT::TopicRule.HttpAction (__added__)
* AWS::IoT::TopicRule.HttpActionHeader (__added__)
* AWS::IoT::TopicRule.HttpAuthorization (__added__)
* AWS::IoT::TopicRule.IotEventsAction (__added__)
* AWS::IoT::TopicRule.IotSiteWiseAction (__added__)
* AWS::IoT::TopicRule.PutAssetPropertyValueEntry (__added__)
* AWS::IoT::TopicRule.SigV4Authorization (__added__)
* AWS::IoT::TopicRule.Action Http (__added__)
* AWS::IoT::TopicRule.Action IotEvents (__added__)
* AWS::IoT::TopicRule.Action IotSiteWise (__added__)
* AWS::IoT::TopicRule.RepublishAction Qos (__added__)


# CloudFormation Resource Specification v11.6.0

## New Resource Types

* AWS::Cassandra::Keyspace
* AWS::Cassandra::Table
* AWS::CodeGuruProfiler::ProfilingGroup
* AWS::NetworkManager::CustomerGatewayAssociation
* AWS::NetworkManager::Device
* AWS::NetworkManager::GlobalNetwork
* AWS::NetworkManager::Link
* AWS::NetworkManager::LinkAssociation
* AWS::NetworkManager::Site
* AWS::NetworkManager::TransitGatewayRegistration
* AWS::ResourceGroups::Group

## Attribute Changes

* AWS::AppMesh::Mesh MeshOwner.PrimitiveType (__added__)
* AWS::AppMesh::Mesh ResourceOwner.PrimitiveType (__added__)
* AWS::AppMesh::Route MeshOwner.PrimitiveType (__added__)
* AWS::AppMesh::Route ResourceOwner.PrimitiveType (__added__)
* AWS::AppMesh::VirtualNode MeshOwner.PrimitiveType (__added__)
* AWS::AppMesh::VirtualNode ResourceOwner.PrimitiveType (__added__)
* AWS::AppMesh::VirtualRouter MeshOwner.PrimitiveType (__added__)
* AWS::AppMesh::VirtualRouter ResourceOwner.PrimitiveType (__added__)
* AWS::AppMesh::VirtualService MeshOwner.PrimitiveType (__added__)
* AWS::AppMesh::VirtualService ResourceOwner.PrimitiveType (__added__)

## Property Changes

* AWS::ApiGatewayV2::Integration TlsConfig (__added__)
* AWS::AppMesh::Route MeshOwner (__added__)
* AWS::AppMesh::VirtualNode MeshOwner (__added__)
* AWS::AppMesh::VirtualRouter MeshOwner (__added__)
* AWS::AppMesh::VirtualService MeshOwner (__added__)
* AWS::DMS::Endpoint KafkaSettings (__added__)
* AWS::EC2::ClientVpnEndpoint SecurityGroupIds (__added__)
* AWS::EC2::ClientVpnEndpoint VpcId (__added__)
* AWS::MSK::Cluster LoggingInfo (__added__)
* AWS::ServiceCatalog::LaunchRoleConstraint LocalRoleName (__added__)
* AWS::ServiceCatalog::LaunchRoleConstraint RoleArn.Required (__changed__)
  * Old: true
  * New: false

## Property Type Changes

* AWS::ApiGatewayV2::Integration.TlsConfig (__added__)
* AWS::CloudFront::Distribution.OriginGroup (__added__)
* AWS::CloudFront::Distribution.OriginGroupFailoverCriteria (__added__)
* AWS::CloudFront::Distribution.OriginGroupMember (__added__)
* AWS::CloudFront::Distribution.OriginGroupMembers (__added__)
* AWS::CloudFront::Distribution.OriginGroups (__added__)
* AWS::CloudFront::Distribution.StatusCodes (__added__)
* AWS::DMS::Endpoint.KafkaSettings (__added__)
* AWS::MSK::Cluster.BrokerLogs (__added__)
* AWS::MSK::Cluster.CloudWatchLogs (__added__)
* AWS::MSK::Cluster.Firehose (__added__)
* AWS::MSK::Cluster.LoggingInfo (__added__)
* AWS::MSK::Cluster.S3 (__added__)
* AWS::CloudFront::Distribution.DistributionConfig OriginGroups (__added__)
* AWS::CloudFront::Distribution.LambdaFunctionAssociation IncludeBody (__added__)


# CloudFormation Resource Specification v11.4.0

## New Resource Types

* AWS::Athena::WorkGroup
* AWS::Chatbot::SlackChannelConfiguration
* AWS::CodeStarConnections::Connection

## Attribute Changes

* AWS::EKS::Cluster EncryptionConfigKeyArn (__added__)

## Property Changes

* AWS::EKS::Cluster EncryptionConfig (__added__)

## Property Type Changes

* AWS::EKS::Cluster.EncryptionConfig (__added__)
* AWS::EKS::Cluster.Provider (__added__)


# CloudFormation Resource Specification v11.3.0

## New Resource Types

* AWS::CloudWatch::CompositeAlarm

## Attribute Changes

* AWS::AppMesh::Mesh MeshOwner (__added__)
* AWS::AppMesh::Mesh ResourceOwner (__added__)
* AWS::AppMesh::Route MeshOwner (__added__)
* AWS::AppMesh::Route ResourceOwner (__added__)
* AWS::AppMesh::VirtualNode MeshOwner (__added__)
* AWS::AppMesh::VirtualNode ResourceOwner (__added__)
* AWS::AppMesh::VirtualRouter MeshOwner (__added__)
* AWS::AppMesh::VirtualRouter ResourceOwner (__added__)
* AWS::AppMesh::VirtualService MeshOwner (__added__)
* AWS::AppMesh::VirtualService ResourceOwner (__added__)

## Property Changes


## Property Type Changes

* AWS::AppMesh::VirtualNode.BackendDefaults (__added__)
* AWS::AppMesh::VirtualNode.ClientPolicy (__added__)
* AWS::AppMesh::VirtualNode.ClientPolicyTls (__added__)
* AWS::AppMesh::VirtualNode.ListenerTls (__added__)
* AWS::AppMesh::VirtualNode.ListenerTlsAcmCertificate (__added__)
* AWS::AppMesh::VirtualNode.ListenerTlsCertificate (__added__)
* AWS::AppMesh::VirtualNode.ListenerTlsFileCertificate (__added__)
* AWS::AppMesh::VirtualNode.TlsValidationContext (__added__)
* AWS::AppMesh::VirtualNode.TlsValidationContextAcmTrust (__added__)
* AWS::AppMesh::VirtualNode.TlsValidationContextFileTrust (__added__)
* AWS::AppMesh::VirtualNode.TlsValidationContextTrust (__added__)
* AWS::Greengrass::ResourceDefinition.ResourceDownloadOwnerSetting (__added__)
* AWS::Greengrass::ResourceDefinitionVersion.ResourceDownloadOwnerSetting (__added__)
* AWS::AppMesh::VirtualNode.Listener TLS (__added__)
* AWS::AppMesh::VirtualNode.VirtualNodeSpec BackendDefaults (__added__)
* AWS::AppMesh::VirtualNode.VirtualServiceBackend ClientPolicy (__added__)
* AWS::Greengrass::ResourceDefinition.S3MachineLearningModelResourceData OwnerSetting (__added__)
* AWS::Greengrass::ResourceDefinition.SageMakerMachineLearningModelResourceData OwnerSetting (__added__)
* AWS::Greengrass::ResourceDefinitionVersion.S3MachineLearningModelResourceData OwnerSetting (__added__)
* AWS::Greengrass::ResourceDefinitionVersion.SageMakerMachineLearningModelResourceData OwnerSetting (__added__)

# Serverless Application Model (SAM) Resource Specification v2016-10-31

## New Resource Types


## Attribute Changes


## Property Changes


## Property Type Changes

* AWS::Serverless::Function.CloudWatchLogsEvent (__added__)
* AWS::Serverless::Function.EventSource Properties.Types (__changed__)
  * Added CloudWatchLogsEvent

# CloudFormation Resource Specification v11.1.0

## New Resource Types


## Attribute Changes


## Property Changes

* AWS::CodeBuild::Project FileSystemLocations (__added__)
* AWS::Cognito::UserPool UsernameConfiguration (__added__)
* AWS::Config::AggregationAuthorization Tags (__added__)
* AWS::Config::ConfigurationAggregator Tags (__added__)
* AWS::WAFv2::IPSet Addresses.PrimitiveItemType (__added__)
* AWS::WAFv2::IPSet Addresses.Type (__changed__)
  * Old: IPAddresses
  * New: List
* AWS::WAFv2::IPSet Tags.ItemType (__added__)
* AWS::WAFv2::IPSet Tags.Type (__changed__)
  * Old: TagList
  * New: List
* AWS::WAFv2::RegexPatternSet RegularExpressionList.PrimitiveItemType (__added__)
* AWS::WAFv2::RegexPatternSet RegularExpressionList.Type (__changed__)
  * Old: RegularExpressionList
  * New: List
* AWS::WAFv2::RegexPatternSet Tags.ItemType (__added__)
* AWS::WAFv2::RegexPatternSet Tags.Type (__changed__)
  * Old: TagList
  * New: List
* AWS::WAFv2::RuleGroup Rules.ItemType (__added__)
* AWS::WAFv2::RuleGroup Rules.Type (__changed__)
  * Old: Rules
  * New: List
* AWS::WAFv2::RuleGroup Tags.ItemType (__added__)
* AWS::WAFv2::RuleGroup Tags.Type (__changed__)
  * Old: TagList
  * New: List
* AWS::WAFv2::WebACL Rules.ItemType (__added__)
* AWS::WAFv2::WebACL Rules.Type (__changed__)
  * Old: Rules
  * New: List
* AWS::WAFv2::WebACL Tags.ItemType (__added__)
* AWS::WAFv2::WebACL Tags.Type (__changed__)
  * Old: TagList
  * New: List

## Property Type Changes

* AWS::WAFv2::IPSet.IPAddresses (__removed__)
* AWS::WAFv2::IPSet.TagList (__removed__)
* AWS::WAFv2::RegexPatternSet.Regex (__removed__)
* AWS::WAFv2::RegexPatternSet.RegularExpressionList (__removed__)
* AWS::WAFv2::RegexPatternSet.TagList (__removed__)
* AWS::WAFv2::RuleGroup.AllQueryArguments (__removed__)
* AWS::WAFv2::RuleGroup.AllowAction (__removed__)
* AWS::WAFv2::RuleGroup.BlockAction (__removed__)
* AWS::WAFv2::RuleGroup.Body (__removed__)
* AWS::WAFv2::RuleGroup.CountAction (__removed__)
* AWS::WAFv2::RuleGroup.CountryCodes (__removed__)
* AWS::WAFv2::RuleGroup.Method (__removed__)
* AWS::WAFv2::RuleGroup.QueryString (__removed__)
* AWS::WAFv2::RuleGroup.Rules (__removed__)
* AWS::WAFv2::RuleGroup.SingleHeader (__removed__)
* AWS::WAFv2::RuleGroup.SingleQueryArgument (__removed__)
* AWS::WAFv2::RuleGroup.StatementThrees (__removed__)
* AWS::WAFv2::RuleGroup.StatementTwos (__removed__)
* AWS::WAFv2::RuleGroup.TagList (__removed__)
* AWS::WAFv2::RuleGroup.TextTransformations (__removed__)
* AWS::WAFv2::RuleGroup.UriPath (__removed__)
* AWS::WAFv2::WebACL.AllQueryArguments (__removed__)
* AWS::WAFv2::WebACL.AllowAction (__removed__)
* AWS::WAFv2::WebACL.BlockAction (__removed__)
* AWS::WAFv2::WebACL.Body (__removed__)
* AWS::WAFv2::WebACL.CountAction (__removed__)
* AWS::WAFv2::WebACL.CountryCodes (__removed__)
* AWS::WAFv2::WebACL.ExcludedRules (__removed__)
* AWS::WAFv2::WebACL.Method (__removed__)
* AWS::WAFv2::WebACL.NoneAction (__removed__)
* AWS::WAFv2::WebACL.QueryString (__removed__)
* AWS::WAFv2::WebACL.Rules (__removed__)
* AWS::WAFv2::WebACL.SingleHeader (__removed__)
* AWS::WAFv2::WebACL.SingleQueryArgument (__removed__)
* AWS::WAFv2::WebACL.StatementThrees (__removed__)
* AWS::WAFv2::WebACL.StatementTwos (__removed__)
* AWS::WAFv2::WebACL.TagList (__removed__)
* AWS::WAFv2::WebACL.TextTransformations (__removed__)
* AWS::WAFv2::WebACL.UriPath (__removed__)
* AWS::CodeBuild::Project.ProjectFileSystemLocation (__added__)
* AWS::Cognito::UserPool.UsernameConfiguration (__added__)
* AWS::WAFv2::RuleGroup.AndStatementOne Statements.ItemType (__added__)
* AWS::WAFv2::RuleGroup.AndStatementOne Statements.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.AndStatementOne Statements.Type (__changed__)
  * Old: StatementTwos
  * New: List
* AWS::WAFv2::RuleGroup.AndStatementTwo Statements.ItemType (__added__)
* AWS::WAFv2::RuleGroup.AndStatementTwo Statements.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.AndStatementTwo Statements.Type (__changed__)
  * Old: StatementThrees
  * New: List
* AWS::WAFv2::RuleGroup.ByteMatchStatement FieldToMatch.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.ByteMatchStatement PositionalConstraint.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.ByteMatchStatement SearchString.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.ByteMatchStatement TextTransformations.ItemType (__added__)
* AWS::WAFv2::RuleGroup.ByteMatchStatement TextTransformations.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.ByteMatchStatement TextTransformations.Type (__changed__)
  * Old: TextTransformations
  * New: List
* AWS::WAFv2::RuleGroup.FieldToMatch AllQueryArguments.Type (__deleted__)
* AWS::WAFv2::RuleGroup.FieldToMatch AllQueryArguments.PrimitiveType (__added__)
* AWS::WAFv2::RuleGroup.FieldToMatch Body.Type (__deleted__)
* AWS::WAFv2::RuleGroup.FieldToMatch Body.PrimitiveType (__added__)
* AWS::WAFv2::RuleGroup.FieldToMatch Method.Type (__deleted__)
* AWS::WAFv2::RuleGroup.FieldToMatch Method.PrimitiveType (__added__)
* AWS::WAFv2::RuleGroup.FieldToMatch QueryString.Type (__deleted__)
* AWS::WAFv2::RuleGroup.FieldToMatch QueryString.PrimitiveType (__added__)
* AWS::WAFv2::RuleGroup.FieldToMatch SingleHeader.Type (__deleted__)
* AWS::WAFv2::RuleGroup.FieldToMatch SingleHeader.PrimitiveType (__added__)
* AWS::WAFv2::RuleGroup.FieldToMatch SingleQueryArgument.Type (__deleted__)
* AWS::WAFv2::RuleGroup.FieldToMatch SingleQueryArgument.PrimitiveType (__added__)
* AWS::WAFv2::RuleGroup.FieldToMatch UriPath.Type (__deleted__)
* AWS::WAFv2::RuleGroup.FieldToMatch UriPath.PrimitiveType (__added__)
* AWS::WAFv2::RuleGroup.GeoMatchStatement CountryCodes.PrimitiveItemType (__added__)
* AWS::WAFv2::RuleGroup.GeoMatchStatement CountryCodes.Type (__changed__)
  * Old: CountryCodes
  * New: List
* AWS::WAFv2::RuleGroup.IPSetReferenceStatement Arn.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.NotStatementOne Statement.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.NotStatementTwo Statement.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.OrStatementOne Statements.ItemType (__added__)
* AWS::WAFv2::RuleGroup.OrStatementOne Statements.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.OrStatementOne Statements.Type (__changed__)
  * Old: StatementTwos
  * New: List
* AWS::WAFv2::RuleGroup.OrStatementTwo Statements.ItemType (__added__)
* AWS::WAFv2::RuleGroup.OrStatementTwo Statements.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.OrStatementTwo Statements.Type (__changed__)
  * Old: StatementThrees
  * New: List
* AWS::WAFv2::RuleGroup.RateBasedStatementOne AggregateKeyType.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.RateBasedStatementOne Limit.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.RateBasedStatementTwo AggregateKeyType.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.RateBasedStatementTwo Limit.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.RegexPatternSetReferenceStatement Arn.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.RegexPatternSetReferenceStatement FieldToMatch.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.RegexPatternSetReferenceStatement TextTransformations.ItemType (__added__)
* AWS::WAFv2::RuleGroup.RegexPatternSetReferenceStatement TextTransformations.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.RegexPatternSetReferenceStatement TextTransformations.Type (__changed__)
  * Old: TextTransformations
  * New: List
* AWS::WAFv2::RuleGroup.Rule Name.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.Rule Priority.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.Rule Statement.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.Rule VisibilityConfig.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.RuleAction Allow.Type (__deleted__)
* AWS::WAFv2::RuleGroup.RuleAction Allow.PrimitiveType (__added__)
* AWS::WAFv2::RuleGroup.RuleAction Block.Type (__deleted__)
* AWS::WAFv2::RuleGroup.RuleAction Block.PrimitiveType (__added__)
* AWS::WAFv2::RuleGroup.RuleAction Count.Type (__deleted__)
* AWS::WAFv2::RuleGroup.RuleAction Count.PrimitiveType (__added__)
* AWS::WAFv2::RuleGroup.SizeConstraintStatement ComparisonOperator.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.SizeConstraintStatement FieldToMatch.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.SizeConstraintStatement Size.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.SizeConstraintStatement TextTransformations.ItemType (__added__)
* AWS::WAFv2::RuleGroup.SizeConstraintStatement TextTransformations.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.SizeConstraintStatement TextTransformations.Type (__changed__)
  * Old: TextTransformations
  * New: List
* AWS::WAFv2::RuleGroup.SqliMatchStatement FieldToMatch.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.SqliMatchStatement TextTransformations.ItemType (__added__)
* AWS::WAFv2::RuleGroup.SqliMatchStatement TextTransformations.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.SqliMatchStatement TextTransformations.Type (__changed__)
  * Old: TextTransformations
  * New: List
* AWS::WAFv2::RuleGroup.TextTransformation Priority.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.TextTransformation Type.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.VisibilityConfig CloudWatchMetricsEnabled.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.VisibilityConfig MetricName.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.VisibilityConfig SampledRequestsEnabled.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.XssMatchStatement FieldToMatch.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.XssMatchStatement TextTransformations.ItemType (__added__)
* AWS::WAFv2::RuleGroup.XssMatchStatement TextTransformations.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup.XssMatchStatement TextTransformations.Type (__changed__)
  * Old: TextTransformations
  * New: List
* AWS::WAFv2::WebACL.AndStatementOne Statements.ItemType (__added__)
* AWS::WAFv2::WebACL.AndStatementOne Statements.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.AndStatementOne Statements.Type (__changed__)
  * Old: StatementTwos
  * New: List
* AWS::WAFv2::WebACL.AndStatementTwo Statements.ItemType (__added__)
* AWS::WAFv2::WebACL.AndStatementTwo Statements.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.AndStatementTwo Statements.Type (__changed__)
  * Old: StatementThrees
  * New: List
* AWS::WAFv2::WebACL.ByteMatchStatement FieldToMatch.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.ByteMatchStatement PositionalConstraint.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.ByteMatchStatement SearchString.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.ByteMatchStatement TextTransformations.ItemType (__added__)
* AWS::WAFv2::WebACL.ByteMatchStatement TextTransformations.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.ByteMatchStatement TextTransformations.Type (__changed__)
  * Old: TextTransformations
  * New: List
* AWS::WAFv2::WebACL.DefaultAction Allow.Type (__deleted__)
* AWS::WAFv2::WebACL.DefaultAction Allow.PrimitiveType (__added__)
* AWS::WAFv2::WebACL.DefaultAction Block.Type (__deleted__)
* AWS::WAFv2::WebACL.DefaultAction Block.PrimitiveType (__added__)
* AWS::WAFv2::WebACL.ExcludedRule Name.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.FieldToMatch AllQueryArguments.Type (__deleted__)
* AWS::WAFv2::WebACL.FieldToMatch AllQueryArguments.PrimitiveType (__added__)
* AWS::WAFv2::WebACL.FieldToMatch Body.Type (__deleted__)
* AWS::WAFv2::WebACL.FieldToMatch Body.PrimitiveType (__added__)
* AWS::WAFv2::WebACL.FieldToMatch Method.Type (__deleted__)
* AWS::WAFv2::WebACL.FieldToMatch Method.PrimitiveType (__added__)
* AWS::WAFv2::WebACL.FieldToMatch QueryString.Type (__deleted__)
* AWS::WAFv2::WebACL.FieldToMatch QueryString.PrimitiveType (__added__)
* AWS::WAFv2::WebACL.FieldToMatch SingleHeader.Type (__deleted__)
* AWS::WAFv2::WebACL.FieldToMatch SingleHeader.PrimitiveType (__added__)
* AWS::WAFv2::WebACL.FieldToMatch SingleQueryArgument.Type (__deleted__)
* AWS::WAFv2::WebACL.FieldToMatch SingleQueryArgument.PrimitiveType (__added__)
* AWS::WAFv2::WebACL.FieldToMatch UriPath.Type (__deleted__)
* AWS::WAFv2::WebACL.FieldToMatch UriPath.PrimitiveType (__added__)
* AWS::WAFv2::WebACL.GeoMatchStatement CountryCodes.PrimitiveItemType (__added__)
* AWS::WAFv2::WebACL.GeoMatchStatement CountryCodes.Type (__changed__)
  * Old: CountryCodes
  * New: List
* AWS::WAFv2::WebACL.IPSetReferenceStatement Arn.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.ManagedRuleGroupStatement ExcludedRules.ItemType (__added__)
* AWS::WAFv2::WebACL.ManagedRuleGroupStatement ExcludedRules.Type (__changed__)
  * Old: ExcludedRules
  * New: List
* AWS::WAFv2::WebACL.ManagedRuleGroupStatement Name.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.ManagedRuleGroupStatement VendorName.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.NotStatementOne Statement.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.NotStatementTwo Statement.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.OrStatementOne Statements.ItemType (__added__)
* AWS::WAFv2::WebACL.OrStatementOne Statements.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.OrStatementOne Statements.Type (__changed__)
  * Old: StatementTwos
  * New: List
* AWS::WAFv2::WebACL.OrStatementTwo Statements.ItemType (__added__)
* AWS::WAFv2::WebACL.OrStatementTwo Statements.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.OrStatementTwo Statements.Type (__changed__)
  * Old: StatementThrees
  * New: List
* AWS::WAFv2::WebACL.OverrideAction Count.Type (__deleted__)
* AWS::WAFv2::WebACL.OverrideAction Count.PrimitiveType (__added__)
* AWS::WAFv2::WebACL.OverrideAction None.Type (__deleted__)
* AWS::WAFv2::WebACL.OverrideAction None.PrimitiveType (__added__)
* AWS::WAFv2::WebACL.RateBasedStatementOne AggregateKeyType.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.RateBasedStatementOne Limit.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.RateBasedStatementTwo AggregateKeyType.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.RateBasedStatementTwo Limit.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.RegexPatternSetReferenceStatement Arn.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.RegexPatternSetReferenceStatement FieldToMatch.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.RegexPatternSetReferenceStatement TextTransformations.ItemType (__added__)
* AWS::WAFv2::WebACL.RegexPatternSetReferenceStatement TextTransformations.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.RegexPatternSetReferenceStatement TextTransformations.Type (__changed__)
  * Old: TextTransformations
  * New: List
* AWS::WAFv2::WebACL.Rule Name.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.Rule Priority.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.Rule Statement.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.Rule VisibilityConfig.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.RuleAction Allow.Type (__deleted__)
* AWS::WAFv2::WebACL.RuleAction Allow.PrimitiveType (__added__)
* AWS::WAFv2::WebACL.RuleAction Block.Type (__deleted__)
* AWS::WAFv2::WebACL.RuleAction Block.PrimitiveType (__added__)
* AWS::WAFv2::WebACL.RuleAction Count.Type (__deleted__)
* AWS::WAFv2::WebACL.RuleAction Count.PrimitiveType (__added__)
* AWS::WAFv2::WebACL.RuleGroupReferenceStatement Arn.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.RuleGroupReferenceStatement ExcludedRules.ItemType (__added__)
* AWS::WAFv2::WebACL.RuleGroupReferenceStatement ExcludedRules.Type (__changed__)
  * Old: ExcludedRules
  * New: List
* AWS::WAFv2::WebACL.SizeConstraintStatement ComparisonOperator.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.SizeConstraintStatement FieldToMatch.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.SizeConstraintStatement Size.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.SizeConstraintStatement TextTransformations.ItemType (__added__)
* AWS::WAFv2::WebACL.SizeConstraintStatement TextTransformations.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.SizeConstraintStatement TextTransformations.Type (__changed__)
  * Old: TextTransformations
  * New: List
* AWS::WAFv2::WebACL.SqliMatchStatement FieldToMatch.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.SqliMatchStatement TextTransformations.ItemType (__added__)
* AWS::WAFv2::WebACL.SqliMatchStatement TextTransformations.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.SqliMatchStatement TextTransformations.Type (__changed__)
  * Old: TextTransformations
  * New: List
* AWS::WAFv2::WebACL.TextTransformation Priority.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.TextTransformation Type.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.VisibilityConfig CloudWatchMetricsEnabled.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.VisibilityConfig MetricName.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.VisibilityConfig SampledRequestsEnabled.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.XssMatchStatement FieldToMatch.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.XssMatchStatement TextTransformations.ItemType (__added__)
* AWS::WAFv2::WebACL.XssMatchStatement TextTransformations.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL.XssMatchStatement TextTransformations.Type (__changed__)
  * Old: TextTransformations
  * New: List


# CloudFormation Resource Specification v11.0.0

## New Resource Types

* AWS::Config::ConformancePack
* AWS::Config::OrganizationConformancePack
* AWS::EC2::LocalGatewayRoute
* AWS::EC2::LocalGatewayRouteTableVPCAssociation
* AWS::FMS::NotificationChannel
* AWS::FMS::Policy

## Attribute Changes


## Property Changes

* AWS::Neptune::DBCluster DeletionProtection (__added__)
* AWS::Neptune::DBCluster EngineVersion (__added__)

## Property Type Changes

* AWS::ElasticLoadBalancingV2::Listener.ForwardConfig (__added__)
* AWS::ElasticLoadBalancingV2::Listener.TargetGroupStickinessConfig (__added__)
* AWS::ElasticLoadBalancingV2::Listener.TargetGroupTuple (__added__)
* AWS::ElasticLoadBalancingV2::ListenerRule.ForwardConfig (__added__)
* AWS::ElasticLoadBalancingV2::ListenerRule.TargetGroupStickinessConfig (__added__)
* AWS::ElasticLoadBalancingV2::ListenerRule.TargetGroupTuple (__added__)
* AWS::ElasticLoadBalancingV2::Listener.Action ForwardConfig (__added__)
* AWS::ElasticLoadBalancingV2::ListenerRule.Action ForwardConfig (__added__)
* AWS::FSx::FileSystem.LustreConfiguration DeploymentType (__added__)
* AWS::FSx::FileSystem.LustreConfiguration PerUnitStorageThroughput (__added__)


# CloudFormation Resource Specification v10.5.0

## New Resource Types

* AWS::AppConfig::Application
* AWS::AppConfig::ConfigurationProfile
* AWS::AppConfig::Deployment
* AWS::AppConfig::DeploymentStrategy
* AWS::AppConfig::Environment
* AWS::WAFv2::WebACLAssociation

## Attribute Changes

* AWS::Athena::NamedQuery NamedQueryId (__deleted__)
* AWS::Transfer::Server VpcEndpointId (__deleted__)

## Property Changes

* AWS::ACMPCA::Certificate Validity.PrimitiveType (__deleted__)
* AWS::ACMPCA::Certificate Validity.Type (__added__)
* AWS::ACMPCA::CertificateAuthority RevocationConfiguration.PrimitiveType (__deleted__)
* AWS::ACMPCA::CertificateAuthority RevocationConfiguration.Type (__added__)
* AWS::ACMPCA::CertificateAuthority Subject.PrimitiveType (__deleted__)
* AWS::ACMPCA::CertificateAuthority Subject.Type (__added__)
* AWS::AppSync::GraphQLApi XrayEnabled (__added__)
* AWS::EC2::ClientVpnEndpoint VpnPort (__added__)
* AWS::OpsWorksCM::Server Tags (__added__)

## Property Type Changes

* AWS::ACMPCA::Certificate.Validity (__added__)
* AWS::ACMPCA::CertificateAuthority.CrlConfiguration (__added__)
* AWS::ACMPCA::CertificateAuthority.RevocationConfiguration (__added__)
* AWS::ACMPCA::CertificateAuthority.Subject (__added__)
* AWS::Backup::BackupPlan.CopyActionResourceType (__added__)
* AWS::EC2::LaunchTemplate.MetadataOptions (__added__)
* AWS::MediaLive::Channel.MultiplexProgramChannelDestinationSettings (__added__)
* AWS::Backup::BackupPlan.BackupRuleResourceType CopyActions (__added__)
* AWS::EC2::LaunchTemplate.LaunchTemplateData MetadataOptions (__added__)
* AWS::EC2::LaunchTemplate.LaunchTemplateElasticInferenceAccelerator Count (__added__)
* AWS::EC2::LaunchTemplate.Placement HostResourceGroupArn (__added__)
* AWS::EC2::LaunchTemplate.Placement PartitionNumber (__added__)
* AWS::EC2::LaunchTemplate.Placement SpreadDomain (__added__)
* AWS::MediaLive::Channel.OutputDestination MultiplexSettings (__added__)
* AWS::Transfer::Server.EndpointDetails AddressAllocationIds.UpdateType (__changed__)
  * Old: Mutable
  * New: Conditional


# CloudFormation Resource Specification v10.4.0

## New Resource Types

* AWS::ACMPCA::Certificate
* AWS::ACMPCA::CertificateAuthority
* AWS::ACMPCA::CertificateAuthorityActivation

## Attribute Changes

* AWS::Athena::NamedQuery NamedQueryId (__added__)
* AWS::Transfer::Server VpcEndpointId (__added__)

## Property Changes

* AWS::Cognito::UserPool AccountRecoverySetting (__added__)

## Property Type Changes

* AWS::Cognito::UserPool.AccountRecoverySetting (__added__)
* AWS::Cognito::UserPool.RecoveryOption (__added__)
* AWS::Transfer::Server.EndpointDetails AddressAllocationIds (__added__)
* AWS::Transfer::Server.EndpointDetails SubnetIds (__added__)
* AWS::Transfer::Server.EndpointDetails VpcId (__added__)
* AWS::Transfer::Server.EndpointDetails VpcEndpointId.Required (__changed__)
  * Old: true
  * New: false


# CloudFormation Resource Specification v10.3.0

## New Resource Types


## Attribute Changes


## Property Changes

* AWS::AppStream::Fleet Name.Required (__changed__)
  * Old: false
  * New: true
* AWS::AppStream::ImageBuilder Name.Required (__changed__)
  * Old: false
  * New: true
* AWS::EC2::Instance HibernationOptions (__added__)
* AWS::EC2::Instance HostResourceGroupArn (__added__)
* AWS::IoTEvents::DetectorModel EvaluationMethod (__added__)
* AWS::RDS::DBInstance CACertificateIdentifier (__added__)
* AWS::SSM::ResourceDataSync S3Destination (__added__)
* AWS::SSM::ResourceDataSync SyncSource (__added__)
* AWS::SSM::ResourceDataSync SyncType (__added__)
* AWS::SSM::ResourceDataSync BucketName.Required (__changed__)
  * Old: true
  * New: false
* AWS::SSM::ResourceDataSync BucketRegion.Required (__changed__)
  * Old: true
  * New: false
* AWS::SSM::ResourceDataSync SyncFormat.Required (__changed__)
  * Old: true
  * New: false
* AWS::Transfer::User HomeDirectoryMappings (__added__)
* AWS::Transfer::User HomeDirectoryType (__added__)
* AWS::WAFv2::IPSet Addresses.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::IPSet IPAddressVersion.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::IPSet Name.Required (__changed__)
  * Old: true
  * New: false
* AWS::WAFv2::RegexPatternSet Name.Required (__changed__)
  * Old: true
  * New: false
* AWS::WAFv2::RegexPatternSet RegularExpressionList.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup Capacity.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::RuleGroup Name.Required (__changed__)
  * Old: true
  * New: false
* AWS::WAFv2::RuleGroup VisibilityConfig.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL DefaultAction.Required (__changed__)
  * Old: false
  * New: true
* AWS::WAFv2::WebACL Name.Required (__changed__)
  * Old: true
  * New: false
* AWS::WAFv2::WebACL VisibilityConfig.Required (__changed__)
  * Old: false
  * New: true

## Property Type Changes

* AWS::EC2::Instance.HibernationOptions (__added__)
* AWS::SSM::ResourceDataSync.AwsOrganizationsSource (__added__)
* AWS::SSM::ResourceDataSync.S3Destination (__added__)
* AWS::SSM::ResourceDataSync.SyncSource (__added__)
* AWS::Transfer::User.HomeDirectoryMapEntry (__added__)
* AWS::AutoScaling::AutoScalingGroup.LaunchTemplateOverrides WeightedCapacity (__added__)
* AWS::SageMaker::Model.ContainerDefinition Mode (__added__)


# CloudFormation Resource Specification v10.2.0

## New Resource Types

* AWS::CodeBuild::ReportGroup
* AWS::EC2::GatewayRouteTableAssociation

## Attribute Changes


## Property Changes

* AWS::Cloud9::EnvironmentEC2 Tags (__added__)
* AWS::Cloud9::EnvironmentEC2 Description.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::Cloud9::EnvironmentEC2 Name.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::EC2::EIP InstanceId.UpdateType (__changed__)
  * Old: Mutable
  * New: Conditional
* AWS::EC2::EIP PublicIpv4Pool.UpdateType (__changed__)
  * Old: Mutable
  * New: Conditional
* AWS::MSK::Cluster OpenMonitoring (__added__)
* AWS::MSK::Cluster EnhancedMonitoring.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::RDS::DBInstance MaxAllocatedStorage (__added__)
* AWS::SSM::Document Name (__added__)

## Property Type Changes

* AWS::DLM::LifecyclePolicy.CrossRegionCopyRetainRule (__added__)
* AWS::DLM::LifecyclePolicy.CrossRegionCopyRule (__added__)
* AWS::MSK::Cluster.JmxExporter (__added__)
* AWS::MSK::Cluster.NodeExporter (__added__)
* AWS::MSK::Cluster.OpenMonitoring (__added__)
* AWS::MSK::Cluster.Prometheus (__added__)
* AWS::DLM::LifecyclePolicy.FastRestoreRule Interval (__added__)
* AWS::DLM::LifecyclePolicy.FastRestoreRule IntervalUnit (__added__)
* AWS::DLM::LifecyclePolicy.FastRestoreRule Count.Required (__changed__)
  * Old: true
  * New: false
* AWS::DLM::LifecyclePolicy.PolicyDetails ResourceTypes.Required (__changed__)
  * Old: false
  * New: true
* AWS::DLM::LifecyclePolicy.PolicyDetails Schedules.Required (__changed__)
  * Old: false
  * New: true
* AWS::DLM::LifecyclePolicy.PolicyDetails TargetTags.Required (__changed__)
  * Old: false
  * New: true
* AWS::DLM::LifecyclePolicy.RetainRule Interval (__added__)
* AWS::DLM::LifecyclePolicy.RetainRule IntervalUnit (__added__)
* AWS::DLM::LifecyclePolicy.RetainRule Count.Required (__changed__)
  * Old: true
  * New: false
* AWS::DLM::LifecyclePolicy.Schedule CrossRegionCopyRules (__added__)


# CloudFormation Resource Specification v10.1.0

## New Resource Types


## Attribute Changes


## Property Changes

* AWS::Pinpoint::EmailTemplate DefaultSubstitutions (__added__)
* AWS::Pinpoint::EmailTemplate TemplateDescription (__added__)
* AWS::Pinpoint::PushTemplate DefaultSubstitutions (__added__)
* AWS::Pinpoint::PushTemplate TemplateDescription (__added__)
* AWS::Pinpoint::SmsTemplate DefaultSubstitutions (__added__)
* AWS::Pinpoint::SmsTemplate TemplateDescription (__added__)

## Property Type Changes



# CloudFormation Resource Specification v10.0.0

## New Resource Types

* AWS::AccessAnalyzer::Analyzer
* AWS::EventSchemas::Discoverer
* AWS::EventSchemas::Registry
* AWS::EventSchemas::Schema
* AWS::S3::AccessPoint

## Attribute Changes

* AWS::WAFv2::IPSet Arn (__added__)
* AWS::WAFv2::IPSet Id (__added__)
* AWS::WAFv2::RegexPatternSet Arn (__added__)
* AWS::WAFv2::RegexPatternSet Id (__added__)
* AWS::WAFv2::RuleGroup Arn (__added__)
* AWS::WAFv2::RuleGroup Id (__added__)
* AWS::WAFv2::WebACL Arn (__added__)
* AWS::WAFv2::WebACL Capacity (__added__)
* AWS::WAFv2::WebACL Id (__added__)

## Property Changes

* AWS::ApiGatewayV2::Api BasePath (__added__)
* AWS::ApiGatewayV2::Api Body (__added__)
* AWS::ApiGatewayV2::Api BodyS3Location (__added__)
* AWS::ApiGatewayV2::Api CorsConfiguration (__added__)
* AWS::ApiGatewayV2::Api CredentialsArn (__added__)
* AWS::ApiGatewayV2::Api FailOnWarnings (__added__)
* AWS::ApiGatewayV2::Api RouteKey (__added__)
* AWS::ApiGatewayV2::Api Target (__added__)
* AWS::ApiGatewayV2::Api Name.Required (__changed__)
  * Old: true
  * New: false
* AWS::ApiGatewayV2::Api ProtocolType.Required (__changed__)
  * Old: true
  * New: false
* AWS::ApiGatewayV2::Api RouteSelectionExpression.Required (__changed__)
  * Old: true
  * New: false
* AWS::ApiGatewayV2::Authorizer JwtConfiguration (__added__)
* AWS::ApiGatewayV2::Authorizer AuthorizerUri.Required (__changed__)
  * Old: true
  * New: false
* AWS::ApiGatewayV2::Integration PayloadFormatVersion (__added__)
* AWS::ApiGatewayV2::Stage AutoDeploy (__added__)
* AWS::ApiGatewayV2::Stage DeploymentId.Required (__changed__)
  * Old: true
  * New: false
* AWS::GuardDuty::Filter Name.Required (__changed__)
  * Old: false
  * New: true
* AWS::Lambda::Alias ProvisionedConcurrencyConfig (__added__)
* AWS::Lambda::Version ProvisionedConcurrencyConfig (__added__)
* AWS::StepFunctions::StateMachine LoggingConfiguration (__added__)
* AWS::StepFunctions::StateMachine StateMachineType (__added__)
* AWS::WAFv2::IPSet IPSet (__deleted__)
* AWS::WAFv2::IPSet IPSetSummary (__deleted__)
* AWS::WAFv2::IPSet IPSets (__deleted__)
* AWS::WAFv2::IPSet Id (__deleted__)
* AWS::WAFv2::IPSet Limit (__deleted__)
* AWS::WAFv2::IPSet LockToken (__deleted__)
* AWS::WAFv2::IPSet NextLockToken (__deleted__)
* AWS::WAFv2::IPSet NextMarker (__deleted__)
* AWS::WAFv2::IPSet Summary (__deleted__)
* AWS::WAFv2::RegexPatternSet Id (__deleted__)
* AWS::WAFv2::RegexPatternSet Limit (__deleted__)
* AWS::WAFv2::RegexPatternSet LockToken (__deleted__)
* AWS::WAFv2::RegexPatternSet NextLockToken (__deleted__)
* AWS::WAFv2::RegexPatternSet NextMarker (__deleted__)
* AWS::WAFv2::RegexPatternSet RegexPatternSet (__deleted__)
* AWS::WAFv2::RegexPatternSet RegexPatternSets (__deleted__)
* AWS::WAFv2::RegexPatternSet Summary (__deleted__)
* AWS::WAFv2::RuleGroup Id (__deleted__)
* AWS::WAFv2::RuleGroup Limit (__deleted__)
* AWS::WAFv2::RuleGroup LockToken (__deleted__)
* AWS::WAFv2::RuleGroup NextLockToken (__deleted__)
* AWS::WAFv2::RuleGroup NextMarker (__deleted__)
* AWS::WAFv2::RuleGroup RuleGroup (__deleted__)
* AWS::WAFv2::RuleGroup RuleGroupSummary (__deleted__)
* AWS::WAFv2::RuleGroup RuleGroups (__deleted__)
* AWS::WAFv2::RuleGroup Statement (__deleted__)
* AWS::WAFv2::RuleGroup Summary (__deleted__)
* AWS::WAFv2::WebACL Id (__deleted__)
* AWS::WAFv2::WebACL Limit (__deleted__)
* AWS::WAFv2::WebACL LockToken (__deleted__)
* AWS::WAFv2::WebACL NextLockToken (__deleted__)
* AWS::WAFv2::WebACL NextMarker (__deleted__)
* AWS::WAFv2::WebACL Summary (__deleted__)
* AWS::WAFv2::WebACL WebACL (__deleted__)
* AWS::WAFv2::WebACL WebACLs (__deleted__)

## Property Type Changes

* AWS::WAFv2::IPSet.IPSet (__removed__)
* AWS::WAFv2::IPSet.IPSetSummary (__removed__)
* AWS::WAFv2::IPSet.IPSets (__removed__)
* AWS::WAFv2::RegexPatternSet.RegexPatternSet (__removed__)
* AWS::WAFv2::RegexPatternSet.RegexPatternSetSummary (__removed__)
* AWS::WAFv2::RegexPatternSet.RegexPatternSets (__removed__)
* AWS::WAFv2::RuleGroup.RuleGroup (__removed__)
* AWS::WAFv2::RuleGroup.RuleGroupSummary (__removed__)
* AWS::WAFv2::RuleGroup.RuleGroups (__removed__)
* AWS::WAFv2::WebACL.WebACL (__removed__)
* AWS::WAFv2::WebACL.WebACLSummary (__removed__)
* AWS::WAFv2::WebACL.WebACLs (__removed__)
* AWS::ApiGatewayV2::Api.BodyS3Location (__added__)
* AWS::ApiGatewayV2::Api.Cors (__added__)
* AWS::ApiGatewayV2::Authorizer.JWTConfiguration (__added__)
* AWS::Lambda::Alias.ProvisionedConcurrencyConfiguration (__added__)
* AWS::Lambda::Version.ProvisionedConcurrencyConfiguration (__added__)
* AWS::StepFunctions::StateMachine.CloudWatchLogsLogGroup (__added__)
* AWS::StepFunctions::StateMachine.LogDestination (__added__)
* AWS::StepFunctions::StateMachine.LoggingConfiguration (__added__)
* AWS::FSx::FileSystem.WindowsConfiguration DeploymentType (__added__)
* AWS::FSx::FileSystem.WindowsConfiguration PreferredSubnetId (__added__)
* AWS::WAFv2::RuleGroup.IPSetReferenceStatement ARN (__deleted__)
* AWS::WAFv2::RuleGroup.IPSetReferenceStatement Arn (__added__)
* AWS::WAFv2::RuleGroup.RegexPatternSetReferenceStatement ARN (__deleted__)
* AWS::WAFv2::RuleGroup.RegexPatternSetReferenceStatement Arn (__added__)
* AWS::WAFv2::WebACL.IPSetReferenceStatement ARN (__deleted__)
* AWS::WAFv2::WebACL.IPSetReferenceStatement Arn (__added__)
* AWS::WAFv2::WebACL.RegexPatternSetReferenceStatement ARN (__deleted__)
* AWS::WAFv2::WebACL.RegexPatternSetReferenceStatement Arn (__added__)
* AWS::WAFv2::WebACL.RuleGroupReferenceStatement ARN (__deleted__)
* AWS::WAFv2::WebACL.RuleGroupReferenceStatement Arn (__added__)


# Serverless Application Model (SAM) Resource Specification v2016-10-31

## New Resource Types


## Attribute Changes


## Property Changes

* AWS::Serverless::Api Cors.PrimitiveType (__deleted__)
* AWS::Serverless::Api Cors.PrimitiveTypes (__added__)
* AWS::Serverless::Api Cors.Types (__added__)
* AWS::Serverless::Api MethodSettings.PrimitiveType (__deleted__)
* AWS::Serverless::Api MethodSettings.PrimitiveItemType (__added__)
* AWS::Serverless::Api MethodSettings.Type (__added__)

## Property Type Changes

* AWS::Serverless::Api.CorsConfiguration (__added__)
* AWS::Serverless::Function.S3KeyFilter (__added__)
* AWS::Serverless::Function.S3KeyFilterRule (__added__)
* AWS::Serverless::Function.S3NotificationFilter S3Key.PrimitiveType (__deleted__)
* AWS::Serverless::Function.S3NotificationFilter S3Key.Type (__added__)

# CloudFormation Resource Specification v9.1.1

## New Resource Types

* AWS::AppSync::ApiCache
* AWS::CloudWatch::InsightRule
* AWS::ECS::PrimaryTaskSet
* AWS::ECS::TaskSet
* AWS::EKS::Nodegroup
* AWS::GameLift::GameSessionQueue
* AWS::GameLift::MatchmakingConfiguration
* AWS::GameLift::MatchmakingRuleSet
* AWS::GameLift::Script
* AWS::Lambda::EventInvokeConfig
* AWS::WAFv2::IPSet
* AWS::WAFv2::RegexPatternSet
* AWS::WAFv2::RuleGroup
* AWS::WAFv2::WebACL

## Attribute Changes

* AWS::EKS::Cluster ClusterSecurityGroupId (__added__)

## Property Changes

* AWS::AmazonMQ::Broker StorageType (__added__)
* AWS::AppSync::Resolver CachingConfig (__added__)
* AWS::AppSync::Resolver SyncConfig (__added__)
* AWS::Cognito::IdentityPool AllowClassicFlow (__added__)
* AWS::Cognito::UserPoolClient PreventUserExistenceErrors (__added__)
* AWS::Cognito::UserPoolClient AllowedOAuthFlowsUserPoolClient.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::Cognito::UserPoolUser ClientMetadata (__added__)
* AWS::DocDB::DBCluster MasterUserPassword.Required (__changed__)
  * Old: false
  * New: true
* AWS::DocDB::DBCluster MasterUsername.Required (__changed__)
  * Old: false
  * New: true
* AWS::EC2::EIP Tags (__added__)
* AWS::EC2::NetworkAclEntry CidrBlock.Required (__changed__)
  * Old: true
  * New: false
* AWS::ECS::Cluster ClusterSettings (__added__)
* AWS::ECS::Service DeploymentController (__added__)
* AWS::ECS::Service TaskDefinition.Required (__changed__)
  * Old: true
  * New: false
* AWS::ElastiCache::ReplicationGroup AuthToken.UpdateType (__changed__)
  * Old: Immutable
  * New: Conditional
* AWS::Elasticsearch::Domain CognitoOptions (__added__)
* AWS::Elasticsearch::Domain ElasticsearchVersion.UpdateType (__changed__)
  * Old: Immutable
  * New: Conditional
* AWS::GameLift::Build OperatingSystem (__added__)
* AWS::GameLift::Fleet CertificateConfiguration (__added__)
* AWS::GameLift::Fleet FleetType (__added__)
* AWS::GameLift::Fleet InstanceRoleARN (__added__)
* AWS::GameLift::Fleet MetricGroups (__added__)
* AWS::GameLift::Fleet NewGameSessionProtectionPolicy (__added__)
* AWS::GameLift::Fleet PeerVpcAwsAccountId (__added__)
* AWS::GameLift::Fleet PeerVpcId (__added__)
* AWS::GameLift::Fleet ResourceCreationLimitPolicy (__added__)
* AWS::GameLift::Fleet RuntimeConfiguration (__added__)
* AWS::GameLift::Fleet ScriptId (__added__)
* AWS::GameLift::Fleet BuildId.Required (__changed__)
  * Old: true
  * New: false
* AWS::GameLift::Fleet DesiredEC2Instances.Required (__changed__)
  * Old: true
  * New: false
* AWS::GameLift::Fleet ServerLaunchPath.Required (__changed__)
  * Old: true
  * New: false
* AWS::Glue::MLTransform GlueVersion (__added__)
* AWS::IAM::User Tags (__added__)
* AWS::Lambda::EventSourceMapping BisectBatchOnFunctionError (__added__)
* AWS::Lambda::EventSourceMapping DestinationConfig (__added__)
* AWS::Lambda::EventSourceMapping MaximumRecordAgeInSeconds (__added__)
* AWS::Lambda::EventSourceMapping MaximumRetryAttempts (__added__)
* AWS::Lambda::EventSourceMapping ParallelizationFactor (__added__)
* AWS::OpsWorksCM::Server CustomCertificate (__added__)
* AWS::OpsWorksCM::Server CustomDomain (__added__)
* AWS::OpsWorksCM::Server CustomPrivateKey (__added__)
* AWS::RDS::DBCluster EnableHttpEndpoint (__added__)
* AWS::SNS::Subscription RedrivePolicy (__added__)
* AWS::SageMaker::Endpoint ExcludeRetainedVariantProperties (__added__)
* AWS::SageMaker::Endpoint RetainAllVariantProperties (__added__)

## Property Type Changes

* AWS::AppSync::DataSource.DeltaSyncConfig (__added__)
* AWS::AppSync::Resolver.CachingConfig (__added__)
* AWS::AppSync::Resolver.LambdaConflictHandlerConfig (__added__)
* AWS::AppSync::Resolver.SyncConfig (__added__)
* AWS::DLM::LifecyclePolicy.FastRestoreRule (__added__)
* AWS::ECS::Cluster.ClusterSetting (__added__)
* AWS::ECS::Service.DeploymentController (__added__)
* AWS::ECS::TaskDefinition.FirelensConfiguration (__added__)
* AWS::Elasticsearch::Domain.CognitoOptions (__added__)
* AWS::GameLift::Fleet.CertificateConfiguration (__added__)
* AWS::GameLift::Fleet.ResourceCreationLimitPolicy (__added__)
* AWS::GameLift::Fleet.RuntimeConfiguration (__added__)
* AWS::GameLift::Fleet.ServerProcess (__added__)
* AWS::Lambda::EventSourceMapping.DestinationConfig (__added__)
* AWS::Lambda::EventSourceMapping.OnFailure (__added__)
* AWS::SageMaker::Endpoint.VariantProperty (__added__)
* AWS::ApiGateway::RestApi.EndpointConfiguration VpcEndpointIds (__added__)
* AWS::AppSync::DataSource.DynamoDBConfig DeltaSyncConfig (__added__)
* AWS::AppSync::DataSource.DynamoDBConfig Versioned (__added__)
* AWS::CodePipeline::Pipeline.ActionDeclaration Namespace (__added__)
* AWS::Cognito::UserPool.EmailConfiguration ConfigurationSet (__added__)
* AWS::Cognito::UserPool.EmailConfiguration From (__added__)
* AWS::DLM::LifecyclePolicy.Schedule FastRestoreRule (__added__)
* AWS::EC2::Instance.ElasticInferenceAccelerator Count (__added__)
* AWS::ECS::TaskDefinition.ContainerDefinition FirelensConfiguration (__added__)
* AWS::ECS::TaskDefinition.InferenceAccelerator DevicePolicy (__added__)
* AWS::ECS::TaskDefinition.LinuxParameters MaxSwap (__added__)
* AWS::ECS::TaskDefinition.LinuxParameters Swappiness (__added__)
* AWS::GameLift::Build.S3Location ObjectVersion (__added__)


# CloudFormation Resource Specification v8.0.0

## New Resource Types

* AWS::CodeStarNotifications::NotificationRule
* AWS::MediaConvert::JobTemplate
* AWS::MediaConvert::Preset
* AWS::MediaConvert::Queue

## Attribute Changes


## Property Changes

* AWS::AppStream::ImageBuilder AccessEndpoints (__added__)
* AWS::AppStream::Stack AccessEndpoints (__added__)
* AWS::AppStream::Stack EmbedHostDomains (__added__)

## Property Type Changes

* AWS::DLM::LifecyclePolicy.FastRestoreRule (__removed__)
* AWS::AppStream::ImageBuilder.AccessEndpoint (__added__)
* AWS::AppStream::Stack.AccessEndpoint (__added__)
* AWS::DLM::LifecyclePolicy.Schedule FastRestoreRule (__deleted__)
* AWS::ECS::TaskDefinition.InferenceAccelerator DevicePolicy (__deleted__)


# CloudFormation Resource Specification v7.3.0

## New Resource Types

* AWS::Pinpoint::EmailTemplate
* AWS::Pinpoint::PushTemplate
* AWS::Pinpoint::SmsTemplate

## Attribute Changes


## Property Changes

* AWS::Amplify::Branch EnablePullRequestPreview (__added__)
* AWS::Amplify::Branch PullRequestEnvironmentName (__added__)
* AWS::ApiGateway::ApiKey Tags (__added__)
* AWS::ApiGateway::ClientCertificate Tags (__added__)
* AWS::ApiGateway::DomainName SecurityPolicy (__added__)
* AWS::ApiGateway::DomainName Tags (__added__)
* AWS::ApiGateway::RestApi Tags (__added__)
* AWS::ApiGateway::UsagePlan Tags (__added__)
* AWS::CodePipeline::CustomActionType Tags (__added__)
* AWS::CodePipeline::Pipeline Tags (__added__)
* AWS::Cognito::UserPool AliasAttributes.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::Cognito::UserPool Schema.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::Cognito::UserPool UserPoolName.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::Cognito::UserPool UsernameAttributes.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::ECS::TaskDefinition InferenceAccelerators (__added__)
* AWS::Elasticsearch::Domain LogPublishingOptions (__added__)
* AWS::Events::Rule EventBusName (__added__)
* AWS::Glue::Crawler DatabaseName.Required (__changed__)
  * Old: true
  * New: false
* AWS::SNS::Topic Tags (__added__)

## Property Type Changes

* AWS::AppMesh::Route.GrpcRetryPolicy (__added__)
* AWS::AppMesh::Route.GrpcRoute (__added__)
* AWS::AppMesh::Route.GrpcRouteAction (__added__)
* AWS::AppMesh::Route.GrpcRouteMatch (__added__)
* AWS::AppMesh::Route.GrpcRouteMetadata (__added__)
* AWS::AppMesh::Route.GrpcRouteMetadataMatchMethod (__added__)
* AWS::DLM::LifecyclePolicy.FastRestoreRule (__added__)
* AWS::ECS::TaskDefinition.InferenceAccelerator (__added__)
* AWS::Elasticsearch::Domain.LogPublishingOption (__added__)
* AWS::Events::Rule.BatchArrayProperties (__added__)
* AWS::Events::Rule.BatchParameters (__added__)
* AWS::Events::Rule.BatchRetryStrategy (__added__)
* AWS::Glue::Crawler.CatalogTarget (__added__)
* AWS::Glue::Crawler.DynamoDBTarget (__added__)
* AWS::Amplify::App.AutoBranchCreationConfig EnablePullRequestPreview (__added__)
* AWS::Amplify::App.AutoBranchCreationConfig PullRequestEnvironmentName (__added__)
* AWS::AppMesh::Route.RouteSpec GrpcRoute (__added__)
* AWS::AppMesh::Route.RouteSpec Http2Route (__added__)
* AWS::DLM::LifecyclePolicy.Schedule FastRestoreRule (__added__)
* AWS::Events::Rule.Target BatchParameters (__added__)
* AWS::Glue::Crawler.Targets CatalogTargets (__added__)
* AWS::Glue::Crawler.Targets DynamoDBTargets (__added__)
* AWS::RDS::DBCluster.DBClusterRole Status (__deleted__)
* AWS::RDS::DBInstance.DBInstanceRole Status (__deleted__)


# CloudFormation Resource Specification v7.1.0

## New Resource Types

* AWS::EC2::TrafficMirrorFilter
* AWS::EC2::TrafficMirrorFilterRule
* AWS::EC2::TrafficMirrorSession
* AWS::EC2::TrafficMirrorTarget
* AWS::Events::EventBus

## Attribute Changes


## Property Changes

* AWS::FSx::FileSystem FileSystemType.Required (__changed__)
  * Old: false
  * New: true
* AWS::FSx::FileSystem SubnetIds.Required (__changed__)
  * Old: false
  * New: true
* AWS::MSK::Cluster NumberOfBrokerNodes.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable

## Property Type Changes

* AWS::FSx::FileSystem.SelfManagedActiveDirectoryConfiguration (__added__)
* AWS::Batch::ComputeEnvironment.ComputeResources AllocationStrategy (__added__)
* AWS::Cognito::IdentityPoolRoleAttachment.RoleMapping IdentityProvider (__added__)
* AWS::FSx::FileSystem.WindowsConfiguration SelfManagedActiveDirectoryConfiguration (__added__)

# Serverless Application Model (SAM) Resource Specification v2016-10-31

## Property Type Changes

* AWS::Serverless::Function.S3Location Version.Required (__changed__)
  * Old: true
  * New: false

# CloudFormation Resource Specification v6.3.0

## New Resource Types

* AWS::Cognito::UserPoolDomain
* AWS::Cognito::UserPoolIdentityProvider
* AWS::Cognito::UserPoolResourceServer
* AWS::Cognito::UserPoolRiskConfigurationAttachment
* AWS::Cognito::UserPoolUICustomizationAttachment

## Attribute Changes

* AWS::Pinpoint::App Arn (__added__)
* AWS::Pinpoint::Campaign Arn (__added__)
* AWS::Pinpoint::Segment Arn (__added__)

## Property Changes

* AWS::Cognito::UserPool EnabledMfas (__added__)
* AWS::Events::EventBusPolicy EventBusName (__added__)
* AWS::Pinpoint::App Tags (__added__)
* AWS::Pinpoint::Campaign Tags (__added__)
* AWS::Pinpoint::Segment Tags (__added__)

## Property Type Changes

* AWS::Budgets::Budget.BudgetData PlannedBudgetLimits (__added__)


# CloudFormation Resource Specification v6.2.0

## New Resource Types

* AWS::EC2::VPCEndpointService
* AWS::Glue::Workflow
* AWS::SageMaker::CodeRepository

## Attribute Changes


## Property Changes

* AWS::AmazonMQ::Broker HostInstanceType.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::DocDB::DBCluster EnableCloudwatchLogsExports (__added__)
* AWS::Glue::DevEndpoint Arguments (__added__)
* AWS::Glue::DevEndpoint GlueVersion (__added__)
* AWS::Glue::DevEndpoint NumberOfWorkers (__added__)
* AWS::Glue::DevEndpoint WorkerType (__added__)
* AWS::Glue::Job NotificationProperty (__added__)
* AWS::Glue::Job Timeout (__added__)
* AWS::Glue::Trigger StartOnCreation (__added__)
* AWS::Glue::Trigger WorkflowName (__added__)
* AWS::ServiceDiscovery::Instance InstanceAttributes.PrimitiveType (__changed__)
  * Old: Map
  * New: Json

## Property Type Changes

* AWS::Glue::Job.NotificationProperty (__added__)
* AWS::Glue::Trigger.NotificationProperty (__added__)
* AWS::Glue::Trigger.Action CrawlerName (__added__)
* AWS::Glue::Trigger.Action NotificationProperty (__added__)
* AWS::Glue::Trigger.Action Timeout (__added__)
* AWS::Glue::Trigger.Condition CrawlState (__added__)
* AWS::Glue::Trigger.Condition CrawlerName (__added__)


# CloudFormation Resource Specification v6.1.0

## New Resource Types

* AWS::QLDB::Ledger

## Attribute Changes


## Property Changes

* AWS::Config::RemediationConfiguration Automatic (__added__)
* AWS::Config::RemediationConfiguration ExecutionControls (__added__)
* AWS::Config::RemediationConfiguration MaximumAutomaticAttempts (__added__)
* AWS::Config::RemediationConfiguration RetryAttemptSeconds (__added__)

## Property Type Changes

* AWS::AppMesh::Route.Duration (__added__)
* AWS::AppMesh::Route.HttpRetryPolicy (__added__)
* AWS::Config::RemediationConfiguration.ExecutionControls (__added__)
* AWS::Config::RemediationConfiguration.SsmControls (__added__)
* AWS::AppMesh::Route.HttpRoute RetryPolicy (__added__)
* Tag Key.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-iotevents-input-tag.html#cfn-iotevents-input-tag-key
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-resource-tags.html#cfn-resource-tags-key
* Tag Value.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-iotevents-input-tag.html#cfn-iotevents-input-tag-value
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-resource-tags.html#cfn-resource-tags-value


# CloudFormation Resource Specification v6.0.0

## New Resource Types

* AWS::Config::OrganizationConfigRule

## Attribute Changes


## Property Changes

* AWS::AmazonMQ::Broker SecurityGroups.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::ApplicationAutoScaling::ScalableTarget SuspendedState (__added__)
* AWS::CloudWatch::Alarm ThresholdMetricId (__added__)
* AWS::CloudWatch::Alarm Threshold.Required (__changed__)
  * Old: true
  * New: false
* AWS::Cognito::UserPoolClient RefreshTokenValidity.PrimitiveType (__changed__)
  * Old: Double
  * New: Integer
* AWS::EC2::Instance CpuOptions (__added__)
* AWS::ECS::TaskDefinition IpcMode (__added__)
* AWS::ECS::TaskDefinition PidMode (__added__)
* AWS::ElastiCache::ReplicationGroup KmsKeyId (__added__)
* AWS::IAM::Role Description (__added__)
* AWS::IAM::Role Tags (__added__)
* AWS::Lambda::EventSourceMapping MaximumBatchingWindowInSeconds (__added__)
* AWS::RDS::DBCluster AssociatedRoles (__added__)
* AWS::RDS::DBCluster RestoreType (__added__)
* AWS::RDS::DBCluster SourceDBClusterIdentifier (__added__)
* AWS::RDS::DBCluster UseLatestRestorableTime (__added__)
* AWS::RDS::DBInstance AssociatedRoles (__added__)
* AWS::SNS::Subscription Region.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable

## Property Type Changes

* AWS::ApplicationAutoScaling::ScalableTarget.SuspendedState (__added__)
* AWS::EC2::Instance.CpuOptions (__added__)
* AWS::ECS::TaskDefinition.SystemControl (__added__)
* AWS::Elasticsearch::Domain.ZoneAwarenessConfig (__added__)
* AWS::Events::Rule.AwsVpcConfiguration (__added__)
* AWS::Events::Rule.NetworkConfiguration (__added__)
* AWS::RDS::DBCluster.DBClusterRole (__added__)
* AWS::RDS::DBInstance.DBInstanceRole (__added__)
* AWS::Cognito::UserPool.AdminCreateUserConfig UnusedAccountValidityDays.PrimitiveType (__changed__)
  * Old: Double
  * New: Integer
* AWS::Cognito::UserPool.PasswordPolicy TemporaryPasswordValidityDays.PrimitiveType (__changed__)
  * Old: Double
  * New: Integer
* AWS::DynamoDB::Table.SSESpecification KMSMasterKeyId (__added__)
* AWS::DynamoDB::Table.SSESpecification SSEType (__added__)
* AWS::EC2::ClientVpnEndpoint.TagSpecification ResourceType.Required (__changed__)
  * Old: false
  * New: true
* AWS::EC2::ClientVpnEndpoint.TagSpecification Tags.Required (__changed__)
  * Old: false
  * New: true
* AWS::EC2::Instance.Ebs KmsKeyId (__added__)
* AWS::ECS::TaskDefinition.ContainerDefinition Interactive (__added__)
* AWS::ECS::TaskDefinition.ContainerDefinition PseudoTerminal (__added__)
* AWS::ECS::TaskDefinition.ContainerDefinition SystemControls (__added__)
* AWS::ECS::TaskDefinition.LogConfiguration SecretOptions (__added__)
* AWS::ECS::TaskDefinition.Tmpfs Size.Required (__changed__)
  * Old: false
  * New: true
* AWS::Elasticsearch::Domain.ElasticsearchClusterConfig ZoneAwarenessConfig (__added__)
* AWS::Events::Rule.EcsParameters Group (__added__)
* AWS::Events::Rule.EcsParameters LaunchType (__added__)
* AWS::Events::Rule.EcsParameters NetworkConfiguration (__added__)
* AWS::Events::Rule.EcsParameters PlatformVersion (__added__)
* Tag Key.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-resource-tags.html#cfn-resource-tags-key
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-iotevents-input-tag.html#cfn-iotevents-input-tag-key
* Tag Value.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-resource-tags.html#cfn-resource-tags-value
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-iotevents-input-tag.html#cfn-iotevents-input-tag-value


# CloudFormation Resource Specification v5.3.0

## New Resource Types


## Attribute Changes


## Property Changes

* AWS::Neptune::DBCluster EnableCloudwatchLogsExports (__added__)

## Property Type Changes

* AWS::AppMesh::Route.HeaderMatchMethod (__added__)
* AWS::AppMesh::Route.HttpRouteHeader (__added__)
* AWS::AppMesh::Route.MatchRange (__added__)
* AWS::AppMesh::Route.HttpRouteMatch Headers (__added__)
* AWS::AppMesh::Route.HttpRouteMatch Method (__added__)
* AWS::AppMesh::Route.HttpRouteMatch Scheme (__added__)
* AWS::AppMesh::Route.RouteSpec Priority (__added__)
* Tag Key.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-iotevents-input-tag.html#cfn-iotevents-input-tag-key
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-resource-tags.html#cfn-resource-tags-key
* Tag Value.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-iotevents-input-tag.html#cfn-iotevents-input-tag-value
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-resource-tags.html#cfn-resource-tags-value


# CloudFormation Resource Specification v5.2.0

## New Resource Types

* AWS::SSM::MaintenanceWindowTarget
* AWS::SageMaker::Workteam

## Attribute Changes


## Property Changes

* AWS::DMS::ReplicationTask CdcStartPosition (__added__)
* AWS::DMS::ReplicationTask CdcStopPosition (__added__)

## Property Type Changes

* AWS::AppSync::GraphQLApi.LogConfig ExcludeVerboseContent (__added__)


# CloudFormation Resource Specification v5.1.0

## New Resource Types

* AWS::CodeBuild::SourceCredential
* AWS::Glue::MLTransform
* AWS::LakeFormation::DataLakeSettings
* AWS::LakeFormation::Permissions
* AWS::LakeFormation::Resource
* AWS::ManagedBlockchain::Member
* AWS::ManagedBlockchain::Node

## Attribute Changes


## Property Changes

* AWS::EC2::ClientVpnEndpoint SplitTunnel (__added__)
* AWS::Greengrass::ConnectorDefinition Tags (__added__)
* AWS::Greengrass::CoreDefinition Tags (__added__)
* AWS::Greengrass::DeviceDefinition Tags (__added__)
* AWS::Greengrass::FunctionDefinition Tags (__added__)
* AWS::Greengrass::Group Tags (__added__)
* AWS::Greengrass::LoggerDefinition Tags (__added__)
* AWS::Greengrass::ResourceDefinition Tags (__added__)
* AWS::Greengrass::SubscriptionDefinition Tags (__added__)

## Property Type Changes

* Tag Key.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-resource-tags.html#cfn-resource-tags-key
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-iotevents-input-tag.html#cfn-iotevents-input-tag-key
* Tag Value.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-resource-tags.html#cfn-resource-tags-value
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-iotevents-input-tag.html#cfn-iotevents-input-tag-value

# Serverless Application Model (SAM) Resource Specification v2016-10-31

## New Resource Types


## Attribute Changes


## Property Changes

* AWS::Serverless::Api AccessLogSetting (__added__)

## Property Type Changes

* AWS::Serverless::Api.AccessLogSetting (__added__)

# CloudFormation Resource Specification v5.0.0

## New Resource Types

* AWS::CodeStar::GitHubRepository

## Attribute Changes


## Property Changes

* AWS::CodeCommit::Repository Tags (__added__)
* AWS::Cognito::UserPool UserPoolAddOns (__added__)
* AWS::Cognito::UserPool VerificationMessageTemplate (__added__)
* AWS::Cognito::UserPoolClient AllowedOAuthFlows (__added__)
* AWS::Cognito::UserPoolClient AllowedOAuthFlowsUserPoolClient (__added__)
* AWS::Cognito::UserPoolClient AllowedOAuthScopes (__added__)
* AWS::Cognito::UserPoolClient AnalyticsConfiguration (__added__)
* AWS::Cognito::UserPoolClient CallbackURLs (__added__)
* AWS::Cognito::UserPoolClient DefaultRedirectURI (__added__)
* AWS::Cognito::UserPoolClient LogoutURLs (__added__)
* AWS::Cognito::UserPoolClient SupportedIdentityProviders (__added__)
* AWS::Glue::Job GlueVersion (__added__)
* AWS::Glue::Job MaxCapacity (__added__)
* AWS::Glue::Job NumberOfWorkers (__added__)
* AWS::Glue::Job WorkerType (__added__)
* AWS::SSM::MaintenanceWindowTask ServiceRoleArn.Required (__changed__)
  * Old: true
  * New: false
* AWS::SSM::MaintenanceWindowTask WindowId.Required (__changed__)
  * Old: false
  * New: true

## Property Type Changes

* AWS::Batch::JobDefinition.Device (__added__)
* AWS::Batch::JobDefinition.LinuxParameters (__added__)
* AWS::Cognito::UserPool.UserPoolAddOns (__added__)
* AWS::Cognito::UserPool.VerificationMessageTemplate (__added__)
* AWS::Cognito::UserPoolClient.AnalyticsConfiguration (__added__)
* AWS::Batch::ComputeEnvironment.ComputeResources SecurityGroupIds.Required (__changed__)
  * Old: true
  * New: false
* AWS::Batch::JobDefinition.ContainerProperties LinuxParameters (__added__)
* AWS::CodeCommit::Repository.RepositoryTrigger DestinationArn.Required (__changed__)
  * Old: false
  * New: true
* AWS::CodeCommit::Repository.RepositoryTrigger Events.Required (__changed__)
  * Old: false
  * New: true
* AWS::CodeCommit::Repository.RepositoryTrigger Name.Required (__changed__)
  * Old: false
  * New: true
* AWS::Cognito::UserPool.LambdaConfig PreTokenGeneration (__added__)
* AWS::Cognito::UserPool.LambdaConfig UserMigration (__added__)
* AWS::Glue::Job.JobCommand PythonVersion (__added__)


# CloudFormation Resource Specification v4.3.0

## New Resource Types

* AWS::IoTEvents::DetectorModel
* AWS::IoTEvents::Input

## Attribute Changes


## Property Changes

* AWS::AmazonMQ::Broker EncryptionOptions (__added__)
* AWS::Amplify::App AutoBranchCreationConfig (__added__)
* AWS::Amplify::Branch EnableAutoBuild (__added__)

## Property Type Changes

* AWS::AmazonMQ::Broker.EncryptionOptions (__added__)
* AWS::Amplify::App.AutoBranchCreationConfig (__added__)
* AWS::Amplify::App.BasicAuthConfig Password.Required (__changed__)
  * Old: true
  * New: false
* AWS::Amplify::App.BasicAuthConfig Username.Required (__changed__)
  * Old: true
  * New: false
* Tag Key.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-transfer-user-tag.html#cfn-transfer-user-tag-key
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-resource-tags.html#cfn-resource-tags-key
* Tag Value.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-transfer-user-tag.html#cfn-transfer-user-tag-value
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-resource-tags.html#cfn-resource-tags-value
* Tag Value.Required (__changed__)
  * Old: false
  * New: true


# CloudFormation Resource Specification v4.2.0

## New Resource Types

* AWS::Backup::BackupPlan
* AWS::Backup::BackupSelection
* AWS::Backup::BackupVault
* AWS::CloudWatch::AnomalyDetector
* AWS::Config::RemediationConfiguration
* AWS::MediaLive::Channel
* AWS::MediaLive::Input
* AWS::MediaLive::InputSecurityGroup
* AWS::SecurityHub::Hub
* AWS::ServiceCatalog::StackSetConstraint

## Attribute Changes


## Property Changes

* AWS::Amplify::App Repository.Required (__changed__)
  * Old: true
  * New: false
* AWS::ApiGatewayV2::Api Tags (__added__)
* AWS::ApiGatewayV2::DomainName Tags (__added__)
* AWS::ApiGatewayV2::Stage Tags (__added__)
* AWS::AppMesh::Mesh Tags.ItemType (__changed__)
  * Old: TagRef
  * New: Tag
* AWS::AppMesh::Route Tags.ItemType (__changed__)
  * Old: TagRef
  * New: Tag
* AWS::AppMesh::VirtualNode Tags.ItemType (__changed__)
  * Old: TagRef
  * New: Tag
* AWS::AppMesh::VirtualRouter Tags.ItemType (__changed__)
  * Old: TagRef
  * New: Tag
* AWS::AppMesh::VirtualService Tags.ItemType (__changed__)
  * Old: TagRef
  * New: Tag
* AWS::AppStream::Fleet IdleDisconnectTimeoutInSeconds (__added__)
* AWS::IoTAnalytics::Channel ChannelStorage (__added__)
* AWS::IoTAnalytics::Datastore DatastoreStorage (__added__)
* AWS::ServiceCatalog::CloudFormationProvisionedProduct ProvisioningPreferences (__added__)

## Property Type Changes

* AWS::Amplify::App.Token (__removed__)
* AWS::AppMesh::Mesh.TagRef (__removed__)
* AWS::AppMesh::Route.TagRef (__removed__)
* AWS::AppMesh::VirtualNode.TagRef (__removed__)
* AWS::AppMesh::VirtualRouter.TagRef (__removed__)
* AWS::AppMesh::VirtualService.TagRef (__removed__)
* AWS::AppMesh::VirtualNode.AwsCloudMapInstanceAttribute (__added__)
* AWS::AppMesh::VirtualNode.AwsCloudMapServiceDiscovery (__added__)
* AWS::IoTAnalytics::Channel.ChannelStorage (__added__)
* AWS::IoTAnalytics::Channel.CustomerManagedS3 (__added__)
* AWS::IoTAnalytics::Channel.ServiceManagedS3 (__added__)
* AWS::IoTAnalytics::Datastore.CustomerManagedS3 (__added__)
* AWS::IoTAnalytics::Datastore.DatastoreStorage (__added__)
* AWS::IoTAnalytics::Datastore.ServiceManagedS3 (__added__)
* AWS::ServiceCatalog::CloudFormationProvisionedProduct.ProvisioningPreferences (__added__)
* AWS::AppMesh::VirtualNode.ServiceDiscovery AWSCloudMap (__added__)
* AWS::EC2::LaunchTemplate.SpotOptions BlockDurationMinutes (__added__)
* AWS::EC2::LaunchTemplate.SpotOptions ValidUntil (__added__)
* AWS::Route53Resolver::ResolverRule.TargetAddress Port.Required (__changed__)
  * Old: true
  * New: false
* Tag Key.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-amplify-branch-tag.html#cfn-amplify-branch-tag-key
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-transfer-user-tag.html#cfn-transfer-user-tag-key
* Tag Value.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-amplify-branch-tag.html#cfn-amplify-branch-tag-value
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-transfer-user-tag.html#cfn-transfer-user-tag-value
* Tag Value.Required (__changed__)
  * Old: true
  * New: false



# Serverless Application Model (SAM) Resource Specification v2016-10-31

## New Resource Types


## Attribute Changes


## Property Changes

* AWS::Serverless::Function Policies.ItemTypes (__changed__)
  * Added SAMPolicyTemplate

## Property Type Changes

* AWS::Serverless::Function.BucketSAMPT (__added__)
* AWS::Serverless::Function.CollectionSAMPT (__added__)
* AWS::Serverless::Function.DomainSAMPT (__added__)
* AWS::Serverless::Function.EmptySAMPT (__added__)
* AWS::Serverless::Function.FunctionSAMPT (__added__)
* AWS::Serverless::Function.IdentitySAMPT (__added__)
* AWS::Serverless::Function.KeySAMPT (__added__)
* AWS::Serverless::Function.LogGroupSAMPT (__added__)
* AWS::Serverless::Function.QueueSAMPT (__added__)
* AWS::Serverless::Function.SAMPolicyTemplate (__added__)
* AWS::Serverless::Function.StateMachineSAMPT (__added__)
* AWS::Serverless::Function.StreamSAMPT (__added__)
* AWS::Serverless::Function.TableSAMPT (__added__)
* AWS::Serverless::Function.TableStreamSAMPT (__added__)
* AWS::Serverless::Function.TopicSAMPT (__added__)

# CloudFormation Resource Specification v3.3.0

## New Resource Types

* AWS::EC2::CapacityReservation
* AWS::PinpointEmail::ConfigurationSet
* AWS::PinpointEmail::ConfigurationSetEventDestination
* AWS::PinpointEmail::DedicatedIpPool
* AWS::PinpointEmail::Identity
* AWS::Transfer::Server
* AWS::Transfer::User
* AWS::WAFRegional::GeoMatchSet
* AWS::WAFRegional::RateBasedRule
* AWS::WAFRegional::RegexPatternSet

## Attribute Changes


## Property Changes

* AWS::CodeBuild::Project SecondarySourceVersions (__added__)
* AWS::CodeBuild::Project SourceVersion (__added__)
* AWS::CodeCommit::Repository Code (__added__)
* AWS::ECS::TaskDefinition ProxyConfiguration (__added__)

## Property Type Changes

* AWS::CodeBuild::Project.ProjectSourceVersion (__added__)
* AWS::CodeCommit::Repository.Code (__added__)
* AWS::CodeCommit::Repository.S3 (__added__)
* AWS::ECS::TaskDefinition.ContainerDependency (__added__)
* AWS::ECS::TaskDefinition.ProxyConfiguration (__added__)
* AWS::EC2::LaunchTemplate.NetworkInterface InterfaceType (__added__)
* AWS::ECS::TaskDefinition.ContainerDefinition DependsOn (__added__)
* AWS::ECS::TaskDefinition.ContainerDefinition StartTimeout (__added__)
* AWS::ECS::TaskDefinition.ContainerDefinition StopTimeout (__added__)


# CloudFormation Resource Specification v3.0.0

## New Resource Types

* AWS::ApiGatewayV2::ApiMapping
* AWS::ApiGatewayV2::DomainName

## Attribute Changes


## Property Changes

* AWS::FSx::FileSystem Tags.ItemType (__changed__)
  * Old: TagEntry
  * New: Tag

## Property Type Changes

* Tag Key.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-dms-endpoint-tag.html#cfn-dms-endpoint-tag-key
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-iotanalytics-datastore-tag.html#cfn-iotanalytics-datastore-tag-key
* Tag Key.Required (__changed__)
  * Old: false
  * New: true
* Tag Value.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-dms-endpoint-tag.html#cfn-dms-endpoint-tag-value
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-iotanalytics-datastore-tag.html#cfn-iotanalytics-datastore-tag-value
* Tag Value.Required (__changed__)
  * Old: false
  * New: true


# CloudFormation Resource Specification v2.32.0

## New Resource Types

* AWS::Greengrass::ResourceDefinition

## Attribute Changes


## Property Changes

* AWS::SSM::Parameter Tags (__added__)
* AWS::ServiceCatalog::CloudFormationProvisionedProduct Tags.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable

## Property Type Changes

* AWS::Cognito::UserPool.EmailConfiguration EmailSendingAccount (__added__)
* AWS::Greengrass::FunctionDefinition.FunctionConfiguration MemorySize.Required (__changed__)
  * Old: true
  * New: false
* AWS::Greengrass::FunctionDefinition.FunctionConfiguration Timeout.Required (__changed__)
  * Old: true
  * New: false
* AWS::Greengrass::FunctionDefinitionVersion.FunctionConfiguration MemorySize.Required (__changed__)
  * Old: true
  * New: false
* AWS::Greengrass::FunctionDefinitionVersion.FunctionConfiguration Timeout.Required (__changed__)
  * Old: true
  * New: false


# CloudFormation Resource Specification v2.30.0

## New Resource Types


## Attribute Changes


## Property Changes


## Property Type Changes

* AWS::Batch::JobDefinition.ResourceRequirement (__added__)
* AWS::Batch::JobDefinition.ContainerProperties ResourceRequirements (__added__)
* Tag Key.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-iotanalytics-datastore-tag.html#cfn-iotanalytics-datastore-tag-key
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-dms-endpoint-tag.html#cfn-dms-endpoint-tag-key
* Tag Key.Required (__changed__)
  * Old: true
  * New: false
* Tag Value.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-iotanalytics-datastore-tag.html#cfn-iotanalytics-datastore-tag-value
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-dms-endpoint-tag.html#cfn-dms-endpoint-tag-value
* Tag Value.Required (__changed__)
  * Old: true
  * New: false


# CloudFormation Resource Specification v2.29.0

## New Resource Types

* AWS::AppMesh::Mesh
* AWS::AppMesh::Route
* AWS::AppMesh::VirtualNode
* AWS::AppMesh::VirtualRouter
* AWS::AppMesh::VirtualService

## Attribute Changes


## Property Changes

* AWS::EKS::Cluster Version.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable

## Property Type Changes

* AWS::ServiceDiscovery::Service.DnsRecord TTL.PrimitiveType (__changed__)
  * Old: String
  * New: Double
* Tag Key.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-dms-endpoint-tag.html#cfn-dms-endpoint-tag-key
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-iotanalytics-datastore-tag.html#cfn-iotanalytics-datastore-tag-key
* Tag Key.Required (__changed__)
  * Old: false
  * New: true
* Tag Value.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-dms-endpoint-tag.html#cfn-dms-endpoint-tag-value
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-iotanalytics-datastore-tag.html#cfn-iotanalytics-datastore-tag-value
* Tag Value.Required (__changed__)
  * Old: false
  * New: true






# Serverless Application Model (SAM) Resource Specification v2016-10-31

## New Resource Types


## Attribute Changes


## Property Changes

* AWS::Serverless::Api TracingEnabled (__added__)
* AWS::Serverless::Function PermissionsBoundary (__added__)

## Property Type Changes

* AWS::Serverless::Function.DynamoDBEvent Enabled (__added__)
* AWS::Serverless::Function.DynamoDBEvent BatchSize.Required (__changed__)
  * Old: true
  * New: false
* AWS::Serverless::Function.KinesisEvent Enabled (__added__)
* AWS::Serverless::Function.SQSEvent Enabled (__added__)









# CloudFormation Resource Specification v2.28.0

## New Resource Types

* AWS::Greengrass::ConnectorDefinition
* AWS::Greengrass::ConnectorDefinitionVersion
* AWS::Greengrass::CoreDefinition
* AWS::Greengrass::CoreDefinitionVersion
* AWS::Greengrass::DeviceDefinition
* AWS::Greengrass::DeviceDefinitionVersion
* AWS::Greengrass::FunctionDefinition
* AWS::Greengrass::FunctionDefinitionVersion
* AWS::Greengrass::Group
* AWS::Greengrass::GroupVersion
* AWS::Greengrass::LoggerDefinition
* AWS::Greengrass::LoggerDefinitionVersion
* AWS::Greengrass::ResourceDefinitionVersion
* AWS::Greengrass::SubscriptionDefinition
* AWS::Greengrass::SubscriptionDefinitionVersion

## Attribute Changes


## Property Changes

* AWS::AppStream::Fleet Tags (__added__)
* AWS::AppStream::ImageBuilder Tags (__added__)
* AWS::AppStream::Stack Tags (__added__)
* AWS::SageMaker::NotebookInstance RootAccess (__added__)

## Property Type Changes

* AWS::CodeBuild::Project.GitSubmodulesConfig (__added__)
* AWS::CodeBuild::Project.S3LogsConfig EncryptionDisabled (__added__)
* AWS::CodeBuild::Project.Source GitSubmodulesConfig (__added__)

# Serverless Application Model (SAM) Resource Specification v2016-10-31

## New Resource Types


## Attribute Changes


## Property Changes

* AWS::Serverless::Application Location.PrimitiveType (__deleted__)
* AWS::Serverless::Application Location.PrimitiveTypes (__added__)

## Property Type Changes

* AWS::Serverless::Api.Auth Authorizers.Type (__deleted__)
* AWS::Serverless::Api.Auth Authorizers.PrimitiveType (__added__)

# CloudFormation Resource Specification v2.26.0

## New Resource Types


## Attribute Changes


## Property Changes

* AWS::SSM::PatchBaseline Tags (__added__)
* AWS::StepFunctions::Activity Tags (__added__)
* AWS::StepFunctions::StateMachine Tags (__added__)

## Property Type Changes

* AWS::StepFunctions::Activity.TagsEntry (__added__)
* AWS::StepFunctions::StateMachine.TagsEntry (__added__)
* Tag Key.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-resource-tags.html#cfn-resource-tags-key
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-dms-endpoint-tag.html#cfn-dms-endpoint-tag-key
* Tag Key.Required (__changed__)
  * Old: true
  * New: false
* Tag Value.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-resource-tags.html#cfn-resource-tags-value
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-dms-endpoint-tag.html#cfn-dms-endpoint-tag-value
* Tag Value.Required (__changed__)
  * Old: true
  * New: false


# CloudFormation Resource Specification v2.25.0

## New Resource Types


## Attribute Changes


## Property Changes

* AWS::ApiGateway::Authorizer Type.Required (__changed__)
  * Old: false
  * New: true
* AWS::CloudWatch::Alarm Metrics (__added__)
* AWS::EC2::VPCEndpoint VPCEndpointType (__deleted__)
* AWS::EC2::VPCEndpoint VpcEndpointType (__added__)
* AWS::ECS::Cluster Tags (__deleted__)
* AWS::ECS::Service Tags (__deleted__)
* AWS::ECS::TaskDefinition Tags (__deleted__)
* AWS::ElasticLoadBalancingV2::TargetGroup HealthCheckEnabled (__added__)
* AWS::ElasticLoadBalancingV2::TargetGroup Port.Required (__changed__)
  * Old: true
  * New: false
* AWS::ElasticLoadBalancingV2::TargetGroup Protocol.Required (__changed__)
  * Old: true
  * New: false
* AWS::ElasticLoadBalancingV2::TargetGroup VpcId.Required (__changed__)
  * Old: true
  * New: false
* AWS::SNS::Subscription Protocol.Required (__changed__)
  * Old: false
  * New: true
* AWS::SNS::Subscription TopicArn.Required (__changed__)
  * Old: false
  * New: true
* AWS::SSM::MaintenanceWindow Tags (__added__)

## Property Type Changes

* AWS::CloudWatch::Alarm.Metric (__added__)
* AWS::CloudWatch::Alarm.MetricDataQuery (__added__)
* AWS::CloudWatch::Alarm.MetricStat (__added__)
* Tag Key.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-iotanalytics-datastore-tag.html#cfn-iotanalytics-datastore-tag-key
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-resource-tags.html#cfn-resource-tags-key
* Tag Value.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-iotanalytics-datastore-tag.html#cfn-iotanalytics-datastore-tag-value
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-resource-tags.html#cfn-resource-tags-value


# CloudFormation Resource Specification v2.24.0

## New Resource Types

* AWS::ApiGatewayV2::Api
* AWS::ApiGatewayV2::Authorizer
* AWS::ApiGatewayV2::Deployment
* AWS::ApiGatewayV2::Integration
* AWS::ApiGatewayV2::IntegrationResponse
* AWS::ApiGatewayV2::Model
* AWS::ApiGatewayV2::Route
* AWS::ApiGatewayV2::RouteResponse
* AWS::ApiGatewayV2::Stage
* AWS::FSx::FileSystem
* AWS::KinesisAnalyticsV2::Application
* AWS::KinesisAnalyticsV2::ApplicationCloudWatchLoggingOption
* AWS::KinesisAnalyticsV2::ApplicationOutput
* AWS::KinesisAnalyticsV2::ApplicationReferenceDataSource
* AWS::RAM::ResourceShare
* AWS::RoboMaker::Fleet
* AWS::RoboMaker::Robot
* AWS::RoboMaker::RobotApplication
* AWS::RoboMaker::RobotApplicationVersion
* AWS::RoboMaker::SimulationApplication
* AWS::RoboMaker::SimulationApplicationVersion

## Attribute Changes


## Property Changes

* AWS::OpsWorksCM::Server AssociatePublicIpAddress (__added__)

## Property Type Changes

* AWS::CodeBuild::Project.FilterGroup (__added__)
* AWS::CodeBuild::Project.WebhookFilter (__added__)
* AWS::EC2::LaunchTemplate.CapacityReservationPreference (__added__)
* AWS::EC2::LaunchTemplate.CapacityReservationSpecification (__added__)
* AWS::EC2::LaunchTemplate.CapacityReservationTarget (__added__)
* AWS::EC2::LaunchTemplate.CpuOptions (__added__)
* AWS::EC2::LaunchTemplate.HibernationOptions (__added__)
* AWS::EC2::LaunchTemplate.LaunchTemplateElasticInferenceAccelerator (__added__)
* AWS::EC2::LaunchTemplate.LicenseSpecification (__added__)
* AWS::CodeBuild::Project.ProjectCache Modes (__added__)
* AWS::CodeBuild::Project.ProjectTriggers FilterGroups (__added__)
* AWS::EC2::LaunchTemplate.LaunchTemplateData CapacityReservationSpecification (__added__)
* AWS::EC2::LaunchTemplate.LaunchTemplateData CpuOptions (__added__)
* AWS::EC2::LaunchTemplate.LaunchTemplateData ElasticInferenceAccelerators (__added__)
* AWS::EC2::LaunchTemplate.LaunchTemplateData HibernationOptions (__added__)
* AWS::EC2::LaunchTemplate.LaunchTemplateData LicenseSpecifications (__added__)
* Tag Key.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-dms-endpoint-tag.html#cfn-dms-endpoint-tag-key
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-iotanalytics-datastore-tag.html#cfn-iotanalytics-datastore-tag-key
* Tag Key.Required (__changed__)
  * Old: false
  * New: true
* Tag Value.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-dms-endpoint-tag.html#cfn-dms-endpoint-tag-value
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-iotanalytics-datastore-tag.html#cfn-iotanalytics-datastore-tag-value
* Tag Value.Required (__changed__)
  * Old: false
  * New: true

# Serverless Application Model (SAM) Resource Specification v2016-10-31

## New Resource Types

* AWS::Serverless::Application
* AWS::Serverless::LayerVersion

## Attribute Changes


## Property Changes

* AWS::Serverless::Api Auth (__added__)
* AWS::Serverless::Api BinaryMediaTypes (__added__)
* AWS::Serverless::Api Cors (__added__)
* AWS::Serverless::Api EndpointConfiguration (__added__)
* AWS::Serverless::Function AutoPublishAlias (__added__)
* AWS::Serverless::Function DeploymentPreference (__added__)
* AWS::Serverless::Function Layers (__added__)
* AWS::Serverless::Function ReservedConcurrentExecutions (__added__)
* AWS::Serverless::SimpleTable SSESpecification (__added__)
* AWS::Serverless::SimpleTable TableName (__added__)
* AWS::Serverless::SimpleTable Tags (__added__)

## Property Type Changes

* AWS::Serverless::Api.Auth (__added__)
* AWS::Serverless::Function.DeploymentPreference (__added__)
* AWS::Serverless::SimpleTable.SSESpecification (__added__)



# CloudFormation Resource Specification v2.21.0

## New Resource Types

* AWS::DocDB::DBCluster
* AWS::DocDB::DBClusterParameterGroup
* AWS::DocDB::DBInstance
* AWS::DocDB::DBSubnetGroup
* AWS::Lambda::LayerVersion
* AWS::Lambda::LayerVersionPermission
* AWS::OpsWorksCM::Server
* AWS::Route53Resolver::ResolverRuleAssociation

## Attribute Changes

* AWS::Route53Resolver::ResolverRule Name (__added__)

## Property Changes

* AWS::AmazonMQ::Broker Tags (__added__)
* AWS::AmazonMQ::Configuration Tags (__added__)
* AWS::ApiGateway::ApiKey Value (__added__)
* AWS::DMS::Endpoint ElasticsearchSettings (__added__)
* AWS::DMS::Endpoint KinesisSettings (__added__)
* AWS::EC2::EC2Fleet ValidFrom.PrimitiveType (__changed__)
  * Old: Integer
  * New: String
* AWS::EC2::EC2Fleet ValidUntil.PrimitiveType (__changed__)
  * Old: Integer
  * New: String
* AWS::ECS::Cluster Tags (__added__)
* AWS::ECS::Service Tags (__added__)
* AWS::ECS::TaskDefinition Tags (__added__)
* AWS::Elasticsearch::Domain NodeToNodeEncryptionOptions (__added__)
* AWS::Inspector::AssessmentTarget ResourceGroupArn.Required (__changed__)
  * Old: true
  * New: false
* AWS::RDS::DBCluster SourceRegion (__added__)
* AWS::RDS::DBInstance UseDefaultProcessorFeatures (__added__)
* AWS::ServiceCatalog::CloudFormationProvisionedProduct ProductId.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::ServiceCatalog::CloudFormationProvisionedProduct ProductName.UpdateType (__changed__)
  * Old: Immutable
  * New: Mutable
* AWS::ServiceDiscovery::Service HealthCheckCustomConfig.UpdateType (__changed__)
  * Old: Mutable
  * New: Immutable

## Property Type Changes

* AWS::AmazonMQ::Broker.TagsEntry (__added__)
* AWS::AmazonMQ::Configuration.TagsEntry (__added__)
* AWS::CodeBuild::Project.RegistryCredential (__added__)
* AWS::DMS::Endpoint.ElasticsearchSettings (__added__)
* AWS::DMS::Endpoint.KinesisSettings (__added__)
* AWS::Elasticsearch::Domain.NodeToNodeEncryptionOptions (__added__)
* AWS::CodeBuild::Project.Environment ImagePullCredentialsType (__added__)
* AWS::CodeBuild::Project.Environment RegistryCredential (__added__)
* Tag Key.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-resource-tags.html#cfn-resource-tags-key
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-dms-endpoint-tag.html#cfn-dms-endpoint-tag-key
* Tag Key.Required (__changed__)
  * Old: true
  * New: false
* Tag Value.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-resource-tags.html#cfn-resource-tags-value
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-dms-endpoint-tag.html#cfn-dms-endpoint-tag-value
* Tag Value.Required (__changed__)
  * Old: true
  * New: false


# CloudFormation Resource Specification v2.18.0

## New Resource Types

* AWS::AmazonMQ::ConfigurationAssociation
* AWS::IoTAnalytics::Channel
* AWS::IoTAnalytics::Dataset
* AWS::IoTAnalytics::Datastore
* AWS::IoTAnalytics::Pipeline

## Attribute Changes

* AWS::AmazonMQ::Broker BrokerId (__deleted__)
* AWS::AmazonMQ::Broker AmqpEndpoints (__added__)
* AWS::AmazonMQ::Broker Arn (__added__)
* AWS::AmazonMQ::Broker ConfigurationId (__added__)
* AWS::AmazonMQ::Broker ConfigurationRevision (__added__)
* AWS::AmazonMQ::Broker IpAddresses (__added__)
* AWS::AmazonMQ::Broker MqttEndpoints (__added__)
* AWS::AmazonMQ::Broker OpenWireEndpoints (__added__)
* AWS::AmazonMQ::Broker StompEndpoints (__added__)
* AWS::AmazonMQ::Broker WssEndpoints (__added__)

## Property Changes

* AWS::SageMaker::Model Containers (__added__)
* AWS::SageMaker::Model PrimaryContainer.Required (__changed__)
  * Old: true
  * New: false
* AWS::ServiceDiscovery::Instance InstanceAttributes.PrimitiveType (__changed__)
  * Old: Json
  * New: Map

## Property Type Changes

* AWS::SageMaker::EndpointConfig.ProductionVariant AcceleratorType (__added__)


# CloudFormation Resource Specification v2.16.0

## New Resource Types

* AWS::AppSync::FunctionConfiguration
* AWS::CloudFormation::Macro
* AWS::EC2::EC2Fleet
* AWS::EC2::TransitGateway
* AWS::EC2::TransitGatewayAttachment
* AWS::EC2::TransitGatewayRoute
* AWS::EC2::TransitGatewayRouteTable
* AWS::EC2::TransitGatewayRouteTableAssociation
* AWS::EC2::TransitGatewayRouteTablePropagation
* AWS::Kinesis::StreamConsumer
* AWS::Route53Resolver::ResolverEndpoint
* AWS::Route53Resolver::ResolverRule
* AWS::ServiceDiscovery::HttpNamespace
* Alexa::ASK::Skill

## Attribute Changes


## Property Changes

* AWS::ApiGateway::Stage Tags (__added__)
* AWS::AutoScaling::AutoScalingGroup MixedInstancesPolicy (__added__)
* AWS::Batch::JobDefinition NodeProperties (__added__)
* AWS::Batch::JobDefinition ContainerProperties.Required (__changed__)
  * Old: true
  * New: false
* AWS::CloudWatch::Alarm MetricName.Required (__changed__)
  * Old: true
  * New: false
* AWS::CloudWatch::Alarm Namespace.Required (__changed__)
  * Old: true
  * New: false
* AWS::CloudWatch::Alarm Period.Required (__changed__)
  * Old: true
  * New: false
* AWS::DynamoDB::Table BillingMode (__added__)
* AWS::DynamoDB::Table ProvisionedThroughput.Required (__changed__)
  * Old: true
  * New: false
* AWS::EC2::EIP PublicIpv4Pool (__added__)
* AWS::EC2::Instance ElasticInferenceAccelerators (__added__)
* AWS::EC2::Instance LicenseSpecifications (__added__)
* AWS::EMR::Cluster Steps (__added__)
* AWS::IoT1Click::Placement PlacementName.Required (__changed__)
  * Old: true
  * New: false
* AWS::IoT1Click::Project ProjectName.Required (__changed__)
  * Old: true
  * New: false
* AWS::Lambda::Function Layers (__added__)
* AWS::RDS::DBCluster DeletionProtection (__added__)
* AWS::RDS::DBInstance DeleteAutomatedBackups (__added__)
* AWS::RDS::DBInstance DeletionProtection (__added__)
* AWS::S3::Bucket PublicAccessBlockConfiguration (__added__)
* AWS::SNS::Topic KmsMasterKeyId (__added__)

## Property Type Changes

* AWS::AutoScaling::AutoScalingGroup.InstancesDistribution (__added__)
* AWS::AutoScaling::AutoScalingGroup.LaunchTemplate (__added__)
* AWS::AutoScaling::AutoScalingGroup.LaunchTemplateOverrides (__added__)
* AWS::AutoScaling::AutoScalingGroup.MixedInstancesPolicy (__added__)
* AWS::Batch::ComputeEnvironment.LaunchTemplateSpecification (__added__)
* AWS::Batch::JobDefinition.NodeProperties (__added__)
* AWS::Batch::JobDefinition.NodeRangeProperty (__added__)
* AWS::EC2::Instance.ElasticInferenceAccelerator (__added__)
* AWS::EC2::Instance.LicenseSpecification (__added__)
* AWS::EMR::Cluster.HadoopJarStepConfig (__added__)
* AWS::EMR::Cluster.KeyValue (__added__)
* AWS::EMR::Cluster.StepConfig (__added__)
* AWS::ElasticLoadBalancingV2::Listener.AuthenticateCognitoConfig (__added__)
* AWS::ElasticLoadBalancingV2::Listener.AuthenticateOidcConfig (__added__)
* AWS::ElasticLoadBalancingV2::Listener.FixedResponseConfig (__added__)
* AWS::ElasticLoadBalancingV2::Listener.RedirectConfig (__added__)
* AWS::ElasticLoadBalancingV2::ListenerRule.AuthenticateCognitoConfig (__added__)
* AWS::ElasticLoadBalancingV2::ListenerRule.AuthenticateOidcConfig (__added__)
* AWS::ElasticLoadBalancingV2::ListenerRule.FixedResponseConfig (__added__)
* AWS::ElasticLoadBalancingV2::ListenerRule.RedirectConfig (__added__)
* AWS::S3::Bucket.PublicAccessBlockConfiguration (__added__)
* AWS::ApiGateway::Deployment.StageDescription Tags (__added__)
* AWS::Batch::ComputeEnvironment.ComputeResources LaunchTemplate (__added__)
* AWS::Batch::ComputeEnvironment.ComputeResources PlacementGroup (__added__)
* AWS::Batch::JobDefinition.ContainerProperties InstanceType (__added__)
* AWS::DynamoDB::Table.GlobalSecondaryIndex ProvisionedThroughput.Required (__changed__)
  * Old: true
  * New: false
* AWS::EMR::Cluster.JobFlowInstancesConfig KeepJobFlowAliveWhenNoSteps (__added__)
* AWS::ElasticLoadBalancingV2::Listener.Action AuthenticateCognitoConfig (__added__)
* AWS::ElasticLoadBalancingV2::Listener.Action AuthenticateOidcConfig (__added__)
* AWS::ElasticLoadBalancingV2::Listener.Action FixedResponseConfig (__added__)
* AWS::ElasticLoadBalancingV2::Listener.Action Order (__added__)
* AWS::ElasticLoadBalancingV2::Listener.Action RedirectConfig (__added__)
* AWS::ElasticLoadBalancingV2::Listener.Action TargetGroupArn.Required (__changed__)
  * Old: true
  * New: false
* AWS::ElasticLoadBalancingV2::ListenerRule.Action AuthenticateCognitoConfig (__added__)
* AWS::ElasticLoadBalancingV2::ListenerRule.Action AuthenticateOidcConfig (__added__)
* AWS::ElasticLoadBalancingV2::ListenerRule.Action FixedResponseConfig (__added__)
* AWS::ElasticLoadBalancingV2::ListenerRule.Action Order (__added__)
* AWS::ElasticLoadBalancingV2::ListenerRule.Action RedirectConfig (__added__)
* AWS::ElasticLoadBalancingV2::ListenerRule.Action TargetGroupArn.Required (__changed__)
  * Old: true
  * New: false




# CloudFormation Resource Specification v2.13.0

## New Resource Types

* AWS::DLM::LifecyclePolicy
* AWS::SecretsManager::ResourcePolicy
* AWS::SecretsManager::RotationSchedule
* AWS::SecretsManager::Secret
* AWS::SecretsManager::SecretTargetAttachment

## Attribute Changes

* AWS::AutoScalingPlans::ScalingPlan ScalingPlanName (__added__)
* AWS::AutoScalingPlans::ScalingPlan ScalingPlanVersion (__added__)
* AWS::S3::Bucket RegionalDomainName (__added__)

## Property Changes

* AWS::ApiGateway::Stage TracingEnabled (__added__)
* AWS::AppSync::DataSource RelationalDatabaseConfig (__added__)
* AWS::AppSync::Resolver Kind (__added__)
* AWS::AppSync::Resolver PipelineConfig (__added__)
* AWS::AppSync::Resolver DataSourceName.Required (__changed__)
  * Old: true
  * New: false
* AWS::CloudFormation::WaitCondition Handle.Required (__changed__)
  * Old: true
  * New: false
* AWS::CloudFormation::WaitCondition Timeout.Required (__changed__)
  * Old: true
  * New: false
* AWS::CloudWatch::Alarm DatapointsToAlarm (__added__)
* AWS::CodeBuild::Project QueuedTimeoutInMinutes (__added__)
* AWS::CodePipeline::Pipeline ArtifactStores (__added__)
* AWS::CodePipeline::Pipeline ArtifactStore.Required (__changed__)
  * Old: true
  * New: false
* AWS::EC2::SecurityGroupIngress SourcePrefixListId (__added__)
* AWS::IAM::Role PermissionsBoundary (__added__)
* AWS::IAM::User PermissionsBoundary (__added__)
* AWS::KMS::Key PendingWindowInDays (__added__)
* AWS::RDS::DBCluster BacktrackWindow (__added__)
* AWS::RDS::DBCluster EnableCloudwatchLogsExports (__added__)
* AWS::RDS::DBCluster EnableIAMDatabaseAuthentication (__added__)
* AWS::RDS::DBInstance EnableCloudwatchLogsExports (__added__)
* AWS::RDS::DBInstance EnableIAMDatabaseAuthentication (__added__)
* AWS::RDS::DBInstance EnablePerformanceInsights (__added__)
* AWS::RDS::DBInstance PerformanceInsightsKMSKeyId (__added__)
* AWS::RDS::DBInstance PerformanceInsightsRetentionPeriod (__added__)
* AWS::RDS::DBInstance ProcessorFeatures (__added__)
* AWS::RDS::DBInstance PromotionTier (__added__)
* AWS::Route53::RecordSet MultiValueAnswer (__added__)
* AWS::SageMaker::NotebookInstance VolumeSizeInGB (__added__)
* AWS::ServiceDiscovery::Service NamespaceId (__added__)
* AWS::ServiceDiscovery::Service DnsConfig.Required (__changed__)
  * Old: true
  * New: false
* AWS::WorkSpaces::Workspace Tags (__added__)
* AWS::WorkSpaces::Workspace WorkspaceProperties (__added__)

## Property Type Changes

* AWS::AppSync::DataSource.AuthorizationConfig (__added__)
* AWS::AppSync::DataSource.AwsIamConfig (__added__)
* AWS::AppSync::DataSource.RdsHttpEndpointConfig (__added__)
* AWS::AppSync::DataSource.RelationalDatabaseConfig (__added__)
* AWS::AppSync::Resolver.PipelineConfig (__added__)
* AWS::AutoScalingPlans::ScalingPlan.CustomizedLoadMetricSpecification (__added__)
* AWS::AutoScalingPlans::ScalingPlan.PredefinedLoadMetricSpecification (__added__)
* AWS::CodePipeline::Pipeline.ArtifactStoreMap (__added__)
* AWS::IoT::TopicRule.IotAnalyticsAction (__added__)
* AWS::IoT::TopicRule.StepFunctionsAction (__added__)
* AWS::RDS::DBInstance.ProcessorFeature (__added__)
* AWS::WorkSpaces::Workspace.WorkspaceProperties (__added__)
* AWS::ApiGateway::Deployment.StageDescription TracingEnabled (__added__)
* AWS::AppSync::DataSource.HttpConfig AuthorizationConfig (__added__)
* AWS::AutoScalingPlans::ScalingPlan.ScalingInstruction CustomizedLoadMetricSpecification (__added__)
* AWS::AutoScalingPlans::ScalingPlan.ScalingInstruction DisableDynamicScaling (__added__)
* AWS::AutoScalingPlans::ScalingPlan.ScalingInstruction PredefinedLoadMetricSpecification (__added__)
* AWS::AutoScalingPlans::ScalingPlan.ScalingInstruction PredictiveScalingMaxCapacityBehavior (__added__)
* AWS::AutoScalingPlans::ScalingPlan.ScalingInstruction PredictiveScalingMaxCapacityBuffer (__added__)
* AWS::AutoScalingPlans::ScalingPlan.ScalingInstruction PredictiveScalingMode (__added__)
* AWS::AutoScalingPlans::ScalingPlan.ScalingInstruction ScalingPolicyUpdateBehavior (__added__)
* AWS::AutoScalingPlans::ScalingPlan.ScalingInstruction ScheduledActionBufferTime (__added__)
* AWS::CodePipeline::Pipeline.ActionDeclaration Region (__added__)
* AWS::EC2::SecurityGroup.Ingress SourcePrefixListId (__added__)
* AWS::EC2::SpotFleet.SpotFleetTagSpecification Tags (__added__)
* AWS::IoT::TopicRule.Action IotAnalytics (__added__)
* AWS::IoT::TopicRule.Action StepFunctions (__added__)
* AWS::IoT::TopicRule.TopicRulePayload ErrorAction (__added__)
* AWS::OpsWorks::Layer.VolumeConfiguration Encrypted (__added__)
* AWS::RDS::DBCluster.ScalingConfiguration SecondsBeforeAutoPause (__deleted__)
* AWS::RDS::DBCluster.ScalingConfiguration SecondsUntilAutoPause (__added__)
* AWS::Route53::RecordSetGroup.RecordSet MultiValueAnswer (__added__)
* AWS::ServiceDiscovery::Service.DnsConfig NamespaceId.Required (__changed__)
  * Old: true
  * New: false
* Tag Key.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-dms-endpoint-tag.html#cfn-dms-endpoint-tag-key
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-resource-tags.html#cfn-resource-tags-key
* Tag Key.Required (__changed__)
  * Old: false
  * New: true
* Tag Value.Documentation (__changed__)
  * Old: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-dms-endpoint-tag.html#cfn-dms-endpoint-tag-value
  * New: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-resource-tags.html#cfn-resource-tags-value
* Tag Value.Required (__changed__)
  * Old: false
  * New: true

