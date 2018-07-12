import { Arn, AwsStackName, Construct, FnConcat, PolicyStatement, Token } from '@aws-cdk/core';
import * as iam from '@aws-cdk/iam';
import * as ssm from '@aws-cdk/ssm';

export interface RuntimeValueProps {
    /**
     * A namespace for the runtime value.
     * It is recommended to use the name of the library/package that advertises this value.
     */
    package: string;

    /**
     * The value to advertise. Can be either a primitive value or a token.
     */
    value: any;
}

/**
 * Defines a value published from construction code which needs to be accessible
 * by runtime code.
 */
export class RuntimeValue extends Construct {

    /**
     * The recommended name of the environment variable to use to set the stack name
     * from which the runtime value is published.
     */
    public static readonly ENV_NAME = 'RTV_STACK_NAME';

    /**
     * The value to assign to the `RTV_STACK_NAME` environment variable.
     */
    public static readonly ENV_VALUE = new AwsStackName();

    /**
     * IAM actions needed to read a value from an SSM parameter.
     */
    private static readonly SSM_READ_ACTIONS = [
        'ssm:DescribeParameters',
        'ssm:GetParameters',
        'ssm:GetParameter'
    ];

    /**
     * The name of the runtime parameter.
     */
    public readonly parameterName: ParameterName;

    /**
     * The ARN fo the SSM parameter used for this runtime value.
     */
    public readonly parameterArn: Arn;

    constructor(parent: Construct, name: string, props: RuntimeValueProps) {
        super(parent, name);

        this.parameterName = new FnConcat('/rtv/', new AwsStackName(), '/', props.package, '/', name);

        new ssm.cloudformation.ParameterResource(this, 'Parameter', {
            parameterName: this.parameterName,
            type: 'String',
            value: props.value,
        });

        this.parameterArn = Arn.fromComponents({
            service: 'ssm',
            resource: 'parameter',
            resourceName: this.parameterName
        });
    }

    /**
     * Grants a principal read permissions on this runtime value.
     * @param principal The principal (e.g. Role, User, Group)
     */
    public grantRead(principal?: iam.IIdentityResource) {

        // sometimes "role" is optional, so we want `rtv.grantRead(role)` to be a no-op
        if (!principal) {
            return;
        }

        principal.addToPolicy(new PolicyStatement()
            .addResource(this.parameterArn)
            .addActions(...RuntimeValue.SSM_READ_ACTIONS));
    }
}

/**
 * The full name of the runtime value's SSM parameter.
 */
export class ParameterName extends Token {

}
