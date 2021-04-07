import { throws } from 'assert';
import { expect, haveResource, haveResourceLike, ResourcePart } from '@aws-cdk/assert';
import '@aws-cdk/assert/jest';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import * as batch from '../lib';

describe('Batch Compute Environment', () => {
  let expectedManagedDefaultComputeProps: any;
  let defaultServiceRole: any;

  let stack: cdk.Stack;
  let vpc: ec2.Vpc;

  beforeEach(() => {
    // GIVEN
    stack = new cdk.Stack();
    vpc = new ec2.Vpc(stack, 'test-vpc');

    defaultServiceRole = {
      ServiceRole: {
        'Fn::GetAtt': [
          'testcomputeenvResourceServiceInstanceRole105069A5',
          'Arn',
        ],
      },
    };

    expectedManagedDefaultComputeProps = (overrides: any) => {
      return {
        ComputeResources: {
          AllocationStrategy: batch.AllocationStrategy.BEST_FIT,
          InstanceRole: {
            'Fn::GetAtt': [
              'testcomputeenvInstanceProfileCBD87EAB',
              'Arn',
            ],
          },
          InstanceTypes: [
            'optimal',
          ],
          MaxvCpus: 256,
          MinvCpus: 0,
          Subnets: [
            {
              Ref: 'testvpcPrivateSubnet1Subnet865FB50A',
            },
            {
              Ref: 'testvpcPrivateSubnet2Subnet23D3396F',
            },
          ],
          Type: batch.ComputeResourceType.ON_DEMAND,
          ...overrides,
        },
      };
    };
  });

  describe('when validating props', () => {
    test('should deny setting compute resources when using type unmanaged', () => {
      // THEN
      throws(() => {
        // WHEN
        new batch.ComputeEnvironment(stack, 'test-compute-env', {
          managed: false,
          computeResources: {
            vpc,
          },
        });
      });
    });

    test('should deny if creating a managed environment with no provided compute resource props', () => {
      // THEN
      throws(() => {
        // WHEN
        new batch.ComputeEnvironment(stack, 'test-compute-env', {
          managed: true,
        });
      });
    });
  });
  describe('using fargate resources', () => {
    test('should deny setting bid percentage', () => {
      // THEN
      throws(() => {
        // WHEN
        new batch.ComputeEnvironment(stack, 'test-compute-env', {
          managed: true,
          computeResources: {
            vpc,
            type: batch.ComputeResourceType.FARGATE,
            bidPercentage: -1,
          },
        });
      });
    });
    test('should deny setting allocation strategy', () => {
      // THEN
      throws(() => {
        // WHEN
        new batch.ComputeEnvironment(stack, 'test-compute-env', {
          managed: true,
          computeResources: {
            vpc,
            type: batch.ComputeResourceType.FARGATE,
            allocationStrategy: batch.AllocationStrategy.BEST_FIT,
          },
        });
      });
    });
    test('should deny setting desired vCPUs', () => {
      // THEN
      throws(() => {
        // WHEN
        new batch.ComputeEnvironment(stack, 'test-compute-env', {
          managed: true,
          computeResources: {
            vpc,
            type: batch.ComputeResourceType.FARGATE,
            desiredvCpus: 1,
          },
        });
      });
    });
    test('should deny setting min vCPUs', () => {
      // THEN
      throws(() => {
        // WHEN
        new batch.ComputeEnvironment(stack, 'test-compute-env', {
          managed: true,
          computeResources: {
            vpc,
            type: batch.ComputeResourceType.FARGATE,
            minvCpus: 1,
          },
        });
      });
    });
    test('should deny setting image', () => {
      // THEN
      throws(() => {
        // WHEN
        new batch.ComputeEnvironment(stack, 'test-compute-env', {
          managed: true,
          computeResources: {
            vpc,
            type: batch.ComputeResourceType.FARGATE,
            image: ec2.MachineImage.latestAmazonLinux(),
          },
        });
      });
    });
    test('should deny setting instance types', () => {
      // THEN
      throws(() => {
        // WHEN
        new batch.ComputeEnvironment(stack, 'test-compute-env', {
          managed: true,
          computeResources: {
            vpc,
            type: batch.ComputeResourceType.FARGATE,
            instanceTypes: [],
          },
        });
      });
    });
    test('should deny setting EC2 key pair', () => {
      // THEN
      throws(() => {
        // WHEN
        new batch.ComputeEnvironment(stack, 'test-compute-env', {
          managed: true,
          computeResources: {
            vpc,
            type: batch.ComputeResourceType.FARGATE,
            ec2KeyPair: 'test',
          },
        });
      });
    });
    test('should deny setting instance role', () => {
      // THEN
      throws(() => {
        // WHEN
        new batch.ComputeEnvironment(stack, 'test-compute-env', {
          managed: true,
          computeResources: {
            vpc,
            type: batch.ComputeResourceType.FARGATE,
            instanceRole: 'test',
          },
        });
      });
    });
    test('should deny setting launch template', () => {
      // THEN
      throws(() => {
        // WHEN
        new batch.ComputeEnvironment(stack, 'test-compute-env', {
          managed: true,
          computeResources: {
            vpc,
            type: batch.ComputeResourceType.FARGATE,
            launchTemplate: {
              launchTemplateName: 'test-template',
            },
          },
        });
      });
    });
    test('should deny setting placement group', () => {
      // THEN
      throws(() => {
        // WHEN
        new batch.ComputeEnvironment(stack, 'test-compute-env', {
          managed: true,
          computeResources: {
            vpc,
            type: batch.ComputeResourceType.FARGATE,
            placementGroup: 'test',
          },
        });
      });
    });
    test('should deny setting spot fleet role', () => {
      // THEN
      throws(() => {
        // WHEN
        new batch.ComputeEnvironment(stack, 'test-compute-env', {
          managed: true,
          computeResources: {
            vpc,
            type: batch.ComputeResourceType.FARGATE,
            spotFleetRole: iam.Role.fromRoleArn(stack, 'test-role-arn', 'test-role'),
          },
        });
      });
    });
  });

  describe('using spot resources', () => {
    test('should provide a spot fleet role if one is not given and allocationStrategy is BEST_FIT', () => {
      // WHEN
      new batch.ComputeEnvironment(stack, 'test-compute-env', {
        managed: true,
        computeResources: {
          type: batch.ComputeResourceType.SPOT,
          allocationStrategy: batch.AllocationStrategy.BEST_FIT,
          vpc,
        },
      });

      // THEN
      expect(stack).to(haveResourceLike('AWS::Batch::ComputeEnvironment', {
        Type: 'MANAGED',
        ...expectedManagedDefaultComputeProps({
          Type: batch.ComputeResourceType.SPOT,
          SpotIamFleetRole: {
            'Fn::Join': [
              '',
              [
                'arn:',
                {
                  Ref: 'AWS::Partition',
                },
                ':iam::',
                {
                  Ref: 'AWS::AccountId',
                },
                ':role/aws-service-role/spotfleet.amazonaws.com/AWSServiceRoleForEC2SpotFleet',
              ],
            ],
          },
        }),
      }, ResourcePart.Properties));
    });

    describe('with a bid percentage', () => {
      test('should deny my bid if set below 0', () => {
        // THEN
        throws(() => {
          // WHEN
          new batch.ComputeEnvironment(stack, 'test-compute-env', {
            managed: true,
            computeResources: {
              vpc,
              type: batch.ComputeResourceType.SPOT,
              bidPercentage: -1,
            },
          });
        });
      });

      test('should deny my bid if above 100', () => {
        // THEN
        throws(() => {
          // WHEN
          new batch.ComputeEnvironment(stack, 'test-compute-env', {
            managed: true,
            computeResources: {
              vpc,
              type: batch.ComputeResourceType.SPOT,
              bidPercentage: 101,
            },
          });
        });
      });
    });
  });

  describe('with properties specified', () => {
    test('renders the correct cloudformation properties', () => {
      // WHEN
      const props = {
        computeEnvironmentName: 'my-test-compute-env',
        computeResources: {
          allocationStrategy: batch.AllocationStrategy.BEST_FIT,
          vpc,
          computeResourcesTags: {
            'Name': 'AWS Batch Instance - C4OnDemand',
            'Tag Other': 'Has other value',
          },
          desiredvCpus: 1,
          ec2KeyPair: 'my-key-pair',
          image: ecs.EcsOptimizedImage.amazonLinux2(ecs.AmiHardwareType.STANDARD),
          instanceRole: new iam.CfnInstanceProfile(stack, 'Instance-Profile', {
            roles: [new iam.Role(stack, 'Ecs-Instance-Role', {
              assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
              managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonEC2ContainerServiceforEC2Role'),
              ],
            }).roleName],
          }).attrArn,
          instanceTypes: [
            ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
          ],
          maxvCpus: 4,
          minvCpus: 1,
          placementGroup: 'example-cluster-group',
          securityGroups: [
            new ec2.SecurityGroup(stack, 'test-sg', {
              vpc,
              allowAllOutbound: true,
            }),
          ],
          type: batch.ComputeResourceType.ON_DEMAND,
          vpcSubnets: {
            subnetType: ec2.SubnetType.PRIVATE,
          },
        } as batch.ComputeResources,
        enabled: false,
        managed: true,
      };

      new batch.ComputeEnvironment(stack, 'test-compute-env', props);

      // THEN
      expect(stack).to(haveResourceLike('AWS::Batch::ComputeEnvironment', {
        ComputeEnvironmentName: 'my-test-compute-env',
        Type: 'MANAGED',
        State: 'DISABLED',
        ServiceRole: {
          'Fn::GetAtt': [
            'testcomputeenvResourceServiceInstanceRole105069A5',
            'Arn',
          ],
        },
        ComputeResources: {
          AllocationStrategy: batch.AllocationStrategy.BEST_FIT,
          DesiredvCpus: props.computeResources.desiredvCpus,
          Ec2KeyPair: props.computeResources.ec2KeyPair,
          ImageId: {
            Ref: 'SsmParameterValueawsserviceecsoptimizedamiamazonlinux2recommendedimageidC96584B6F00A464EAD1953AFF4B05118Parameter',
          },
          InstanceRole: {
            'Fn::GetAtt': [
              props.computeResources.instanceRole ? 'InstanceProfile' : '',
              'Arn',
            ],
          },
          InstanceTypes: [
            props.computeResources.instanceTypes ? props.computeResources.instanceTypes[0].toString() : '',
          ],
          MaxvCpus: props.computeResources.maxvCpus,
          MinvCpus: props.computeResources.minvCpus,
          PlacementGroup: props.computeResources.placementGroup,
          SecurityGroupIds: [
            {
              'Fn::GetAtt': [
                'testsg872EB48A',
                'GroupId',
              ],
            },
          ],
          Subnets: [
            {
              Ref: `${cdk.Names.uniqueId(vpc)}PrivateSubnet1Subnet865FB50A`,
            },
            {
              Ref: `${cdk.Names.uniqueId(vpc)}PrivateSubnet2Subnet23D3396F`,
            },
          ],
          Tags: {
            'Name': 'AWS Batch Instance - C4OnDemand',
            'Tag Other': 'Has other value',
          },
          Type: 'EC2',
        },
      }, ResourcePart.Properties));
    });

    describe('with no allocation strategy specified', () => {
      test('should default to a best_fit strategy', () => {
        // WHEN
        new batch.ComputeEnvironment(stack, 'test-compute-env', {
          managed: true,
          computeResources: {
            vpc,
          },
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::Batch::ComputeEnvironment', {
          Type: 'MANAGED',
          ServiceRole: {
            'Fn::GetAtt': [
              'testcomputeenvResourceServiceInstanceRole105069A5',
              'Arn',
            ],
          },
        }, ResourcePart.Properties));
      });
    });

    describe('with a min vcpu value', () => {
      test('should deny less than 0', () => {
        // THEN
        throws(() => {
          // WHEN
          new batch.ComputeEnvironment(stack, 'test-compute-env', {
            computeResources: {
              vpc,
              minvCpus: -1,
            },
          });
        });
      });

      test('cannot be greater than the max vcpu value', () => {
        // THEN
        throws(() => {
          // WHEN
          new batch.ComputeEnvironment(stack, 'test-compute-env', {
            computeResources: {
              vpc,
              minvCpus: 2,
              maxvCpus: 1,
            },
          });
        });
      });
    });

    describe('with no min vcpu value provided', () => {
      test('should default to 0', () => {
        // WHEN
        new batch.ComputeEnvironment(stack, 'test-compute-env', {
          managed: true,
          computeResources: {
            vpc,
          },
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::Batch::ComputeEnvironment', {
          ...defaultServiceRole,
          ...expectedManagedDefaultComputeProps({
            MinvCpus: 0,
          }),
        }, ResourcePart.Properties));
      });
    });

    describe('with no max vcpu value provided', () => {
      test('should default to 256', () => {
        // WHEN
        new batch.ComputeEnvironment(stack, 'test-compute-env', {
          managed: true,
          computeResources: {
            vpc,
          },
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::Batch::ComputeEnvironment', {
          ...expectedManagedDefaultComputeProps({
            MaxvCpus: 256,
          }),
        }, ResourcePart.Properties));
      });
    });

    describe('with no instance role specified', () => {
      test('should generate a role for me', () => {
        // WHEN
        new batch.ComputeEnvironment(stack, 'test-compute-env', {
          managed: true,
          computeResources: {
            vpc,
          },
        });

        // THEN
        expect(stack).to(haveResource('AWS::Batch::ComputeEnvironment'));
        expect(stack).to(haveResource('AWS::IAM::Role'));
      });
    });

    describe('with no instance type defined', () => {
      test('should default to optimal matching', () => {
        // WHEN
        new batch.ComputeEnvironment(stack, 'test-compute-env', {
          managed: true,
          computeResources: {
            vpc,
          },
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::Batch::ComputeEnvironment', {
          ...expectedManagedDefaultComputeProps({
            InstanceTypes: ['optimal'],
          }),
        }, ResourcePart.Properties));
      });
    });

    describe('with no type specified', () => {
      test('should default to EC2', () => {
        // WHEN
        new batch.ComputeEnvironment(stack, 'test-compute-env', {
          managed: true,
          computeResources: {
            vpc,
          },
        });

        // THEN
        expect(stack).to(haveResourceLike('AWS::Batch::ComputeEnvironment', {
          ...expectedManagedDefaultComputeProps({
            Type: batch.ComputeResourceType.ON_DEMAND,
          }),
        }, ResourcePart.Properties));
      });
    });
  });
});
