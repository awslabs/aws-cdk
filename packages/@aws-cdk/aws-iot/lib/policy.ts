import { Lazy, Resource, IResource } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { ICertificate } from './certificate';
import { CfnPolicy } from './iot.generated';
import { PolicyDocument } from './policy-document';
import { PolicyStatement } from './policy-statement';
import { generatePolicyName, parsePolicyArn } from './util';
/**
 * Represents an IoT `Policy`.
 */
export interface IPolicy extends IResource {
  /**
   * The name of this IoT policy
   *
   * @attribute
   */
  readonly policyName: string;
  /**
   * The Arn of this IoT policy
   *
   * @attribute
   */
  readonly policyArn: string;
}

/**
 * Properties to initialize an instance of `Policy`.
 */
export interface PolicyProps {
  /**
   * The IoT policy name
   *
   * @default - Uses the logical ID of the policy resource, wich is ensured to
   * be unique within the stack
   */
  readonly policyName?: string;
  /**
   * The policy statements for the IoT policy
   *
   * @default - No statements.
   */
  readonly statements?: PolicyStatement[];
  /**
   * Initial PoilcyDocument to use for this Policy. If omited, any
   * `PolicyStatement` provided in the `statements` property will be applied
   * against the empty default `PolicyDocument`.
   *
   * @default - An empty policy.
   */
  readonly document?: PolicyDocument;
}
/**
 * Represents an AWS::IoT::Policy.
 *
 * AWS IoT Core policies are JSON documents. They follow the same conventions as
 * IAM policies. AWS IoT Core supports named policies so many identities can
 * reference the same policy document. Named policies are versioned so they can
 * be easily rolled back.

 * AWS IoT Core policies allow you to control access to the AWS IoT Core data
 * plane. The AWS IoT Core data plane consists of operations that allow you to
 * connect to the AWS IoT Core message broker, send and receive MQTT messages, and
 * get or update a device's shadow.

 * An AWS IoT Core policy is a JSON document that contains one or more policy
 * statements. Each statement contains:

 * - `Effect`, which specifies whether the action is allowed or denied.
 * - `Action`, which specifies the action the policy is allowing or denying.
 * - `Resource`, which specifies the resource or resources on which the action is
 * allowed or denied.
 *
 * Changes made to a policy can take a few minutes to become effective because
 * of how AWS IoT caches the policy documents. That is, it may take a few
 * minutes to access a resource that has recently been granted access, and a
 * resource may be accessisble for several minutes after its access has been
 * revoked.
 *
 * Policies can be either defined within this stack:
 *
 *   new Policy(this, 'MyPolicy', { props });
 *
 * Or imported from an existing policy:
 *
 *   Policy.import(this, 'MyImportedPolicy', { policyName: ... });
 *
 * You can also export a Policy and import it into another stack:
 *
 *   const ref = Policy.export();
 *   Policy.import(this, 'MyImportedPolicy', ref);
 *
 */
export class Policy extends Resource implements IPolicy {
  /**
   * Import a policy in this app based on it's name
   */
  public static fromPolicyName(scope: Construct, id: string, policyName: string): IPolicy {
    class Import extends Resource implements IPolicy {
      public readonly policyName = policyName;
      public readonly policyArn = parsePolicyArn(scope, policyName);
    }
    return new Import(scope, id);
  }

  /**
   * A policy document containing permissions to add to the specified resource.
   * For more information, see Access Policy Language Overview in the Amazon
   * IoT Core Developer Guide.
   */
  public readonly document = new PolicyDocument();

  private readonly _policyName: string;
  private readonly _policyArn: string;

  constructor(scope: Construct, id: string, props: PolicyProps = {}) {
    super(scope, id, {
      physicalName: props.policyName ||
        Lazy.string({ produce: () => generatePolicyName(scope, resource.logicalId) }),
    });

    if (props.document) {
      this.document = props.document;
    }

    const resource = new CfnPolicy(this, 'Resource', {
      policyName: this.physicalName,
      policyDocument: this.document,
    });

    this._policyName = this.physicalName;
    this._policyArn = resource.attrArn;

    if (props.statements) {
      props.statements.forEach(p => this.addStatements(p));
    }
  }

  /**
   * Adds a statement ot the policy document.
   */
  public addStatements(...statement: PolicyStatement[]) {
    this.document.addStatements(...statement);
  }

  /**
   * Attaches an AWS IoT policy to a principal (an x.509 certificate or other
   * credential).
   *
   * a certificate ARN (as returned from the CreateCertificate operation) or an
   * Amazon Cognito ID.
   */
  public attachToCertificate(certificate: ICertificate) {
    certificate.attachPolicy(this);
  }

  /**
   * The name of this policy
   *
   * @attribute
   */
  public get policyName(): string {
    return this._policyName;
  }

  /**
   * The Arn of this policy
   *
   * @attribute
   */
  public get policyArn(): string {
    return this._policyArn;
  }

  protected validate(): string[] {
    const errors = super.validate();
    if (this.document.isEmpty) {
      errors.push('Policy document is empty. You must add statements ot the policy');
    }
    errors.push(...this.document.validateForAnyPolicy());
    return errors;
  }
}
