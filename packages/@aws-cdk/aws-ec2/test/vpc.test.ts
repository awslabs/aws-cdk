import { countResources, expect as cdkExpect, haveResource, haveResourceLike, isSuperObject, MatchStyle, SynthUtils } from '@aws-cdk/assert-internal';
import { CfnOutput, CfnResource, Fn, Lazy, Stack, Tags } from '@aws-cdk/core';
import { nodeunitShim, Test } from 'nodeunit-shim';
import {
  AclCidr,
  AclTraffic,
  BastionHostLinux,
  CfnSubnet,
  CfnVPC,
  SubnetFilter,
  DefaultInstanceTenancy,
  GenericLinuxImage,
  InstanceType,
  InterfaceVpcEndpoint,
  InterfaceVpcEndpointService,
  NatProvider,
  NatTrafficDirection,
  NetworkAcl,
  NetworkAclEntry,
  Peer,
  Port,
  PrivateSubnet,
  PublicSubnet,
  RouterType,
  Subnet,
  SubnetType,
  TrafficDirection,
  Vpc,
} from '../lib';

nodeunitShim({
  'When creating a VPC': {
    'with the default CIDR range': {

      'vpc.vpcId returns a token to the VPC ID'(test: Test) {
        const stack = getTestStack();
        const vpc = new Vpc(stack, 'TheVPC');
        test.deepEqual(stack.resolve(vpc.vpcId), { Ref: 'TheVPC92636AB0' } );
        test.done();
      },

      'it uses the correct network range'(test: Test) {
        const stack = getTestStack();
        new Vpc(stack, 'TheVPC');
        cdkExpect(stack).to(haveResource('AWS::EC2::VPC', {
          CidrBlock: Vpc.DEFAULT_CIDR_RANGE,
          EnableDnsHostnames: true,
          EnableDnsSupport: true,
          InstanceTenancy: DefaultInstanceTenancy.DEFAULT,
        }));
        test.done();
      },
      'the Name tag is defaulted to path'(test: Test) {
        const stack = getTestStack();
        new Vpc(stack, 'TheVPC');
        cdkExpect(stack).to(
          haveResource('AWS::EC2::VPC',
            hasTags( [{ Key: 'Name', Value: 'TestStack/TheVPC' }])),
        );
        cdkExpect(stack).to(
          haveResource('AWS::EC2::InternetGateway',
            hasTags( [{ Key: 'Name', Value: 'TestStack/TheVPC' }])),
        );
        test.done();
      },

    },

    'with all of the properties set, it successfully sets the correct VPC properties'(test: Test) {
      const stack = getTestStack();
      new Vpc(stack, 'TheVPC', {
        cidr: '192.168.0.0/16',
        enableDnsHostnames: false,
        enableDnsSupport: false,
        defaultInstanceTenancy: DefaultInstanceTenancy.DEDICATED,
      });

      cdkExpect(stack).to(haveResource('AWS::EC2::VPC', {
        CidrBlock: '192.168.0.0/16',
        EnableDnsHostnames: false,
        EnableDnsSupport: false,
        InstanceTenancy: DefaultInstanceTenancy.DEDICATED,
      }));
      test.done();
    },

    'dns getters correspond to CFN properties': (() => {
      const tests: any = { };

      const inputs = [
        { dnsSupport: false, dnsHostnames: false },
        // {dnsSupport: false, dnsHostnames: true} - this configuration is illegal so its not part of the permutations.
        { dnsSupport: true, dnsHostnames: false },
        { dnsSupport: true, dnsHostnames: true },
      ];

      for (const input of inputs) {
        tests[`[dnsSupport=${input.dnsSupport},dnsHostnames=${input.dnsHostnames}]`] = (test: Test) => {
          const stack = getTestStack();
          const vpc = new Vpc(stack, 'TheVPC', {
            cidr: '192.168.0.0/16',
            enableDnsHostnames: input.dnsHostnames,
            enableDnsSupport: input.dnsSupport,
            defaultInstanceTenancy: DefaultInstanceTenancy.DEDICATED,
          });

          cdkExpect(stack).to(haveResource('AWS::EC2::VPC', {
            CidrBlock: '192.168.0.0/16',
            EnableDnsHostnames: input.dnsHostnames,
            EnableDnsSupport: input.dnsSupport,
            InstanceTenancy: DefaultInstanceTenancy.DEDICATED,
          }));

          test.equal(input.dnsSupport, vpc.dnsSupportEnabled);
          test.equal(input.dnsHostnames, vpc.dnsHostnamesEnabled);
          test.done();
        };
      }

      return tests;
    })(),

    'contains the correct number of subnets'(test: Test) {
      const stack = getTestStack();
      const vpc = new Vpc(stack, 'TheVPC');
      const zones = stack.availabilityZones.length;
      test.equal(vpc.publicSubnets.length, zones);
      test.equal(vpc.privateSubnets.length, zones);
      test.deepEqual(stack.resolve(vpc.vpcId), { Ref: 'TheVPC92636AB0' });
      test.done();
    },

    'can refer to the internet gateway'(test: Test) {
      const stack = getTestStack();
      const vpc = new Vpc(stack, 'TheVPC');
      test.deepEqual(stack.resolve(vpc.internetGatewayId), { Ref: 'TheVPCIGWFA25CC08' });
      test.done();
    },

    'with only isolated subnets, the VPC should not contain an IGW or NAT Gateways'(test: Test) {
      const stack = getTestStack();
      new Vpc(stack, 'TheVPC', {
        subnetConfiguration: [
          {
            subnetType: SubnetType.ISOLATED,
            name: 'Isolated',
          },
        ],
      });
      cdkExpect(stack).notTo(haveResource('AWS::EC2::InternetGateway'));
      cdkExpect(stack).notTo(haveResource('AWS::EC2::NatGateway'));
      cdkExpect(stack).to(haveResource('AWS::EC2::Subnet', {
        MapPublicIpOnLaunch: false,
      }));
      test.done();
    },

    'with no private subnets, the VPC should have an IGW but no NAT Gateways'(test: Test) {
      const stack = getTestStack();
      new Vpc(stack, 'TheVPC', {
        subnetConfiguration: [
          {
            subnetType: SubnetType.PUBLIC,
            name: 'Public',
          },
          {
            subnetType: SubnetType.ISOLATED,
            name: 'Isolated',
          },
        ],
      });
      cdkExpect(stack).to(countResources('AWS::EC2::InternetGateway', 1))
      ;
      cdkExpect(stack).notTo(haveResource('AWS::EC2::NatGateway'));
      test.done();
    },
    'with private subnets and custom networkAcl.'(test: Test) {
      const stack = getTestStack();
      const vpc = new Vpc(stack, 'TheVPC', {
        subnetConfiguration: [
          {
            subnetType: SubnetType.PUBLIC,
            name: 'Public',
          },
          {
            subnetType: SubnetType.PRIVATE,
            name: 'private',
          },
        ],
      });

      const nacl1 = new NetworkAcl(stack, 'myNACL1', {
        vpc,
        subnetSelection: { subnetType: SubnetType.PRIVATE },
      });

      new NetworkAclEntry(stack, 'AllowDNSEgress', {
        networkAcl: nacl1,
        ruleNumber: 100,
        traffic: AclTraffic.udpPort(53),
        direction: TrafficDirection.EGRESS,
        cidr: AclCidr.ipv4('10.0.0.0/16'),
      });

      new NetworkAclEntry(stack, 'AllowDNSIngress', {
        networkAcl: nacl1,
        ruleNumber: 100,
        traffic: AclTraffic.udpPort(53),
        direction: TrafficDirection.INGRESS,
        cidr: AclCidr.anyIpv4(),
      });

      cdkExpect(stack).to(countResources('AWS::EC2::NetworkAcl', 1));
      cdkExpect(stack).to(countResources('AWS::EC2::NetworkAclEntry', 2));
      cdkExpect(stack).to(countResources('AWS::EC2::SubnetNetworkAclAssociation', 3));
      test.done();
    },

    'with no subnets defined, the VPC should have an IGW, and a NAT Gateway per AZ'(test: Test) {
      const stack = getTestStack();
      const zones = stack.availabilityZones.length;
      new Vpc(stack, 'TheVPC', { });
      cdkExpect(stack).to(countResources('AWS::EC2::InternetGateway', 1));
      cdkExpect(stack).to(countResources('AWS::EC2::NatGateway', zones));
      test.done();
    },

    'with isolated and public subnet, should be able to use the internet gateway to define routes'(test: Test) {
      const stack = getTestStack();
      const vpc = new Vpc(stack, 'TheVPC', {
        subnetConfiguration: [
          {
            subnetType: SubnetType.ISOLATED,
            name: 'isolated',
          },
          {
            subnetType: SubnetType.PUBLIC,
            name: 'public',
          },
        ],
      });
      (vpc.isolatedSubnets[0] as Subnet).addRoute('TheRoute', {
        routerId: vpc.internetGatewayId!,
        routerType: RouterType.GATEWAY,
        destinationCidrBlock: '8.8.8.8/32',
      });
      cdkExpect(stack).to(haveResource('AWS::EC2::InternetGateway'));
      cdkExpect(stack).to(haveResourceLike('AWS::EC2::Route', {
        DestinationCidrBlock: '8.8.8.8/32',
        GatewayId: { },
      }));
      test.done();
    },

    'with only isolated subnets the internet gateway should be undefined'(test: Test) {
      const stack = getTestStack();
      const vpc = new Vpc(stack, 'TheVPC', {
        subnetConfiguration: [
          {
            subnetType: SubnetType.ISOLATED,
            name: 'isolated',
          },
        ],
      });
      test.equal(vpc.internetGatewayId, undefined);
      cdkExpect(stack).notTo(haveResource('AWS::EC2::InternetGateway'));
      test.done();
    },

    'with subnets and reserved subnets defined, VPC subnet count should not contain reserved subnets '(test: Test) {
      const stack = getTestStack();
      new Vpc(stack, 'TheVPC', {
        cidr: '10.0.0.0/16',
        subnetConfiguration: [
          {
            cidrMask: 24,
            subnetType: SubnetType.PUBLIC,
            name: 'Public',
          },
          {
            cidrMask: 24,
            name: 'reserved',
            subnetType: SubnetType.PRIVATE,
            reserved: true,
          },
          {
            cidrMask: 28,
            name: 'rds',
            subnetType: SubnetType.ISOLATED,
          },
        ],
        maxAzs: 3,
      });
      cdkExpect(stack).to(countResources('AWS::EC2::Subnet', 6));
      test.done();
    },
    'with reserved subnets, any other subnets should not have cidrBlock from within reserved space'(test: Test) {
      const stack = getTestStack();
      new Vpc(stack, 'TheVPC', {
        cidr: '10.0.0.0/16',
        subnetConfiguration: [
          {
            cidrMask: 24,
            name: 'ingress',
            subnetType: SubnetType.PUBLIC,
          },
          {
            cidrMask: 24,
            name: 'reserved',
            subnetType: SubnetType.PRIVATE,
            reserved: true,
          },
          {
            cidrMask: 24,
            name: 'rds',
            subnetType: SubnetType.PRIVATE,
          },
        ],
        maxAzs: 3,
      });
      for (let i = 0; i < 3; i++) {
        cdkExpect(stack).to(haveResource('AWS::EC2::Subnet', {
          CidrBlock: `10.0.${i}.0/24`,
        }));
      }
      for (let i = 3; i < 6; i++) {
        cdkExpect(stack).notTo(haveResource('AWS::EC2::Subnet', {
          CidrBlock: `10.0.${i}.0/24`,
        }));
      }
      for (let i = 6; i < 9; i++) {
        cdkExpect(stack).to(haveResource('AWS::EC2::Subnet', {
          CidrBlock: `10.0.${i}.0/24`,
        }));
      }
      test.done();
    },
    'with custom subnets, the VPC should have the right number of subnets, an IGW, and a NAT Gateway per AZ'(test: Test) {
      const stack = getTestStack();
      const zones = stack.availabilityZones.length;
      new Vpc(stack, 'TheVPC', {
        cidr: '10.0.0.0/21',
        subnetConfiguration: [
          {
            cidrMask: 24,
            name: 'ingress',
            subnetType: SubnetType.PUBLIC,
          },
          {
            cidrMask: 24,
            name: 'application',
            subnetType: SubnetType.PRIVATE,
          },
          {
            cidrMask: 28,
            name: 'rds',
            subnetType: SubnetType.ISOLATED,
          },
        ],
        maxAzs: 3,
      });
      cdkExpect(stack).to(countResources('AWS::EC2::InternetGateway', 1));
      cdkExpect(stack).to(countResources('AWS::EC2::NatGateway', zones));
      cdkExpect(stack).to(countResources('AWS::EC2::Subnet', 9));
      for (let i = 0; i < 6; i++) {
        cdkExpect(stack).to(haveResource('AWS::EC2::Subnet', {
          CidrBlock: `10.0.${i}.0/24`,
        }));
      }
      for (let i = 0; i < 3; i++) {
        cdkExpect(stack).to(haveResource('AWS::EC2::Subnet', {
          CidrBlock: `10.0.6.${i * 16}/28`,
        }));
      }
      test.done();
    },
    'with custom subents and natGateways = 2 there should be only two NATGW'(test: Test) {
      const stack = getTestStack();
      new Vpc(stack, 'TheVPC', {
        cidr: '10.0.0.0/21',
        natGateways: 2,
        subnetConfiguration: [
          {
            cidrMask: 24,
            name: 'ingress',
            subnetType: SubnetType.PUBLIC,
          },
          {
            cidrMask: 24,
            name: 'application',
            subnetType: SubnetType.PRIVATE,
          },
          {
            cidrMask: 28,
            name: 'rds',
            subnetType: SubnetType.ISOLATED,
          },
        ],
        maxAzs: 3,
      });
      cdkExpect(stack).to(countResources('AWS::EC2::InternetGateway', 1));
      cdkExpect(stack).to(countResources('AWS::EC2::NatGateway', 2));
      cdkExpect(stack).to(countResources('AWS::EC2::Subnet', 9));
      for (let i = 0; i < 6; i++) {
        cdkExpect(stack).to(haveResource('AWS::EC2::Subnet', {
          CidrBlock: `10.0.${i}.0/24`,
        }));
      }
      for (let i = 0; i < 3; i++) {
        cdkExpect(stack).to(haveResource('AWS::EC2::Subnet', {
          CidrBlock: `10.0.6.${i * 16}/28`,
        }));
      }
      test.done();
    },
    'with enableDnsHostnames enabled but enableDnsSupport disabled, should throw an Error'(test: Test) {
      const stack = getTestStack();
      test.throws(() => new Vpc(stack, 'TheVPC', {
        enableDnsHostnames: true,
        enableDnsSupport: false,
      }));
      test.done();
    },
    'with public subnets MapPublicIpOnLaunch is true'(test: Test) {
      const stack = getTestStack();
      new Vpc(stack, 'VPC', {
        maxAzs: 1,
        subnetConfiguration: [
          {
            cidrMask: 24,
            name: 'ingress',
            subnetType: SubnetType.PUBLIC,
          },
        ],
      });
      cdkExpect(stack).to(countResources('AWS::EC2::Subnet', 1));
      cdkExpect(stack).notTo(haveResource('AWS::EC2::NatGateway'));
      cdkExpect(stack).to(haveResource('AWS::EC2::Subnet', {
        MapPublicIpOnLaunch: true,
      }));
      test.done();
    },

    'maxAZs defaults to 3 if unset'(test: Test) {
      const stack = getTestStack();
      new Vpc(stack, 'VPC');
      cdkExpect(stack).to(countResources('AWS::EC2::Subnet', 6));
      cdkExpect(stack).to(countResources('AWS::EC2::Route', 6));
      for (let i = 0; i < 6; i++) {
        cdkExpect(stack).to(haveResource('AWS::EC2::Subnet', {
          CidrBlock: `10.0.${i * 32}.0/19`,
        }));
      }
      cdkExpect(stack).to(haveResourceLike('AWS::EC2::Route', {
        DestinationCidrBlock: '0.0.0.0/0',
        NatGatewayId: { },
      }));

      test.done();
    },

    'with maxAZs set to 2'(test: Test) {
      const stack = getTestStack();
      new Vpc(stack, 'VPC', { maxAzs: 2 });
      cdkExpect(stack).to(countResources('AWS::EC2::Subnet', 4));
      cdkExpect(stack).to(countResources('AWS::EC2::Route', 4));
      for (let i = 0; i < 4; i++) {
        cdkExpect(stack).to(haveResource('AWS::EC2::Subnet', {
          CidrBlock: `10.0.${i * 64}.0/18`,
        }));
      }
      cdkExpect(stack).to(haveResourceLike('AWS::EC2::Route', {
        DestinationCidrBlock: '0.0.0.0/0',
        NatGatewayId: { },
      }));
      test.done();
    },
    'with natGateway set to 1'(test: Test) {
      const stack = getTestStack();
      new Vpc(stack, 'VPC', {
        natGateways: 1,
      });
      cdkExpect(stack).to(countResources('AWS::EC2::Subnet', 6));
      cdkExpect(stack).to(countResources('AWS::EC2::Route', 6));
      cdkExpect(stack).to(countResources('AWS::EC2::NatGateway', 1));
      cdkExpect(stack).to(haveResourceLike('AWS::EC2::Route', {
        DestinationCidrBlock: '0.0.0.0/0',
        NatGatewayId: { },
      }));
      test.done();
    },
    'with natGateway subnets defined'(test: Test) {
      const stack = getTestStack();
      new Vpc(stack, 'VPC', {
        subnetConfiguration: [
          {
            cidrMask: 24,
            name: 'ingress',
            subnetType: SubnetType.PUBLIC,
          },
          {
            cidrMask: 24,
            name: 'egress',
            subnetType: SubnetType.PUBLIC,
          },
          {
            cidrMask: 24,
            name: 'private',
            subnetType: SubnetType.PRIVATE,
          },
        ],
        natGatewaySubnets: {
          subnetGroupName: 'egress',
        },
      });
      cdkExpect(stack).to(countResources('AWS::EC2::NatGateway', 3));
      for (let i = 1; i < 4; i++) {
        cdkExpect(stack).to(haveResource('AWS::EC2::Subnet', hasTags([{
          Key: 'Name',
          Value: `TestStack/VPC/egressSubnet${i}`,
        }, {
          Key: 'aws-cdk:subnet-name',
          Value: 'egress',
        }])));
      }
      test.done();
    },

    'natGateways = 0 throws if no PRIVATE subnets configured'(test: Test) {
      const stack = getTestStack();
      test.throws(() => {
        new Vpc(stack, 'VPC', {
          natGateways: 0,
          subnetConfiguration: [
            {
              name: 'public',
              subnetType: SubnetType.PUBLIC,
            },
            {
              name: 'private',
              subnetType: SubnetType.PRIVATE,
            },
          ],
        });
      }, /make sure you don't configure any PRIVATE subnets/);
      test.done();
    },

    'natGateway = 0 defaults with ISOLATED subnet'(test: Test) {
      const stack = getTestStack();
      new Vpc(stack, 'VPC', {
        natGateways: 0,
      });
      cdkExpect(stack).to(haveResource('AWS::EC2::Subnet', hasTags([{
        Key: 'aws-cdk:subnet-type',
        Value: 'Isolated',
      }])));
      test.done();
    },

    'unspecified natGateways constructs with PRIVATE subnet'(test: Test) {
      const stack = getTestStack();
      new Vpc(stack, 'VPC');
      cdkExpect(stack).to(haveResource('AWS::EC2::Subnet', hasTags([{
        Key: 'aws-cdk:subnet-type',
        Value: 'Private',
      }])));
      test.done();
    },

    'natGateways = 0 allows RESERVED PRIVATE subnets'(test: Test) {
      const stack = getTestStack();
      new Vpc(stack, 'VPC', {
        cidr: '10.0.0.0/16',
        subnetConfiguration: [
          {
            name: 'ingress',
            subnetType: SubnetType.PUBLIC,
          },
          {
            name: 'private',
            subnetType: SubnetType.PRIVATE,
            reserved: true,
          },
        ],
        natGateways: 0,
      });
      cdkExpect(stack).to(haveResource('AWS::EC2::Subnet', hasTags([{
        Key: 'aws-cdk:subnet-name',
        Value: 'ingress',
      }])));
      test.done();
    },

    'with mis-matched nat and subnet configs it throws'(test: Test) {
      const stack = getTestStack();
      test.throws(() => new Vpc(stack, 'VPC', {
        subnetConfiguration: [
          {
            cidrMask: 24,
            name: 'ingress',
            subnetType: SubnetType.PUBLIC,
          },
          {
            cidrMask: 24,
            name: 'private',
            subnetType: SubnetType.PRIVATE,
          },
        ],
        natGatewaySubnets: {
          subnetGroupName: 'notthere',
        },
      }));
      test.done();
    },
    'with a vpn gateway'(test: Test) {
      const stack = getTestStack();
      new Vpc(stack, 'VPC', {
        vpnGateway: true,
        vpnGatewayAsn: 65000,
      });

      cdkExpect(stack).to(haveResource('AWS::EC2::VPNGateway', {
        AmazonSideAsn: 65000,
        Type: 'ipsec.1',
      }));

      cdkExpect(stack).to(haveResource('AWS::EC2::VPCGatewayAttachment', {
        VpcId: {
          Ref: 'VPCB9E5F0B4',
        },
        VpnGatewayId: {
          Ref: 'VPCVpnGatewayB5ABAE68',
        },
      }));

      cdkExpect(stack).to(haveResource('AWS::EC2::VPNGatewayRoutePropagation', {
        RouteTableIds: [
          {
            Ref: 'VPCPrivateSubnet1RouteTableBE8A6027',
          },
          {
            Ref: 'VPCPrivateSubnet2RouteTable0A19E10E',
          },
          {
            Ref: 'VPCPrivateSubnet3RouteTable192186F8',
          },
        ],
        VpnGatewayId: {
          Ref: 'VPCVpnGatewayB5ABAE68',
        },
      }));

      test.done();
    },
    'with a vpn gateway and route propagation on isolated subnets'(test: Test) {
      const stack = getTestStack();
      new Vpc(stack, 'VPC', {
        subnetConfiguration: [
          { subnetType: SubnetType.PUBLIC, name: 'Public' },
          { subnetType: SubnetType.ISOLATED, name: 'Isolated' },
        ],
        vpnGateway: true,
        vpnRoutePropagation: [
          {
            subnetType: SubnetType.ISOLATED,
          },
        ],
      });

      cdkExpect(stack).to(haveResource('AWS::EC2::VPNGatewayRoutePropagation', {
        RouteTableIds: [
          {
            Ref: 'VPCIsolatedSubnet1RouteTableEB156210',
          },
          {
            Ref: 'VPCIsolatedSubnet2RouteTable9B4F78DC',
          },
          {
            Ref: 'VPCIsolatedSubnet3RouteTableCB6A1FDA',
          },
        ],
        VpnGatewayId: {
          Ref: 'VPCVpnGatewayB5ABAE68',
        },
      }));

      test.done();
    },
    'with a vpn gateway and route propagation on private and isolated subnets'(test: Test) {
      const stack = getTestStack();
      new Vpc(stack, 'VPC', {
        subnetConfiguration: [
          { subnetType: SubnetType.PUBLIC, name: 'Public' },
          { subnetType: SubnetType.PRIVATE, name: 'Private' },
          { subnetType: SubnetType.ISOLATED, name: 'Isolated' },
        ],
        vpnGateway: true,
        vpnRoutePropagation: [
          {
            subnetType: SubnetType.PRIVATE,
          },
          {
            subnetType: SubnetType.ISOLATED,
          },
        ],
      });

      cdkExpect(stack).to(haveResource('AWS::EC2::VPNGatewayRoutePropagation', {
        RouteTableIds: [
          {
            Ref: 'VPCPrivateSubnet1RouteTableBE8A6027',
          },
          {
            Ref: 'VPCPrivateSubnet2RouteTable0A19E10E',
          },
          {
            Ref: 'VPCPrivateSubnet3RouteTable192186F8',
          },
          {
            Ref: 'VPCIsolatedSubnet1RouteTableEB156210',
          },
          {
            Ref: 'VPCIsolatedSubnet2RouteTable9B4F78DC',
          },
          {
            Ref: 'VPCIsolatedSubnet3RouteTableCB6A1FDA',
          },
        ],
        VpnGatewayId: {
          Ref: 'VPCVpnGatewayB5ABAE68',
        },
      }));

      test.done();
    },
    'route propagation defaults to isolated subnets when there are no private subnets'(test: Test) {
      const stack = getTestStack();
      new Vpc(stack, 'VPC', {
        subnetConfiguration: [
          { subnetType: SubnetType.PUBLIC, name: 'Public' },
          { subnetType: SubnetType.ISOLATED, name: 'Isolated' },
        ],
        vpnGateway: true,
      });

      cdkExpect(stack).to(haveResource('AWS::EC2::VPNGatewayRoutePropagation', {
        RouteTableIds: [
          {
            Ref: 'VPCIsolatedSubnet1RouteTableEB156210',
          },
          {
            Ref: 'VPCIsolatedSubnet2RouteTable9B4F78DC',
          },
          {
            Ref: 'VPCIsolatedSubnet3RouteTableCB6A1FDA',
          },
        ],
        VpnGatewayId: {
          Ref: 'VPCVpnGatewayB5ABAE68',
        },
      }));

      test.done();
    },
    'route propagation defaults to public subnets when there are no private/isolated subnets'(test: Test) {
      const stack = getTestStack();
      new Vpc(stack, 'VPC', {
        subnetConfiguration: [
          { subnetType: SubnetType.PUBLIC, name: 'Public' },
        ],
        vpnGateway: true,
      });

      cdkExpect(stack).to(haveResource('AWS::EC2::VPNGatewayRoutePropagation', {
        RouteTableIds: [
          {
            Ref: 'VPCPublicSubnet1RouteTableFEE4B781',
          },
          {
            Ref: 'VPCPublicSubnet2RouteTable6F1A15F1',
          },
          {
            Ref: 'VPCPublicSubnet3RouteTable98AE0E14',
          },
        ],
        VpnGatewayId: {
          Ref: 'VPCVpnGatewayB5ABAE68',
        },
      }));

      test.done();
    },
    'fails when specifying vpnConnections with vpnGateway set to false'(test: Test) {
      // GIVEN
      const stack = new Stack();

      test.throws(() => new Vpc(stack, 'VpcNetwork', {
        vpnGateway: false,
        vpnConnections: {
          VpnConnection: {
            asn: 65000,
            ip: '192.0.2.1',
          },
        },
      }), /`vpnConnections`.+`vpnGateway`.+false/);

      test.done();
    },
    'fails when specifying vpnGatewayAsn with vpnGateway set to false'(test: Test) {
      // GIVEN
      const stack = new Stack();

      test.throws(() => new Vpc(stack, 'VpcNetwork', {
        vpnGateway: false,
        vpnGatewayAsn: 65000,
      }), /`vpnGatewayAsn`.+`vpnGateway`.+false/);

      test.done();
    },

    'Subnets have a defaultChild'(test: Test) {
      // GIVEN
      const stack = new Stack();

      const vpc = new Vpc(stack, 'VpcNetwork');

      test.ok(vpc.publicSubnets[0].node.defaultChild instanceof CfnSubnet);

      test.done();
    },

    'CIDR cannot be a Token'(test: Test) {
      const stack = new Stack();
      test.throws(() => {
        new Vpc(stack, 'Vpc', {
          cidr: Lazy.string({ produce: () => 'abc' }),
        });
      }, /property must be a concrete CIDR string/);

      test.done();
    },

    'Default NAT gateway provider'(test: Test) {
      const stack = new Stack();
      const natGatewayProvider = NatProvider.gateway();
      new Vpc(stack, 'VpcNetwork', { natGatewayProvider });

      test.ok(natGatewayProvider.configuredGateways.length > 0);

      test.done();
    },

    'NAT gateway provider with EIP allocations'(test: Test) {
      const stack = new Stack();
      const natGatewayProvider = NatProvider.gateway({
        eipAllocationIds: ['a', 'b', 'c', 'd'],
      });
      new Vpc(stack, 'VpcNetwork', { natGatewayProvider });

      cdkExpect(stack).to(haveResource('AWS::EC2::NatGateway', {
        AllocationId: 'a',
      }));
      cdkExpect(stack).to(haveResource('AWS::EC2::NatGateway', {
        AllocationId: 'b',
      }));

      test.done();
    },

    'Can add an IPv6 route'(test: Test) {
      // GIVEN
      const stack = getTestStack();

      // WHEN
      const vpc = new Vpc(stack, 'VPC');
      (vpc.publicSubnets[0] as PublicSubnet).addRoute('SomeRoute', {
        destinationIpv6CidrBlock: '2001:4860:4860::8888/32',
        routerId: 'router-1',
        routerType: RouterType.NETWORK_INTERFACE,
      });

      // THEN

      cdkExpect(stack).to(haveResourceLike('AWS::EC2::Route', {
        DestinationIpv6CidrBlock: '2001:4860:4860::8888/32',
        NetworkInterfaceId: 'router-1',
      }));

      test.done();
    },
    'Can add an IPv4 route'(test: Test) {
      // GIVEN
      const stack = getTestStack();

      // WHEN
      const vpc = new Vpc(stack, 'VPC');
      (vpc.publicSubnets[0] as PublicSubnet).addRoute('SomeRoute', {
        destinationCidrBlock: '0.0.0.0/0',
        routerId: 'router-1',
        routerType: RouterType.NETWORK_INTERFACE,
      });

      // THEN

      cdkExpect(stack).to(haveResourceLike('AWS::EC2::Route', {
        DestinationCidrBlock: '0.0.0.0/0',
        NetworkInterfaceId: 'router-1',
      }));

      test.done();
    },
  },

  'NAT instances': {
    'Can configure NAT instances instead of NAT gateways'(test: Test) {
      // GIVEN
      const stack = getTestStack();

      // WHEN
      const natGatewayProvider = NatProvider.instance({
        instanceType: new InstanceType('q86.mega'),
        machineImage: new GenericLinuxImage({
          'us-east-1': 'ami-1',
        }),
      });
      new Vpc(stack, 'TheVPC', { natGatewayProvider });

      // THEN
      cdkExpect(stack).to(countResources('AWS::EC2::Instance', 3));
      cdkExpect(stack).to(haveResource('AWS::EC2::Instance', {
        ImageId: 'ami-1',
        InstanceType: 'q86.mega',
        SourceDestCheck: false,
      }));
      cdkExpect(stack).to(haveResource('AWS::EC2::Route', {
        RouteTableId: { Ref: 'TheVPCPrivateSubnet1RouteTableF6513BC2' },
        DestinationCidrBlock: '0.0.0.0/0',
        InstanceId: { Ref: 'TheVPCPublicSubnet1NatInstanceCC514192' },
      }));
      cdkExpect(stack).to(haveResource('AWS::EC2::SecurityGroup', {
        SecurityGroupEgress: [
          {
            CidrIp: '0.0.0.0/0',
            Description: 'Allow all outbound traffic by default',
            IpProtocol: '-1',
          },
        ],
        SecurityGroupIngress: [
          {
            CidrIp: '0.0.0.0/0',
            Description: 'from 0.0.0.0/0:ALL TRAFFIC',
            IpProtocol: '-1',
          },
        ],
      }));

      test.done();
    },

    'natGateways controls amount of NAT instances'(test: Test) {
      // GIVEN
      const stack = getTestStack();

      // WHEN
      new Vpc(stack, 'TheVPC', {
        natGatewayProvider: NatProvider.instance({
          instanceType: new InstanceType('q86.mega'),
          machineImage: new GenericLinuxImage({
            'us-east-1': 'ami-1',
          }),
        }),
        natGateways: 1,
      });

      // THEN
      cdkExpect(stack).to(countResources('AWS::EC2::Instance', 1));

      test.done();
    },

    'can configure Security Groups of NAT instances with allowAllTraffic false'(test: Test) {
      // GIVEN
      const stack = getTestStack();

      // WHEN
      const provider = NatProvider.instance({
        instanceType: new InstanceType('q86.mega'),
        machineImage: new GenericLinuxImage({
          'us-east-1': 'ami-1',
        }),
        allowAllTraffic: false,
      });
      new Vpc(stack, 'TheVPC', {
        natGatewayProvider: provider,
      });
      provider.connections.allowFrom(Peer.ipv4('1.2.3.4/32'), Port.tcp(86));

      // THEN
      cdkExpect(stack).to(haveResource('AWS::EC2::SecurityGroup', {
        SecurityGroupEgress: [
          {
            CidrIp: '0.0.0.0/0',
            Description: 'Allow all outbound traffic by default',
            IpProtocol: '-1',
          },
        ],
        SecurityGroupIngress: [
          {
            CidrIp: '1.2.3.4/32',
            Description: 'from 1.2.3.4/32:86',
            FromPort: 86,
            IpProtocol: 'tcp',
            ToPort: 86,
          },
        ],
      }));

      test.done();
    },

    'can configure Security Groups of NAT instances with defaultAllowAll INBOUND_AND_OUTBOUND'(test: Test) {
      // GIVEN
      const stack = getTestStack();

      // WHEN
      const provider = NatProvider.instance({
        instanceType: new InstanceType('q86.mega'),
        machineImage: new GenericLinuxImage({
          'us-east-1': 'ami-1',
        }),
        defaultAllowedTraffic: NatTrafficDirection.INBOUND_AND_OUTBOUND,
      });
      new Vpc(stack, 'TheVPC', {
        natGatewayProvider: provider,
      });

      // THEN
      cdkExpect(stack).to(haveResource('AWS::EC2::SecurityGroup', {
        SecurityGroupEgress: [
          {
            CidrIp: '0.0.0.0/0',
            Description: 'Allow all outbound traffic by default',
            IpProtocol: '-1',
          },
        ],
        SecurityGroupIngress: [
          {
            CidrIp: '0.0.0.0/0',
            Description: 'from 0.0.0.0/0:ALL TRAFFIC',
            IpProtocol: '-1',
          },
        ],
      }));

      test.done();
    },

    'can configure Security Groups of NAT instances with defaultAllowAll OUTBOUND_ONLY'(test: Test) {
      // GIVEN
      const stack = getTestStack();

      // WHEN
      const provider = NatProvider.instance({
        instanceType: new InstanceType('q86.mega'),
        machineImage: new GenericLinuxImage({
          'us-east-1': 'ami-1',
        }),
        defaultAllowedTraffic: NatTrafficDirection.OUTBOUND_ONLY,
      });
      new Vpc(stack, 'TheVPC', {
        natGatewayProvider: provider,
      });

      // THEN
      cdkExpect(stack).to(haveResource('AWS::EC2::SecurityGroup', {
        SecurityGroupEgress: [
          {
            CidrIp: '0.0.0.0/0',
            Description: 'Allow all outbound traffic by default',
            IpProtocol: '-1',
          },
        ],
      }));

      test.done();
    },

    'can configure Security Groups of NAT instances with defaultAllowAll NONE'(test: Test) {
      // GIVEN
      const stack = getTestStack();

      // WHEN
      const provider = NatProvider.instance({
        instanceType: new InstanceType('q86.mega'),
        machineImage: new GenericLinuxImage({
          'us-east-1': 'ami-1',
        }),
        defaultAllowedTraffic: NatTrafficDirection.NONE,
      });
      new Vpc(stack, 'TheVPC', {
        natGatewayProvider: provider,
      });

      // THEN
      cdkExpect(stack).to(haveResource('AWS::EC2::SecurityGroup', {
        SecurityGroupEgress: [
          {
            CidrIp: '255.255.255.255/32',
            Description: 'Disallow all traffic',
            FromPort: 252,
            IpProtocol: 'icmp',
            ToPort: 86,
          },
        ],
      }));

      test.done();
    },

  },

  'Network ACL association': {
    'by default uses default ACL reference'(test: Test) {
      // GIVEN
      const stack = getTestStack();

      // WHEN
      const vpc = new Vpc(stack, 'TheVPC', { cidr: '192.168.0.0/16' });
      new CfnOutput(stack, 'Output', {
        value: (vpc.publicSubnets[0] as Subnet).subnetNetworkAclAssociationId,
      });

      cdkExpect(stack).toMatch({
        Outputs: {
          Output: {
            Value: { 'Fn::GetAtt': ['TheVPCPublicSubnet1Subnet770D4FF2', 'NetworkAclAssociationId'] },
          },
        },
      }, MatchStyle.SUPERSET);

      test.done();
    },

    'if ACL is replaced new ACL reference is returned'(test: Test) {
      // GIVEN
      const stack = getTestStack();
      const vpc = new Vpc(stack, 'TheVPC', { cidr: '192.168.0.0/16' });

      // WHEN
      new CfnOutput(stack, 'Output', {
        value: (vpc.publicSubnets[0] as Subnet).subnetNetworkAclAssociationId,
      });
      new NetworkAcl(stack, 'ACL', {
        vpc,
        subnetSelection: { subnetType: SubnetType.PUBLIC },
      });

      cdkExpect(stack).toMatch({
        Outputs: {
          Output: {
            Value: { Ref: 'ACLDBD1BB49' },
          },
        },
      }, MatchStyle.SUPERSET);

      test.done();
    },
  },

  'When creating a VPC with a custom CIDR range': {
    'vpc.vpcCidrBlock is the correct network range'(test: Test) {
      const stack = getTestStack();
      new Vpc(stack, 'TheVPC', { cidr: '192.168.0.0/16' });
      cdkExpect(stack).to(haveResource('AWS::EC2::VPC', {
        CidrBlock: '192.168.0.0/16',
      }));
      test.done();
    },
  },
  'When tagging': {
    'VPC propagated tags will be on subnet, IGW, routetables, NATGW'(test: Test) {
      const stack = getTestStack();
      const tags = {
        VpcType: 'Good',
      };
      const noPropTags = {
        BusinessUnit: 'Marketing',
      };
      const allTags = { ...tags, ...noPropTags };

      const vpc = new Vpc(stack, 'TheVPC');
      // overwrite to set propagate
      Tags.of(vpc).add('BusinessUnit', 'Marketing', { includeResourceTypes: [CfnVPC.CFN_RESOURCE_TYPE_NAME] });
      Tags.of(vpc).add('VpcType', 'Good');
      cdkExpect(stack).to(haveResource('AWS::EC2::VPC', hasTags(toCfnTags(allTags))));
      const taggables = ['Subnet', 'InternetGateway', 'NatGateway', 'RouteTable'];
      const propTags = toCfnTags(tags);
      const noProp = toCfnTags(noPropTags);
      for (const resource of taggables) {
        cdkExpect(stack).to(haveResource(`AWS::EC2::${resource}`, hasTags(propTags)));
        cdkExpect(stack).notTo(haveResource(`AWS::EC2::${resource}`, hasTags(noProp)));
      }
      test.done();
    },
    'Subnet Name will propagate to route tables and NATGW'(test: Test) {
      const stack = getTestStack();
      const vpc = new Vpc(stack, 'TheVPC');
      for (const subnet of vpc.publicSubnets) {
        const tag = { Key: 'Name', Value: subnet.node.path };
        cdkExpect(stack).to(haveResource('AWS::EC2::NatGateway', hasTags([tag])));
        cdkExpect(stack).to(haveResource('AWS::EC2::RouteTable', hasTags([tag])));
      }
      for (const subnet of vpc.privateSubnets) {
        const tag = { Key: 'Name', Value: subnet.node.path };
        cdkExpect(stack).to(haveResource('AWS::EC2::RouteTable', hasTags([tag])));
      }
      test.done();
    },
    'Tags can be added after the Vpc is created with `vpc.tags.setTag(...)`'(test: Test) {
      const stack = getTestStack();

      const vpc = new Vpc(stack, 'TheVPC');
      const tag = { Key: 'Late', Value: 'Adder' };
      cdkExpect(stack).notTo(haveResource('AWS::EC2::VPC', hasTags([tag])));
      Tags.of(vpc).add(tag.Key, tag.Value);
      cdkExpect(stack).to(haveResource('AWS::EC2::VPC', hasTags([tag])));
      test.done();
    },
  },

  'subnet selection': {
    'selecting default subnets returns the private ones'(test: Test) {
      // GIVEN
      const stack = getTestStack();
      const vpc = new Vpc(stack, 'VPC');

      // WHEN
      const { subnetIds } = vpc.selectSubnets();

      // THEN
      test.deepEqual(subnetIds, vpc.privateSubnets.map(s => s.subnetId));
      test.done();
    },

    'can select public subnets'(test: Test) {
      // GIVEN
      const stack = getTestStack();
      const vpc = new Vpc(stack, 'VPC');

      // WHEN
      const { subnetIds } = vpc.selectSubnets({ subnetType: SubnetType.PUBLIC });

      // THEN
      test.deepEqual(subnetIds, vpc.publicSubnets.map(s => s.subnetId));

      test.done();
    },

    'can select isolated subnets'(test: Test) {
      // GIVEN
      const stack = getTestStack();
      const vpc = new Vpc(stack, 'VPC', {
        subnetConfiguration: [
          { subnetType: SubnetType.PUBLIC, name: 'Public' },
          { subnetType: SubnetType.ISOLATED, name: 'Isolated' },
        ],
      });

      // WHEN
      const { subnetIds } = vpc.selectSubnets({ subnetType: SubnetType.ISOLATED });

      // THEN
      test.deepEqual(subnetIds, vpc.isolatedSubnets.map(s => s.subnetId));

      test.done();
    },

    'can select subnets by name'(test: Test) {
      // GIVEN
      const stack = getTestStack();
      const vpc = new Vpc(stack, 'VPC', {
        subnetConfiguration: [
          { subnetType: SubnetType.PUBLIC, name: 'BlaBla' },
          { subnetType: SubnetType.PRIVATE, name: 'DontTalkToMe' },
          { subnetType: SubnetType.ISOLATED, name: 'DontTalkAtAll' },
        ],
      });

      // WHEN
      const { subnetIds } = vpc.selectSubnets({ subnetGroupName: 'DontTalkToMe' });

      // THEN
      test.deepEqual(subnetIds, vpc.privateSubnets.map(s => s.subnetId));
      test.done();
    },

    'subnetName is an alias for subnetGroupName (backwards compat)'(test: Test) {
      // GIVEN
      const stack = getTestStack();
      const vpc = new Vpc(stack, 'VPC', {
        subnetConfiguration: [
          { subnetType: SubnetType.PUBLIC, name: 'BlaBla' },
          { subnetType: SubnetType.PRIVATE, name: 'DontTalkToMe' },
          { subnetType: SubnetType.ISOLATED, name: 'DontTalkAtAll' },
        ],
      });

      // WHEN
      const { subnetIds } = vpc.selectSubnets({ subnetName: 'DontTalkToMe' });

      // THEN
      test.deepEqual(subnetIds, vpc.privateSubnets.map(s => s.subnetId));
      test.done();
    },

    'selecting default subnets in a VPC with only isolated subnets returns the isolateds'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = Vpc.fromVpcAttributes(stack, 'VPC', {
        vpcId: 'vpc-1234',
        availabilityZones: ['dummy1a', 'dummy1b', 'dummy1c'],
        isolatedSubnetIds: ['iso-1', 'iso-2', 'iso-3'],
        isolatedSubnetRouteTableIds: ['rt-1', 'rt-2', 'rt-3'],
      });

      // WHEN
      const subnets = vpc.selectSubnets();

      // THEN
      test.deepEqual(subnets.subnetIds, ['iso-1', 'iso-2', 'iso-3']);
      test.done();
    },

    'selecting default subnets in a VPC with only public subnets returns the publics'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = Vpc.fromVpcAttributes(stack, 'VPC', {
        vpcId: 'vpc-1234',
        availabilityZones: ['dummy1a', 'dummy1b', 'dummy1c'],
        publicSubnetIds: ['pub-1', 'pub-2', 'pub-3'],
        publicSubnetRouteTableIds: ['rt-1', 'rt-2', 'rt-3'],
      });

      // WHEN
      const subnets = vpc.selectSubnets();

      // THEN
      test.deepEqual(subnets.subnetIds, ['pub-1', 'pub-2', 'pub-3']);
      test.done();
    },

    'selecting subnets by name fails if the name is unknown'(test: Test) {
      // GIVEN
      const stack = new Stack();
      const vpc = new Vpc(stack, 'VPC');

      test.throws(() => {
        vpc.selectSubnets({ subnetGroupName: 'Toot' });
      }, /There are no subnet groups with name 'Toot' in this VPC. Available names: Public,Private/);

      test.done();
    },

    'select subnets with az restriction'(test: Test) {
      // GIVEN
      const stack = getTestStack();
      const vpc = new Vpc(stack, 'VpcNetwork', {
        maxAzs: 1,
        subnetConfiguration: [
          { name: 'lb', subnetType: SubnetType.PUBLIC },
          { name: 'app', subnetType: SubnetType.PRIVATE },
          { name: 'db', subnetType: SubnetType.PRIVATE },
        ],
      });

      // WHEN
      const { subnetIds } = vpc.selectSubnets({ onePerAz: true });

      // THEN
      test.deepEqual(subnetIds.length, 1);
      test.deepEqual(subnetIds[0], vpc.privateSubnets[0].subnetId);
      test.done();
    },

    'fromVpcAttributes using unknown-length list tokens'(test: Test) {
      // GIVEN
      const stack = getTestStack();

      const vpcId = Fn.importValue('myVpcId');
      const availabilityZones = Fn.split(',', Fn.importValue('myAvailabilityZones'));
      const publicSubnetIds = Fn.split(',', Fn.importValue('myPublicSubnetIds'));

      // WHEN
      const vpc = Vpc.fromVpcAttributes(stack, 'VPC', {
        vpcId,
        availabilityZones,
        publicSubnetIds,
      });

      new CfnResource(stack, 'Resource', {
        type: 'Some::Resource',
        properties: {
          subnetIds: vpc.selectSubnets().subnetIds,
        },
      });

      // THEN - No exception
      cdkExpect(stack).to(haveResource('Some::Resource', {
        subnetIds: { 'Fn::Split': [',', { 'Fn::ImportValue': 'myPublicSubnetIds' }] },
      }));

      // THEN - Warnings have been added to the stack metadata
      const asm = SynthUtils.synthesize(stack);
      expect(asm.messages).toEqual(expect.arrayContaining([
        expect.objectContaining(
          {
            entry: {
              type: 'aws:cdk:warning',
              data: "fromVpcAttributes: 'availabilityZones' is a list token: the imported VPC will not work with constructs that require a list of subnets at synthesis time. Use 'Vpc.fromLookup()' or 'Fn.importListValue' instead.",
            },
          },
        ),
      ]));

      test.done();
    },

    'fromVpcAttributes using fixed-length list tokens'(test: Test) {
      // GIVEN
      const stack = getTestStack();

      const vpcId = Fn.importValue('myVpcId');
      const availabilityZones = Fn.importListValue('myAvailabilityZones', 2);
      const publicSubnetIds = Fn.importListValue('myPublicSubnetIds', 2);

      // WHEN
      const vpc = Vpc.fromVpcAttributes(stack, 'VPC', {
        vpcId,
        availabilityZones,
        publicSubnetIds,
      });

      new CfnResource(stack, 'Resource', {
        type: 'Some::Resource',
        properties: {
          subnetIds: vpc.selectSubnets().subnetIds,
        },
      });

      // THEN - No exception

      const publicSubnetList = { 'Fn::Split': [',', { 'Fn::ImportValue': 'myPublicSubnetIds' }] };
      cdkExpect(stack).to(haveResource('Some::Resource', {
        subnetIds: [
          { 'Fn::Select': [0, publicSubnetList] },
          { 'Fn::Select': [1, publicSubnetList] },
        ],
      }));

      test.done();
    },

    'select explicitly defined subnets'(test: Test) {
      // GIVEN
      const stack = getTestStack();
      const vpc = Vpc.fromVpcAttributes(stack, 'VPC', {
        vpcId: 'vpc-1234',
        availabilityZones: ['dummy1a', 'dummy1b', 'dummy1c'],
        publicSubnetIds: ['pub-1', 'pub-2', 'pub-3'],
        publicSubnetRouteTableIds: ['rt-1', 'rt-2', 'rt-3'],
      });
      const subnet = new PrivateSubnet(stack, 'Subnet', {
        availabilityZone: vpc.availabilityZones[0],
        cidrBlock: '10.0.0.0/28',
        vpcId: vpc.vpcId,
      });

      // WHEN
      const { subnetIds } = vpc.selectSubnets({ subnets: [subnet] });

      // THEN
      test.deepEqual(subnetIds.length, 1);
      test.deepEqual(subnetIds[0], subnet.subnetId);
      test.done();
    },

    'subnet created from subnetId'(test: Test) {
      // GIVEN
      const stack = getTestStack();

      // WHEN
      const subnet = Subnet.fromSubnetId(stack, 'subnet1', 'pub-1');

      // THEN
      test.deepEqual(subnet.subnetId, 'pub-1');
      test.done();
    },

    'Referencing AZ throws error when subnet created from subnetId'(test: Test) {
      // GIVEN
      const stack = getTestStack();

      // WHEN
      const subnet = Subnet.fromSubnetId(stack, 'subnet1', 'pub-1');

      // THEN
      // eslint-disable-next-line max-len
      test.throws(() => subnet.availabilityZone, "You cannot reference a Subnet's availability zone if it was not supplied. Add the availabilityZone when importing using Subnet.fromSubnetAttributes()");
      test.done();
    },

    'Referencing AZ throws error when subnet created from attributes without az'(test: Test) {
      // GIVEN
      const stack = getTestStack();

      // WHEN
      const subnet = Subnet.fromSubnetAttributes(stack, 'subnet1', { subnetId: 'pub-1', availabilityZone: '' });

      // THEN
      test.deepEqual(subnet.subnetId, 'pub-1');
      // eslint-disable-next-line max-len
      test.throws(() => subnet.availabilityZone, "You cannot reference a Subnet's availability zone if it was not supplied. Add the availabilityZone when importing using Subnet.fromSubnetAttributes()");
      test.done();
    },

    'AZ have value when subnet created from attributes with az'(test: Test) {
      // GIVEN
      const stack = getTestStack();

      // WHEN
      const subnet = Subnet.fromSubnetAttributes(stack, 'subnet1', { subnetId: 'pub-1', availabilityZone: 'az-1234' });

      // THEN
      test.deepEqual(subnet.subnetId, 'pub-1');
      test.deepEqual(subnet.availabilityZone, 'az-1234');
      test.done();
    },

    'Can select subnets by type and AZ'(test: Test) {
      // GIVEN
      const stack = getTestStack();
      const vpc = new Vpc(stack, 'VPC', {
        maxAzs: 3,
      });

      // WHEN
      new InterfaceVpcEndpoint(stack, 'VPC Endpoint', {
        vpc,
        privateDnsEnabled: false,
        service: new InterfaceVpcEndpointService('com.amazonaws.vpce.us-east-1.vpce-svc-uuddlrlrbastrtsvc', 443),
        subnets: {
          subnetType: SubnetType.PRIVATE,
          availabilityZones: ['dummy1a', 'dummy1c'],
        },
      });

      // THEN
      cdkExpect(stack).to(haveResource('AWS::EC2::VPCEndpoint', {
        ServiceName: 'com.amazonaws.vpce.us-east-1.vpce-svc-uuddlrlrbastrtsvc',
        SubnetIds: [
          {
            Ref: 'VPCPrivateSubnet1Subnet8BCA10E0',
          },
          {
            Ref: 'VPCPrivateSubnet3Subnet3EDCD457',
          },
        ],
      }));
      test.done();
    },

    'SubnetSelection filtered on az uses default subnetType when no subnet type specified'(test: Test) {
      // GIVEN
      const stack = getTestStack();
      const vpc = new Vpc(stack, 'VPC', {
        maxAzs: 3,
      });

      // WHEN
      new InterfaceVpcEndpoint(stack, 'VPC Endpoint', {
        vpc,
        service: new InterfaceVpcEndpointService('com.amazonaws.vpce.us-east-1.vpce-svc-uuddlrlrbastrtsvc', 443),
        subnets: {
          availabilityZones: ['dummy1a', 'dummy1c'],
        },
      });

      // THEN
      cdkExpect(stack).to(haveResource('AWS::EC2::VPCEndpoint', {
        ServiceName: 'com.amazonaws.vpce.us-east-1.vpce-svc-uuddlrlrbastrtsvc',
        SubnetIds: [
          {
            Ref: 'VPCPrivateSubnet1Subnet8BCA10E0',
          },
          {
            Ref: 'VPCPrivateSubnet3Subnet3EDCD457',
          },
        ],
      }));
      test.done();
    },
    'SubnetSelection doesnt throw error when selecting imported subnets'(test: Test) {
      // GIVEN
      const stack = getTestStack();

      // WHEN
      const vpc = new Vpc(stack, 'VPC');

      // THEN
      test.doesNotThrow(() => vpc.selectSubnets({
        subnets: [
          Subnet.fromSubnetId(stack, 'Subnet', 'sub-1'),
        ],
      }));
      test.done();
    },

    'can filter by single IP address'(test: Test) {
      // GIVEN
      const stack = getTestStack();

      // IP space is split into 6 pieces, one public/one private per AZ
      const vpc = new Vpc(stack, 'VPC', {
        cidr: '10.0.0.0/16',
        maxAzs: 3,
      });

      // WHEN
      // We want to place this bastion host in the same subnet as this IPv4
      // address.
      new BastionHostLinux(stack, 'Bastion', {
        vpc,
        subnetSelection: {
          subnetFilters: [SubnetFilter.containsIpAddresses(['10.0.160.0'])],
        },
      });

      // THEN
      // 10.0.160.0/19 is the third subnet, sequentially, if you split
      // 10.0.0.0/16 into 6 pieces
      cdkExpect(stack).to(haveResource('AWS::EC2::Instance', {
        SubnetId: {
          Ref: 'VPCPrivateSubnet3Subnet3EDCD457',
        },
      }));
      test.done();
    },

    'can filter by multiple IP addresses'(test: Test) {
      // GIVEN
      const stack = getTestStack();

      // IP space is split into 6 pieces, one public/one private per AZ
      const vpc = new Vpc(stack, 'VPC', {
        cidr: '10.0.0.0/16',
        maxAzs: 3,
      });

      // WHEN
      // We want to place this endpoint in the same subnets as these IPv4
      // address.
      // WHEN
      new InterfaceVpcEndpoint(stack, 'VPC Endpoint', {
        vpc,
        service: new InterfaceVpcEndpointService('com.amazonaws.vpce.us-east-1.vpce-svc-uuddlrlrbastrtsvc', 443),
        subnets: {
          subnetFilters: [SubnetFilter.containsIpAddresses(['10.0.96.0', '10.0.160.0'])],
        },
      });

      // THEN
      cdkExpect(stack).to(haveResource('AWS::EC2::VPCEndpoint', {
        ServiceName: 'com.amazonaws.vpce.us-east-1.vpce-svc-uuddlrlrbastrtsvc',
        SubnetIds: [
          {
            Ref: 'VPCPrivateSubnet1Subnet8BCA10E0',
          },
          {
            Ref: 'VPCPrivateSubnet3Subnet3EDCD457',
          },
        ],
      }));
      test.done();
    },
  },
});

function getTestStack(): Stack {
  return new Stack(undefined, 'TestStack', { env: { account: '123456789012', region: 'us-east-1' } });
}

function toCfnTags(tags: any): Array<{Key: string, Value: string}> {
  return Object.keys(tags).map( key => {
    return { Key: key, Value: tags[key] };
  });
}

function hasTags(expectedTags: Array<{Key: string, Value: string}>): (props: any) => boolean {
  return (props: any) => {
    try {
      const tags = props.Tags;
      const actualTags = tags.filter( (tag: {Key: string, Value: string}) => {
        for (const expectedTag of expectedTags) {
          if (isSuperObject(expectedTag, tag)) {
            return true;
          } else {
            continue;
          }
        }
        // no values in array so expecting empty
        return false;
      });
      return actualTags.length === expectedTags.length;
    } catch (e) {
      /* eslint-disable no-console */
      console.error('Tags are incorrect');
      console.error('found tags ', props.Tags);
      console.error('expected tags ', expectedTags);
      /* eslint-enable no-console */
      throw e;
    }
  };
}
