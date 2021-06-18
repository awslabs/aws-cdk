import * as aws from 'aws-sdk'; // eslint-disable-line import/no-extraneous-dependencies
import { ResourceHandler } from './common';

const MAX_NAME_LEN = 63;

export class FargateProfileResourceHandler extends ResourceHandler {
  protected async onCreate() {
    const fargateProfileName = this.event.ResourceProperties.Config.fargateProfileName ?? this.generateProfileName();

    const createFargateProfile: aws.EKS.CreateFargateProfileRequest = {
      fargateProfileName,
      ...this.event.ResourceProperties.Config,
    };

    this.log({ createFargateProfile });
    const createFargateProfileResponse = await this.eks.createFargateProfile(createFargateProfile);
    this.log({ createFargateProfileResponse });

    if (!createFargateProfileResponse.fargateProfile) {
      throw new Error('invalid CreateFargateProfile response');
    }

    return {
      PhysicalResourceId: createFargateProfileResponse.fargateProfile.fargateProfileName,
      Data: {
        fargateProfileArn: createFargateProfileResponse.fargateProfile.fargateProfileArn,
      },
    };
  }

  protected async onDelete() {
    if (!this.physicalResourceId) {
      throw new Error('Cannot delete a profile without a physical id');
    }

    const deleteFargateProfile: aws.EKS.DeleteFargateProfileRequest = {
      clusterName: this.event.ResourceProperties.Config.clusterName,
      fargateProfileName: this.physicalResourceId,
    };

    this.log({ deleteFargateProfile });
    const deleteFargateProfileResponse = await this.eks.deleteFargateProfile(deleteFargateProfile);
    this.log({ deleteFargateProfileResponse });

    return;
  }

  protected async onUpdate() {
    // all updates require a replacement. as long as name is generated, we are
    // good. if name is explicit, update will fail, which is common when trying
    // to replace cfn resources with explicit physical names
    return this.onCreate();
  }

  protected async isCreateComplete() {
    return this.isUpdateComplete();
  }

  protected async isUpdateComplete() {
    const status = await this.queryStatus();
    return {
      IsComplete: status === 'ACTIVE',
    };
  }

  protected async isDeleteComplete() {
    const status = await this.queryStatus();
    return {
      IsComplete: status === 'NOT_FOUND',
    };
  }

  /**
   * Generates a fargate profile name.
   */
  private generateProfileName() {
    const suffix = this.requestId.replace(/-/g, ''); // 32 chars
    const prefix = this.logicalResourceId.substr(0, MAX_NAME_LEN - suffix.length - 1);
    return `${prefix}-${suffix}`;
  }

  /**
   * Queries the Fargate profile's current status and returns the status or
   * NOT_FOUND if the profile doesn't exist (i.e. it has been deleted).
   */
  private async queryStatus(): Promise<aws.EKS.FargateProfileStatus | 'NOT_FOUND' | undefined> {
    if (!this.physicalResourceId) {
      throw new Error('Unable to determine status for fargate profile without a resource name');
    }

    const describeFargateProfile: aws.EKS.DescribeFargateProfileRequest = {
      clusterName: this.event.ResourceProperties.Config.clusterName,
      fargateProfileName: this.physicalResourceId,
    };

    try {
      this.log({ describeFargateProfile });
      const describeFargateProfileResponse = await this.eks.describeFargateProfile(describeFargateProfile);
      this.log({ describeFargateProfileResponse });
      const status = describeFargateProfileResponse.fargateProfile?.status;

      if (status === 'CREATE_FAILED' || status === 'DELETE_FAILED') {
        throw new Error(status);
      }

      return status;
    } catch (describeFargateProfileError) {
      if (describeFargateProfileError.code === 'ResourceNotFoundException') {
        this.log('received ResourceNotFoundException, this means the profile has been deleted (or never existed)');
        return 'NOT_FOUND';
      }

      this.log({ describeFargateProfileError });
      throw describeFargateProfileError;
    }
  }
}
