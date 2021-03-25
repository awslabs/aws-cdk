import { Resource, IResource } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { ICertificate } from './certificate';
import { CfnThing } from './iot.generated';
import { parseThingArn, parseThingName } from './util';
/**
 * Represents a `Thing`.
 */
export interface IThing extends IResource {
  /**
   * ARN of the IoT thing
   * i.e. arn:aws:iot:us-east-2:123456789012:thing/name
   *
   * @attribute
   */
  readonly thingArn: string;

  /**
   * The ID of the thing.
   *
   * @attribute
   */
  readonly thingName: string;

  /**
   * Attaches a certificate
   */
  attachCertificate(certificate: ICertificate): void;
}
/**
 * Properties to initialize an instance of `Thing`.
 */
export interface ThingAttributes {
  /**
   * ARN of the IoT thing
   * i.e. arn:aws:iot:us-east-2:123456789012:thing/name
   *
   * @attribute
   * @default none
   */
  readonly thingArn?: string;

  /**
   * The ID of the thing.
   *
   * @attribute
   * @default none
   */
  readonly thingName?: string;
}
/**
 * Properties to initialize an instance of `Thing`.
 */
export interface ThingProps {
  /**
   * The name of the thing
   *
   * You can't change a thing's name. To change a thing's name, you must create a
   * new thing, give it the new name, and then delete the old thing.B
   *
   * @default - generated
   */
  readonly thingName?: string
  /**
   * A string that contains up to three key value pairs. Maximum length of 800.
   * Duplicates not allowed.
   *
   * @default - none
   */
  readonly attributePayload?: CfnThing.AttributePayloadProperty
}

/**
 * Represents an IoT Thing.
 *
 * Thing can be either defined within this stack:
 *
 *   new Thing(this, 'MyCert', { props });
 *
 * Or imported from an existing Thing:
 *
 *   Thing.import(this, 'MyImportedThing', { thingArn: ... });
 *
 */
abstract class ThingBase extends Resource implements IThing {
  public abstract readonly thingArn: string;
  public abstract readonly thingName: string;

  /**
   * Attaches an IoT Policy to the Thing
   *
   * @param certificate ICertificate
   */
  public attachCertificate(certificate: ICertificate): void {
    certificate.attachThing(this);
  }
}

/**
 * A new Thing
 */
export class Thing extends ThingBase {
  /**
   * Creates a thing construct that represents an external Thing.
   *
   * @param scope The parent creating construct (usually `this`).
   * @param id The construct's name.
   * @param thingArn The Arn of the thing to import
   */
  public static fromThingArn(scope: Construct, id: string, thingArn: string): IThing {

    class Import extends ThingBase {
      public readonly thingArn = thingArn;
      public readonly thingName = parseThingName(scope, { thingArn });
    }

    return new Import(scope, id);
  }
  /**
   * Creates a Thing construct that represents an external thing.
   *
   * @param scope The parent creating construct (usually `this`).
   * @param id The construct's name.
   * @param thingName The Id of the thing to import
   */
  public static fromThingName(scope: Construct, id: string, thingName: string): IThing {
    class Import extends ThingBase {
      public readonly thingArn = parseThingArn(scope, { thingName });
      public readonly thingName = thingName;
    }

    return new Import(scope, id);
  }

  public readonly thingArn: string;
  public readonly thingName: string;

  constructor(scope: Construct, id: string, props: ThingProps = {}) {
    super(scope, id, {
      physicalName: props.thingName,
    });

    if (props && props.attributePayload && props.attributePayload.attributes) {
      if (Object.keys(props.attributePayload?.attributes).length > 3) {
        throw new Error('Invalid thing attributes. Can only have three attributes');
      }
      if (JSON.stringify(props.attributePayload?.attributes).length > 800) {
        throw new Error('Invalid thing attribute length. Can not exceed 800 characters');
      }
    }

    const resource = new CfnThing(this, 'Thing', {
      thingName: this.physicalName,
      attributePayload: props.attributePayload,
    });

    this.thingName = resource.logicalId;
    this.thingArn = resource.getAtt('Arn').toString();
  }
}
