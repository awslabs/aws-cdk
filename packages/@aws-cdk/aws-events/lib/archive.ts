import { Duration, Resource } from '@aws-cdk/core';
import { Construct } from 'constructs';
import { IEventBus } from './event-bus';
import { EventPattern } from './event-pattern';
import { CfnArchive } from './events.generated';
import { renderEventPattern } from './util';

/**
 * The event archive base properties
 */
export interface BaseArchiveProps {
  /**
   * The name of the archive.
   *
   * @default - Automatically generated
   */
  readonly archiveName?: string;
  /**
   * A description for the archive.
   *
   * @default - none
   */
  readonly description?: string;
  /**
   * An event pattern to use to filter events sent to the archive.
   */
  readonly eventPattern: EventPattern;
  /**
   * The number of days to retain events for. Default value is 0. If set to 0, events are retained indefinitely.
   * @default - Infinite
   */
  readonly retention?: Duration;
}


/**
 * The event archive properties
 */
export interface ArchiveProps extends BaseArchiveProps {
  /**
   * The event source associated with the archive.
   */
  readonly sourceEventBus: IEventBus;
}

/**
 * Define an EventBridge Archive
 *
 * @resource AWS::Events::Archive
 */
export class Archive extends Resource {
  /**
   * The archive name.
   * @attribute
   */
  public readonly archiveName: string;

  /**
   * The ARN of the archive created.
   * @attribute
   */
  public readonly archiveArn: string;

  constructor(scope: Construct, id: string, props: ArchiveProps) {
    super(scope, id, { physicalName: props.archiveName });

    let archive = new CfnArchive(this, 'Archive', {
      sourceArn: props.sourceEventBus.eventBusArn,
      description: props.description,
      eventPattern: renderEventPattern(props.eventPattern),
      retentionDays: props.retention?.toDays({ integral: true }) || 0,
      archiveName: this.physicalName,
    });

    this.archiveArn = archive.attrArn;
    this.archiveName = archive.attrArchiveName;
  }
}
