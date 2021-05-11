import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecr from '@aws-cdk/aws-ecr';
import { DockerImageAsset, DockerImageAssetProps } from '@aws-cdk/aws-ecr-assets';
import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import * as s3 from '@aws-cdk/aws-s3';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import { Duration, Size } from '@aws-cdk/core';
import { Construct } from 'constructs';

/**
 * Task to train a machine learning model using Amazon SageMaker
 */
export interface ISageMakerTask extends iam.IGrantable {}

/**
 * Specify the training algorithm and algorithm-specific metadata
 */
export interface AlgorithmSpecification {

  /**
   * Name of the algorithm resource to use for the training job.
   * This must be an algorithm resource that you created or subscribe to on AWS Marketplace.
   * If you specify a value for this parameter, you can't specify a value for TrainingImage.
   *
   * @default - No algorithm is specified
   */
  readonly algorithmName?: string;

  /**
   * List of metric definition objects. Each object specifies the metric name and regular expressions used to parse algorithm logs.
   *
   * @default - No metrics
   */
  readonly metricDefinitions?: MetricDefinition[];

  /**
   * Registry path of the Docker image that contains the training algorithm.
   *
   * @default - No Docker image is specified
   */
  readonly trainingImage?: DockerImage;

  /**
   * Input mode that the algorithm supports.
   *
   * @default 'File' mode
   */
  readonly trainingInputMode?: InputMode;
}

/**
 *  Describes the training, validation or test dataset and the Amazon S3 location where it is stored.
 *
 */
export interface Channel {

  /**
   * Name of the channel
   */
  readonly channelName: string;

  /**
   * Compression type if training data is compressed
   *
   * @default - None
   */
  readonly compressionType?: CompressionType;

  /**
   * The MIME type of the data.
   *
   * @default - None
   */
  readonly contentType?: string;

  /**
   * Location of the channel data.
   */
  readonly dataSource: DataSource;

  /**
   * Input mode to use for the data channel in a training job.
   *
   * @default - None
   */
  readonly inputMode?: InputMode;

  /**
   * Specify RecordIO as the value when input data is in raw format but the training algorithm requires the RecordIO format.
   * In this case, Amazon SageMaker wraps each individual S3 object in a RecordIO record.
   * If the input data is already in RecordIO format, you don't need to set this attribute.
   *
   * @default - None
   */
  readonly recordWrapperType?: RecordWrapperType;

  /**
   * Shuffle config option for input data in a channel.
   *
   * @default - None
   */
  readonly shuffleConfig?: ShuffleConfig;
}

/**
 * Configuration for a shuffle option for input data in a channel.
 *
 */
export interface ShuffleConfig {
  /**
   * Determines the shuffling order.
   */
  readonly seed: number;
}

/**
 * Location of the channel data.
 *
 */
export interface DataSource {
  /**
   * S3 location of the data source that is associated with a channel.
   */
  readonly s3DataSource: S3DataSource;
}

/**
 * S3 location of the channel data.
 *
 * @see https://docs.aws.amazon.com/sagemaker/latest/APIReference/API_S3DataSource.html
 *
 */
export interface S3DataSource {
  /**
   * List of one or more attribute names to use that are found in a specified augmented manifest file.
   *
   * @default - No attribute names
   */
  readonly attributeNames?: string[];

  /**
   * S3 Data Distribution Type
   *
   * @default - None
   */
  readonly s3DataDistributionType?: S3DataDistributionType;

  /**
   * S3 Data Type
   *
   * @default S3_PREFIX
   */
  readonly s3DataType?: S3DataType;

  /**
   * S3 Uri
   */
  readonly s3Location: S3Location;
}

/**
 * Configures the S3 bucket where SageMaker will save the result of model training
 */
export interface OutputDataConfig {
  /**
   * Optional KMS encryption key that Amazon SageMaker uses to encrypt the model artifacts at rest using Amazon S3 server-side encryption.
   *
   * @default - Amazon SageMaker uses the default KMS key for Amazon S3 for your role's account
   */
  readonly encryptionKey?: kms.IKey;

  /**
   * Identifies the S3 path where you want Amazon SageMaker to store the model artifacts.
   */
  readonly s3OutputLocation: S3Location;
}

/**
 * Specifies a limit to how long a model training job can run.
 * When the job reaches the time limit, Amazon SageMaker ends the training job.
 *
 */
export interface StoppingCondition {
  /**
   * The maximum length of time, in seconds, that the training or compilation job can run.
   *
   * @default - 1 hour
   */
  readonly maxRuntime?: Duration;
}

/**
 * Specifies the resources, ML compute instances, and ML storage volumes to deploy for model training.
 *
 */
export interface ResourceConfig {

