import * as path from 'path';
import { Vpc } from '@aws-cdk/aws-ec2';
import { App, Stack, StackProps } from '@aws-cdk/core';
import { Construct } from 'constructs';
import * as route53resolver from '../lib';

class TestStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new Vpc(this, 'Vpc', { maxAzs: 1 });

    const blockList = new route53resolver.FirewallDomainList(this, 'BlockList', {
      domains: route53resolver.FirewallDomains.fromList(['bad-domain.com', 'bot-domain.net']),
    });
    const overrideList = new route53resolver.FirewallDomainList(this, 'OverrideList', {
      domains: route53resolver.FirewallDomains.fromList(['override-domain.com']),
    });

    new route53resolver.FirewallDomainList(this, 'OtherList', {
      domains: route53resolver.FirewallDomains.fromAsset(path.join(__dirname, 'domains.txt')),
    });

    const ruleGroup = new route53resolver.FirewallRuleGroup(this, 'RuleGroup');

    ruleGroup.addRule({
      priority: 10,
      firewallDomainList: blockList,
      action: route53resolver.FirewallRuleAction.block(),
    });
    ruleGroup.addRule({
      priority: 20,
      firewallDomainList: overrideList,
      action: route53resolver.FirewallRuleAction.block(route53resolver.DnsBlockResponse.override('amazon.com')),
    });

    ruleGroup.associate('Association', {
      priority: 101,
      vpc,
    });
  }
}

const app = new App();
new TestStack(app, 'cdk-route53-resolver-firewall');
app.synth();
