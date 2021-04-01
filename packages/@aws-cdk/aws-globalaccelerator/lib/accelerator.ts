import * as cdk from '@aws-cdk/core';
import { Construct } from 'constructs';
import * as ga from './globalaccelerator.generated';
import { Listener, ListenerOptions } from './listener';

/**
 * The interface of the Accelerator
 */
export interface IAccelerator extends cdk.IResource {
  /**
   * The ARN of the accelerator
   *
   * @attribute
   */
  readonly acceleratorArn: string;

  /**
   * The Domain Name System (DNS) name that Global Accelerator creates that points to your accelerator's static
   * IP addresses.
   *
   * @attribute
   */
  readonly dnsName: string;
}

/**
 * Construct properties of the Accelerator
 */
export interface AcceleratorProps {
  /**
   * The name of the accelerator
   *
   * @default - resource ID
   */
  readonly acceleratorName?: string;

  /**
   * Indicates whether the accelerator is enabled.
   *
   * @default true
   */
  readonly enabled?: boolean;
}

/**
 * Attributes required to import an existing accelerator to the stack
 */
export interface AcceleratorAttributes {
  /**
   * The ARN of the accelerator
   */
  readonly acceleratorArn: string;

  /**
   * The DNS name of the accelerator
   */
  readonly dnsName: string;
}

/**
 * The Accelerator construct
 */
export class Accelerator extends cdk.Resource implements IAccelerator {
  /**
   * import from attributes
   */
  public static fromAcceleratorAttributes(scope: Construct, id: string, attrs: AcceleratorAttributes): IAccelerator {
    class Import extends cdk.Resource implements IAccelerator {
      public readonly acceleratorArn = attrs.acceleratorArn;
      public readonly dnsName = attrs.dnsName;
    }
    return new Import(scope, id);
  }
  /**
   * The ARN of the accelerator.
   */
  public readonly acceleratorArn: string;

  /**
   * The Domain Name System (DNS) name that Global Accelerator creates that points to your accelerator's static
   * IP addresses.
   */
  public readonly dnsName: string;

  constructor(scope: Construct, id: string, props: AcceleratorProps = {}) {
    super(scope, id);

    const resource = new ga.CfnAccelerator(this, 'Resource', {
      enabled: props.enabled ?? true,
      name: props.acceleratorName ?? cdk.Names.uniqueId(this),
    });

    this.acceleratorArn = resource.attrAcceleratorArn;
    this.dnsName = resource.attrDnsName;
  }

  /**
   * Add a listener to the accelerator
   */
  public addListener(id: string, options: ListenerOptions) {
    return new Listener(this, id, {
      accelerator: this,
      ...options,
    });
  }
}