  /**
   * The number of ML compute instances to use.
   *
   * @default 1 instance.
   */
  readonly instanceCount: number;

  /**
   * ML compute instance type.
   *
   * @default is the 'm4.xlarge' instance type.
   */
  readonly instanceType: ec2.InstanceType;

  /**
   * KMS key that Amazon SageMaker uses to encrypt data on the storage volume attached to the ML compute instance(s) that run the training job.
   *
   * @default - Amazon SageMaker uses the default KMS key for Amazon S3 for your role's account
   */
  readonly volumeEncryptionKey?: kms.IKey;

  /**
   * Size of the ML storage volume that you want to provision.
   *
   * @default 10 GB EBS volume.
   */
  readonly volumeSize: Size;
}

/**
 * Specifies the VPC that you want your Amazon SageMaker training job to connect to.
 *
 */
export interface VpcConfig {
  /**
   * VPC
   */
  readonly vpc: ec2.IVpc;

  /**
   * VPC subnets.
   *
   * @default - Private Subnets are selected
   */
  readonly subnets?: ec2.SubnetSelection;
}

/**
 * Specifies the metric name and regular expressions used to parse algorithm logs.
 *
 */
export interface MetricDefinition {

  /**
   * Name of the metric.
   */
  readonly name: string;

  /**
   * Regular expression that searches the output of a training job and gets the value of the metric.
   */
  readonly regex: string;
}

/**
 * Stores information about the location of an object in Amazon S3
 *
 */
export interface S3LocationConfig {

  /**
   * Uniquely identifies the resource in Amazon S3
   */
  readonly uri: string;
}

/**
 * Constructs `IS3Location` objects.
 *
 */
export abstract class S3Location {
  /**
   * An `IS3Location` built with a determined bucket and key prefix.
   *
   * @param bucket    is the bucket where the objects are to be stored.
   * @param keyPrefix is the key prefix used by the location.
   */
  public static fromBucket(bucket: s3.IBucket, keyPrefix: string): S3Location {
    return new StandardS3Location({ bucket, keyPrefix, uri: bucket.urlForObject(keyPrefix) });
  }

  /**
   * An `IS3Location` determined fully by a JSON Path from the task input.
   *
   * Due to the dynamic nature of those locations, the IAM grants that will be set by `grantRead` and `grantWrite`
   * apply to the `*` resource.
   *
   * @param expression the JSON expression resolving to an S3 location URI.
   */
  public static fromJsonExpression(expression: string): S3Location {
    return new StandardS3Location({ uri: sfn.JsonPath.stringAt(expression) });
  }

  /**
   * Called when the S3Location is bound to a StepFunctions task.
   */
  public abstract bind(task: ISageMakerTask, opts: S3LocationBindOptions): S3LocationConfig;
}

/**
 * Options for binding an S3 Location.
 *
 */
export interface S3LocationBindOptions {
  /**
   * Allow reading from the S3 Location.
   *
   * @default false
   */
  readonly forReading?: boolean;

  /**
   * Allow writing to the S3 Location.
   *
   * @default false
   */
  readonly forWriting?: boolean;
}

/**
 * Configuration for a using Docker image.
 *
 */
export interface DockerImageConfig {
  /**
   * The fully qualified URI of the Docker image.
   */
  readonly imageUri: string;
}

/**
 * Creates `IDockerImage` instances.
 *
 */
export abstract class DockerImage {
  /**
   * Reference a Docker image stored in an ECR repository.
   *
   * @param repository the ECR repository where the image is hosted.
   * @param tag an optional `tag`
   */
  public static fromEcrRepository(repository: ecr.IRepository, tag: string = 'latest'): DockerImage {
    return new StandardDockerImage({ repository, imageUri: repository.repositoryUriForTag(tag) });
  }

  /**
   * Reference a Docker image which URI is obtained from the task's input.
   *
   * @param expression           the JSON path expression with the task input.
   * @param allowAnyEcrImagePull whether ECR access should be permitted (set to `false` if the image will never be in ECR).
   */
  public static fromJsonExpression(expression: string, allowAnyEcrImagePull = true): DockerImage {
    return new StandardDockerImage({ imageUri: expression, allowAnyEcrImagePull });
  }

  /**
   * Reference a Docker image by it's URI.
   *
   * When referencing ECR images, prefer using `inEcr`.
   *
   * @param imageUri the URI to the docker image.
   */
  public static fromRegistry(imageUri: string): DockerImage {
    return new StandardDockerImage({ imageUri });
  }

