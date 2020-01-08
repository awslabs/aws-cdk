import * as events from '@aws-cdk/aws-events';
import * as cdk from '@aws-cdk/core';
import * as securityhub from './securityhub.generated';

/**
 * Represents a SecurityHub Hub resource.
 */
export interface IHub extends cdk.IResource {
    /**
     * The ARN of this Hub.
     * @attribute
     */
    readonly hubArn: string;

    /**
     * Defines a CloudWatch event rule triggered when something happens within SecurityHub.
     * Note that currently there is only one Hub available per region.
     * @returns a CloudWatch event rule
     */
    onEvent(id: string, options?: events.OnEventOptions): events.Rule;

    /**
     * Defines a CloudWatch event rule triggered when new insight results are available.
     * @returns a CloudWatch event rule
     */
    onInsightResults(id: string, options?: events.OnEventOptions): events.Rule;

    /**
     * Defines a CloudWatch event rule triggered when new findings are imported.
     * @returns a CloudWatch event rule
     */
    onImportedFindings(id: string, options?: events.OnEventOptions): events.Rule;

    /**
     * Defines a CloudWatch event rule triggered when a custom action is executed.
     * @returns a CloudWatch event rule
     */
    onCustomAction(id: string, options?: events.OnEventOptions): events.Rule;
}

/**
 * Represents a reference to a SecurityHub Hub.
 *
 * If you're managing the Hub alongside the rest of your CDK resources,
 * use the {@link Hub} class.
 *
 * If you want to reference an already existing Hub
 * (or one defined in a different CDK Stack),
 * use the {@link import} method.
 */
abstract class HubBase extends cdk.Resource implements IHub {
    public abstract hubArn: string;

    public onEvent(id: string, options?: events.OnEventOptions): events.Rule {
        const rule = new events.Rule(this, id, {
            enabled: true,
            ...options
        });

        rule.addEventPattern({
            source: ['aws.securityhub']
        });

        if (options && options.target) {
            rule.addTarget(options.target);
        }

        return rule;
    }

    public onInsightResults(id: string, options?: events.OnEventOptions): events.Rule {
        const rule = this.onEvent(id, {
            ...options
        });
        rule.addEventPattern({
            detailType: ['Security Hub Insight Results']
        });

        return rule;
    }

    public onImportedFindings(id: string, options?: events.OnEventOptions): events.Rule {
        const rule = this.onEvent(id, {
            ...options
        });
        rule.addEventPattern({
            detailType: ['Security Hub Findings - Imported']
        });

        return rule;
    }

    public onCustomAction(id: string, options?: events.OnEventOptions): events.Rule {
        const rule = this.onEvent(id, {
            ...options
        });
        rule.addEventPattern({
            detailType: ['Security Hub Findings - Custom Action']
        });

        return rule;
    }
}

/**
 * A representation of a SecurityHub Hub.
 */
export class Hub extends HubBase {
    /**
     * Imports an existing SecurityHub Hub.
     *
     * @param scope
     * @param id
     * @param hubArn
     */
    public static fromHubArn(scope: cdk.Construct, id: string, hubArn: string): IHub {
        class Import extends HubBase {
            public readonly hubArn = hubArn;
        }

        return new Import(scope, id);
    }

    /**
     * The ARN of the Hub.
     */
    public readonly hubArn: string;

    private readonly hub: securityhub.CfnHub;

    constructor(scope: cdk.Construct, id: string) {
        super(scope, id);

        this.hub = new securityhub.CfnHub(scope, 'Resource', {});

        this.hubArn = this.hub.ref;
    }
}
