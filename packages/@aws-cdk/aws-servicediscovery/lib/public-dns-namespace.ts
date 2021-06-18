import { Resource } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { BaseNamespaceProps, INamespace, NamespaceType } from './namespace';
import { DnsServiceProps, Service } from './service';
import { CfnPublicDnsNamespace } from './servicediscovery.generated';

export interface PublicDnsNamespaceProps extends BaseNamespaceProps {}
export interface IPublicDnsNamespace extends INamespace { }
export interface PublicDnsNamespaceAttributes {
  /**
   * A name for the Namespace.
   */
  readonly namespaceName: string;

  /**
   * Namespace Id for the Namespace.
   */
  readonly namespaceId: string;

  /**
   * Namespace ARN for the Namespace.
   */
  readonly namespaceArn: string;
}

/**
 * Define a Public DNS Namespace
 */
export class PublicDnsNamespace extends Resource implements IPublicDnsNamespace {
  public static fromPublicDnsNamespaceAttributes(scope: Construct, id: string, attrs: PublicDnsNamespaceAttributes): IPublicDnsNamespace {
    class Import extends Resource implements IPublicDnsNamespace {
      public namespaceName = attrs.namespaceName;
      public namespaceId = attrs.namespaceId;
      public namespaceArn = attrs.namespaceArn;
      public type = NamespaceType.DNS_PUBLIC;
    }
    return new Import(scope, id);
  }

  /**
   * A name for the namespace.
   */
  public readonly namespaceName: string;

  /**
   * Namespace Id for the namespace.
   */
  public readonly namespaceId: string;

  /**
   * Namespace Arn for the namespace.
   */
  public readonly namespaceArn: string;

  /**
   * Type of the namespace.
   */
  public readonly type: NamespaceType;

  constructor(scope: Construct, id: string, props: PublicDnsNamespaceProps) {
    super(scope, id);

    const ns = new CfnPublicDnsNamespace(this, 'Resource', {
      name: props.name,
      description: props.description,
    });

    this.namespaceName = props.name;
    this.namespaceId = ns.attrId;
    this.namespaceArn = ns.attrArn;
    this.type = NamespaceType.DNS_PUBLIC;
  }

  /** @attribute */
  public get publicDnsNamespaceArn() { return this.namespaceArn; }

  /** @attribute */
  public get publicDnsNamespaceName() { return this.namespaceName; }

  /** @attribute */
  public get publicDnsNamespaceId() { return this.namespaceId; }

  /**
   * Creates a service within the namespace
   */
  public createService(id: string, props?: DnsServiceProps): Service {
    return new Service(this, id, {
      namespace: this,
      ...props,
    });
  }
}