  /**
   * Reference a Docker image that is provided as an Asset in the current app.
   *
   * @param scope the scope in which to create the Asset.
   * @param id    the ID for the asset in the construct tree.
   * @param props the configuration props of the asset.
   */
  public static fromAsset(scope: Construct, id: string, props: DockerImageAssetProps): DockerImage {
    const asset = new DockerImageAsset(scope, id, props);
    return new StandardDockerImage({ repository: asset.repository, imageUri: asset.imageUri });
  }

  /**
   * Called when the image is used by a SageMaker task.
   */
  public abstract bind(task: ISageMakerTask): DockerImageConfig;
}

/**
 * S3 Data Type.
 *
 */
export enum S3DataType {
  /**
   * Manifest File Data Type
   */
  MANIFEST_FILE = 'ManifestFile',

  /**
   * S3 Prefix Data Type
   */
  S3_PREFIX = 'S3Prefix',

  /**
   * Augmented Manifest File Data Type
   */
  AUGMENTED_MANIFEST_FILE = 'AugmentedManifestFile'
}

/**
 * S3 Data Distribution Type.
 *
 */
export enum S3DataDistributionType {
  /**
   * Fully replicated S3 Data Distribution Type
   */
  FULLY_REPLICATED = 'FullyReplicated',

  /**
   * Sharded By S3 Key Data Distribution Type
   */
  SHARDED_BY_S3_KEY = 'ShardedByS3Key'
}

/**
 * Define the format of the input data.
 *
 */
export enum RecordWrapperType {
  /**
   * None record wrapper type
   */
  NONE = 'None',

  /**
   * RecordIO record wrapper type
   */
  RECORD_IO = 'RecordIO'
}

/**
 *  Input mode that the algorithm supports.
 *
 */
export enum InputMode {
  /**
   * Pipe mode
   */
  PIPE = 'Pipe',

  /**
   * File mode.
   */
  FILE = 'File'
}

/**
 * Compression type of the data.
 *
 */
export enum CompressionType {
  /**
   * None compression type
   */
  NONE = 'None',

  /**
   * Gzip compression type
   */
  GZIP = 'Gzip'
}

//
// Create Processing Job types
//

/**
 * Configures the processing job to run a specified Docker container image.
 */
export interface AppSpecification {
  /**
   * The arguments for a container used to run a processing job.
   *
   * @see https://docs.aws.amazon.com/sagemaker/latest/dg/build-your-own-processing-container.html
   *
   * @default None
   */
  readonly containerArguments?: string[];

  /**
   * The entrypoint for a container used to run a processing job.
   *
   * @see https://docs.aws.amazon.com/sagemaker/latest/dg/build-your-own-processing-container.html
   *
   * @default None
   */
  readonly containerEntrypoint?: string[];

  /**
   * The fully qualified ECR URI of the Docker image.
   * If you specify a value for this parameter, you can't specify a value for ImageUri.
   *
   * @default None
   */
  readonly containerImage?: DockerImage;

  /**
   * The fully qualified URI of the Docker image.
   * If you specify a value for this parameter, you can't specify a value for ContainerImage.
   *
   * @default None
   */
  readonly imageUri?: string;
}

/**
 * Associates a SageMaker job as a trial component with an experiment and trial. Specified when you call the
 * following APIs: CreateProcessingJob, CreateTrainingJob, CreateTransformJob
 */
export interface ExperimentConfig {
  /**
   * The name of an existing experiment to associate the trial component with.
   *
   * @default NONE
   */
  readonly experimentName?: string;

  /**
   * The display name for the trial component. If this key isn't specified, the display name is the trial component name.
   *
   * @default NONE
   */
  readonly trialComponentDisplayName?: string;

  /**
   * The name of an existing trial to associate the trial component with. If not specified, a new trial is created.
   *
   * @default NONE
   */
  readonly trialName?: string;
}

/**
 * Networking options for a job, such as network traffic encryption between containers, whether to allow inbound and
 * outbound network calls to and from containers, and the VPC subnets and security groups to use for VPC-enabled jobs.
 */
export interface NetworkConfig {
  /**
   * Whether to encrypt all communications between distributed processing jobs. Choose True to encrypt communications.
   * Encryption provides greater security for distributed processing jobs, but the processing might take longer.
   *
   * @default False
   */
  readonly enableInterContainerTrafficEncryption?: boolean;

  /**
   * Whether to allow inbound and outbound network calls to and from the containers used for the processing job.
   *
   * @default False
   */
  readonly enableNetworkIsolation?: boolean;

  /**
   * Specifies a VPC that your training jobs and hosted models have access to. Control access to and from your
   * training and model containers by configuring the VPC.
   *
   * @default - No VPC
   */
  readonly vpcConfig?: VpcConfig;
}

/**
 * Information about where and how you want to obtain the inputs for an processing job.
 */
