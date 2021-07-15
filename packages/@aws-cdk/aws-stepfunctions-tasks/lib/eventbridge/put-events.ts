import * as events from '@aws-cdk/aws-events';
import * as iam from '@aws-cdk/aws-iam';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as cdk from '@aws-cdk/core';
import { Construct } from 'constructs';
import { integrationResourceArn, validatePatternSupported } from '../private/task-utils';

/**
 * An entry to be sent to EventBridge
 *
 * @see https://docs.aws.amazon.com/eventbridge/latest/APIReference/API_PutEventsRequestEntry.html
 */
export interface EventBridgePutEventsEntry {
  /**
   * The event body
   *
   * Can either be provided as an object or as a JSON-serialized string
   * @example
   * sfn.TaskInput.fromText('{"instance-id": "i-1234567890abcdef0", "state": "terminated"}')
   * sfn.TaskInput.fromObject({ Message: 'Hello from Step Functions' })
   * sfn.TaskInput.fromJsonPathAt('$.EventDetail')
   */
  readonly detail: sfn.TaskInput;

  /**
   * Used along with the source field to help identify the fields and values expected in the detail field
   *
   * For example, events by CloudTrail have detail type "AWS API Call via CloudTrail"
   * @see https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-events.html
   */
  readonly detailType: string;

  /**
   * The event bus the entry will be sent to.
   *
   * @default - event is sent to account's default event bus
   */
  readonly eventBus?: events.IEventBus;

  /**
   * The service or application that caused this event to be generated
   *
   * @example 'com.example.service'
   * @see https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-events.html
   */
  readonly source: string;
}

/**
 * Properties for sending events with PutEvents
 */
export interface EventBridgePutEventsProps extends sfn.TaskStateBaseProps {
  /**
   * The entries that will be sent (must be at least 1)
   */
  readonly entries: EventBridgePutEventsEntry[];
}

/**
 * A StepFunctions Task to send events to an EventBridge event bus
 */
export class EventBridgePutEvents extends sfn.TaskStateBase {
  private static readonly SUPPORTED_INTEGRATION_PATTERNS: sfn.IntegrationPattern[] = [
    sfn.IntegrationPattern.REQUEST_RESPONSE,
    sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
  ];

  protected readonly taskMetrics?: sfn.TaskMetricsConfig;
  protected readonly taskPolicies?: iam.PolicyStatement[];

  private readonly integrationPattern: sfn.IntegrationPattern;

  constructor(scope: Construct, id: string, private readonly props: EventBridgePutEventsProps) {
    super(scope, id, props);

    this.integrationPattern = props.integrationPattern ?? sfn.IntegrationPattern.REQUEST_RESPONSE;

    validatePatternSupported(this.integrationPattern, EventBridgePutEvents.SUPPORTED_INTEGRATION_PATTERNS);

    if (this.integrationPattern === sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN) {
      if (!sfn.FieldUtils.containsTaskToken(props.entries.map(entry => entry.detail))) {
        throw new Error('Task Token is required in `entries`. Use JsonPath.taskToken to set the token.');
      }
    }

    this.validateEntries();

    this.taskPolicies = [
      new iam.PolicyStatement({
        actions: ['events:PutEvents'],
        resources: this.eventBusArns,
      }),
    ];
  }

  /**
   * Returns an array of EventBusArn strings based on this.props.entries
   */
  private get eventBusArns(): string[] {
    return this.props.entries
      .map(entry => {
        if (entry.eventBus) {
          // If an eventBus is provided, use the corresponding ARN
          return entry.eventBus.eventBusArn;
        } else {
          // If neither an eventBus nor eventBusName is provided,
          // format the ARN for the default event bus in the account.
          return cdk.Stack.of(this).formatArn({
            resource: 'event-bus',
            resourceName: 'default',
            sep: '/',
            service: 'events',
          });
        }
      });
  }

  /**
   * Provides the EventBridge put events service integration task configuration
   * @internal
   */
  protected _renderTask(): any {
    return {
      Resource: integrationResourceArn('events', 'putEvents', this.integrationPattern),
      Parameters: sfn.FieldUtils.renderObject({
        Entries: this.renderEntries(),
      }),
    };
  }

  private renderEntries(): Object[] {
    return this.props.entries.map(entry => {
      if (entry.source?.startsWith('aws')) {
        throw new Error('Event source cannot start with "aws."');
      } else {
        return {
          Detail: entry.detail?.value,
          DetailType: entry.detailType,
          EventBusName: entry.eventBus?.eventBusArn,
          Source: entry.source,
        };
      }
    });
  }

  private validateEntries(): void {
    if (this.props.entries.length <= 0) {
      throw new Error('Value for property `entries` must be a non-empty array.');
    }
  }
}