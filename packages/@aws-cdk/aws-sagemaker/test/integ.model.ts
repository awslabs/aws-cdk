import * as ec2 from "@aws-cdk/aws-ec2";
import * as ecr_assets from "@aws-cdk/aws-ecr-assets";
import * as s3_assets from '@aws-cdk/aws-s3-assets';
import * as cdk from '@aws-cdk/core';
import * as path from 'path';
import * as sagemaker from '../lib';

/*
 * Stack verification steps:
 * aws sagemaker describe-model --model-name <deployed model name>
 *
 * For the single container model, the output will resemble:
 *
 *   {
 *       "ModelName": "PrimaryContainerModel...",
 *       "PrimaryContainer": {
 *           "Image": "...",
 *           "ModelDataUrl": "https://s3..."
 *       },
 *       "ExecutionRoleArn": "arn:aws:iam::...",
 *       "VpcConfig": {
 *           "SecurityGroupIds": [
 *               "sg-..."
 *           ],
 *           "Subnets": [
 *               "subnet-...",
 *               "subnet-..."
 *           ]
 *       },
 *       "CreationTime": ...,
 *       "ModelArn": "arn:aws:sagemaker:...",
 *       "EnableNetworkIsolation": false
 *   }
 *
 * For the inference pipeline model, the output will resemble:
 *
 *   {
 *       "ModelName": "InferencePipelineModel...",
 *       "Containers": [
 *           {
 *               "Image": "..."
 *           },
 *           {
 *               "Image": "...",
 *               "ModelDataUrl": "https://s3..."
 *           },
 *           {
 *               "Image": "...",
 *               "ModelDataUrl": "https://s3..."
 *           }
 *       ],
 *       "ExecutionRoleArn": "arn:aws:iam::...",
 *       "CreationTime": ...,
 *       "ModelArn": "arn:aws:sagemaker:...",
 *       "EnableNetworkIsolation": false
 *   }
 */

const app = new cdk.App();
const stack = new cdk.Stack(app, 'aws-cdk-sagemaker-model');

// Paths to local assets
const dockerfileDirectory = path.join(__dirname, 'test-image');
const artifactFilePath = path.join(__dirname, 'test-artifacts', 'valid-artifact.tar.gz');

/*
 * Exercise different variations of ContainerImages, including:
 * - EcrImage as vended by ContainerImage.fromEcrRepository
 * - AssetImage as vended by ContainerImage.fromAsset
 */

const ecrImage = sagemaker.ContainerImage.fromEcrRepository(
  new ecr_assets.DockerImageAsset(stack, 'EcrImage', {
    directory: dockerfileDirectory,
  }).repository
);

const localImage = sagemaker.ContainerImage.fromAsset(stack, 'LocalImage', {
  directory: dockerfileDirectory,
});

/*
 * Exercise different variations of ModelData, including:
 * - S3ModelData as vended by ModelData.fromBucket
 * - AssetModelData as vended by ModelData.fromAsset
 */

const artifactAsset = new s3_assets.Asset(stack, 'S3ModelData', {
  path: artifactFilePath,
});
const s3ModelData = sagemaker.ModelData.fromBucket(
  artifactAsset.bucket,
  artifactAsset.s3ObjectKey
);

const localModelData = sagemaker.ModelData.fromAsset(stack, 'LocalModelData', artifactFilePath);

/*
 * Use the above images and model data instances to create SageMaker models, including:
 * - A single-container model, with a VPC, using the "remote" image and model data references
 * - An inference pipeline model, without a VPC, using the "local" image and model data references
 */

new sagemaker.Model(stack, 'PrimaryContainerModel', {
  container: {
    image: ecrImage,
    modelData: s3ModelData,
  },
  vpc: new ec2.Vpc(stack, 'VPC'),
});

new sagemaker.Model(stack, 'InferencePipelineModel', {
  container: {
    image: localImage
  },
  extraContainers: [
    { image: localImage, modelData: localModelData },
    { image: localImage, modelData: localModelData }
  ],
});

app.synth();