export interface S3Input {
  /**
   * The local path to the Amazon S3 bucket where you want Amazon SageMaker to download the inputs to run a processing job.
   * LocalPath is an absolute path to the input data.
   */
  readonly localPath: string;

  /**
   * Whether to use Gzip compression for Amazon S3 storage.
   *
   * @default NONE
   */
  readonly s3CompressionType?: CompressionType;

  /**
   * Whether the data stored in Amazon S3 is FullyReplicated or ShardedByS3Key.
   *
   * @default NONE
   */
  readonly s3DataDistributionType?: S3DataDistributionType;

  /**
   * Whether you use an S3Prefix or a ManifestFile for the data type. If you choose S3Prefix, S3Uri identifies a key
   * name prefix. Amazon SageMaker uses all objects with the specified key name prefix for the processing job. If you
   * choose ManifestFile, S3Uri identifies an object that is a manifest file containing a list of object keys that you
   * want Amazon SageMaker to use for the processing job.
   */
  readonly s3DataType: S3DataType;

  /**
   * Whether to use File or Pipe input mode. In File mode, Amazon SageMaker copies the data from the input source onto
   * the local Amazon Elastic Block Store (Amazon EBS) volumes before starting your training algorithm. This is the
   * most commonly used input mode. In Pipe mode, Amazon SageMaker streams input data from the source directly to your
   * algorithm without using the EBS volume.
   */
  readonly s3InputMode: InputMode;

  /**
   * The URI for the Amazon S3 storage where you want Amazon SageMaker to download the artifacts needed to run a processing job.
   */
  readonly s3Uri: string;
}

/**
 * Configuration for processing job outputs in Amazon S3.
 */
export interface S3Output {
  /**
   * The local path to the Amazon S3 bucket where you want Amazon SageMaker to save the results of an processing job.
   * LocalPath is an absolute path to the input data.
   */
  readonly localPath: string;

  /**
   * Whether to upload the results of the processing job continuously or after the job completes.
   */
  readonly s3UploadMode: S3UploadMode;

  /**
   * A URI that identifies the Amazon S3 bucket where you want Amazon SageMaker to save the results of a processing job.
   */
  readonly s3Uri: string;
}

/**
 * The inputs for a processing job. The processing input must specify exactly one of either S3Input or DatasetDefinition types.
 */
export interface ProcessingInput {
  /**
   * When True, output operations such as data upload are managed natively by the processing job application.
   * When False (default when unspecified), output operations are managed by Amazon SageMaker.
   *
   * @default None
   */
  readonly appManaged?: boolean;

  /**
   * Configuration for a Dataset Definition input.
   *
   * @default None
   */
  readonly datasetDefinition?: DatasetDefinition;

  /**
   * The name of the inputs for the processing job.
   */
  readonly inputName: string;

  /**
   * The S3 inputs for the processing job.
   *
   * @default None
   */
  readonly s3Input?: S3Input;
}

/**
 * Configuration for Dataset Definition inputs. The Dataset Definition input must specify exactly one of either
 * AthenaDatasetDefinition or RedshiftDatasetDefinition types.
 */
export interface DatasetDefinition {
  /**
   * Configuration for Athena Dataset Definition input.
   *
   * @default None
   */
  readonly athenaDatasetDefinition?: AthenaDatasetDefinition;

  /**
   * Whether the generated dataset is FullyReplicated or ShardedByS3Key (default when unspecified).
   *
   * @default None
   */
  readonly dataDistributionType?: S3DataDistributionType;

  /**
   * Whether to use File or Pipe input mode. In File (default) mode, Amazon SageMaker copies the data from the input
   * source onto the local Amazon Elastic Block Store (Amazon EBS) volumes before starting your training algorithm.
   * This is the most commonly used input mode. In Pipe mode, Amazon SageMaker streams input data from the source
   * directly to your algorithm without using the EBS volume.
   *
   * @default None
   */
  readonly inputMode?: InputMode;

  /**
   * The local path where you want Amazon SageMaker to download the Dataset Definition inputs to run a processing job.
   * LocalPath is an absolute path to the input data. This is a required parameter when AppManaged is False (default).
   *
   * @default None
   */
  readonly localPath?: string;

  /**
   * Configuration for Redshift Dataset Definition input.
   *
   * @default None
   */
  readonly redshiftDatasetDefinition?: RedshiftDatasetDefinition;
}

/**
 * Configuration for Athena Dataset Definition input.
 */
export interface AthenaDatasetDefinition {
  /**
   * The name of the data catalog used in Athena query execution.
   */
  readonly catalog: string;

  /**
   * The name of the database used in the Athena query execution.
   */
  readonly database: string;

