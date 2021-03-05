import {
  HttpRouteIntegrationBindOptions,
  HttpRouteIntegrationConfig,
  AwsServiceIntegrationSubtype,
} from '@aws-cdk/aws-apigatewayv2';
import { IEventBus } from '@aws-cdk/aws-events';
import { PolicyStatement, Role, ServicePrincipal } from '@aws-cdk/aws-iam';
import { AwsServiceIntegration } from './private/integration';


export enum EventBridgeTargetAction {
  PUT_EVENTS = 'EventBridge-PutEvents'
}

/**
 * Properties to initialize `EventBridgeIntegration`.
 */
export interface EventBridgeIntegrationProps {
  /**
  * The EventBridge API action to integrate.
  */
  readonly targetAction: EventBridgeTargetAction;

  /**
   * The target event bus.
   */
  readonly eventBus: IEventBus;

  /**
   * The event source.
   */
  readonly eventSource?: string;

  /**
   * The EventBridge PutEvents request parameters.
   * @see https://docs.aws.amazon.com/eventbridge/latest/APIReference/API_PutEvents.html
   */
  readonly requestParameters: EventBridgeIntegrationRequestParameters;
}

/**
 * Integration request parameters for EventBridge
 * @see https://docs.aws.amazon.com/eventbridge/latest/APIReference/API_PutEventsRequestEntry.html#eventbridge-Type-PutEventsRequestEntry-Detail
 */
export interface EventBridgeIntegrationRequestParameters {
  /**
  * A valid JSON string. There is no other schema imposed. The JSON string may contain fields and nested subobjects.
  *
  * @default none
  */
  readonly detail?: string;

  /**
  * Free-form string used to decide what fields to expect in the event detail.
  *
  * @default none
  */
  readonly detailType?: string;

  /**
  * The AWS region. NB: Particular to EventBridge-PutEvents API Gateway integration and not EventBridge's PutEvents API.
  *
  * @default none
  */
  readonly region?: string;

  /**
  * AWS resources, identified by Amazon Resource Name (ARN), which the event primarily concerns. Any number,
  * including zero, may be present.
  *
  * @default none
  */
  readonly resources?: string[];

  /**
  * The source of the event.
  *
  * @default none
  */
  readonly source?: string;

  /**
  * The time stamp of the event, per RFC3339. If no time stamp is provided, the time stamp of the PutEvents call is
  * used.
  *
  * @default none
  */
  readonly time?: string;
}

/**
 * The EventBridge integration resource for HTTP API
 */
export class EventBridgeIntegration extends AwsServiceIntegration {
  constructor(private readonly props: EventBridgeIntegrationProps) {
    super();
  }

  public bind(options: HttpRouteIntegrationBindOptions): HttpRouteIntegrationConfig {
    switch (this.props.targetAction) {
      case EventBridgeTargetAction.PUT_EVENTS:
        this.integrationSubtype = AwsServiceIntegrationSubtype.EVENT_BRIDGE_PUT_EVENTS;
        break;
      default:
        this.integrationSubtype = AwsServiceIntegrationSubtype.EVENT_BRIDGE_PUT_EVENTS;
    }

    const { scope } = options;

    const role = new Role(scope, 'EventBridgeIntegrationRole', {
      description: 'Role for API Gateway to publish Events',
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
    });

    role.addToPolicy(new PolicyStatement({
      actions: ['events:PutEvents'],
      resources: [this.props.eventBus.eventBusArn],
      conditions: (() => !('eventSource' in this.props) ? undefined : {
        StringEquals: {
          'events:source': this.props.eventSource,
        },
      })(),
    }));

    return {
      payloadFormatVersion: this.payloadFormatVersion,
      type: this.integrationType,
      connectionType: this.connectionType,
      credentialsArn: role.roleArn,
      integrationSubtype: this.integrationSubtype,
      requestParameters: {
        ...this.props.requestParameters,
        eventBusName: this.props.eventBus.eventBusName,
      },
    };
  }
}
