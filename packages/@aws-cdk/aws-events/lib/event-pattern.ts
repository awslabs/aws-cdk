/**
 * Events in Amazon CloudWatch Events are represented as JSON objects. For more
 * information about JSON objects, see RFC 7159.
 *
 * Rules use event patterns to select events and route them to targets. A
 * pattern either matches an event or it doesn't. Event patterns are represented
 * as JSON objects with a structure that is similar to that of events, for
 * example:
 *
 * It is important to remember the following about event pattern matching:
 *
 * - For a pattern to match an event, the event must contain all the field names
 *   listed in the pattern. The field names must appear in the event with the
 *   same nesting structure.
 *
 * - Other fields of the event not mentioned in the pattern are ignored;
 *   effectively, there is a ``"*": "*"`` wildcard for fields not mentioned.
 *
 * - The matching is exact (character-by-character), without case-folding or any
 *   other string normalization.
 *
 * - The values being matched follow JSON rules: Strings enclosed in quotes,
 *   numbers, and the unquoted keywords true, false, and null.
 *
 * - Number matching is at the string representation level. For example, 300,
 *   300.0, and 3.0e2 are not considered equal.
 *
 * @see https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/CloudWatchEventsandEventPatterns.html
 */
export interface EventPattern {
  /**
   * By default, this is set to 0 (zero) in all events.
   *
   * @default - No filtering on version
   */
  readonly version?: any[];

  /**
   * A unique value is generated for every event. This can be helpful in
   * tracing events as they move through rules to targets, and are processed.
   *
   * @default - No filtering on id
   */
  readonly id?: any[];

  /**
   * Identifies, in combination with the source field, the fields and values
   * that appear in the detail field.
   *
   * Represents the "detail-type" event field.
   *
   * @default - No filtering on detail type
   */
  readonly detailType?: any[];

  /**
   * Identifies the service that sourced the event. All events sourced from
   * within AWS begin with "aws." Customer-generated events can have any value
   * here, as long as it doesn't begin with "aws." We recommend the use of
   * Java package-name style reverse domain-name strings.
   *
   * To find the correct value for source for an AWS service, see the table in
   * AWS Service Namespaces. For example, the source value for Amazon
   * CloudFront is aws.cloudfront.
   *
   * @see http://docs.aws.amazon.com/general/latest/gr/aws-arns-and-namespaces.html#genref-aws-service-namespaces
   * @default - No filtering on source
   */
  readonly source?: any[];

  /**
   * The 12-digit number identifying an AWS account.
   *
   * @default - No filtering on account
   */
  readonly account?: any[];

  /**
   * The event timestamp, which can be specified by the service originating
   * the event. If the event spans a time interval, the service might choose
   * to report the start time, so this value can be noticeably before the time
   * the event is actually received.
   *
   * @default - No filtering on time
   */
  readonly time?: any[];

  /**
   * Identifies the AWS region where the event originated.
   *
   * @default - No filtering on region
   */
  readonly region?: any[];

  /**
   * This JSON array contains ARNs that identify resources that are involved
   * in the event. Inclusion of these ARNs is at the discretion of the
   * service.
   *
   * For example, Amazon EC2 instance state-changes include Amazon EC2
   * instance ARNs, Auto Scaling events include ARNs for both instances and
   * Auto Scaling groups, but API calls with AWS CloudTrail do not include
   * resource ARNs.
   *
   * @default - No filtering on resource
   */
  readonly resources?: any[];

  /**
   * A JSON object, whose content is at the discretion of the service
   * originating the event.
   *
   * @default - No filtering on detail
   */
  readonly detail?: {[key: string]: any};
}