  /**
   * The AWS Key Management Service (AWS KMS) key that Amazon SageMaker uses to encrypt data generated from an Athena query execution.
   *
   * @default None
   */
  readonly encryptionKey?: kms.IKey;

  /**
   * The compression used for Athena query results.
   *
   * @default None
   */
  readonly outputCompression?: AthenaOutputCompressionType;

  /**
   * The data storage format for Athena query results.
   */
  readonly outputFormat: AthenaOutputFormat;

  /**
   * The location in Amazon S3 where Athena query results are stored.
   */
  readonly outputS3Uri: string;

  /**
   * The SQL query statements, to be executed.
   */
  readonly queryString: string;

  /**
   * The name of the workgroup in which the Athena query is being started.
   *
   * @default None
   */
  readonly workGroup?: string;
}

/**
 * Configuration for Redshift Dataset Definition input.
 */
export interface RedshiftDatasetDefinition {
  /**
   * The Redshift cluster Identifier.
   */
  readonly clusterId: string;

  /**
   * The IAM role attached to your Redshift cluster that Amazon SageMaker uses to generate datasets.
   */
  readonly clusterRoleArn: string;

  /**
   * The name of the Redshift database used in Redshift query execution.
   */
  readonly database: string;

  /**
   * The database user name used in Redshift query execution.
   */
  readonly dbUser: string;

  /**
   * The AWS Key Management Service (AWS KMS) key that Amazon SageMaker uses to encrypt data from a Redshift execution.
   *
   * @default None
   */
  readonly encryptionKey?: kms.IKey;

  /**
   * The compression used for Redshift query results.
   *
   * @default None
   */
  readonly outputCompression?: RedshiftCompressionType;

  /**
   * The data storage format for Redshift query results.
   */
  readonly outputFormat: RedshiftOutputFormat;

  /**
   * The location in Amazon S3 where the Redshift query results are stored.
   */
  readonly outputS3Uri : string;

  /**
   * The SQL query statements to be executed.
   */
  readonly queryString : string;
}

/**
 * The compression used for Athena query results.
 */
export enum AthenaOutputCompressionType {
  /**
   * Gzip compression type
   */
  GZIP = 'GZIP',

  /**
   * Snappy compression type
   */
  SNAPPY = 'SNAPPY',

  /**
   * Zlib compression type
   */
  ZLIB = 'ZLIB'
}

/**
 * The data storage format for Athena query results.
 */
export enum AthenaOutputFormat {
  /**
   * Parquet data storage format type
   */
  PARQUET = 'PARQUET',

  /**
   * Orc data storage format type
   */
  ORC = 'ORC',

  /**
   * Avro data storage format type
   */
  AVRO = 'AVRO',

  /**
   * Json data storage format type
   */
  JSON = 'JSON',

  /**
   * Textfile data storage format type
   */
  TEXTFILE = 'TEXTFILE'
}


/**
 * The compression used for Redshift query results.
 */
export enum RedshiftCompressionType {
  /**
   * No compression
   */
  NONE = 'None',

  /**
   * Gzip compression type
   */
  GZIP = 'GZIP',

  /**
   * BZip2 compression type
   */
  BZIP2 = 'BZIP2',

  /**
   * Zstd compression type
   */
  ZSTD = 'ZSTD',

  /**
   * Snappy compression type
   */
  SNAPPY = 'SNAPPY'
}

/**
 * The data storage format for Redshift query results.
 */
export enum RedshiftOutputFormat {
  /**
   * Parquet data storage format type
   */
  PARQUET = 'PARQUET',

  /**
   * Csv data storage format type
   */
  CSV = 'CSV'
}

/**
 * Information about where and how you want to store the results of an processing job.
 */
export interface ProcessingOutput {
  /**
   * When True, output operations such as data upload are managed natively by the processing job application.
   * When False (default), output operations are managed by Amazon SageMaker.
   *
   * @default False
   */
  readonly appManaged?: boolean;

  /**
   * Configuration for processing job outputs in Amazon SageMaker Feature Store.
   * This processing output type is only supported when AppManaged is specified.
   *
   * @default None
   */
  readonly featureStoreOutput?: ProcessingFeatureStoreOutput;

  /**
   * The name for the processing job output.
   */
  readonly outputName: string;

  /**
   * Configuration for processing job outputs in Amazon S3.
   */
  readonly s3Output: S3Output;
}


/**
 * Configuration for processing job outputs in Amazon SageMaker Feature Store.
 */
export interface ProcessingFeatureStoreOutput {
  /**
   * The name of the Amazon SageMaker FeatureGroup to use as the destination for processing job output.
   * Note that your processing script is responsible for putting records into your Feature Store.
   */
  readonly featureGroupName: string;
}

/**
 * Output configuration for the processing job.
 */
