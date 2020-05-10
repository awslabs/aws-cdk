import { expect } from '@aws-cdk/assert';
import { AccountRootPrincipal, Role } from '@aws-cdk/aws-iam';
import { Stack } from '@aws-cdk/core';
import { ProfilingGroup } from '../lib/profiling-group';

// tslint:disable:object-literal-key-quotes

describe('profiling group', () => {

  test('default profiling group', () => {
    const stack = new Stack();
    new ProfilingGroup(stack, 'MyProfilingGroup', {
      profilingGroupName: 'MyAwesomeProfilingGroup',
    });

    expect(stack).toMatch({
      'Resources': {
        'MyProfilingGroup829F0507': {
          'Type': 'AWS::CodeGuruProfiler::ProfilingGroup',
          'Properties': {
            'ProfilingGroupName': 'MyAwesomeProfilingGroup',
          },
        },
      },
    });
  });

  test('grant publish permissions profiling group', () => {
    const stack = new Stack();
    const profilingGroup = new ProfilingGroup(stack, 'MyProfilingGroup', {
      profilingGroupName: 'MyAwesomeProfilingGroup',
    });
    const publishAppRole = new Role(stack, 'PublishAppRole', {
      assumedBy: new AccountRootPrincipal(),
    });

    profilingGroup.grantPublish(publishAppRole);

    expect(stack).toMatch({
      'Resources': {
        'MyProfilingGroup829F0507': {
          'Type': 'AWS::CodeGuruProfiler::ProfilingGroup',
          'Properties': {
            'ProfilingGroupName': 'MyAwesomeProfilingGroup',
          },
        },
        'PublishAppRole9FEBD682': {
          'Type': 'AWS::IAM::Role',
          'Properties': {
            'AssumeRolePolicyDocument': {
              'Statement': [
                {
                  'Action': 'sts:AssumeRole',
                  'Effect': 'Allow',
                  'Principal': {
                    'AWS': {
                      'Fn::Join': [
                        '',
                        [
                          'arn:',
                          {
                            'Ref': 'AWS::Partition',
                          },
                          ':iam::',
                          {
                            'Ref': 'AWS::AccountId',
                          },
                          ':root',
                        ],
                      ],
                    },
                  },
                },
              ],
              'Version': '2012-10-17',
            },
          },
        },
        'PublishAppRoleDefaultPolicyCA1E15C3': {
          'Type': 'AWS::IAM::Policy',
          'Properties': {
            'PolicyDocument': {
              'Statement': [
                {
                  'Action': [
                    'codeguru-profiler:ConfigureAgent',
                    'codeguru-profiler:PostAgentProfile',
                  ],
                  'Effect': 'Allow',
                  'Resource': {
                    'Fn::GetAtt': [
                      'MyProfilingGroup829F0507',
                      'Arn',
                    ],
                  },
                },
              ],
              'Version': '2012-10-17',
            },
            'PolicyName': 'PublishAppRoleDefaultPolicyCA1E15C3',
            'Roles': [
              {
                'Ref': 'PublishAppRole9FEBD682',
              },
            ],
          },
        },
      },
    });
  });

  test('grant read permissions profiling group', () => {
    const stack = new Stack();
    const profilingGroup = new ProfilingGroup(stack, 'MyProfilingGroup', {
      profilingGroupName: 'MyAwesomeProfilingGroup',
    });
    const readAppRole = new Role(stack, 'ReadAppRole', {
      assumedBy: new AccountRootPrincipal(),
    });

    profilingGroup.grantRead(readAppRole);

    expect(stack).toMatch({
      'Resources': {
        'MyProfilingGroup829F0507': {
          'Type': 'AWS::CodeGuruProfiler::ProfilingGroup',
          'Properties': {
            'ProfilingGroupName': 'MyAwesomeProfilingGroup',
          },
        },
        'ReadAppRole52FE6317': {
          'Type': 'AWS::IAM::Role',
          'Properties': {
            'AssumeRolePolicyDocument': {
              'Statement': [
                {
                  'Action': 'sts:AssumeRole',
                  'Effect': 'Allow',
                  'Principal': {
                    'AWS': {
                      'Fn::Join': [
                        '',
                        [
                          'arn:',
                          {
                            'Ref': 'AWS::Partition',
                          },
                          ':iam::',
                          {
                            'Ref': 'AWS::AccountId',
                          },
                          ':root',
                        ],
                      ],
                    },
                  },
                },
              ],
              'Version': '2012-10-17',
            },
          },
        },
        'ReadAppRoleDefaultPolicy4BB8955C': {
          'Type': 'AWS::IAM::Policy',
          'Properties': {
            'PolicyDocument': {
              'Statement': [
                {
                  'Action': [
                    'codeguru-profiler:GetProfile',
                    'codeguru-profiler:DescribeProfilingGroup',
                  ],
                  'Effect': 'Allow',
                  'Resource': {
                    'Fn::GetAtt': [
                      'MyProfilingGroup829F0507',
                      'Arn',
                    ],
                  },
                },
              ],
              'Version': '2012-10-17',
            },
            'PolicyName': 'ReadAppRoleDefaultPolicy4BB8955C',
            'Roles': [
              {
                'Ref': 'ReadAppRole52FE6317',
              },
            ],
          },
        },
      },
    });
  });

});
