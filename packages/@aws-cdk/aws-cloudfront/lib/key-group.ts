import { IResource, Names, Resource } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnKeyGroup } from './cloudfront.generated';
import { IPublicKey } from './public-key';

/**
 * Represents a Key Group
 */
export interface IKeyGroup extends IResource {
  /**
   * The ID of the key group.
   * @attribute
   */
  readonly keyGroupId: string;
}

/**
 * Properties for creating a Public Key
 */
export interface KeyGroupProps {
  /**
   * A name to identify the key group.
   * @default - generated from the `id`
   */
  readonly keyGroupName?: string;

  /**
   * A comment to describe the key group.
   * @default - no comment
   */
  readonly comment?: string;

  /**
   * A list of public keys to add to the key group.
   */
  readonly items: IPublicKey[];
}

/**
 * A Key Group configuration
 *
 * @resource AWS::CloudFront::KeyGroup
 */
export class KeyGroup extends Resource implements IKeyGroup {
  /** Imports a Key Group from its id. */
  public static fromKeyGroupId(scope: Construct, id: string, keyGroupId: string): IKeyGroup {
    return new class extends Resource implements IKeyGroup {
      public readonly keyGroupId = keyGroupId;
    }(scope, id);
  }
  public readonly keyGroupId: string;

  constructor(scope: Construct, id: string, props: KeyGroupProps) {
    super(scope, id);

    const resource = new CfnKeyGroup(this, 'Resource', {
      keyGroupConfig: {
        name: props.keyGroupName ?? this.generateName(),
        comment: props.comment,
        items: props.items.map(key => key.publicKeyId),
      },
    });

    this.keyGroupId = resource.ref;
  }

  private generateName(): string {
    const name = Names.uniqueId(this);
    if (name.length > 80) {
      return name.substring(0, 40) + name.substring(name.length - 40);
    }
    return name;
  }
}