export interface ProcessingOutputConfig {
  /**
   * The AWS Key Management Service (AWS KMS) key that Amazon SageMaker uses to encrypt the processing job output.
   * KmsKeyId can be an ID of a KMS key, ARN of a KMS key, alias of a KMS key, or alias of a KMS key.
   * The KmsKeyId is applied to all outputs.
   *
   * @default None
   */
  readonly encryptionKey?: kms.IKey;

  /**
   * Output configuration information for a processing job.
   */
  readonly outputs: ProcessingOutput[];
}

/**
 * Identifies the resources, ML compute instances, and ML storage volumes to deploy for a processing job. In distributed
 * training, you specify more than one instance.
 */
export interface ProcessingResources {
  /**
   * Configuration for the cluster used to run a processing job.
   */
  readonly clusterConfig: ClusterConfig;
}

/**
 * The configuration for the resources in a cluster used to run the processing job.
 */
export interface ClusterConfig {
  /**
   * The number of ML compute instances to use.
   *
   * @default 1 instance.
   */
  readonly instanceCount?: number;

  /**
   * ML compute instance type.
   *
   * @default is the 'm4.xlarge' instance type.
   */
  readonly instanceType?: ec2.InstanceType;

  /**
   * KMS key that Amazon SageMaker uses to encrypt data on the storage volume attached to the ML compute instance(s) that
   * run the processing job.
   *
   * @default None
   */
  readonly volumeEncryptionKey?: kms.IKey;

  /**
   * The size of the ML storage volume in gigabytes that you want to provision. You must specify sufficient ML storage
   * for your scenario. If left unspecified, SageMaker will assign a 10 GB EBS volume
   *
   * @default None
   */
  readonly volumeSize?: Size;
}

/**
 * Whether to upload the results of the processing job continuously or after the job completes.
 */
export enum S3UploadMode {
  /**
   * Upload the results of the processing job continuously.
   */
  CONTINUOUS = 'Continuous',

  /**
   * Upload the results of the processing job after the job completes.
   */
  END_OF_JOB = 'EndOfJob'
}

//
// Create Transform Job types
//

/**
 * Configures the timeout and maximum number of retries for processing a transform job invocation.
 *
 */
export interface ModelClientOptions {

  /**
   * The maximum number of retries when invocation requests are failing.
   *
   * @default 0
   */
  readonly invocationsMaxRetries?: number;

  /**
   * The timeout duration for an invocation request.
   *
   * @default Duration.minutes(1)
   */
  readonly invocationsTimeout?: Duration;
}

/**
 *  Dataset to be transformed and the Amazon S3 location where it is stored.
 *
 */
export interface TransformInput {

  /**
   * The compression type of the transform data.
   *
   * @default NONE
   */
  readonly compressionType?: CompressionType;

  /**
   * Multipurpose internet mail extension (MIME) type of the data.
   *
   * @default - None
   */
  readonly contentType?: string;

  /**
   * S3 location of the channel data
   */
  readonly transformDataSource: TransformDataSource;

  /**
   * Method to use to split the transform job's data files into smaller batches.
   *
   * @default NONE
   */
  readonly splitType?: SplitType;
}

/**
 * S3 location of the input data that the model can consume.
 *
 */
export interface TransformDataSource {

  /**
   * S3 location of the input data
   */
  readonly s3DataSource: TransformS3DataSource;
}

/**
 * Location of the channel data.
 *
 */
export interface TransformS3DataSource {

  /**
   * S3 Data Type
   *
   * @default 'S3Prefix'
   */
  readonly s3DataType?: S3DataType;

  /**
   * Identifies either a key name prefix or a manifest.
   */
  readonly s3Uri: string;
}

/**
 * S3 location where you want Amazon SageMaker to save the results from the transform job.
 *
 */
export interface TransformOutput {

  /**
   * MIME type used to specify the output data.
   *
   * @default - None
   */
  readonly accept?: string;

  /**
   * Defines how to assemble the results of the transform job as a single S3 object.
   *
   * @default - None
   */
  readonly assembleWith?: AssembleWith;

  /**
   * AWS KMS key that Amazon SageMaker uses to encrypt the model artifacts at rest using Amazon S3 server-side encryption.
   *
   * @default - default KMS key for Amazon S3 for your role's account.
   */
  readonly encryptionKey?: kms.IKey;

  /**
   * S3 path where you want Amazon SageMaker to store the results of the transform job.
   */
  readonly s3OutputPath: string;
}

/**
 * ML compute instances for the transform job.
 *
 */
export interface TransformResources {

  /**
   * Number of ML compute instances to use in the transform job
   */
  readonly instanceCount: number;

  /**
   * ML compute instance type for the transform job.
   */
  readonly instanceType: ec2.InstanceType;

