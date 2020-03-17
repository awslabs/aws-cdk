import { expect, haveResource, haveResourceLike } from '@aws-cdk/assert';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecr from '@aws-cdk/aws-ecr';
import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import { Test } from 'nodeunit';
import * as sagemaker from '../lib';

export = {
  'When instantiating SageMaker Model': {
    'with more than 5 containers, an exception is thrown'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const testRepo = ecr.Repository.fromRepositoryName(stack, `testRepo`, `123456789012.dkr.ecr.us-west-2.amazonaws.com/mymodel`);
      const container = { image: sagemaker.ContainerImage.fromEcrRepository(testRepo) };
      const extraContainers: sagemaker.ContainerDefinition[] = [];
      for (let i = 0; i < 5; i++) {
        const containerDefinition = {
          image: sagemaker.ContainerImage.fromEcrRepository(testRepo)
        };
        extraContainers.push(containerDefinition);
      }

      // WHEN
      const when = () => new sagemaker.Model(stack, 'Model', { container, extraContainers });

      // THEN
      test.throws(when, /Cannot have more than 5 containers in inference pipeline/);

      test.done();
    },

    'with a ContainerImage implementation which adds constructs of its own, the new constructs are present'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      class ConstructCreatingContainerImage extends sagemaker.ContainerImage {
        public bind(scope: cdk.Construct, _model: sagemaker.Model): sagemaker.ContainerImageConfig {
          new iam.User(scope, 'User', {
            userName: 'ExtraConstructUserName'
          });
          return {
            imageName: 'anything'
          };
        }
      }

      // WHEN
      new sagemaker.Model(stack, 'Model', {
        container: {
          image: new ConstructCreatingContainerImage()
        }
      });

      // THEN
      expect(stack).to(haveResource('AWS::SageMaker::Model'));
      expect(stack).to(haveResource('AWS::IAM::User', {
        UserName: 'ExtraConstructUserName'
      }));

      test.done();
    },

    'with a VPC': {
      'and security groups, no security group is created'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();
        const vpc = new ec2.Vpc(stack, 'testVPC');

        // WHEN
        new sagemaker.Model(stack, 'Model', {
          container: {image: sagemaker.ContainerImage.fromEcrRepository(new ecr.Repository(stack, 'Repo'))},
          vpc,
          securityGroups: [new ec2.SecurityGroup(stack, 'SG', {vpc})]
        });

        // THEN
        expect(stack).notTo(haveResource('AWS::EC2::SecurityGroup', {
          GroupDescription: 'Model/ModelSecurityGroup'
        }));

        test.done();
      },

      'but no security groups, a security group is created'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();

        // WHEN
        new sagemaker.Model(stack, 'Model', {
          container: {image: sagemaker.ContainerImage.fromEcrRepository(new ecr.Repository(stack, 'Repo'))},
          vpc: new ec2.Vpc(stack, 'testVPC'),
        });

        // THEN
        expect(stack).to(haveResource('AWS::EC2::SecurityGroup', {
          GroupDescription: 'Model/SecurityGroup'
        }));

        test.done();
      },

      'and both security groups and allowAllOutbound are specified, an exception is thrown'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();
        const vpc = new ec2.Vpc(stack, 'testVPC');

        // WHEN
        const when = () =>
          new sagemaker.Model(stack, 'Model', {
            container: {image: sagemaker.ContainerImage.fromEcrRepository(new ecr.Repository(stack, 'Repo'))},
            vpc,
            securityGroups: [new ec2.SecurityGroup(stack, 'SG', {vpc})],
            allowAllOutbound: false
          });

        // THEN
        test.throws(when, /Configure 'allowAllOutbound' directly on the supplied SecurityGroups/);

        test.done();
      },
    },

    'without a VPC': {
      'but security groups are specified, an exception is thrown'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();
        const vpcNotSpecified = new ec2.Vpc(stack, 'VPC');

        // WHEN
        const when = () =>
          new sagemaker.Model(stack, 'Model', {
            container: {image: sagemaker.ContainerImage.fromEcrRepository(new ecr.Repository(stack, 'Repo'))},
            securityGroups: [new ec2.SecurityGroup(stack, 'SG', {vpc: vpcNotSpecified})]
          });

        // THEN
        test.throws(when, /Cannot configure 'securityGroups' or 'allowAllOutbound' without configuring a VPC/);

        test.done();
      },

      'but allowAllOutbound is specified, an exception is thrown'(test: Test) {
        // GIVEN
        const stack = new cdk.Stack();

        // WHEN
        const when = () =>
          new sagemaker.Model(stack, 'Model', {
            container: {image: sagemaker.ContainerImage.fromEcrRepository(new ecr.Repository(stack, 'Repo'))},
            allowAllOutbound: false
          });

        // THEN
        test.throws(when, /Cannot configure 'securityGroups' or 'allowAllOutbound' without configuring a VPC/);

        test.done();
      },
    },
  },

  'When accessing Connections object': {
    'from a model with no VPC, an exception is thrown'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const modelWithoutVpc = new sagemaker.Model(stack, 'Model', {
        container: {image: sagemaker.ContainerImage.fromEcrRepository(new ecr.Repository(stack, 'Repo'))},
      });

      // WHEN
      const when = () => modelWithoutVpc.connections;

      // THEN
      test.throws(when, /Cannot manage network access without configuring a VPC/);

      test.done();
    },

    'from an imported model with no security groups specified, an exception is thrown'(test: Test) {
      // GIVEN
      const stack = new cdk.Stack();
      const importedModel = sagemaker.Model.fromModelAttributes(stack, 'Model', {
        modelName: 'MyModel'
      });

      // WHEN
      const when = () => importedModel.connections;

      // THEN
      test.throws(when, /Cannot manage network access without configuring a VPC/);

      test.done();
    }
  },

  'When adding security group after model instantiation, it is reflected in VpcConfig of Model'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const vpc = new ec2.Vpc(stack, 'testVPC');
    const model = new sagemaker.Model(stack, 'Model', {
      container: { image: sagemaker.ContainerImage.fromEcrRepository(new ecr.Repository(stack, 'Repo')) },
      vpc,
    });

    // WHEN
    model.connections.addSecurityGroup(new ec2.SecurityGroup(stack, 'AdditionalGroup', {vpc}));

    // THEN
    expect(stack).to(haveResourceLike('AWS::SageMaker::Model', {
      VpcConfig: {
        SecurityGroupIds: [
          {
            'Fn::GetAtt': [
              'ModelSecurityGroup2A7C9E10',
              'GroupId'
            ]
          },
          {
            'Fn::GetAtt': [
              'AdditionalGroup4973CFAA',
              'GroupId'
            ]
          }
        ]
      }
    }));

    test.done();
  },

  'When allowing traffic from an imported model with a security group, an S3 egress rule should be present'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack();
    const model = sagemaker.Model.fromModelAttributes(stack, 'Model', {
      modelName: 'MyModel',
      securityGroups: [ec2.SecurityGroup.fromSecurityGroupId(stack, 'SG', 'sg-123456789', {
        allowAllOutbound: false,
      })],
    });

    // WHEN
    model.connections.allowToAnyIpv4(ec2.Port.tcp(443));

    // THEN
    expect(stack).to(haveResource('AWS::EC2::SecurityGroupEgress', {
      GroupId: 'sg-123456789',
    }));

    test.done();
  },

  'When importing a model by name, the ARN is constructed correctly'(test: Test) {
    // GIVEN
    const stack = new cdk.Stack(undefined, undefined, {
      env:
        {
          region: 'us-west-2',
          account: '123456789012'
        }
    });

    // WHEN
    const model = sagemaker.Model.fromModelName(stack, 'Model', 'my-name');

    // THEN
    test.equal(model.modelArn, 'arn:${Token[AWS::Partition.3]}:sagemaker:us-west-2:123456789012:model/my-name');

    test.done();
  },
};