  /**
   * AWS KMS key that Amazon SageMaker uses to encrypt data on the storage volume attached to the ML compute instance(s).
   *
   * @default - None
   */
  readonly volumeEncryptionKey?: kms.IKey;
}

/**
 * Properties to define a ContainerDefinition
 *
 * @see https://docs.aws.amazon.com/sagemaker/latest/APIReference/API_ContainerDefinition.html
 */
export interface ContainerDefinitionOptions {
  /**
   * The Amazon EC2 Container Registry (Amazon ECR) path where inference code is stored.
   *
   * @default - None
   */
  readonly image?: DockerImage;
  /**
   * The environment variables to set in the Docker container
   *
   * @default - No variables
   */
  readonly environmentVariables?: sfn.TaskInput;
  /**
   * The name or Amazon Resource Name (ARN) of the model package to use to create the model.
   *
   * @default - None
   */
  readonly modelPackageName?: string;
  /**
   * Defines how many models the container hosts
   *
   * @default - Mode.SINGLE_MODEL
   */
  readonly mode?: Mode;
  /**
   * This parameter is ignored for models that contain only a PrimaryContainer.
   * When a ContainerDefinition is part of an inference pipeline,
   * the value of the parameter uniquely identifies the container for the purposes of logging and metrics.
   *
   * @default - None
   */
  readonly containerHostName?: string;
  /**
   * The S3 path where the model artifacts, which result from model training, are stored.
   * This path must point to a single gzip compressed tar archive (.tar.gz suffix).
   * The S3 path is required for Amazon SageMaker built-in algorithms, but not if you use your own algorithms.
   *
   * @default - None
   */
  readonly modelS3Location?: S3Location;
}

/**
 * Describes the container, as part of model definition.
 *
 * @see https://docs.aws.amazon.com/sagemaker/latest/APIReference/API_ContainerDefinition.html
 */
export class ContainerDefinition implements IContainerDefinition {

  constructor(private readonly options: ContainerDefinitionOptions) {}

  /**
   * Called when the ContainerDefinition type configured on Sagemaker Task
   */
  public bind(task: ISageMakerTask): ContainerDefinitionConfig {
    return {
      parameters: {
        ContainerHostname: this.options.containerHostName,
        Image: this.options.image?.bind(task).imageUri,
        Mode: this.options.mode,
        ModelDataUrl: this.options.modelS3Location?.bind(task, { forReading: true }).uri,
        ModelPackageName: this.options.modelPackageName,
        Environment: this.options.environmentVariables?.value,
      },
    };
  }
}

/**
 * Configuration of the container used to host the model
 *
 * @see https://docs.aws.amazon.com/sagemaker/latest/APIReference/API_ContainerDefinition.html
 */
export interface IContainerDefinition {
  /**
   * Called when the ContainerDefinition is used by a SageMaker task.
   */
  bind(task: ISageMakerTask): ContainerDefinitionConfig;
}

/**
 * Configuration options for the ContainerDefinition
 */
export interface ContainerDefinitionConfig {
  /**
   * Additional parameters to pass to the base task
   *
   * @default - No additional parameters passed
   */
  readonly parameters?: { [key: string]: any };
}

/**
 * Specifies how many models the container hosts
 *
 */
export enum Mode {
  /**
   * Container hosts a single model
   */
  SINGLE_MODEL = 'SingleModel',
  /**
   * Container hosts multiple models
   *
   * @see https://docs.aws.amazon.com/sagemaker/latest/dg/multi-model-endpoints.html
   */
  MULTI_MODEL = 'MultiModel',
}

/**
 * Identifies a model that you want to host and the resources to deploy for hosting it.
 *
 * @see  https://docs.aws.amazon.com/sagemaker/latest/APIReference/API_ProductionVariant.html
 */
export interface ProductionVariant {
  /**
   * The size of the Elastic Inference (EI) instance to use for the production variant.
   *
   * @default - None
   */
  readonly acceleratorType?: AcceleratorType;
  /**
   * Number of instances to launch initially.
   *
   * @default - 1
   */
  readonly initialInstanceCount?: number;
  /**
   * Determines initial traffic distribution among all of the models that you specify in the endpoint configuration.
   *
   * @default - 1.0
   */
  readonly initialVariantWeight?: number;
  /**
   * The ML compute instance type
   */
  readonly instanceType: ec2.InstanceType;
  /**
   * The name of the production variant.
   */
  readonly variantName: string;
  /**
   * The name of the model that you want to host. This is the name that you specified when creating the model.
   */
  readonly modelName: string;
}

/**
 * The generation of Elastic Inference (EI) instance
 *
 * @see https://docs.aws.amazon.com/sagemaker/latest/dg/ei.html
 */
export class AcceleratorClass {
  /**
   * Elastic Inference accelerator 1st generation
   */
  public static readonly EIA1 = AcceleratorClass.of('eia1');
  /**
   * Elastic Inference accelerator 2nd generation
   */
  public static readonly EIA2 = AcceleratorClass.of('eia2');
  /**
   * Custom AcceleratorType
   * @param version - Elastic Inference accelerator generation
  */
  public static of(version: string) { return new AcceleratorClass(version); }
  /**
   * @param version - Elastic Inference accelerator generation
   */
  private constructor(public readonly version: string) { }
}

/**
 * The size of the Elastic Inference (EI) instance to use for the production variant.
 * EI instances provide on-demand GPU computing for inference
 *
 * @see https://docs.aws.amazon.com/sagemaker/latest/dg/ei.html
 */
export class AcceleratorType {
  /**
   * AcceleratorType
   *
   * This class takes a combination of a class and size.
   */
  public static of(acceleratorClass: AcceleratorClass, instanceSize: ec2.InstanceSize) {
    return new AcceleratorType(`ml.${acceleratorClass}.${instanceSize}`);
  }

  constructor(private readonly instanceTypeIdentifier: string) {
  }

  /**
   * Return the accelerator type as a dotted string
   */
  public toString(): string {
    return this.instanceTypeIdentifier;
  }
}

/**
 * Specifies the number of records to include in a mini-batch for an HTTP inference request.
 *
 */
export enum BatchStrategy {

  /**
   * Fits multiple records in a mini-batch.
   */
  MULTI_RECORD = 'MultiRecord',

  /**
   * Use a single record when making an invocation request.
   */
  SINGLE_RECORD = 'SingleRecord'
}

/**
 * Method to use to split the transform job's data files into smaller batches.
 *
 */
export enum SplitType {

  /**
   * Input data files are not split,
   */
  NONE = 'None',

  /**
   * Split records on a newline character boundary.
   */
  LINE = 'Line',

  /**
   * Split using MXNet RecordIO format.
   */
  RECORD_IO = 'RecordIO',

  /**
   * Split using TensorFlow TFRecord format.
   */
  TF_RECORD = 'TFRecord'
}

/**
 * How to assemble the results of the transform job as a single S3 object.
 *
 */
export enum AssembleWith {

  /**
   * Concatenate the results in binary format.
   */
  NONE = 'None',

  /**
   * Add a newline character at the end of every transformed record.
   */
  LINE = 'Line'

}

class StandardDockerImage extends DockerImage {
  private readonly allowAnyEcrImagePull: boolean;
  private readonly imageUri: string;
  private readonly repository?: ecr.IRepository;

  constructor(opts: { allowAnyEcrImagePull?: boolean, imageUri: string, repository?: ecr.IRepository }) {
    super();

    this.allowAnyEcrImagePull = !!opts.allowAnyEcrImagePull;
    this.imageUri = opts.imageUri;
    this.repository = opts.repository;
  }

  public bind(task: ISageMakerTask): DockerImageConfig {
    if (this.repository) {
      this.repository.grantPull(task);
    }
    if (this.allowAnyEcrImagePull) {
      task.grantPrincipal.addToPrincipalPolicy(new iam.PolicyStatement({
        actions: [
          'ecr:BatchCheckLayerAvailability',
          'ecr:GetDownloadUrlForLayer',
          'ecr:BatchGetImage',
        ],
        resources: ['*'],
      }));
    }
    return {
      imageUri: this.imageUri,
    };
  }
}

class StandardS3Location extends S3Location {
  private readonly bucket?: s3.IBucket;
  private readonly keyGlob: string;
  private readonly uri: string;

  constructor(opts: { bucket?: s3.IBucket, keyPrefix?: string, uri: string }) {
    super();
    this.bucket = opts.bucket;
    this.keyGlob = `${opts.keyPrefix || ''}*`;
    this.uri = opts.uri;
  }

  public bind(task: ISageMakerTask, opts: S3LocationBindOptions): S3LocationConfig {
    if (this.bucket) {
      if (opts.forReading) {
        this.bucket.grantRead(task, this.keyGlob);
      }
      if (opts.forWriting) {
        this.bucket.grantWrite(task, this.keyGlob);
      }
    } else {
      const actions = new Array<string>();
      if (opts.forReading) {
        actions.push('s3:GetObject', 's3:ListBucket');
      }
      if (opts.forWriting) {
        actions.push('s3:PutObject');
      }
      task.grantPrincipal.addToPrincipalPolicy(new iam.PolicyStatement({ actions, resources: ['*'] }));
    }
    return { uri: this.uri };
  }
}
